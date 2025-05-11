const Database = require('better-sqlite3');
const path = require('path');

// Initialize the database
const db = new Database(path.join(__dirname, 'quantumfx.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

module.exports = db;