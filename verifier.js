const crypto = require('crypto');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const db = require('./database');

function computeImageHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

async function verifyPayment(orderId, filePath) {
  const imageHash = computeImageHash(filePath);

  // 1. Duplicate Image Check
  const duplicateImage = db.prepare('SELECT * FROM submissions WHERE image_hash = ?').get(imageHash);
  if (duplicateImage) {
    return saveAndReturn(orderId, filePath, imageHash, null, null, null, 'REJECTED', 
      'Duplicate image submitted. This slip has already been processed previously.',
      'This payment slip has already been submitted for another request. Please upload a valid slip.'
    );
  }

  // 2. Fetch Order
  const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
  if (!order) {
    return saveAndReturn(orderId, filePath, imageHash, null, null, null, 'REJECTED',
      `Order ${orderId} does not exist in the database.`,
      'Invalid order referenced. Please check your order details.'
    );
  }

  // 3. Perform OCR
  let ocrText = '';
  try {
    const ocrResult = await Tesseract.recognize(filePath, 'eng');
    ocrText = ocrResult.data.text || '';
  } catch (err) {
    return saveAndReturn(orderId, filePath, imageHash, null, null, null, 'NEEDS VERIFICATION',
      'OCR processing failed. Image might be corrupt or unreadable.',
      'We could not clearly read your payment slip. Please send a clearer image of the complete slip.'
    );
  }

  // Check low readability
  if (!ocrText || ocrText.trim().length < 15) {
    return saveAndReturn(orderId, filePath, imageHash, ocrText, null, null, 'NEEDS VERIFICATION',
      'Extracted text is too short or image is low quality/blurry.',
      'We couldn\'t clearly read the payment slip. Please send a clearer, higher resolution photo.'
    );
  }

  // --- 4. ROBUST EXTRACTION LOGIC ---

  // Clean OCR text: remove parenthesized content and long barcode numbers (8+ digits)
  const normalizedText = ocrText
    .replace(/\([^\)]*\)/g, '')   
    .replace(/\b\d{8,}\b/g, '');  

  let extractedAmount = null;

  // Regex targeting standard currency numbers (e.g., 1500, 1500.00, 1,500.50)
  const numberRegex = /\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b|\b\d{1,6}(?:\.\d{1,2})?\b/g;
  
  // Prioritize scanning lines with explicit keywords
  const keywordLines = normalizedText.split('\n').filter(line => 
    /total|paid|lkr|rs|amount|grand/i.test(line)
  );

  let searchSource = keywordLines.length > 0 ? keywordLines.join(' ') : normalizedText;
  let matches = searchSource.match(numberRegex);

  if (!matches) {
    matches = normalizedText.match(numberRegex);
  }

  if (matches) {
    const parsedAmounts = matches
      .map(numStr => parseFloat(numStr.replace(/,/g, '')))
      .filter(amt => !isNaN(amt) && amt > 0 && amt < 1000000);

    if (parsedAmounts.length > 0) {
      // Prioritize exact match with the order total if present in the OCR list
      const expectedAmount = order.amount || order.expected_amount || 0;
      const exactMatch = parsedAmounts.find(amt => Math.abs(amt - expectedAmount) < 0.01);

      if (exactMatch !== undefined) {
        extractedAmount = exactMatch;
      } else {
        // Fallback to the largest extracted monetary value
        extractedAmount = Math.max(...parsedAmounts);
      }
    }
  }

  // Extract Reference / PNR / Transaction ID
  let extractedRefNo = null;
  const refMatch = ocrText.match(/(?:PNR|Txn\s*ID|Transaction\s*ID|Reference\s*No|Ref\s*No|Ref|Payment\s*ID|License)[\s#:]*([A-Za-z0-9\-_]{5,15})/i);
  if (refMatch) {
    extractedRefNo = refMatch[1];
  }

  // --- END EXTRACTION LOGIC ---

  // 5. Reused Reference Number Check
  if (extractedRefNo) {
    const reusedRef = db.prepare("SELECT * FROM submissions WHERE extracted_ref_no = ? AND decision = 'APPROVED'").get(extractedRefNo);
    if (reusedRef) {
      return saveAndReturn(orderId, filePath, imageHash, ocrText, extractedAmount, extractedRefNo, 'REJECTED',
        `Transaction reference #${extractedRefNo} has already been approved for another order.`,
        'This transaction reference has already been used. Please provide a new payment slip.'
      );
    }
  }

  // 6. Amount Validation
  if (extractedAmount === null) {
    return saveAndReturn(orderId, filePath, imageHash, ocrText, extractedAmount, extractedRefNo, 'NEEDS VERIFICATION',
      'Could not detect or parse a clear payment amount from the payment slip.',
      'We could not clearly read the payment amount on your slip. Please upload a clearer image.'
    );
  }

  // Mismatched Amount Check
  const expectedAmount = order.amount || order.expected_amount || 0;
  if (Math.abs(extractedAmount - expectedAmount) > 0.01) {
    return saveAndReturn(orderId, filePath, imageHash, ocrText, extractedAmount, extractedRefNo, 'REJECTED',
      `Payment amount mismatch. Order expects LKR ${expectedAmount.toFixed(2)}, but slip shows LKR ${extractedAmount.toFixed(2)}.`,
      `The payment amount on your slip (LKR ${extractedAmount}) does not match your order total (LKR ${expectedAmount}). Please verify and re-submit.`
    );
  }

  // 7. Match Bank SMS
  let bankSmsMatch = null;
  if (extractedRefNo) {
    bankSmsMatch = db.prepare('SELECT * FROM bank_sms WHERE (ref_no = ? OR reference_number = ?) AND (is_matched = 0 OR is_matched IS NULL)').get(extractedRefNo, extractedRefNo);
  } else {
    bankSmsMatch = db.prepare('SELECT * FROM bank_sms WHERE amount = ? AND (is_matched = 0 OR is_matched IS NULL)').get(extractedAmount);
  }

  if (bankSmsMatch) {
    db.prepare('UPDATE bank_sms SET is_matched = 1 WHERE sms_id = ?').run(bankSmsMatch.sms_id);
    db.prepare('UPDATE orders SET status = "PAID" WHERE order_id = ?').run(orderId);

    return saveAndReturn(orderId, filePath, imageHash, ocrText, extractedAmount, extractedRefNo, 'APPROVED',
      `Sufficient evidence found: Amount (LKR ${extractedAmount}) matches order and bank SMS confirmation verified.`,
      `Thank you! Your payment of LKR ${extractedAmount} has been successfully verified and accepted.`
    );
  } else {
    return saveAndReturn(orderId, filePath, imageHash, ocrText, extractedAmount, extractedRefNo, 'NEEDS VERIFICATION',
      `Payment slip details match expected order amount (LKR ${extractedAmount}), but no matching bank SMS notification has been received yet.`,
      `Your payment slip showing LKR ${extractedAmount} was received! We are waiting for bank confirmation and will update you shortly.`
    );
  }
}

// Helper to save submission record into SQLite database
function saveAndReturn(orderId, imagePath, imageHash, extractedText, extractedAmount, extractedRefNo, decision, decisionReason, customerMessage) {
  try {
    db.prepare(`
      INSERT INTO submissions (order_id, image_path, image_hash, extracted_text, extracted_amount, extracted_ref_no, decision, decision_reason, customer_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, imagePath, imageHash, extractedText, extractedAmount, extractedRefNo, decision, decisionReason, customerMessage);
  } catch (e) {
    console.error('Failed to log submission to DB:', e);
  }

  return {
    decision,
    decisionReason,
    customerMessage,
    imageHash,
    extractedText,
    extractedAmount,
    extractedRefNo
  };
}

module.exports = { verifyPayment };