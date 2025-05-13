/**
 * referralMiddleware.js
 * Middleware to handle referral processing for deposits
 */

const { processDepositForReferrals } = require('../controller/ReferralController');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// No-op logger as a replacement for referralLogger
const referralLogger = {
  info: () => {},
  error: () => {},
  warning: () => {},
  debug: () => {}
};

/**
 * Middleware that registers hooks to process referral commissions after deposit
 * This is applied to all routes to catch deposit transactions
 */
exports.setupReferralHooks = (req, res, next) => {
  // Store the original json method
  const originalJson = res.json;
  
  // Override the json method to intercept responses
  res.json = function(data) {
    // After sending the response, check if this was a successful deposit
    const isSuccessfulDeposit = 
      req.path.includes('/api/wallet') &&
      req.method === 'POST' &&
      data && data.success === true &&
      req.body && req.body.amount &&
      (req.path.includes('/deposit') || req.originalUrl.includes('/deposit'));
    
    if (isSuccessfulDeposit && req.user) {
      const userId = req.user.id;
      const amount = parseFloat(req.body.amount);
      
      referralLogger.info(`Deposit detected via API response hook - User: ${userId}, Amount: ${amount}`, 
        { deposit: { userId, amount, path: req.path } }, true);
      
      // Process the deposit for referrals asynchronously (don't block response)
      processDepositForReferrals(userId, amount)
        .then(result => {
          referralLogger.info(`Referral commission processing completed for deposit - Success: ${result}`, 
            { userId, amount, result }, true);
        })
        .catch(error => {
          referralLogger.error(`Error processing referral commission: ${error.message}`, 
            { userId, amount, error: error.stack }, true);
        });
    }
    
    // Call the original json method
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Hook into Transaction model creation to catch deposits
 * This function should be called once on server start
 */
exports.hookTransactionCreation = () => {
  referralLogger.info('Setting up referral hooks for Transaction creation');
  
  // Store the original create method
  const originalTransactionCreate = Transaction.create;
  
  // Override the create method
  Transaction.create = function(transactionData) {
    // Call the original method first
    const result = originalTransactionCreate.call(this, transactionData);
    
    // Check if this is a successful deposit and process referrals
    if (
      result && 
      transactionData && 
      transactionData.userId &&
      transactionData.type && 
      transactionData.type.toLowerCase() === 'deposit' &&
      transactionData.status && 
      transactionData.status.toLowerCase() === 'completed' &&
      transactionData.amount
    ) {
      const userId = transactionData.userId;
      const amount = parseFloat(transactionData.amount);
      
      referralLogger.info(`Deposit detected via Transaction.create hook - User: ${userId}, Amount: ${amount}`, 
        { deposit: { userId, amount, transactionId: result.id } }, true);
      
      // Process the deposit for referrals asynchronously
      processDepositForReferrals(userId, amount)
        .then(result => {
          referralLogger.info(`Referral commission processing completed for Transaction ID ${result ? 'successfully' : 'with errors'}`, 
            { userId, amount, result }, true);
        })
        .catch(error => {
          referralLogger.error(`Error processing referral commission in Transaction hook: ${error.message}`, 
            { userId, amount, error: error.stack }, true);
        });
    }
    
    return result;
  };
  
  referralLogger.info('Transaction.create hook for referral processing established');
  return true;
};

/**
 * Debug endpoint middleware - Tests referral chain for a user
 */
exports.debugReferralChain = async (req, res) => {
  try {
    const userId = req.params.userId || (req.user ? req.user.id : null);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Get user details
    const user = User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Build referral chain (upstream)
    const referralChain = [];
    let currentUser = user;
    let level = 0;
    let maxLevels = 5; // Prevent infinite loops
    
    while (currentUser && currentUser.referredBy && level < maxLevels) {
      const referrer = User.findById(currentUser.referredBy);
      if (!referrer) break;
      
      referralChain.push({
        level: ++level,
        userId: referrer.id,
        username: referrer.username,
        email: referrer.email,
        firstName: referrer.firstName,
        lastName: referrer.lastName,
        referralCode: referrer.referralCode,
        joinedAt: referrer.createdAt
      });
      
      currentUser = referrer;
    }
    
    // Get users who this user referred
    const referredUsers = [];
    const referredByThisUser = User.findByReferredBy(userId);
    
    referredByThisUser.forEach(referred => {
      referredUsers.push({
        userId: referred.id,
        username: referred.username,
        email: referred.email,
        firstName: referred.firstName,
        lastName: referred.lastName,
        joinedAt: referred.createdAt
      });
    });
    
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        referralCode: user.referralCode,
        referredBy: user.referredBy
      },
      referralChain,
      referredUsers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    referralLogger.error(`Error in debug referral chain: ${error.message}`, {
      error: error.stack,
      userId: req.params.userId
    });
    
    res.status(500).json({
      success: false,
      message: 'Error processing referral debug request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Debug endpoint middleware - Test referral commission calculation
 */
exports.testCommissionCalculation = async (req, res) => {
  try {
    // For security reasons, only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }
    
    const { userId, amount } = req.body;
    
    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'User ID and amount are required'
      });
    }
    
    referralLogger.info(`Manual commission calculation test - User ID: ${userId}, Amount: ${amount}`, 
      { userId, amount, requestedBy: req.user.id }, true);
    
    const result = await processDepositForReferrals(userId, parseFloat(amount));
    
    res.status(200).json({
      success: true,
      message: 'Commission calculation test completed',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    referralLogger.error(`Error in test commission calculation: ${error.message}`, {
      error: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Error processing test commission calculation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
