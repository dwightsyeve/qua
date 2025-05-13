/**
 * ReferralController.js
 * Handles all referral-related operations including statistics, 
 * referral lists, commission calculations, and milestone rewards.
 */
const User = require('../models/User');
const Referral = require('../models/Referral');
const Milestone = require('../models/Milestone');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { sendEmailNotification } = require('../utils/WalletUtils');

// No-op logger as a replacement for referralLogger
const referralLogger = {
  info: () => {},
  error: () => {},
  warning: () => {},
  debug: () => {}
};
const db = require('../database');

/**
 * Get referral link for the current user
 * Endpoint: GET /api/referrals/link
 */
exports.getReferralLink = (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user details
    const user = User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate frontend URL based on environment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://qua-vagw.onrender.com' 
      : 'http://localhost:3000/auth.html';
    
    const referralLink = `${baseUrl}?ref=${user.referralCode}`;
    
    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      referralLink
    });
  } catch (error) {
    console.error('Error getting referral link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get referral link',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get referral statistics for the current user
 * Endpoint: GET /api/referrals/stats
 */
exports.getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Initialize milestones if they don't exist
    Milestone.initializeForUser(userId);
    
    // Get referral statistics
    const stats = Referral.getReferralStats(userId);
    
    // Get milestone info
    const milestones = Milestone.getByUserId(userId);
    const nextMilestone = Milestone.getNextMilestone(userId, stats.totalReferrals);
    const currentProgress = stats.totalReferrals;
    
    // Calculate progress percentage
    let progressPercentage = 0;
    let nextTarget = 0;
    let nextReward = 0;
    
    if (nextMilestone) {
      nextTarget = nextMilestone.target;
      nextReward = nextMilestone.reward;
      
      // Find the previous milestone
      const previousMilestone = milestones.find(m => m.level === nextMilestone.level - 1);
      const startingPoint = previousMilestone ? previousMilestone.target : 0;
      
      // Calculate percentage between previous and next milestone
      const range = nextMilestone.target - startingPoint;
      const progress = currentProgress - startingPoint;
      progressPercentage = Math.min(Math.floor((progress / range) * 100), 100);
    } else {
      // All milestones completed
      progressPercentage = 100;
    }
    
    res.status(200).json({
      success: true,
      stats: {
        totalReferrals: stats.totalReferrals,
        activeReferrals: stats.activeReferrals,
        totalEarnings: stats.totalEarnings,
        pendingCommissions: stats.pendingCommissions,
        referralsByLevel: stats.referralsByLevel,
        commissionsByLevel: stats.commissionsByLevel
      },
      milestone: {
        currentProgress,
        progressPercentage,
        nextTarget,
        nextReward,
        isClaimable: currentProgress >= nextTarget && nextTarget > 0
      }
    });
  } catch (error) {
    console.error('Error getting referral stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get referral statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get list of referrals for the current user
 * Endpoint: GET /api/referrals/list
 * Query params: page, limit
 */
exports.getReferralsList = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Get paginated referrals
    const referrals = Referral.getByReferrerIdWithPagination(
      userId, offset, parseInt(limit)
    );
    
    // Get total count
    const totalCount = Referral.countByReferrerId(userId);
    
    // Format referrals for frontend display
    const formattedReferrals = referrals.map(ref => {
      // Get actual deposit amount for this referred user
      const actualDeposits = getTotalDeposits(ref.referredId);
      
      return {
        id: ref.id,
        username: ref.username,
        avatar: null, // You can implement avatar fetching if needed
        joined: ref.joined,
        level: ref.level,
        deposits: actualDeposits, // Real deposit amount instead of estimation
        commission: ref.commissionEarned,
        status: hasCompletedDeposit(ref.referredId) ? 'active' : 'inactive'
      };
    });

    // Helper function to get total deposits
    function getTotalDeposits(userId) {
      const stmt = db.prepare(`
        SELECT SUM(amount) as total FROM transactions 
        WHERE userId = ? AND type = 'Deposit' AND status = 'Completed'
      `);
      const result = stmt.get(userId);
      return result && result.total ? Number(result.total) : 0;
    }

    // Helper function to check if user has completed deposits
    function hasCompletedDeposit(userId) {
      const stmt = db.prepare(`
        SELECT COUNT(*) as count FROM transactions 
        WHERE userId = ? AND type = 'Deposit' AND status = 'Completed'
      `);
      const result = stmt.get(userId);
      return result && result.count > 0;
    }
    
    res.status(200).json({
      success: true,
      referrals: formattedReferrals,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error getting referrals list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get referrals list',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get commission history for the current user
 * Endpoint: GET /api/referrals/commissions
 * Query params: page, limit
 */
exports.getCommissionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Get paginated commission history
    const commissions = Referral.getCommissionHistory(
      userId, offset, parseInt(limit)
    );
    
    // Format commissions for frontend display
    const formattedCommissions = commissions.map(commission => {
      // Create a friendly description
      let description;
      if (commission.level === 1) {
        description = `${commission.referredFirstName} ${commission.referredLastName} (Level 1) deposit commission`;
      } else if (commission.level === 2) {
        description = `${commission.referredFirstName} ${commission.referredLastName} (Level 2) deposit commission`;
      } else {
        description = `${commission.referredFirstName} ${commission.referredLastName} (Level 3) deposit commission`;
      }
      
      return {
        id: commission.id,
        amount: commission.commissionEarned,
        pending: commission.pendingCommission,
        date: commission.updatedAt,
        description,
        username: commission.referredUsername,
        level: commission.level
      };
    });
    
    // Get total earnings and pending commissions
    const totalEarnings = Referral.getTotalCommissionByReferrerId(userId);
    const pendingCommissions = Referral.getPendingCommissionByReferrerId(userId);
    
    res.status(200).json({
      success: true,
      commissions: formattedCommissions,
      totals: {
        earned: totalEarnings,
        pending: pendingCommissions
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting commission history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get commission history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get milestone progress for the current user
 * Endpoint: GET /api/referrals/milestone
 */
exports.getMilestoneProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Ensure milestones are initialized
    Milestone.initializeForUser(userId);
    
    // Get total referrals and active referrals
    const totalReferrals = Referral.countByReferrerId(userId);
    const activeReferrals = Referral.countActiveReferrals(userId); // Added this line
    
    // Get all milestones
    const milestones = Milestone.getByUserId(userId);
    
    // Get next milestone
    const nextMilestone = Milestone.getNextMilestone(userId, totalReferrals); // Added this line
    
    // Original milestone format code (can be kept for backward compatibility)
    const formattedMilestones = milestones.map(milestone => ({
      id: milestone.id,
      level: milestone.level,
      target: milestone.target,
      reward: milestone.reward,
      claimed: milestone.claimed === 1,
      claimable: totalReferrals >= milestone.target && milestone.claimed === 0,
      progress: Math.min(totalReferrals / milestone.target, 1) * 100,
      claimedAt: milestone.claimedAt
    }));
    
    // Send response with the format expected by the frontend
    res.status(200).json({
      success: true,
      currentReferrals: activeReferrals,
      targetReferrals: nextMilestone ? nextMilestone.target : 0,
      milestoneReached: nextMilestone ? totalReferrals >= nextMilestone.target && nextMilestone.claimed === 0 : false,
      // Include the old format for backward compatibility if needed
      milestones: formattedMilestones
    });
  } catch (error) {
    console.error('Error getting milestone progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get milestone progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
/**
 * Claim a milestone reward
 * Endpoint: POST /api/referrals/claim-milestone
 * Body: { milestoneId }
 */
exports.claimMilestoneReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { milestoneId } = req.body;
    
    if (!milestoneId) {
      return res.status(400).json({
        success: false,
        message: 'Milestone ID is required'
      });
    }
    
    // Get the milestone
    const milestone = Milestone.getById(milestoneId);
    
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }
    
    // Check if milestone belongs to the user
    if (milestone.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to claim this milestone'
      });
    }
    
    // Check if milestone is already claimed
    if (milestone.claimed === 1) {
      return res.status(400).json({
        success: false,
        message: 'This milestone has already been claimed'
      });
    }
    
    // Check if user has enough referrals to claim
    const totalReferrals = Referral.countByReferrerId(userId);
    
    if (totalReferrals < milestone.target) {
      return res.status(400).json({
        success: false,
        message: `You need ${milestone.target - totalReferrals} more referrals to claim this reward`
      });
    }
    
    // Get user's wallet
    const wallet = Wallet.findByUserId(userId);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    
    // Start transaction process
    
    // 1. Update milestone as claimed
    const claimResult = Milestone.claimMilestone(milestoneId);
    
    if (!claimResult) {
      throw new Error('Failed to claim milestone');
    }
    
    // 2. Add milestone reward amount to user's balance
    Wallet.updateBalance(
      userId, 
      wallet.balance + milestone.reward,
      wallet.pendingBalance
    );
    
    // 3. Create transaction record for the milestone reward
    Transaction.create({
      userId,
      type: 'ReferralReward',
      amount: milestone.reward,
      status: 'Completed',
      details: JSON.stringify({
        milestoneId: milestone.id,
        milestoneLevel: milestone.level,
        milestoneTarget: milestone.target
      })
    });
    
    // Get user details for email
    const user = User.findById(userId);
    
    // Send email notification about milestone claim
    if (user && user.email) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #4f46e5; margin-bottom: 20px;">Congratulations ${user.firstName}!</h2>
          <p>You've successfully claimed your referral milestone reward!</p>
          <div style="background-color: #f9fafb; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Milestone Level:</strong> ${milestone.level}</p>
            <p style="margin: 5px 0;"><strong>Referrals:</strong> ${milestone.target}</p>
            <p style="margin: 5px 0;"><strong>Reward Amount:</strong> $${milestone.reward.toFixed(2)}</p>
          </div>
          <p>The reward has been added to your wallet balance and is available for immediate use or withdrawal.</p>
          <p>Keep referring friends to earn more rewards!</p>
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      `;
      
      try {
        await sendEmailNotification(
          user.email,
          'Referral Milestone Reward Claimed',
          emailContent
        );
      } catch (emailError) {
        console.error('Failed to send milestone email:', emailError);
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Milestone reward claimed successfully',
      milestone: {
        id: milestone.id,
        level: milestone.level,
        target: milestone.target,
        reward: milestone.reward
      }
    });
  } catch (error) {
    console.error('Error claiming milestone reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to claim milestone reward',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Transfer referral commissions to wallet
 * Endpoint: POST /api/referrals/transfer-commission
 */
exports.transferCommissionToWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get total earnings
    const totalEarnings = Referral.getTotalCommissionByReferrerId(userId);
    
    if (totalEarnings <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No commissions available to transfer'
      });
    }
    
    // Get user's wallet
    const wallet = Wallet.findByUserId(userId);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    
    // Update wallet balance
    Wallet.updateBalance(
      userId,
      wallet.balance + totalEarnings,
      wallet.pendingBalance
    );
    
    // Reset commissions in referrals
    const referrals = Referral.getByReferrerId(userId);
    
    referrals.forEach(ref => {
      if (ref.commissionEarned > 0) {
        // Create transaction record for each referral commission
        Transaction.create({
          userId,
          type: 'ReferralCommission',
          amount: ref.commissionEarned,
          status: 'Completed',
          details: JSON.stringify({
            referralId: ref.id,
            referredUserId: ref.referredId,
            level: ref.level
          })
        });
        
        // Reset commission to zero
        const stmt = db.prepare(`
          UPDATE referrals
          SET commissionEarned = 0,
              updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        stmt.run(ref.id);
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Commission transferred successfully',
      amount: totalEarnings
    });
  } catch (error) {
    console.error('Error transferring commission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transfer commission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Admin endpoints

/**
 * Admin: Get all referrals with pagination
 * Endpoint: GET /api/referrals/admin/all
 * Query params: page, limit
 */
exports.adminGetAllReferrals = async (req, res) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin role required'
      });
    }
    
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Get all referrals with pagination
    const referrals = db.prepare(`
      SELECT r.*, 
             u1.username as referrerUsername, u1.email as referrerEmail,
             u2.username as referredUsername, u2.email as referredEmail
      FROM referrals r
      JOIN users u1 ON r.referrerId = u1.id
      JOIN users u2 ON r.referredId = u2.id
      ORDER BY r.createdAt DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(limit), offset);
    
    // Count total referrals
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM referrals').get().count;
    
    res.status(200).json({
      success: true,
      referrals,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error getting all referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get referrals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Admin: Modify referral commission
 * Endpoint: POST /api/referrals/admin/modify-commission
 * Body: { referralId, amount, action }
 */
exports.adminModifyCommission = async (req, res) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin role required'
      });
    }
    
    const { referralId, amount, action } = req.body;
    
    if (!referralId || !amount || !action) {
      return res.status(400).json({
        success: false,
        message: 'Referral ID, amount and action are required'
      });
    }
    
    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    // Get referral
    const referral = Referral.getById(referralId);
    
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }
    
    if (action === 'add') {
      // Add commission
      Referral.updateCommission(referralId, parsedAmount);
    } else if (action === 'subtract') {
      // Subtract commission (ensure not negative)
      const newCommission = Math.max(0, referral.commissionEarned - parsedAmount);
      const stmt = db.prepare(`
        UPDATE referrals
        SET commissionEarned = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(newCommission, referralId);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "add" or "subtract"'
      });
    }
    
    // Get updated referral
    const updatedReferral = Referral.getById(referralId);
    
    res.status(200).json({
      success: true,
      message: `Commission ${action === 'add' ? 'added' : 'subtracted'} successfully`,
      referral: updatedReferral
    });
  } catch (error) {
    console.error('Error modifying commission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to modify commission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Hook for processing deposits
 * This should be called when a user makes a deposit to calculate commissions
 * @param {number} userId - User ID who made the deposit
 * @param {number} amount - Deposit amount
 */
exports.processDepositForReferrals = async (userId, amount) => {
  try {
    referralLogger.info(`Processing deposit for referrals - User ID: ${userId}, Amount: ${amount}`);
    
    // Get user details
    const user = User.findById(userId);
    if (!user) {
      referralLogger.error(`User ${userId} not found for referral processing`);
      return false;
    }
    
    referralLogger.info(`User found: ${user.username} (${user.email}), ReferredBy: ${user.referredBy}`);
    
    if (!user.referredBy) {
      referralLogger.info(`User ${userId} has no referrer, skipping commission calculation`);
      return false;
    }
    
    // Get the referral chain (up to 3 levels)
    const referralChain = [];
    let currentUserId = userId;
    let level = 0;
    
    while (currentUserId && level < 3) {
      const currentUser = User.findById(currentUserId);
      if (!currentUser || !currentUser.referredBy) break;
      
      const referrerId = currentUser.referredBy;
      referralChain.push({
        level: ++level,
        userId: currentUserId,
        referrerId: referrerId
      });
      
      referralLogger.info(`Found Level ${level} referrer: ${referrerId} for user ${currentUserId}`);
      currentUserId = referrerId;
    }
    
    if (referralChain.length === 0) {
      referralLogger.info(`No referrers found in chain for user ${userId}`);
      return false;
    }
    
    // Process the deposit for commissions
    const result = await Referral.processDepositForCommissions(userId, amount);
    
    referralLogger.info(`Referral commission processing completed: ${result ? 'Success' : 'Failed'}`);
    return result;
  } catch (error) {
    referralLogger.error(`Error processing deposit for referrals: ${error.message}`, { 
      userId, 
      amount, 
      stack: error.stack 
    });
    return false;
  }
};
