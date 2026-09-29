const Database = require('better-sqlite3');
const db = new Database('payguard.db');

// Enable WAL mode for performance
db.pragma('journal_mode = WAL');

// 1. Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'TEAM',
    status TEXT DEFAULT 'PENDING_APPROVAL',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    customer_name TEXT,
    amount REAL,
    status TEXT DEFAULT 'PENDING'
  );

  CREATE TABLE IF NOT EXISTS bank_sms (
    sms_id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    message_body TEXT,
    amount REAL,
    ref_no TEXT,
    reference_number TEXT,
    is_matched INTEGER DEFAULT 0,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS submissions (
    submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT,
    image_path TEXT,
    image_hash TEXT,
    extracted_text TEXT,
    extracted_amount REAL,
    extracted_ref_no TEXT,
    decision TEXT,
    decision_reason TEXT,
    customer_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 2. Seed Default Orders and Bank SMS Data if empty
const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;

if (orderCount === 0) {
  console.log('Seeding initial orders and bank SMS records...');

  // Seed sample pending orders
  const insertOrder = db.prepare('INSERT INTO orders (order_id, customer_name, amount) VALUES (?, ?, ?)');
  insertOrder.run('ORD001', 'John Doe', 1500.00);
  insertOrder.run('ORD002', 'Jane Smith', 2500.50);
  insertOrder.run('ORD003', 'Thayini', 5000.00);

  // Seed matching sample bank SMS notifications
  const insertSms = db.prepare('INSERT INTO bank_sms (sender, message_body, amount, ref_no, reference_number) VALUES (?, ?, ?, ?, ?)');
  insertSms.run('COMBANK', 'Deposit of LKR 1500.00 received for Ref: REF1001', 1500.00, 'REF1001', 'REF1001');
  insertSms.run('BOC', 'Credit alert LKR 2500.50 Txn Ref: REF1002', 2500.50, 'REF1002', 'REF1002');
  insertSms.run('HNB', 'Received LKR 5000.00 Ref No: REF1003', 5000.00, 'REF1003', 'REF1003');
}

module.exports = db;