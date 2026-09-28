const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('./database');
const { verifyPayment } = require('./verifier');

const app = express();
const PORT = 3000;

// Configure file storage using Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Endpoint 1: Fetch Orders for Dropdown
app.get('/api/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders').all();
  res.json(orders);
});

// Endpoint 2: Fetch Bank SMS Records
app.get('/api/bank-sms', (req, res) => {
  const smsList = db.prepare('SELECT * FROM bank_sms ORDER BY sms_id DESC').all();
  res.json(smsList);
});

// Endpoint 3: Fetch Submissions for Admin Dashboard
app.get('/api/submissions', (req, res) => {
  const submissions = db.prepare('SELECT * FROM submissions ORDER BY submission_id DESC').all();
  res.json(submissions);
});

// Endpoint 4: Verify Submitted Payment Slip
app.post('/api/verify', upload.single('paymentSlip'), async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a payment slip image.' });
    }

    const filePath = req.file.path;

    // Run core verifier rules
    const result = await verifyPayment(orderId, filePath);

    // Save submission attempt into audit trail
    const stmt = db.prepare(`
      INSERT INTO submissions (
        order_id, image_path, image_hash, extracted_text, 
        extracted_amount, extracted_ref_no, decision, decision_reason, customer_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      orderId,
      filePath,
      result.imageHash || null,
      result.extractedText || null,
      result.extractedAmount || null,
      result.extractedRefNo || null,
      result.decision,
      result.decisionReason,
      result.customerMessage
    );

    res.json(result);
  } catch (error) {
    console.error('Verification Error:', error);
    res.status(500).json({ error: 'Internal server error during verification.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});