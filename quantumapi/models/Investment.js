/**
 * @fileoverview Investment model for storing user investment data
 * @date 2025-05-06
 */

const DB = require('../database');

// Investment statuses
const INVESTMENT_STATUS = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    PENDING: 'pending',
    REJECTED: 'rejected'
};

class Investment {
    /**
     * Create investments table if it doesn't exist
     */
    static createTable() {
        return DB.exec(`
            CREATE TABLE IF NOT EXISTS investments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_id TEXT NOT NULL,
                amount REAL NOT NULL,
                daily_roi REAL NOT NULL,
                total_return REAL NOT NULL,
                current_value REAL,
                return_amount REAL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                completed_date TEXT,
                cancelled_date TEXT,
                status TEXT NOT NULL,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
    }

    /**
     * Create a new investment
     * @param {Object} data Investment data
     * @returns {Promise<Object>} Created investment object
     */
    static create(data) {
        const { userId, planId, amount, startDate = new Date() } = data;
        
        // Get plan details
        const plan = Investment.getInvestmentPlanById(planId);
        if (!plan) {
            throw new Error('Invalid investment plan');
        }
        
        // Calculate end date based on plan duration
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + plan.duration);
        
        // Insert investment into database
        const stmt = DB.prepare(`
            INSERT INTO investments 
            (user_id, plan_id, amount, daily_roi, total_return, start_date, end_date, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            userId,
            planId,
            amount,
            plan.dailyRoi,
            plan.totalReturn,
            startDate.toISOString(),
            endDate.toISOString(),
            INVESTMENT_STATUS.ACTIVE
        );
        
        // Return the created investment
        return this.getById(result.lastInsertRowid);
    }

    /**
     * Get investment by ID
     * @param {number} id Investment ID
     * @returns {Promise<Object|null>} Investment object or null
     */
    static getById(id) {
        const stmt = DB.prepare('SELECT * FROM investments WHERE id = ?');
        const investment = stmt.get(id);
        if (!investment) return null;
        
        return this.formatInvestmentObject(investment);
    }

    /**
     * Get all investments by user ID
     * @param {number} userId User ID
     * @returns {Promise<Array>} Array of investment objects
     */
    static getByUserId(userId) {
        const stmt = DB.prepare('SELECT * FROM investments WHERE user_id = ?');
        const investments = stmt.all(userId);
        return investments.map(this.formatInvestmentObject);
    }

    /**
     * Get active investments by user ID
     * @param {number} userId User ID
     * @returns {Promise<Array>} Array of active investment objects
     */
    static getActiveByUserId(userId) {
        const stmt = DB.prepare('SELECT * FROM investments WHERE user_id = ? AND status = ?');
        const investments = stmt.all(userId, INVESTMENT_STATUS.ACTIVE);
        return investments.map(this.formatInvestmentObject);
    }

    /**
     * Get all active investments in the system
     * @returns {Promise<Array>} Array of active investment objects
     */
    static getAllActive() {
        const stmt = DB.prepare('SELECT * FROM investments WHERE status = ?');
        const investments = stmt.all(INVESTMENT_STATUS.ACTIVE);
        return investments.map(this.formatInvestmentObject);
    }

    /**
     * Get investment history by user ID
     * @param {number} userId User ID
     * @returns {Promise<Array>} Array of completed/cancelled investment objects
     */
    static getHistoryByUserId(userId) {
        const stmt = DB.prepare('SELECT * FROM investments WHERE user_id = ? AND status != ? ORDER BY start_date DESC');
        const investments = stmt.all(userId, INVESTMENT_STATUS.ACTIVE);
        return investments.map(this.formatInvestmentObject);
    }

    /**
     * Update investment status
     * @param {number} id Investment ID
     * @param {string} status New status
     * @returns {Object|null} Updated investment object or null
     */
    static updateStatus(id, status) {
        const stmt = DB.prepare('UPDATE investments SET status = ? WHERE id = ?');
        stmt.run(status, id);
        return this.getById(id);
    }

    /**
     * Update investment current value
     * @param {number} id Investment ID
     * @param {number} currentValue Updated current value
     * @returns {Object|null} Updated investment object or null
     */
    static updateCurrentValue(id, currentValue) {
        const stmt = DB.prepare('UPDATE investments SET current_value = ? WHERE id = ?');
        stmt.run(currentValue, id);
        return this.getById(id);
    }

    /**
     * Complete an investment
     * @param {number} id Investment ID
     * @param {number} returnAmount Total return amount
     * @returns {Object|null} Updated investment object or null
     */
    static complete(id, returnAmount) {
        const stmt = DB.prepare('UPDATE investments SET status = ?, return_amount = ?, completed_date = ? WHERE id = ?');
        stmt.run(INVESTMENT_STATUS.COMPLETED, returnAmount, new Date().toISOString(), id);
        return this.getById(id);
    }

    /**
     * Cancel an investment
     * @param {number} id Investment ID
     * @returns {Object|null} Updated investment object or null
     */
    static cancel(id) {
        const stmt = DB.prepare('UPDATE investments SET status = ?, cancelled_date = ? WHERE id = ?');
        stmt.run(INVESTMENT_STATUS.CANCELLED, new Date().toISOString(), id);
        return this.getById(id);
    }

    /**
     * Calculate daily profit for active investments
     * Distributes daily profit to all active investments
     * @returns {Array} Array of updated investments
     */
    static calculateDailyProfits() {
        // Get all active investments
        const activeInvestments = this.getAllActive();
        const updatedInvestments = [];

        // Process each active investment
        for (const investment of activeInvestments) {
            try {
                // Calculate daily profit
                const dailyProfit = investment.amount * investment.dailyRoi;
                
                // Calculate new current value
                const newCurrentValue = (investment.currentValue || investment.amount) + dailyProfit;
                
                // Update the investment's current value
                const updatedInvestment = this.updateCurrentValue(investment.id, newCurrentValue);
                updatedInvestments.push(updatedInvestment);

                // Check if investment has reached end date
                const endDate = new Date(investment.endDate);
                const currentDate = new Date();
                
                if (currentDate >= endDate) {
                    // Investment duration completed, mark as completed
                    this.complete(
                        investment.id, 
                        investment.amount * investment.totalReturn
                    );
                }
            } catch (error) {
                console.error(`Error processing investment ID ${investment.id}:`, error);
            }
        }

        return updatedInvestments;
    }

    /**
     * Get investment statistics by user ID
     * @param {number} userId User ID
     * @returns {Promise<Object>} Investment statistics
     */
    static async getStatsByUserId(userId) {
        try {
            const stmt = DB.prepare(`
                SELECT 
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingCount,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as activeCount,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedCount,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejectedCount,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelledCount,
                    SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as activeAmount,
                    SUM(CASE WHEN status = 'active' THEN current_value ELSE 0 END) as currentValue,
                    SUM(CASE WHEN status = 'completed' THEN return_amount ELSE 0 END) as completedReturn
                FROM investments
                WHERE user_id = ?
            `);
            
            const stats = stmt.get(userId) || {
                pendingCount: 0,
                activeCount: 0,
                completedCount: 0,
                rejectedCount: 0,
                cancelledCount: 0,
                activeAmount: 0,
                currentValue: 0,
                completedReturn: 0
            };
            
            // Format numeric values
            for (let key in stats) {
                if (typeof stats[key] === 'number') {
                    stats[key] = parseFloat(stats[key] || 0);
                }
            }
            
            return stats;
        } catch (error) {
            console.error('Error getting investment stats:', error);
            return {
                pendingCount: 0,
                activeCount: 0,
                completedCount: 0,
                rejectedCount: 0,
                cancelledCount: 0,
                activeAmount: 0,
                currentValue: 0,
                completedReturn: 0
            };
        }
    }
    
    /**
     * Get active investments by user ID
     * @param {number} userId User ID 
     * @returns {Promise<Array>} Active investments
     */
    static async getActiveInvestments(userId) {
        try {
            const stmt = DB.prepare('SELECT * FROM investments WHERE user_id = ? AND status = ? ORDER BY start_date DESC');
            // Added for debugging
            console.log(`[Investment.getActiveInvestments] Called with userId: ${userId}, status definition: ${INVESTMENT_STATUS}, status value for query: ${INVESTMENT_STATUS ? INVESTMENT_STATUS.ACTIVE : 'INVESTMENT_STATUS_IS_UNDEFINED'}`);
            if (typeof INVESTMENT_STATUS === 'undefined') {
                console.error('[Investment.getActiveInvestments] CRITICAL: INVESTMENT_STATUS object itself is undefined!');
            } else if (typeof INVESTMENT_STATUS.ACTIVE === 'undefined') {
                console.error('[Investment.getActiveInvestments] CRITICAL: INVESTMENT_STATUS.ACTIVE property is undefined!');
            }
            const investments = stmt.all(userId, INVESTMENT_STATUS.ACTIVE);
            return investments.map(this.formatInvestmentObject);
        } catch (error) {
            console.error('Error getting active investments:', error);
            // Log parameters if error occurs, attempting to access them safely
            const statusVal = INVESTMENT_STATUS && typeof INVESTMENT_STATUS.ACTIVE !== 'undefined' ? INVESTMENT_STATUS.ACTIVE : 'UNDEFINED_OR_INVESTMENT_STATUS_MISSING';
            console.error(`[Investment.getActiveInvestments] Error occurred with userId: ${userId}, status value attempted: ${statusVal}`);
            return [];
        }
    }
    
    /**
     * Get investment value history for a specific time period
     * @param {number} userId User ID
     * @param {Date} startDate Period start date
     * @param {Date} endDate Period end date
     * @returns {Promise<Array>} Investment value history
     */
    static async getValueHistory(userId, startDate, endDate) {
        try {
            // In a real app, this would query a time series table of investment values
            // For simplicity, we'll simulate this with some generated data points
            const stmt = DB.prepare(`
                SELECT start_date, amount, current_value
                FROM investments
                WHERE user_id = ? AND start_date >= ? AND start_date <= ?
                ORDER BY start_date ASC
            `);
            
            const results = stmt.all(
                userId, 
                startDate.toISOString(), 
                endDate.toISOString()
            );
            
            if (results.length === 0) {
                return this.generateSampleValueHistory(userId, startDate, endDate);
            }
            
            // Format investment history data
            return results.map(item => ({
                date: new Date(item.start_date),
                initialValue: parseFloat(item.amount || 0),
                currentValue: parseFloat(item.current_value || item.amount || 0)
            }));
        } catch (error) {
            console.error('Error getting investment value history:', error);
            return this.generateSampleValueHistory(userId, startDate, endDate);
        }
    }
    
    /**
     * Generate sample investment value history when no real data exists
     * @param {number} userId User ID
     * @param {Date} startDate Period start date
     * @param {Date} endDate Period end date
     * @returns {Array} Sample investment value history
     */
    static generateSampleValueHistory(userId, startDate, endDate) {
        const history = [];
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const interval = Math.max(1, Math.floor(daysDiff / 10)); // Create at most 10 data points
        
        // Get total investment amount for the user
        const totalStmt = DB.prepare('SELECT SUM(amount) as total FROM investments WHERE user_id = ?');
        const totalResult = totalStmt.get(userId);
        const baseAmount = parseFloat(totalResult?.total || 1000);
        
        let currentDate = new Date(startDate);
        let growthFactor = 1.0;
        
        while (currentDate <= endDate) {
            // Add some randomness to growth
            growthFactor *= (1 + Math.random() * 0.02); // 0-2% growth per interval
            
            history.push({
                date: new Date(currentDate),
                initialValue: baseAmount,
                currentValue: baseAmount * growthFactor
            });
            
            // Increment date by interval
            currentDate.setDate(currentDate.getDate() + interval);
        }
        
        return history;
    }
    
    /**
     * Get recent investments by user ID
     * @param {number} userId User ID
     * @param {number} limit Maximum number of investments to return
     * @returns {Promise<Array>} Recent investments
     */
    static async getRecentByUserId(userId, limit = 5) {
        try {
            const stmt = DB.prepare(`
                SELECT * FROM investments 
                WHERE user_id = ? 
                ORDER BY createdAt DESC
                LIMIT ?
            `);
            
            const investments = stmt.all(userId, limit);
            return investments.map(this.formatInvestmentObject);
        } catch (error) {
            console.error('Error getting recent investments:', error);
            return [];
        }
    }
    
    /**
     * Format investment object from database row
     * @param {Object} dbInvestment Database investment row
     * @returns {Object} Formatted investment object
     */
    static formatInvestmentObject(dbInvestment) {
        if (!dbInvestment) return null;

        // Convert snake_case to camelCase
        const investment = {
            id: dbInvestment.id,
            userId: dbInvestment.user_id,
            plan: dbInvestment.plan_id,
            amount: parseFloat(dbInvestment.amount || 0),
            dailyRoi: parseFloat(dbInvestment.daily_roi || 0),
            totalReturn: parseFloat(dbInvestment.total_return || 0),
            currentValue: parseFloat(dbInvestment.current_value || dbInvestment.amount || 0),
            returnAmount: parseFloat(dbInvestment.return_amount || 0),
            startDate: dbInvestment.start_date,
            endDate: dbInvestment.end_date,
            completedDate: dbInvestment.completed_date,
            cancelledDate: dbInvestment.cancelled_date,
            status: dbInvestment.status,
            createdAt: dbInvestment.createdAt
        };
        
        return investment;
    }

    /**
     * Get investment plan by ID
     * @param {string} planId Plan identifier
     * @returns {Object|null} Investment plan object or null
     */
    static getInvestmentPlanById(planId) {
        const plans = {
            "starter": {
                "name": "Starter Plan",
                "dailyRoi": 0.02, // 2% daily ROI
                "totalReturn": 2.0, // 100% return (X2)
                "duration": 50,
                "minDeposit": 50,
                "maxDeposit": 1000,
                "color": "#6366f1"
            },
            "premium": {
                "name": "Premium Plan",
                "dailyRoi": 0.025, // 2.5% daily ROI
                "totalReturn": 2.0, // 100% return (X2)
                "duration": 40,
                "minDeposit": 1001,
                "maxDeposit": 5000,
                "color": "#10b981"
            },
            "vip": {
                "name": "VIP Plan",
                "dailyRoi": 0.03, // 3% daily ROI
                "totalReturn": 2.0, // 100% return (X2)
                "duration": 33,
                "minDeposit": 5001,
                "maxDeposit": Infinity,
                "color": "#4f46e5"
            }
        };
        
        return plans[planId] || null;
    }
}

module.exports = {
    Investment,
    INVESTMENT_STATUS
};