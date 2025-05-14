/**
 * Milestone.js
 * Handles referral milestones and bonus rewards
 */

const db = require('../database');
const Transaction = require('./Transaction');
const Wallet = require('./Wallet');

class Milestone {
  /**
   * Create milestones table if it doesn't exist
   */
  static createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        level INTEGER NOT NULL,
        reward REAL NOT NULL,
        target INTEGER NOT NULL,
        achieved BOOLEAN DEFAULT FALSE,
        achievedAt TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        UNIQUE(userId, level)
      )
    `;

    db.prepare(query).run();
  }

  /**
   * Initialize milestone records for a new user
   * @param {number} userId 
   */
  static initializeForUser(userId) {
    try {
      
      // Begin transaction
      db.transaction(() => {
        // Check if user already has milestones initialized
        const existingMilestones = db.prepare('SELECT COUNT(*) as count FROM milestones WHERE userId = ?').get(userId);
        
        // Only initialize if no milestones exist
        if (existingMilestones.count === 0) {
          // Level 1 milestone: 25 active referrals
          db.prepare(`
            INSERT OR IGNORE INTO milestones (userId, level, target, reward, rewardAmount, progress, completed, claimedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(userId, 1, 25, 'USDT', 250, 0, 0, null);
          
          // Add more milestone levels as needed
          // Level 2, 3, etc.
        }
      })();
      
      return true;
    } catch (error) {
      console.error(`Error initializing milestones: ${error}`);
      return false;
    }
  }
  
  /**
   * Get all milestones for a user
   * @param {number} userId 
   */
  static getByUserId(userId) {
    try {
      const stmt = db.prepare('SELECT * FROM milestones WHERE userId = ? ORDER BY level');
      return stmt.all(userId);
    } catch (error) {
      console.error('Error getting milestones by user ID:', error);
      return [];
    }
  }
  
  /**
   * Get milestone by user ID and level
   * @param {number} userId 
   * @param {number} level 
   */
  static getByUserIdAndLevel(userId, level) {
    try {
      const stmt = db.prepare('SELECT * FROM milestones WHERE userId = ? AND level = ?');
      return stmt.get(userId, level);
    } catch (error) {
      console.error('Error getting milestone by user ID and level:', error);
      return null;
    }
  }
  
  /**
   * Mark milestone as achieved
   * @param {number} userId 
   * @param {number} level 
   */
  static async markAsAchieved(userId, level) {
    try {
      // Check if milestone exists and is not already achieved
      const milestone = this.getByUserIdAndLevel(userId, level);
      
      if (!milestone || milestone.achieved) {
        return false;
      }
      
      // Update milestone as achieved
      const stmt = db.prepare(`
        UPDATE milestones
        SET achieved = TRUE,
            achievedAt = CURRENT_TIMESTAMP,
            updatedAt = CURRENT_TIMESTAMP
        WHERE userId = ? AND level = ?
      `);
      
      stmt.run(userId, level);
      
      // Add reward to user's wallet
      const wallet = Wallet.findByUserId(userId);
      
      if (wallet) {
        const newBalance = wallet.balance + milestone.reward;
        Wallet.updateBalance(userId, newBalance, wallet.pendingBalance);
        
        // Create transaction record for the milestone reward
        Transaction.create({
          userId,
          type: 'MilestoneReward',
          amount: milestone.reward,
          status: 'Completed',
          details: JSON.stringify({
            milestoneLevel: level,
            referralsMilestone: level === 1 ? 25 : 50,
            reward: milestone.reward
          })
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error marking milestone as achieved:', error);
      return false;
    }
  }
  
  /**
   * Check and process referral milestones for a user
   * @param {number} userId 
   * @param {number} referralCount 
   */
  static async checkAndProcessMilestones(userId, referralCount) {
    try {
      // Check for level 1 milestone (25 referrals)
      if (referralCount >= 25) {
        const milestone1 = this.getByUserIdAndLevel(userId, 1);
        
        if (milestone1 && !milestone1.achieved) {
          await this.markAsAchieved(userId, 1);
        }
      }
      
      // Check for level 2 milestone (50 referrals)
      if (referralCount >= 50) {
        const milestone2 = this.getByUserIdAndLevel(userId, 2);
        
        if (milestone2 && !milestone2.achieved) {
          await this.markAsAchieved(userId, 2);
        }
      }
    } catch (error) {
      console.error('Error checking and processing milestones:', error);
    }
  }
  
  /**
   * Get next milestone for a user
   * @param {number} userId 
   * @param {number} currentReferrals 
   */
  static getNextMilestone(userId, currentReferrals) {
    try {
      let nextMilestone = null;
      
      if (currentReferrals < 25) {
        nextMilestone = {
          level: 1,
          target: 25,
          reward: 250,
          progress: (currentReferrals / 25) * 100,
          remaining: 25 - currentReferrals
        };
      } else if (currentReferrals < 50) {
        nextMilestone = {
          level: 2,
          target: 50,
          reward: 250,
          progress: ((currentReferrals - 25) / 25) * 100,
          remaining: 50 - currentReferrals
        };
      }
      
      return nextMilestone;
    } catch (error) {
      console.error('Error getting next milestone:', error);
      return null;
    }
  }
  
  /**
   * Get milestone statistics for a user
   * @param {number} userId 
   * @param {number} referralCount 
   */
  static getMilestoneStats(userId, referralCount) {
    try {
      const milestones = this.getByUserId(userId);
      const nextMilestone = this.getNextMilestone(userId, referralCount);
      
      let totalEarned = 0;
      for (const milestone of milestones) {
        if (milestone.achieved) {
          totalEarned += milestone.reward;
        }
      }
      
      return {
        milestones,
        nextMilestone,
        totalEarned
      };
    } catch (error) {
      console.error('Error getting milestone stats:', error);
      return {
        milestones: [],
        nextMilestone: null,
        totalEarned: 0
      };
    }
  }
}

module.exports = Milestone;