const Database = require('better-sqlite3');
const db = new Database('payguard.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    customer_name TEXT,
    expected_amount REAL,
    status TEXT DEFAULT 'PENDING'
  );

  CREATE TABLE IF NOT EXISTS bank_sms (
    sms_id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_text TEXT,
    extracted_amount REAL,
    reference_number TEXT UNIQUE,
    is_matched INTEGER DEFAULT 0
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

// Seed initial test data if empty
const orderCount = db.prepare('SELECT count(*) as count FROM orders').get();
if (orderCount.count === 0) {
  const insertOrder = db.prepare('INSERT INTO orders (order_id, customer_name, expected_amount) VALUES (?, ?, ?)');
  insertOrder.run('ORD-101', 'Alice', 25000.00);
  insertOrder.run('ORD-102', 'Bob', 1500.00);

  const insertSMS = db.prepare('INSERT INTO bank_sms (raw_text, extracted_amount, reference_number) VALUES (?, ?, ?)');
  insertSMS.run('Rs. 25,000 credited to A/C XXXX1234. Ref 839201.', 25000.00, '839201');
}

module.exports = db;