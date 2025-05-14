/**
 * @fileoverview Dashboard controller for handling dashboard API requests
 * @date 2025-05-08
 */

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { Investment } = require('../models/Investment'); // Correctly destructure Investment class
const Referral = require('../models/Referral');
const Notification = require('../models/Notification'); // Add Notification model

class DashboardController {
    /**
     * Get dashboard overview data
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getDashboardData(req, res) {
        try {
            const userId = req.user.id;
            
            // Get wallet information
            const wallet = await Wallet.findByUserId(userId);
            
            // Get investment stats
            const investmentStats = await Investment.getStatsByUserId(userId);
            
            // Get user profile
            const user = await User.findById(userId);
            
            // Calculate monthly growth
            let monthlyGrowth = 0;
            // Ensure investmentStats and relevant properties exist before calculation
            if (investmentStats && typeof investmentStats.activeAmount === 'number' && investmentStats.activeAmount > 0 && typeof investmentStats.currentValue === 'number' && investmentStats.currentValue > 0) {
                const growthAmount = investmentStats.currentValue - investmentStats.activeAmount;
                monthlyGrowth = parseFloat(((growthAmount / investmentStats.activeAmount) * 100).toFixed(2));
            }
            
            // Calculate projected profit
            const projectedProfit = (investmentStats && typeof investmentStats.projectedProfit === 'number') ? investmentStats.projectedProfit : 0;

            const liquidBalance = wallet && typeof wallet.balance === 'number' ? wallet.balance : 0;
            const pendingLiquidBalance = wallet && typeof wallet.pendingBalance === 'number' ? wallet.pendingBalance : 0;
            const activeInvestmentValue = investmentStats && typeof investmentStats.currentValue === 'number' ? investmentStats.currentValue : 0;

            const calculatedTotalBalance = liquidBalance + pendingLiquidBalance + activeInvestmentValue;
            
            const responseData = {
                totalBalance: calculatedTotalBalance,
                availableBalance: liquidBalance,
                pendingBalance: pendingLiquidBalance,
                monthlyGrowth,
                projectedProfit,
                investments: {
                    pendingCount: investmentStats ? (investmentStats.pendingCount || 0) : 0,
                    approvedCount: investmentStats ? (investmentStats.activeCount || 0) : 0,
                    rejectedCount: investmentStats ? (investmentStats.rejectedCount || 0) : 0,
                    activeAmount: investmentStats ? (investmentStats.activeAmount || 0) : 0,
                    currentValue: activeInvestmentValue
                },
                user: {
                    name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'User',
                    email: user ? user.email : '',
                    avatar: user ? user.avatar : null,
                    level: user ? user.level || 'Standard' : 'Standard',
                    isVerified: user ? Boolean(user.isVerified) : false
                }
            };
            
            return res.status(200).json(responseData);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard data',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    
    /**
     * Get profit chart data for dashboard
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getProfitChartData(req, res) {
        try {
            const userId = req.user.id;
            const period = req.query.period || 'month';
            
            let startDate = new Date();
            const endDate = new Date();
            
            // Determine date range based on period
            switch (period) {
                case 'week':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(endDate.getMonth() - 1);
                    break;
                case 'year':
                    startDate.setFullYear(endDate.getFullYear() - 1);
                    break;
                case 'all':
                    // Get the user's registration date as the start date
                    const user = await User.findById(userId);
                    if (user && user.createdAt) {
                        startDate = new Date(user.createdAt);
                    } else {
                        startDate.setFullYear(endDate.getFullYear() - 1);
                    }
                    break;
            }
            
            // Get investment value history
            const valueHistory = await Investment.getValueHistory(userId, startDate, endDate);
            
            // Prepare chart data
            const labels = [];
            const investmentValues = [];
            const initialValues = [];
            
            if (valueHistory && valueHistory.length > 0) {
                valueHistory.forEach(point => {
                    const date = new Date(point.date);
                    labels.push(date.toLocaleDateString());
                    investmentValues.push(point.currentValue);
                    initialValues.push(point.initialValue);
                });
            }
            
            return res.status(200).json({
                labels,
                investmentValues,
                initialValues
            });
        } catch (error) {
            console.error('Error getting profit chart data:', error);
            return res.status(500).json({
                error: 'An error occurred while fetching profit chart data'
            });
        }
    }
    
    /**
 * Get referral data for charts and stats
 */
static async getReferralData(req, res) {
    try {
        const userId = req.user.id;
        
        // Get referral statistics
        const referralStats = await Referral.getStatsByUserId(userId);
        
        return res.status(200).json({
            success: true,
            activeReferrals: referralStats.activeCount || 0,
            pendingSignups: referralStats.pendingCount || 0,
            totalEarnings: referralStats.earnings || 0
        });
    } catch (error) {
        console.error('Error getting referral stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch referral data'
        });
    }
}
    
    /**
     * Get recent activity for dashboard
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getRecentActivity(req, res) {
        try {
            const userId = req.user.id;
            const activities = [];
            
            // Get recent transactions
            const recentTransactions = await Transaction.getRecentByUserId(userId, 5);
            if (recentTransactions && recentTransactions.length > 0) {
                for (const transaction of recentTransactions) {
                    let iconClass = 'fa-exchange-alt';
                    let description = `Transaction: ${transaction.type}`;
                    
                    switch (transaction.type) {
                        case 'Deposit':
                            iconClass = 'fa-arrow-down';
                            description = `Deposit of ${transaction.amount} USD`;
                            break;
                        case 'Withdrawal':
                            iconClass = 'fa-arrow-up';
                            description = `Withdrawal of ${transaction.amount} USD`;
                            break;
                        case 'ReferralCommission':
                            iconClass = 'fa-user-plus';
                            description = `Referral commission of ${transaction.amount} USD`;
                            break;
                        case 'Profit':
                            iconClass = 'fa-chart-line';
                            description = `Profit payment of ${transaction.amount} USD`;
                            break;
                    }
                    
                    activities.push({
                        id: transaction.id,
                        description,
                        timestamp: transaction.createdAt,
                        iconClass,
                        detailsLink: `/wallet.html?transaction=${transaction.id}`
                    });
                }
            }
            
            // Get recent investments
            const recentInvestments = await Investment.getRecentByUserId(userId, 3);
            if (recentInvestments && recentInvestments.length > 0) {
                for (const investment of recentInvestments) {
                    activities.push({
                        id: `inv-${investment.id}`,
                        description: `New investment of ${investment.amount} USD`,
                        timestamp: investment.createdAt,
                        iconClass: 'fa-chart-pie',
                        detailsLink: `/investment.html?id=${investment.id}`
                    });
                }
            }
            
            // Get recent referrals
            const recentReferrals = await Referral.getRecentByUserId(userId, 3);
            if (recentReferrals && recentReferrals.length > 0) {
                for (const referral of recentReferrals) {
                    let name = 'Anonymous User';
                    if (referral.referredName) {
                        name = referral.referredName;
                    } else if (referral.referredUsername) {
                        name = referral.referredUsername;
                    }
                    
                    activities.push({
                        id: `ref-${referral.id}`,
                        description: `New referral: ${name}`,
                        timestamp: referral.createdAt,
                        iconClass: 'fa-user-plus',
                        detailsLink: '/referrals.html'
                    });
                }
            }
            
            // Sort activities by timestamp (newest first)
            activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return res.status(200).json(activities);
        } catch (error) {
            console.error('Error getting recent activity:', error);
            return res.status(500).json({
                error: 'An error occurred while fetching recent activity'
            });
        }
    }

    /**
     * Get notifications for the logged-in user
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getNotifications(req, res) {
        try {
            const userId = req.user.id;
            const notifications = await Notification.getByUserId(userId);
            return res.status(200).json(notifications);
        } catch (error) {
            console.error('Error getting notifications:', error);
            return res.status(500).json({
                error: 'An error occurred while fetching notifications'
            });
        }
    }

    /**
 * Mark all notifications as read for the logged-in user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
    static async markAllNotificationsAsRead(req, res) {
        try {
            const userId = req.user.id;
            const result = await Notification.markAllAsRead(userId);
        
            // SQLite operation results have 'changes' property, not 'success'
            return res.status(200).json({
                success: true,
                message: 'All notifications marked as read.',
                modifiedCount: result.changes || 0
            });
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return res.status(500).json({
                error: 'An error occurred while marking notifications as read'
            });
        }
    }

    /**
 * Mark a single notification as read
 */
    static async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const notificationId = req.params.id;

            if (!notificationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Notification ID is required'
                });
            }
  
      const result = await Notification.markAsRead(notificationId, userId);
      
      if (result && result.changes > 0) {
        return res.status(200).json({
          success: true,
          message: 'Notification marked as read'
        });
      } else {
        return res.status(404).json({
          success: false,
          message: 'Notification not found or already read'
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to mark notification as read' 
      });
    }
  };

/**
 * Delete a notification
 */
static async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;
      
      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'Notification ID is required'
        });
      }
      const result = await Notification.deleteNotification(notificationId, userId);
      if (result && result.changes > 0) {
        return res.status(200).json({
          success: true,
          message: 'Notification deleted successfully'
        });
      } else {
        return res.status(404).json({
          success: false,
          message: 'Notification not found or you do not have permission to delete it'
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to delete notification' 
      });
    }
  };

static async getReferralStats(req, res) {
    try {
      const userId = req.user.id;
      
      // Get referral statistics from database
      const referralStats = await Referral.getStatsByUserId(userId);
      
      res.status(200).json({
        success: true,
        stats: {
          activeReferrals: referralStats.activeCount || 0,
          pendingSignups: referralStats.pendingCount || 0,
          totalEarnings: referralStats.earnings || 0
        }
      });
    } catch (error) {
      console.error('Error fetching referral stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch referral statistics'
      });
    }
  };


    /**
 * Get referral statistics for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
static async getReferralStats(req, res) {
    try {
        const userId = req.user.id;
        
        // Get basic referral stats
        const referralStats = await Referral.getStatsByUserId(userId);
        
        // Get earnings from referral commissions
        const earnings = await Transaction.getTotalReferralEarnings(userId);
        
        return res.status(200).json({
            activeReferrals: referralStats.activeCount || 0,
            pendingSignups: referralStats.pendingCount || 0,
            totalEarnings: earnings || 0
        });
    } catch (error) {
        console.error('Error fetching referral statistics:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch referral data' 
        });
    }
}
    
}
module.exports = DashboardController;