const Database = require('better-sqlite3');
const db = new Database('payguard.db');

// Enable Foreign Keys
db.pragma('foreign_keys = ON');

// 1. Users Table (with approval status)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'TEAM',
    status TEXT DEFAULT 'PENDING_APPROVAL',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 2. Orders Table
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    customer_name TEXT,
    expected_amount REAL,
    status TEXT DEFAULT 'PENDING'
  )
`);

// 3. Bank SMS Table
db.exec(`
  CREATE TABLE IF NOT EXISTS bank_sms (
    sms_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_no TEXT UNIQUE,
    amount REAL,
    sender TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 4. Submissions Table
db.exec(`
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
  )
`);

// 5. Contact & Feedback Table
db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    message TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;