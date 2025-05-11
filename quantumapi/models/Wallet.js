const db = require('../database');
const { generateTRC20Address } = require('../utils/WalletUtils');

class Wallet {
  static createTable() {
    return db.prepare(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER UNIQUE NOT NULL,
        balance REAL DEFAULT 0,
        pendingBalance REAL DEFAULT 0,
        trc20_address TEXT,
        encrypted_private_key TEXT,
        pin TEXT NULL,
        pin_attempts INTEGER DEFAULT 0,
        pin_locked_until TEXT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `).run();
  }

  static findByUserId(userId) {
    return db.prepare('SELECT * FROM wallets WHERE userId = ?').get(userId);
  }
  
  static async createForUser(userId) {
    if (!userId || isNaN(userId)) {
      throw new Error('Cannot create wallet: Invalid userId');
    }
  
    // Generate TRC20 address
    const walletData = await generateTRC20Address(userId);
  
    // Insert wallet into the database
    const stmt = db.prepare(`
      INSERT INTO wallets (userId, trc20_address, encrypted_private_key) 
      VALUES (?, ?, ?)
    `);
    console.log(`Wallet created for user ${userId}:`, walletData);
    stmt.run(userId, walletData.address, walletData.encryptedPrivateKey);
  
    return this.findByUserId(userId);
  }
  
  static updateBalance(userId, balance, pendingBalance) {
    const stmt = db.prepare(`
      UPDATE wallets 
      SET balance = ?, pendingBalance = ?, updatedAt = CURRENT_TIMESTAMP 
      WHERE userId = ?
    `);
    return stmt.run(balance, pendingBalance, userId);
  }

  static updatePin(userId, hashedPin) {
    const stmt = db.prepare(`
      UPDATE wallets 
      SET pin = ?, pin_attempts = 0, updatedAt = CURRENT_TIMESTAMP 
      WHERE userId = ?
    `);
    return stmt.run(hashedPin, userId);
  }

  static incrementPinAttempt(userId) {
    const stmt = db.prepare(`
      UPDATE wallets 
      SET pin_attempts = pin_attempts + 1, updatedAt = CURRENT_TIMESTAMP 
      WHERE userId = ?
    `);
    return stmt.run(userId);
  }

  static resetPinAttempts(userId) {
    const stmt = db.prepare(`
      UPDATE wallets 
      SET pin_attempts = 0, pin_locked_until = NULL, updatedAt = CURRENT_TIMESTAMP 
      WHERE userId = ?
    `);
    return stmt.run(userId);
  }

  static lockPinFor(userId, minutes) {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + minutes);
    
    const stmt = db.prepare(`
      UPDATE wallets 
      SET pin_locked_until = ?, updatedAt = CURRENT_TIMESTAMP 
      WHERE userId = ?
    `);
    return stmt.run(lockUntil.toISOString(), userId);
  }

  static findAll() {
    return db.prepare('SELECT * FROM wallets').all();
  }
}


module.exports = Wallet;