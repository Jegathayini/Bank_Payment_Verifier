const express = require('express');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const db = require('./database');
const { verifyPayment } = require('./verifier');

const app = express();
const PORT = 3000;

const ADMIN_EMAIL = 'admin@payguard.com';

// Nodemailer Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-system-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Helper function to safely attempt sending emails
async function sendNotificationEmail(to, subject, text, html) {
  try {
    if (!process.env.EMAIL_USER) {
      console.log(`\n--- [EMAIL SIMULATION] ---`);
      console.log(`To: ${to}\nSubject: ${subject}\nBody: ${text}`);
      console.log(`--------------------------\n`);
      return;
    }
    await transporter.sendMail({
      from: `"PayGuard Admin" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    console.error('Failed to send email notification:', error.message);
  }
}

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configure File Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- AUTHENTICATION & APPROVAL ROUTES ---

// Team Member Signup (Allows re-signup if previously REJECTED)
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (existingUser) {
      if (existingUser.status === 'APPROVED') {
        return res.status(400).json({ error: 'Email already registered and approved.' });
      }
      if (existingUser.status === 'PENDING_APPROVAL') {
        return res.status(400).json({ error: 'Your signup request is already pending admin approval.' });
      }

      // Re-signup for rejected accounts
      db.prepare("UPDATE users SET name = ?, password = ?, status = 'PENDING_APPROVAL' WHERE email = ?")
        .run(name, password, email);
    } else {
      // New user insertion
      const stmt = db.prepare("INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, 'TEAM', 'PENDING_APPROVAL')");
      stmt.run(name, email, password);
    }

    await sendNotificationEmail(
      ADMIN_EMAIL,
      'New Team Member Signup Request',
      `User ${name} (${email}) has requested access to PayGuard. Please review in the Admin Portal.`,
      `<h3>New Signup Request</h3><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p>Log into your Admin Portal to approve or reject this user.</p>`
    );

    res.json({
      success: true,
      message: 'Registration submitted! Your account is pending admin approval.'
    });
  } catch (err) {
    console.error('Signup SQL Error:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Team Member Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT id, name, email, role, status FROM users WHERE email = ? AND password = ?').get(email, password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.status === 'PENDING_APPROVAL') {
    return res.status(403).json({ error: 'Your account is pending admin approval. Please check back later.' });
  }

  if (user.status === 'REJECTED') {
    return res.status(403).json({ error: 'Your registration request was rejected by admin. Please click "Contact Admin" on the main page to submit a request.' });
  }

  res.json({ success: true, user });
});

// Admin Login
app.post('/api/auth/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, role: 'ADMIN' });
  } else {
    res.status(401).json({ error: 'Invalid admin credentials.' });
  }
});

// --- ADMIN APPROVAL & USER MANAGEMENT ---

app.get('/api/admin/pending-users', (req, res) => {
  const pending = db.prepare("SELECT id, name, email, status, created_at FROM users WHERE status = 'PENDING_APPROVAL' ORDER BY id DESC").all();
  res.json(pending);
});

app.post('/api/admin/user-action', async (req, res) => {
  const { userId, action } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(action, userId);

  if (action === 'REJECTED') {
    await sendNotificationEmail(
      user.email,
      'PayGuard Account Registration Status',
      `Hello ${user.name},\n\nYour sign-up request for PayGuard has been rejected. Please contact the administrator via the Contact page if you believe this is an error.\n\nThank you.`,
      `<h3>Registration Status Update</h3><p>Hello ${user.name},</p><p>Your sign-up request for <strong>PayGuard</strong> has been rejected by the administrator.</p><p>If you believe this is an error, please visit the home page and click <strong>Contact Admin</strong> to submit a request.</p>`
    );
  } else if (action === 'APPROVED') {
    await sendNotificationEmail(
      user.email,
      'PayGuard Account Approved!',
      `Hello ${user.name},\n\nYour account has been approved! You can now log into PayGuard.`,
      `<h3>Welcome to PayGuard!</h3><p>Hello ${user.name},</p><p>Your account has been approved. You can now access team verification features.</p>`
    );
  }

  res.json({ success: true, message: `User ${user.email} marked as ${action}.` });
});

// --- CONTACT & FEEDBACK ENDPOINTS ---

app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  db.prepare('INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)').run(name, email, message);
  res.json({ success: true, message: 'Your message has been sent to the admin!' });
});

app.get('/api/admin/feedback', (req, res) => {
  const messages = db.prepare('SELECT * FROM feedback ORDER BY id DESC').all();
  res.json(messages);
});

// --- VERIFICATION & AUDIT ROUTES ---

app.get('/api/orders', (req, res) => res.json(db.prepare('SELECT * FROM orders').all()));
app.get('/api/bank-sms', (req, res) => res.json(db.prepare('SELECT * FROM bank_sms ORDER BY sms_id DESC').all()));
app.get('/api/submissions', (req, res) => res.json(db.prepare('SELECT * FROM submissions ORDER BY submission_id DESC').all()));

app.post('/api/verify', upload.single('paymentSlip'), async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Please upload a payment slip image.' });

    const result = await verifyPayment(orderId, req.file.path);
    
    const stmt = db.prepare(`
      INSERT INTO submissions (
        order_id, image_path, image_hash, extracted_text, 
        extracted_amount, extracted_ref_no, decision, decision_reason, customer_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Guarded execution against undefined fields
    stmt.run(
      orderId || null,
      req.file.path || null,
      result.imageHash || null,
      result.extractedText || null,
      result.extractedAmount || null,
      result.extractedRefNo || null,
      result.decision || 'REJECTED',
      result.decisionReason || 'Verification failed',
      result.customerMessage || ''
    );

    res.json(result);
  } catch (error) {
    console.error('Verification Route Error:', error);
    res.status(500).json({ error: 'Internal server error during verification.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`PayGuard Server running at http://localhost:${PORT}`);
});