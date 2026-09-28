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
    return {
      decision: 'REJECTED',
      decisionReason: 'Duplicate image submitted. This slip has already been processed previously.',
      customerMessage: 'This payment slip has already been submitted for another request. Please upload a valid slip.',
      imageHash
    };
  }

  // 2. Fetch Order
  const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
  if (!order) {
    return {
      decision: 'REJECTED',
      decisionReason: `Order ${orderId} does not exist in the database.`,
      customerMessage: 'Invalid order referenced. Please check your order details.',
      imageHash
    };
  }

  // 3. Perform OCR
  let ocrText = '';
  try {
    const ocrResult = await Tesseract.recognize(filePath, 'eng');
    ocrText = ocrResult.data.text;
  } catch (err) {
    return {
      decision: 'NEEDS VERIFICATION',
      decisionReason: 'OCR processing failed. Image might be corrupt or unreadable.',
      customerMessage: 'We could not clearly read your payment slip. Please send a clearer image of the complete slip.',
      imageHash
    };
  }

  // Check low readability (Kept as is)
  if (!ocrText || ocrText.trim().length < 15) {
    return {
      decision: 'NEEDS VERIFICATION',
      decisionReason: 'Extracted text is too short or image is low quality/blurry.',
      customerMessage: 'We couldn\'t clearly read the payment slip. Please send a clearer, higher resolution photo.',
      imageHash,
      extractedText: ocrText
    };
  }

  // --- 4. IMPROVED EXTRACTION LOGIC ---

  // Extract Amount: Search explicitly for Grand Total, Total, or decimal monetary values
  let extractedAmount = null;
  const totalMatch = ocrText.match(/(?:Grand\s*Total|Total\b)[^\n\r]*?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i);

  if (totalMatch) {
    extractedAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
  } else {
    // Fallback: collect all currency decimal numbers (e.g., 9968.00) and grab the largest one
    const decimalMatches = [...ocrText.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2}|[0-9]{3,6}\.[0-9]{2})\b/g)];
    if (decimalMatches.length > 0) {
      const amounts = decimalMatches.map(m => parseFloat(m[1].replace(/,/g, '')));
      extractedAmount = Math.max(...amounts);
    }
  }

  // Extract Reference / PNR / Transaction ID
  let extractedRefNo = null;
  const refMatch = ocrText.match(/(?:PNR|Txn\s*ID|Transaction\s*ID|Reference\s*No|Ref\s*No|Payment\s*ID)[\s#:]*([A-Za-z0-9]{5,12})/i);
  if (refMatch) {
    extractedRefNo = refMatch[1];
  }

  // --- END EXTRACTION LOGIC ---

  // 5. Reused Reference Number Check
  if (extractedRefNo) {
    const reusedRef = db.prepare("SELECT * FROM submissions WHERE extracted_ref_no = ? AND decision = 'APPROVED'").get(extractedRefNo);
    if (reusedRef) {
      return {
        decision: 'REJECTED',
        decisionReason: `Transaction reference #${extractedRefNo} has already been approved for another order.`,
        customerMessage: 'This transaction reference has already been used. Please provide a new payment slip.',
        imageHash, extractedText: ocrText, extractedAmount, extractedRefNo
      };
    }
  }

  // 6. Amount Validation
  if (extractedAmount && Math.abs(extractedAmount - order.expected_amount) > 0.01) {
    return {
      decision: 'REJECTED',
      decisionReason: `Payment amount mismatch. Order expects ${order.expected_amount}, but slip shows ${extractedAmount}.`,
      customerMessage: 'The payment amount on your slip does not match your order total. Please verify and re-submit.',
      imageHash, extractedText: ocrText, extractedAmount, extractedRefNo
    };
  }

  // 7. Match Bank SMS
  let bankSmsMatch = null;
  if (extractedRefNo) {
    bankSmsMatch = db.prepare('SELECT * FROM bank_sms WHERE reference_number = ? AND is_matched = 0').get(extractedRefNo);
  }

  if (bankSmsMatch) {
    db.prepare('UPDATE bank_sms SET is_matched = 1 WHERE sms_id = ?').run(bankSmsMatch.sms_id);
    db.prepare('UPDATE orders SET status = "PAID" WHERE order_id = ?').run(orderId);

    return {
      decision: 'APPROVED',
      decisionReason: 'Sufficient evidence found: Amount matches and bank SMS confirmation verified.',
      customerMessage: 'Thank you! Your payment has been successfully verified and accepted.',
      imageHash, extractedText: ocrText, extractedAmount, extractedRefNo
    };
  } else {
    return {
      decision: 'NEEDS VERIFICATION',
      decisionReason: 'Payment slip details match expected order amount, but no matching bank SMS notification has been received yet.',
      customerMessage: 'Your payment slip was received! We are waiting for bank confirmation and will update you shortly.',
      imageHash, extractedText: ocrText, extractedAmount, extractedRefNo
    };
  }
}

module.exports = { verifyPayment };