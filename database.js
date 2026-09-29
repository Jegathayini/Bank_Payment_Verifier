const Database = require('better-sqlite3');
const db = new Database('payguard.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create Users Table
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
`);

// Create Feedback Table
db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;