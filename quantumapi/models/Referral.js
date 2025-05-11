const db = require('../database');
const User = require('./User');
const Wallet = require('./Wallet');
const Transaction = require('./Transaction');

class Referral {
  /**
   * Create referrals table if it doesn't exist
   */
  static createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrerId INTEGER NOT NULL,
        referredId INTEGER NOT NULL,
        level INTEGER NOT NULL,
        commissionEarned REAL DEFAULT 0,
        status TEXT DEFAULT 'Active',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrerId) REFERENCES users(id),
        FOREIGN KEY (referredId) REFERENCES users(id),
        UNIQUE(referrerId, referredId)
      )
    `;

    db.prepare(query).run();
  }

  /**
   * Create a new referral relationship
   * @param {object} referralData 
   */
  static create(referralData) {
    try {
      const stmt = db.prepare(`
        INSERT INTO referrals (referrerId, referredId, level)
        VALUES (?, ?, ?)
      `);
      
      const result = stmt.run(
        referralData.referrerId, 
        referralData.referredId, 
        referralData.level
      );
      
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error creating referral:', error);
      return null;
    }
  }
  
  /**
   * Get referral by ID
   * @param {number} id 
   */
  static getById(id) {
    try {
      const stmt = db.prepare('SELECT * FROM referrals WHERE id = ?');
      return stmt.get(id);
    } catch (error) {
      console.error('Error getting referral by ID:', error);
      return null;
    }
  }
  
  /**
   * Get referrals by referrer ID (users who this user has referred)
   * @param {number} referrerId 
   */
  static getByReferrerId(referrerId) {
    try {
      const stmt = db.prepare(`
        SELECT r.*, u.username, u.firstName, u.lastName
        FROM referrals r
        JOIN users u ON r.referredId = u.id
        WHERE r.referrerId = ?
        ORDER BY r.createdAt DESC
      `);
      
      return stmt.all(referrerId);
    } catch (error) {
      console.error('Error getting referrals by referrer ID:', error);
      return [];
    }
  }
  
  /**
   * Get referrals by referrer ID with pagination
   * @param {number} referrerId 
   * @param {number} offset 
   * @param {number} limit 
   */
  static getByReferrerIdWithPagination(referrerId, offset, limit) {
    try {
      const stmt = db.prepare(`
        SELECT r.*, u.username, u.firstName, u.lastName, u.createdAt as joined
        FROM referrals r
        JOIN users u ON r.referredId = u.id
        WHERE r.referrerId = ?
        ORDER BY r.createdAt DESC
        LIMIT ? OFFSET ?
      `);
      
      return stmt.all(referrerId, limit, offset);
    } catch (error) {
      console.error('Error getting referrals with pagination:', error);
      return [];
    }
  }
  
  /**
   * Get referrals by referred ID (users who referred this user)
   * @param {number} referredId 
   */
  static getByReferredId(referredId) {
    try {
      const stmt = db.prepare('SELECT * FROM referrals WHERE referredId = ?');
      return stmt.all(referredId);
    } catch (error) {
      console.error('Error getting referrals by referred ID:', error);
      return [];
    }
  }
  
  /**
   * Count referrals by referrer ID
   * @param {number} referrerId 
   */
  static countByReferrerId(referrerId) {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrerId = ?');
      const result = stmt.get(referrerId);
      return result ? result.count : 0;
    } catch (error) {
      console.error('Error counting referrals:', error);
      return 0;
    }
  }
  
  /**
   * Count active referrals by referrer ID (referrals who have made deposits)
   * @param {number} referrerId 
   */
  static countActiveReferrals(referrerId) {
    try {
      const stmt = db.prepare(`
        SELECT COUNT(DISTINCT r.referredId) as count 
        FROM referrals r
        JOIN transactions t ON r.referredId = t.userId
        WHERE r.referrerId = ? AND t.type = 'Deposit' AND t.status = 'Completed'
      `);
      
      const result = stmt.get(referrerId);
      return result ? result.count : 0;
    } catch (error) {
      console.error('Error counting active referrals:', error);
      return 0;
    }
  }
  
  /**
   * Get commission history for a referrer
   * @param {number} referrerId 
   * @param {number} offset 
   * @param {number} limit 
   */
  static getCommissionHistory(referrerId, offset, limit) {
    try {
      const stmt = db.prepare(`
        SELECT r.*, u.username as referredUsername, u.firstName as referredFirstName, u.lastName as referredLastName
        FROM referrals r
        JOIN users u ON r.referredId = u.id
        WHERE r.referrerId = ? AND r.commissionEarned > 0
        ORDER BY r.updatedAt DESC
        LIMIT ? OFFSET ?
      `);
      
      return stmt.all(referrerId, limit, offset);
    } catch (error) {
      console.error('Error getting commission history:', error);
      return [];
    }
  }
  
  /**
   * Get total commission earned by a referrer
   * @param {number} referrerId 
   */
  static getTotalCommissionByReferrerId(referrerId) {
    try {
      const stmt = db.prepare('SELECT SUM(commissionEarned) as total FROM referrals WHERE referrerId = ?');
      const result = stmt.get(referrerId);
      return result && result.total ? Number(result.total) : 0;
    } catch (error) {
      console.error('Error getting total commission:', error);
      return 0;
    }
  }
  
  /**
   * Get pending commissions for a referrer
   * @param {number} referrerId 
   */
  static getPendingCommissionByReferrerId(referrerId) {
    try {
      const stmt = db.prepare(`
        SELECT SUM(t.amount * 
          CASE 
            WHEN r.level = 1 THEN 0.05 
            WHEN r.level = 2 THEN 0.02 
            WHEN r.level = 3 THEN 0.01 
            ELSE 0 
          END) as total
        FROM transactions t
        JOIN referrals r ON t.userId = r.referredId
        WHERE r.referrerId = ? AND t.type = 'Deposit' AND t.status = 'Pending'
      `);
      
      const result = stmt.get(referrerId);
      return result && result.total ? Number(result.total) : 0;
    } catch (error) {
      console.error('Error getting pending commissions:', error);
      return 0;
    }
  }
  
  /**
   * Update commission for a referral
   * @param {number} referralId 
   * @param {number} amount 
   */
  static updateCommission(referralId, amount) {
    try {
      const referral = this.getById(referralId);
      
      if (!referral) {
        return false;
      }
      
      const stmt = db.prepare(`
        UPDATE referrals
        SET commissionEarned = commissionEarned + ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(amount, referralId);
      return true;
    } catch (error) {
      console.error('Error updating commission:', error);
      return false;
    }
  }
  
  /**
   * Get referral statistics for a user
   * @param {number} userId 
   */
  static getReferralStats(userId) {
    try {
      // Get total referrals
      const totalReferrals = this.countByReferrerId(userId);
      
      // Get active referrals (with deposits)
      const activeReferrals = this.countActiveReferrals(userId);
      
      // Get total earnings
      const totalEarnings = this.getTotalCommissionByReferrerId(userId);
      
      // Get pending commissions
      const pendingCommissions = this.getPendingCommissionByReferrerId(userId);
      
      // Get referrals by level
      const stmt = db.prepare(`
        SELECT level, COUNT(*) as count
        FROM referrals
        WHERE referrerId = ?
        GROUP BY level
        ORDER BY level
      `);
      
      const referralsByLevel = stmt.all(userId);
      
      // Get commissions by level
      const stmtCommissions = db.prepare(`
        SELECT level, SUM(commissionEarned) as total
        FROM referrals
        WHERE referrerId = ?
        GROUP BY level
        ORDER BY level
      `);
      
      const commissionsByLevel = stmtCommissions.all(userId);
      
      return {
        totalReferrals,
        activeReferrals,
        totalEarnings,
        pendingCommissions,
        referralsByLevel,
        commissionsByLevel
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return {
        totalReferrals: 0,
        activeReferrals: 0,
        totalEarnings: 0,
        pendingCommissions: 0,
        referralsByLevel: [],
        commissionsByLevel: []
      };
    }
  }
  
  /**
   * Process a deposit and calculate referral commissions
   * This implements the 3-tier commission structure (5%, 2%, 1%)
   * @param {number} userId - User who made the deposit
   * @param {number} amount - Deposit amount
   */
  static async processDepositForCommissions(userId, amount) {
    try {
      // Get first-level referrer (who referred this user)
      const user = User.findById(userId);
      
      if (!user || !user.referredBy) {
        return; // No referrer, nothing to do
      }
      
      // Level 1 referrer (direct referrer) - 5%
      const level1ReferrerId = user.referredBy;
      const level1Commission = amount * 0.05; // 5% of deposit
      
      // Check if referral relationship exists
      let referral = db.prepare('SELECT * FROM referrals WHERE referrerId = ? AND referredId = ?')
                      .get(level1ReferrerId, userId);
      
      if (!referral) {
        // Create the referral relationship if it doesn't exist
        this.create({
          referrerId: level1ReferrerId,
          referredId: userId,
          level: 1
        });
      } else {
        // Update the commission
        this.updateCommission(referral.id, level1Commission);
      }
      
      // Get level 1 referrer's wallet and update balance
      const level1Wallet = Wallet.findByUserId(level1ReferrerId);
      
      if (level1Wallet) {
        // Add commission to wallet
        const newBalance = level1Wallet.balance + level1Commission;
        Wallet.updateBalance(level1ReferrerId, newBalance, level1Wallet.pendingBalance);
        
        // Create transaction record
        Transaction.create({
          userId: level1ReferrerId,
          type: 'ReferralCommission',
          amount: level1Commission,
          status: 'Completed',
          details: JSON.stringify({
            level: 1,
            referredUser: userId,
            depositAmount: amount,
            commission: level1Commission
          })
        });
      }
      
      // Level 2 referrer (referrer of referrer) - 2%
      const level1User = User.findById(level1ReferrerId);
      
      if (level1User && level1User.referredBy) {
        const level2ReferrerId = level1User.referredBy;
        const level2Commission = amount * 0.02; // 2% of deposit
        
        // Check if level 2 referral relationship exists
        referral = db.prepare('SELECT * FROM referrals WHERE referrerId = ? AND referredId = ?')
                     .get(level2ReferrerId, userId);
        
        if (!referral) {
          // Create the referral relationship if it doesn't exist
          this.create({
            referrerId: level2ReferrerId,
            referredId: userId,
            level: 2
          });
        } else {
          // Update the commission
          this.updateCommission(referral.id, level2Commission);
        }
        
        // Get level 2 referrer's wallet and update balance
        const level2Wallet = Wallet.findByUserId(level2ReferrerId);
        
        if (level2Wallet) {
          // Add commission to wallet
          const newBalance = level2Wallet.balance + level2Commission;
          Wallet.updateBalance(level2ReferrerId, newBalance, level2Wallet.pendingBalance);
          
          // Create transaction record
          Transaction.create({
            userId: level2ReferrerId,
            type: 'ReferralCommission',
            amount: level2Commission,
            status: 'Completed',
            details: JSON.stringify({
              level: 2,
              referredUser: userId,
              depositAmount: amount,
              commission: level2Commission
            })
          });
        }
        
        // Level 3 referrer - 1%
        const level2User = User.findById(level2ReferrerId);
        
        if (level2User && level2User.referredBy) {
          const level3ReferrerId = level2User.referredBy;
          const level3Commission = amount * 0.01; // 1% of deposit
          
          // Check if level 3 referral relationship exists
          referral = db.prepare('SELECT * FROM referrals WHERE referrerId = ? AND referredId = ?')
                       .get(level3ReferrerId, userId);
          
          if (!referral) {
            // Create the referral relationship if it doesn't exist
            this.create({
              referrerId: level3ReferrerId,
              referredId: userId,
              level: 3
            });
          } else {
            // Update the commission
            this.updateCommission(referral.id, level3Commission);
          }
          
          // Get level 3 referrer's wallet and update balance
          const level3Wallet = Wallet.findByUserId(level3ReferrerId);
          
          if (level3Wallet) {
            // Add commission to wallet
            const newBalance = level3Wallet.balance + level3Commission;
            Wallet.updateBalance(level3ReferrerId, newBalance, level3Wallet.pendingBalance);
            
            // Create transaction record
            Transaction.create({
              userId: level3ReferrerId,
              type: 'ReferralCommission',
              amount: level3Commission,
              status: 'Completed',
              details: JSON.stringify({
                level: 3,
                referredUser: userId,
                depositAmount: amount,
                commission: level3Commission
              })
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing deposit for commissions:', error);
    }
  }

  /**
   * Get referral statistics by user ID for dashboard
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Referral statistics
   */
  static async getStatsByUserId(userId) {
    try {
      // Get total referrals
      const totalReferrals = this.countByReferrerId(userId);
      
      // Get active referrals (with deposits)
      const activeReferrals = this.countActiveReferrals(userId);
      
      // Count pending signups (referrals without deposits)
      const pendingSignups = totalReferrals - activeReferrals;
      
      // Get total earnings
      const totalEarnings = this.getTotalCommissionByReferrerId(userId);
      
      return {
        totalCount: totalReferrals,
        activeCount: activeReferrals,
        pendingCount: pendingSignups,
        totalEarnings: totalEarnings,
      };
    } catch (error) {
      console.error('Error getting referral stats for dashboard:', error);
      return {
        totalCount: 0,
        activeCount: 0,
        pendingCount: 0,
        totalEarnings: 0
      };
    }
  }

  /**
   * Get recent referrals by user ID
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number to return
   * @returns {Promise<Array>} Recent referrals
   */
  static async getRecentByUserId(userId, limit = 5) {
    try {
      const stmt = db.prepare(`
        SELECT r.*, 
               u.username as referredUsername, 
               u.email as referredEmail,
               u.firstName as referredFirstName, 
               u.lastName as referredLastName
        FROM referrals r
        JOIN users u ON r.referredId = u.id
        WHERE r.referrerId = ?
        ORDER BY r.createdAt DESC
        LIMIT ?
      `);
      
      const referrals = stmt.all(userId, limit);
      
      // Format the results
      return referrals.map(ref => ({
        id: ref.id,
        referredId: ref.referredId,
        referredUsername: ref.referredUsername,
        referredEmail: ref.referredEmail,
        referredName: `${ref.referredFirstName || ''} ${ref.referredLastName || ''}`.trim() || 'Anonymous User',
        level: ref.level,
        commissionEarned: ref.commissionEarned,
        status: ref.status,
        createdAt: ref.createdAt
      }));
    } catch (error) {
      console.error('Error getting recent referrals:', error);
      return [];
    }
  }

/**
 * Get referral statistics for a user
 * @param {number} userId - User ID
 * @returns {Object} Referral statistics
 */
/**
 * Get referral statistics for a user
 * @param {number} userId - User ID
 * @returns {Object} Referral statistics
 */
static getStatsByUserId(userId) {
  try {
      // Count active referrals (users who have made at least one deposit)
      const activeStmt = db.prepare(`
          SELECT COUNT(DISTINCT r.referredId) as activeCount 
          FROM referrals r
          JOIN users u ON u.id = r.referredId
          JOIN transactions t ON t.userId = r.referredId
          WHERE r.referrerId = ? 
          AND t.type = 'deposit' 
          AND t.status = 'completed'
      `);
      
      // Count pending referrals (signed up but no deposits yet)
      const pendingStmt = db.prepare(`
          SELECT COUNT(DISTINCT r.referredId) as pendingCount 
          FROM referrals r
          JOIN users u ON u.id = r.referredId
          LEFT JOIN (
              SELECT userId FROM transactions 
              WHERE type = 'deposit' AND status = 'completed'
              GROUP BY userId
          ) t ON t.userId = r.referredId
          WHERE r.referrerId = ? AND t.userId IS NULL
      `);
      
      // Rest of the method remains unchanged
      const earningsStmt = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as totalEarnings
          FROM transactions
          WHERE userId = ? AND type = 'referral' AND status = 'completed'
      `);
      
      const activeResult = activeStmt.get(userId);
      const pendingResult = pendingStmt.get(userId);
      const earningsResult = earningsStmt.get(userId);
      
      return {
          activeCount: activeResult.activeCount || 0,
          pendingCount: pendingResult.pendingCount || 0,
          earnings: earningsResult.totalEarnings || 0
      };
  } catch (error) {
      console.error(`Error getting referral stats for user ${userId}:`, error);
      return { activeCount: 0, pendingCount: 0, earnings: 0 };
  }
}

}

module.exports = Referral;