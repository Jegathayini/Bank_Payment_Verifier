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

  // Check low readability
  if (!ocrText || ocrText.trim().length < 15) {
    return {
      decision: 'NEEDS VERIFICATION',
      decisionReason: 'Extracted text is too short or image is low quality/blurry.',
      customerMessage: 'We couldn\'t clearly read the payment slip. Please send a clearer, higher resolution photo.',
      imageHash,
      extractedText: ocrText
    };
  }

  // Extract amount and reference number
  const amountMatch = ocrText.match(/(?:Rs\.?|USD|\$)?\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i);
  const refMatch = ocrText.match(/(?:Ref|Txn|Reference|ID)[\s#:]*([A-Za-z0-9]+)/i);

  const extractedAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
  const extractedRefNo = refMatch ? refMatch[1] : null;

  // 4. Reused Reference Number Check
  if (extractedRefNo) {
    const reusedRef = db.prepare('SELECT * FROM submissions WHERE extracted_ref_no = ? AND decision = "APPROVED"').get(extractedRefNo);
    if (reusedRef) {
      return {
        decision: 'REJECTED',
        decisionReason: `Transaction reference #${extractedRefNo} has already been approved for another order.`,
        customerMessage: 'This transaction reference has already been used. Please provide a new payment slip.',
        imageHash, extractedText: ocrText, extractedAmount, extractedRefNo
      };
    }
  }

  // 5. Amount Validation
  if (extractedAmount && Math.abs(extractedAmount - order.expected_amount) > 0.01) {
    return {
      decision: 'REJECTED',
      decisionReason: `Payment amount mismatch. Order expects ${order.expected_amount}, but slip shows ${extractedAmount}.`,
      customerMessage: 'The payment amount on your slip does not match your order total. Please verify and re-submit.',
      imageHash, extractedText: ocrText, extractedAmount, extractedRefNo
    };
  }

  // 6. Match Bank SMS
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