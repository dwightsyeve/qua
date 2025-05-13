const db = require('../database');

class Transaction {
  /**
   * Create the transactions table if it doesn't exist
   */
  static createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('Deposit', 'Withdrawal', 'Profit', 'Referral Bonus', 'Admin Adjustment', 'Fee', 'investment', 'admin_adjustment', 'withdrawal')),
        amount REAL NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Pending', 'Completed', 'Failed', 'Rejected', 'Processing', 'pending', 'completed', 'failed', 'rejected', 'processing')),
        txHash TEXT,
        details TEXT,
        notes TEXT,
        createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        completedAt TEXT,
        updatedAt TEXT DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `;
    db.exec(query);
    console.log("Transactions table schema checked/created.");
  }
  
  static #addColumnIfNotExists(columnName, columnDefinition) {
    try {
      const columns = db.pragma(`table_info(transactions)`);
      const columnExists = columns.some(col => col.name === columnName);
      if (!columnExists) {
        db.exec(`ALTER TABLE transactions ADD COLUMN ${columnName} ${columnDefinition};`);
        console.log(`Successfully added '${columnName}' column to transactions table.`);
      } else {
        // console.log(`'${columnName}' column already exists in transactions table.`);
      }
    } catch (error) {
      console.error(`Error checking/adding '${columnName}' column to transactions table:`, error);
    }
  }

  static ensureSchema() {
    this.createTable(); // Ensure table exists
    this.#addColumnIfNotExists('notes', 'TEXT');
    this.#addColumnIfNotExists('txHash', 'TEXT');
    this.#addColumnIfNotExists('updatedAt', 'TEXT DEFAULT (STRFTIME(\'%Y-%m-%d %H:%M:%S\', \'NOW\'))');
    // Add other columns here if needed in the future, e.g., completedAt
    this.#addColumnIfNotExists('completedAt', 'TEXT');
     // Verify CHECK constraints for type and status if they were added later
     // This is more complex and might require recreating table or careful PRAGMA checks
  }


  /**
   * Create a new transaction
   * @param {object} transaction - Transaction object
   * @returns {object} Created transaction
   */
  static create(transaction) {
    try {
      const { userId, type, amount, status, details, txHash = null, notes = null } = transaction;
      
      const stmt = db.prepare(`
        INSERT INTO transactions (userId, type, amount, status, details, txHash, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW'), STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW'))
      `);
      
      const result = stmt.run(
        userId,
        type,
        amount,
        status,
        details,
        txHash,
        notes
      );
      
      return {
        id: result.lastInsertRowid,
        userId, type, amount, status, details, txHash, notes
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  static getByUserIdAndType(userId, type) {
    try {
      const query = `
        SELECT * FROM transactions 
        WHERE userId = ? AND LOWER(type) = LOWER(?) 
        ORDER BY createdAt DESC
      `;
      
      return db.prepare(query).all(userId, type);
    } catch (error) {
      console.error(`Error fetching ${type} transactions for user ${userId}:`, error);
      return [];
    }
  }

  /**
 * Get total earnings from referrals for a user
 * @param {number} userId - User ID
 * @returns {number} Total earnings
 */
static getTotalReferralEarnings(userId) {
  try {
      const stmt = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as totalEarnings
          FROM transactions
          WHERE userId = ? 
          AND (LOWER(type) = 'referral' OR LOWER(type) = 'referralcommission' OR LOWER(type) = 'referralreward') 
          AND LOWER(status) = 'completed'
      `);
      
      const result = stmt.get(userId);
      return result.totalEarnings || 0;
  } catch (error) {
      console.error(`Error getting referral earnings for user ${userId}:`, error);
      return 0;
  }
}

  /**
   * Get transaction by ID
   * @param {number} id - Transaction ID
   * @returns {object|null} Transaction object or null if not found
   */
  static getById(id) {
    // console.log(`[Transaction.getById] Fetching transaction with ID: ${id}`); // Already in your logs
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const transaction = stmt.get(id);
    // console.log(`[Transaction.getById] DB returned:`, transaction); // Already in your logs
    return transaction;
  }

  /**
   * Update transaction status, notes, txHash, and completedAt timestamp
   * @param {number} id - Transaction ID
   * @param {string} status - New status (e.g., 'completed', 'rejected', 'failed')
   * @param {string} [notes=null] - Optional admin notes
   * @param {string} [txHash=null] - Optional transaction hash for successful withdrawals
   * @returns {object} Database result
   */
  static updateStatus(id, status, notes = null, txHash = null) {
    // console.log(`[Transaction.updateStatus] Updating TX ID ${id} to status: ${status}`); // Already in your logs
    try {
      const completedAtTimestamp = (status.toLowerCase() === 'completed' || status.toLowerCase() === 'rejected' || status.toLowerCase() === 'failed') 
                                  ? new Date().toISOString().slice(0, 19).replace('T', ' ') 
                                  : null;
      
      const stmt = db.prepare(`
        UPDATE transactions 
        SET status = ?, notes = ?, txHash = ?, completedAt = ?, updatedAt = STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')
        WHERE id = ?
      `);
      const result = stmt.run(status, notes, txHash, completedAtTimestamp, id);
      
      if (result.changes === 0) {
        console.warn(`[Transaction.updateStatus] No transaction found with ID ${id} to update.`);
      } else {
        // console.log(`[Transaction.updateStatus] Successfully updated TX ID ${id}. Changes: ${result.changes}`);
      }
      return result;
    } catch (error) {
      console.error(`Error updating transaction status for ID ${id}:`, error);
      throw error;
    }
  }
  /**
   * Get all transactions by user ID
   * @param {number} userId - User ID
   * @param {number} [limit=10] - Limit number of transactions
   * @param {number} [offset=0] - Offset for pagination
   * @returns {Array} Array of transaction objects
   */
// ...existing code...
  static getByUserIdWithPagination(userId, offset = 0, limit = 10) {
    return db.prepare(`
      SELECT * FROM transactions
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
  }
  
  /**
   * Count all transactions for a user
   * @param {number} userId - User ID
   * @returns {number} Total count
   */
  static countByUserId(userId) {
    return db.prepare('SELECT COUNT(*) as count FROM transactions WHERE userId = ?')
      .get(userId).count;
  }
  
  /**
   * Get transactions by type for a user with pagination
   * @param {number} userId - User ID
   * @param {string} type - Transaction type
   * @param {number} offset - Pagination offset
   * @param {number} limit - Pagination limit
   * @returns {Array} Transactions array
   */
  static getByUserIdAndTypeWithPagination(userId, type, offset = 0, limit = 10) {
    return db.prepare(`
      SELECT * FROM transactions
      WHERE userId = ? AND type = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(userId, type, limit, offset);
  }
  
  /**
   * Count transactions by type for a user
   * @param {number} userId - User ID
   * @param {string} type - Transaction type
   * @returns {number} Count
   */
  static countByUserIdAndType(userId, type) {
    return db.prepare('SELECT COUNT(*) as count FROM transactions WHERE userId = ? AND type = ?')
      .get(userId, type).count;
  }
  
  /**
   * Get transactions by status for a user with pagination
   * @param {number} userId - User ID
   * @param {string} status - Transaction status
   * @param {number} offset - Pagination offset
   * @param {number} limit - Pagination limit
   * @returns {Array} Transactions array
   */
  static getByUserIdAndStatusWithPagination(userId, status, offset = 0, limit = 10) {
    return db.prepare(`
      SELECT * FROM transactions
      WHERE userId = ? AND status = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(userId, status, limit, offset);
  }
  
  /**
   * Count transactions by status for a user
   * @param {number} userId - User ID
   * @param {string} status - Transaction status
   * @returns {number} Count
   */
  static countByUserIdAndStatus(userId, status) {
    return db.prepare('SELECT COUNT(*) as count FROM transactions WHERE userId = ? AND status = ?')
      .get(userId, status).count;
  }
  
  /**
   * Get transactions by type and status for a user with pagination
   * @param {number} userId - User ID
   * @param {string} type - Transaction type
   * @param {string} status - Transaction status
   * @param {number} offset - Pagination offset
   * @param {number} limit - Pagination limit
   * @returns {Array} Transactions array
   */
  static getByUserIdTypeAndStatusWithPagination(userId, type, status, offset = 0, limit = 10) {
    return db.prepare(`
      SELECT * FROM transactions
      WHERE userId = ? AND type = ? AND status = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(userId, type, status, limit, offset);
  }
  
  /**
   * Count transactions by type and status for a user
   * @param {number} userId - User ID
   * @param {string} type - Transaction type
   * @param {string} status - Transaction status
   * @returns {number} Count
   */
  static countByUserIdTypeAndStatus(userId, type, status) {
    return db.prepare('SELECT COUNT(*) as count FROM transactions WHERE userId = ? AND type = ? AND status = ?')
      .get(userId, type, status).count;
  }
  
  /**
   * Get transactions since a specific date for a user
   * @param {number} userId - User ID
   * @param {string} since - ISO date string
   * @returns {Array} Transactions array
   */
  static getByUserIdSince(userId, since) {
    return db.prepare(`
      SELECT * FROM transactions
      WHERE userId = ? AND createdAt >= ?
      ORDER BY createdAt ASC
    `).all(userId, since);
  }
  
  /**
   * Get total amount for a transaction type and user
   * @param {string} type - Transaction type
   * @param {number} userId - User ID
   * @param {string} status - Optional status filter
   * @returns {number} Total amount
   */
  static getTotalAmountByTypeAndUserId(type, userId, status = null) {
    let query = `
      SELECT SUM(amount) as total
      FROM transactions
      WHERE userId = ? AND type = ?
    `;
    
    if (status) {
      query += ' AND status = ?';
      return db.prepare(query).get(userId, type, status).total || 0;
    }
    
    return db.prepare(query).get(userId, type).total || 0;
  }
  
  /**
   * Get all pending withdrawal transactions (for admin)
   * @returns {Array} Pending withdrawals
   */
  static getAllPendingWithdrawals() {
    return db.prepare(`
      SELECT * FROM transactions
      WHERE type = 'Withdrawal' AND status = 'Pending'
      ORDER BY createdAt ASC
    `).all();
  }
  
  /**
   * Get all pending withdrawals for a user
   * @param {number} userId - User ID
   * @returns {Array} Pending withdrawals
   */
  static getPendingWithdrawalsByUserId(userId) {
    return db.prepare(`
      SELECT * FROM transactions
      WHERE userId = ? AND type = 'Withdrawal' AND status = 'Pending'
      ORDER BY createdAt ASC
    `).all(userId);
  }
  
  /**
   * Get transactions by date range
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @param {string} type - Optional transaction type
   * @param {string} status - Optional transaction status
   * @returns {Array} Transactions
   */
  static getByDateRange(startDate, endDate, type = null, status = null) {
    let query = `
      SELECT * FROM transactions
      WHERE createdAt >= ? AND createdAt <= ?
    `;
    
    const params = [startDate, endDate];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY createdAt DESC';
    
    return db.prepare(query).all(...params);
  }
  
  /**
   * Get recent transactions (for admin dashboard)
   * @param {number} limit - Maximum number to return
   * @returns {Array} Recent transactions
   */
  static getRecent(limit = 5) {
    return db.prepare(`
      SELECT t.*, u.username, u.email
      FROM transactions t
      JOIN users u ON t.userId = u.id
      ORDER BY t.createdAt DESC
      LIMIT ?
    `).all(limit);
  }
  
  /**
   * Get recent transactions for a user
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number to return
   * @returns {Array} Recent transactions
   */
  static getRecentByUserId(userId, limit = 5) {
    return db.prepare(`
      SELECT * FROM transactions
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(userId, limit);
  }
  
  /**
   * Get wallet balance history for a user within a time period
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date|null} endDate - End date (optional)
   * @returns {Array} Wallet balance history
   */
  static getWalletHistoryByPeriod(userId, startDate, endDate = null) {
    const query = `
      SELECT t.*, 
             (SELECT SUM(amount) FROM transactions 
              WHERE userId = t.userId AND createdAt <= t.createdAt AND type IN ('Deposit', 'Profit')) -
             (SELECT SUM(amount) FROM transactions 
              WHERE userId = t.userId AND createdAt <= t.createdAt AND type = 'Withdrawal') AS balanceAfter,
             (SELECT SUM(amount) FROM transactions 
              WHERE userId = t.userId AND createdAt < t.createdAt AND type IN ('Deposit', 'Profit')) -
             (SELECT SUM(amount) FROM transactions 
              WHERE userId = t.userId AND createdAt < t.createdAt AND type = 'Withdrawal') AS balanceBefore
      FROM transactions t
      WHERE t.userId = ? 
        AND t.createdAt >= ?
        ${endDate ? 'AND t.createdAt <= ?' : ''}
      ORDER BY t.createdAt ASC
    `;
    
    const params = [
      userId,
      startDate.toISOString(),
      ...(endDate ? [endDate.toISOString()] : [])
    ];
    
    return db.prepare(query).all(...params);
  }
  
  /**
   * Get total deposits for a user
   * @param {number} userId - User ID
   * @returns {number} Total deposits amount
   */
  static getTotalDeposits(userId) {
    return this.getTotalAmountByTypeAndUserId('Deposit', userId, 'Completed') || 0;
  }
  
  /**
   * Get total withdrawals for a user
   * @param {number} userId - User ID
   * @returns {number} Total withdrawals amount
   */
  static getTotalWithdrawals(userId) {
    return this.getTotalAmountByTypeAndUserId('Withdrawal', userId, 'Completed') || 0;
  }
  
  /**
   * Get total profits for a user
   * @param {number} userId - User ID
   * @returns {number} Total profits amount
   */
  static getTotalProfits(userId) {
    return this.getTotalAmountByTypeAndUserId('Profit', userId, 'Completed') || 0;
  }

  /**
   * Get all transactions of a specific type with optional search, for admin view.
   * Joins with users table to include user email for searching.
   * @param {string} type - Transaction type ('Deposit' or 'Withdrawal')
   * @param {string} searchTerm - Optional search term for userId, userEmail, amount, status
   * @param {number} limit - Pagination limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<{transactions: Array, totalCount: number}>} Transactions array and total count
   */
  static getAllByTypeAndSearch(type, searchTerm = '', limit = 50, offset = 0) {
    let query = `
      SELECT t.*, u.email as userEmail, u.username as userName, u.firstName, u.lastName, u.id as userIdFromUserTable
      FROM transactions t
      JOIN users u ON t.userId = u.id
      WHERE t.type = ?
    `;
    const params = [type];
    let countQuery = `
      SELECT COUNT(t.id) as count
      FROM transactions t
      JOIN users u ON t.userId = u.id
      WHERE t.type = ?
    `;
    const countParams = [type];

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`;
      const numericSearchTerm = isNaN(parseFloat(searchTerm)) ? -9999999999 : parseFloat(searchTerm); // Handle non-numeric search for ID/Amount

      query += ` AND (
        CAST(t.id AS TEXT) LIKE ? OR
        CAST(u.id AS TEXT) LIKE ? OR 
        u.email LIKE ? OR 
        u.username LIKE ? OR
        u.firstName LIKE ? OR
        u.lastName LIKE ? OR
        CAST(t.amount AS TEXT) LIKE ? OR 
        t.status LIKE ? OR
        t.txHash LIKE ? OR
        t.notes LIKE ?
      )`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      
      countQuery += ` AND (
        CAST(t.id AS TEXT) LIKE ? OR
        CAST(u.id AS TEXT) LIKE ? OR 
        u.email LIKE ? OR 
        u.username LIKE ? OR
        u.firstName LIKE ? OR
        u.lastName LIKE ? OR
        CAST(t.amount AS TEXT) LIKE ? OR 
        t.status LIKE ? OR
        t.txHash LIKE ? OR
        t.notes LIKE ?
      )`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY t.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      const transactions = db.prepare(query).all(...params).map(tx => ({
        ...tx,
        user: { 
            id: tx.userIdFromUserTable, 
            email: tx.userEmail, 
            username: tx.userName,
            fullName: `${tx.firstName || ''} ${tx.lastName || ''}`.trim() || tx.userName || 'N/A'
        }
      }));
      const totalResult = db.prepare(countQuery).get(...countParams);
      const totalCount = totalResult ? totalResult.count : 0;
      
      return { transactions, totalCount };
    } catch (error) {
      console.error('Error in getAllByTypeAndSearch:', error);
      throw error;
    }
  }
}

module.exports = Transaction;