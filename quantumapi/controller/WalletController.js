/**
 * WalletController.js
 * Handles all wallet-related operations including balance management,
 * transaction history, deposits and withdrawals
 */
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Notification = require('../models/Notification');
const bcrypt = require('bcrypt');
const db = require('../database');
const { generateQRCode } = require('../utils/qrCodeGenerator');
const { validateWalletAddress, sendEmailNotification, sendAdminNotification, sendUsdt } = require('../utils/WalletUtils'); // Added sendUsdt
const { sendVerificationEmail } = require('../utils/emailService');

/**
 * Get wallet summary with balance, stats and chart data
 * Endpoint: GET /api/wallet/summary
 */
exports.getWalletSummary = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id;
    
    // Get wallet data
    let wallet = Wallet.findByUserId(userId);
    
    // If wallet doesn't exist, create one automatically
    if (!wallet) {
      console.log(`No wallet found for user ${userId}. Creating new wallet...`);
      wallet = await Wallet.createForUser(userId);
      
      if (!wallet) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create wallet for user'
        });
      }
      
      console.log(`Created new wallet for user ${userId} with TRC20 address: ${wallet.trc20_address}`);
    }

    // Get deposit and withdrawal totals
    const totalDeposits = Transaction.getTotalAmountByTypeAndUserId('Deposit', userId, 'Completed') || 0;
    const totalWithdrawals = Transaction.getTotalAmountByTypeAndUserId('Withdrawal', userId, 'Completed') || 0;
    
    // Get chart data (last 6 months of balance history)
    const chartData = await getBalanceChartData(userId);
    
    res.status(200).json({
      success: true,
      balance: {
        total: wallet.balance + wallet.pendingBalance,
        available: wallet.balance,
        pending: wallet.pendingBalance
      },
      stats: {
        totalDeposits: totalDeposits,
        totalWithdrawals: totalWithdrawals
      },
      chartData,
      wallet: {
        address: wallet.trc20_address,
        createdAt: wallet.createdAt,
        hasPin: !!wallet.pin
      }
    });
  } catch (error) {
    console.error('Error fetching wallet summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get wallet balance (simplified endpoint)
 * Endpoint: GET /api/wallet/balance
 */
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get wallet for user
    const wallet = Wallet.findByUserId(userId);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    
    res.status(200).json({
      success: true,
      balance: {
        total: wallet.balance + wallet.pendingBalance,
        available: wallet.balance,
        pending: wallet.pendingBalance
      }
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Change wallet PIN
 * Endpoint: POST /api/wallet/change-pin
 * Body: { currentPin, newPin, confirmPin }
 */
exports.changeWalletPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPin, newPin, confirmPin } = req.body;

    // Validate inputs
    if (newPin !== confirmPin) {
      return res.status(400).json({
        success: false,
        message: 'New PINs do not match'
      });
    }

    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be 4-6 digits'
      });
    }
    
    // Get wallet for user
    const wallet = Wallet.findByUserId(userId);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    
    // Check if setting new PIN for first time
    if (!wallet.pin && !currentPin) {
      // First time setting PIN - no current PIN needed
      const hashedPin = await bcrypt.hash(newPin, 10);
      Wallet.updatePin(userId, hashedPin);
      
      // Get user email for notification
      const user = User.findById(userId);
      
      if (user && user.email) {
        // Send notification email
        const emailContent = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #4CAF50;">Wallet Security Update</h2>
            <p>Hello ${user.firstName || 'Valued Customer'},</p>
            <p>Your wallet PIN has been set successfully.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p>Thank you for choosing our platform!</p>
            <p style="color: #888; font-size: 0.9em;">This is an automated message. Please do not reply to this email.</p>
          </div>
        `;
        await sendVerificationEmail(user.email, null, null, emailContent);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Wallet PIN set successfully'
      });
    }
    
    // If already has PIN, need to verify current PIN
    if (!currentPin) {
      return res.status(400).json({
        success: false,
        message: 'Current PIN is required'
      });
    }
    
    // Verify current PIN
    const isPinValid = await bcrypt.compare(currentPin, wallet.pin);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Current PIN is incorrect'
      });
    }
    
    // Update PIN
    const hashedPin = await bcrypt.hash(newPin, 10);
    Wallet.updatePin(userId, hashedPin);
    
    // Get user email for notification
    const user = User.findById(userId);
    
    if (user && user.email) {
      // Send notification email
      const emailContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #4CAF50;">Wallet Security Update</h2>
          <p>Hello ${user.firstName || 'Valued Customer'},</p>
          <p>Your wallet PIN has been updated successfully.</p>
          <p>If you did not make this change, please contact our support team immediately.</p>
          <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p>Thank you for choosing our platform!</p>
          <p style="color: #888; font-size: 0.9em;">This is an automated message. Please do not reply to this email.</p>
        </div>
      `;
      await sendVerificationEmail(user.email, null, null, emailContent);
    }
    
    res.status(200).json({
      success: true,
      message: 'Wallet PIN updated successfully'
    });
  } catch (error) {
    console.error('Error changing wallet PIN:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change wallet PIN',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get transaction history with pagination and filtering
 * Endpoint: GET /api/wallet/history
 * Query params: page, limit, type, status
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, type, status } = req.query;
    
    const offset = (page - 1) * limit;
    
    let transactions;
    let totalCount;

    // Handle different filter combinations
    if (type && status) {
      // Filter by both type and status
      transactions = Transaction.getByUserIdTypeAndStatusWithPagination(
        userId, type, status, offset, parseInt(limit)
      );
      totalCount = Transaction.countByUserIdTypeAndStatus(userId, type, status);
    } else if (type) {
      // Filter by type only
      transactions = Transaction.getByUserIdAndTypeWithPagination(
        userId, type, offset, parseInt(limit)
      );
      totalCount = Transaction.countByUserIdAndType(userId, type);
    } else if (status) {
      // Filter by status only
      transactions = Transaction.getByUserIdAndStatusWithPagination(
        userId, status, offset, parseInt(limit)
      );
      totalCount = Transaction.countByUserIdAndStatus(userId, status);
    } else {
      // No filters
      transactions = Transaction.getByUserIdWithPagination(
        userId, offset, parseInt(limit)
      );
      totalCount = Transaction.countByUserId(userId);
    }
    
    // Format transactions for client display
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      date: tx.createdAt,
      status: tx.status,
      details: tx.details ? JSON.parse(tx.details) : {},
      completedAt: tx.completedAt
    }));
    
    res.status(200).json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get deposit address for specific network
 * Endpoint: GET /api/wallet/deposit-address
 * Query param: network
 */
exports.getDepositAddress = async (req, res) => {
  try {
    const { network } = req.query;
    const userId = req.user.id;
    
    if (!network) {
      return res.status(400).json({ 
        success: false,
        message: 'Network parameter is required'
      });
    }
    
    // Get wallet for user
    const wallet = Wallet.findByUserId(userId);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // Get address based on network
    let address = '';
    
    switch(network.toUpperCase()) {
      case 'TRC20':
        address = wallet.trc20_address;
        break;
      case 'BTC':
        address = wallet.btc_address || await generateOrGetAddressForNetwork(userId, 'BTC');
        break;
      case 'ETH':
        address = wallet.eth_address || await generateOrGetAddressForNetwork(userId, 'ETH');
        break;
      default:
        address = await generateOrGetAddressForNetwork(userId, network);
    }
    
    if (!address) {
      return res.status(404).json({
        success: false,
        message: `No deposit address available for network: ${network}`
      });
    }
    
    // Generate QR code
    const qrCodeUrl = await generateQRCode(address);
    
    res.status(200).json({
      success: true,
      address,
      qrCodeUrl,
      network: network.toUpperCase()
    });
  } catch (error) {
    console.error('Error getting deposit address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get deposit address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Process withdrawal request
 * Endpoint: POST /api/wallet/withdraw
 * Body: { amount, walletAddress, network }
 */
// ...existing code...
exports.requestWithdrawal = async (req, res) => {
  console.log('[requestWithdrawal] Entered function'); // Log 1: Entry point
  try {
    const { amount, walletAddress, network } = req.body;
    const userId = req.user.id;
    console.log(`[requestWithdrawal] User ID: ${userId}, Amount: ${amount}, Network: ${network}, Address: ${walletAddress}`); // Log 2: Inputs

    // Validate input
    if (!amount || !walletAddress || !network) {
      console.log('[requestWithdrawal] Validation failed: Missing amount, walletAddress, or network');
      return res.status(400).json({
        success: false,
        message: 'Amount, wallet address, and network are required'
      });
    }
    
    // Check if amount is valid
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.log('[requestWithdrawal] Validation failed: Invalid withdrawal amount');
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount'
      });
    }
    
    // Validate minimum withdrawal amount
    const minWithdrawal = 10; // Example minimum amount
    if (parsedAmount < minWithdrawal) {
      console.log('[requestWithdrawal] Validation failed: Amount less than minimum');
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ${minWithdrawal} USDT`
      });
    }
    
    // Validate wallet address format
    if (!validateWalletAddress(walletAddress, network)) {
      console.log('[requestWithdrawal] Validation failed: Invalid wallet address format');
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format for selected network'
      });
    }
    
    console.log('[requestWithdrawal] Input validation passed. Fetching wallet...');
    // Get user wallet
    const wallet = Wallet.findByUserId(userId);
    
    if (!wallet) {
      console.log('[requestWithdrawal] Wallet not found for user: ' + userId);
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    console.log('[requestWithdrawal] Wallet found. Checking balance...');
    
    // Check if user has enough balance
    if (wallet.balance < parsedAmount) {
      console.log('[requestWithdrawal] Insufficient funds (before fee)');
      return res.status(400).json({
        success: false,
        message: 'Insufficient funds'
      });
    }
    
    // Calculate fee (1 USDT fixed for now)
    const fee = 1;
    const totalWithFee = parsedAmount + fee;
    
    // Check again with fee included
    if (wallet.balance < totalWithFee) {
      console.log('[requestWithdrawal] Insufficient funds (after fee)');
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Withdrawal amount plus fee (${fee} USDT) exceeds available balance.`
      });
    }
    console.log('[requestWithdrawal] Balance check passed. Proceeding to create transaction.');
    
    let withdrawalInfo; // Renamed to avoid confusion, and to reflect it's an info object
    try {
      console.log('[requestWithdrawal] Attempting to call Transaction.create...'); // Log 3: Before Transaction.create call
      withdrawalInfo = await Transaction.create({
        userId,
        type: 'withdrawal', 
        amount: parsedAmount,
        status: 'pending',  
        details: JSON.stringify({
          walletAddress,
          network,
          fee: fee
        })
      });
      
      // Log the raw object returned by Transaction.create
      console.log('[requestWithdrawal] Info object from Transaction.create:', withdrawalInfo); 

      // Correctly check if the transaction was created and an ID was returned
      if (!withdrawalInfo || !withdrawalInfo.id) {
        console.error('[requestWithdrawal] Failed to create withdrawal transaction record or retrieve its ID for User: ' + userId, withdrawalInfo);
        return res.status(500).json({
          success: false,
          message: 'Failed to process withdrawal request. Please try again later. DB issue.'
        });
      }

      const transactionId = withdrawalInfo.id;
      // Log successful transaction creation with the correct ID
      console.log(`[requestWithdrawal] Withdrawal transaction created successfully: ID ${transactionId} for User ${userId}`);
      
      // Update wallet balance (deduct amount with fee) with proper error handling
      const newBalance = wallet.balance - totalWithFee;
// ...existing code...
    } catch (txError) {
      console.error('[requestWithdrawal] Error during Transaction.create or subsequent logic in inner try:', txError); // Enhanced log
      return res.status(500).json({
        success: false,
        message: 'System error processing withdrawal. Please try again later. DB op failed.'
      });
    }
  } catch (error) {
    console.error('[requestWithdrawal] Error in outer try block:', error); // Enhanced log
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Admin only: Process pending withdrawal
 * Endpoint: POST /api/wallet/admin/process-withdrawal
 * Body: { transactionId, action, notes }
 */
exports.processWithdrawal = async (req, res) => {
  const transactionIdParam = req.params.id;
  const { action, notes, txHash: manualTxHash } = req.body;

  console.log(`[processWithdrawal] Admin processing withdrawal ID: ${transactionIdParam}, Action: ${action}`);

  try {
    const transactionId = parseInt(transactionIdParam, 10);
    if (isNaN(transactionId)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID format.' });
    }

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return res.status(400).json({ success: false, message: "Invalid action. Must be 'approve' or 'reject'." });
    }

    const transaction = Transaction.getById(transactionId);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Withdrawal transaction not found.' });
    }
    if (transaction.type.toLowerCase() !== 'withdrawal') {
      return res.status(400).json({ success: false, message: 'Transaction is not a withdrawal.' });
    }
    if (transaction.status.toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `Withdrawal is not pending. Current status: ${transaction.status}` });
    }

    const user = User.findById(transaction.userId);
    if (!user) {
      console.error(`[processWithdrawal] User not found for transaction ID ${transactionId}, UserID: ${transaction.userId}`);
      return res.status(500).json({ success: false, message: 'Associated user not found. Internal error.' });
    }

    const wallet = Wallet.findByUserId(transaction.userId);
    if (!wallet) {
      console.error(`[processWithdrawal] Wallet not found for User ID ${transaction.userId}`);
      return res.status(500).json({ success: false, message: 'User wallet not found. Internal error.' });
    }

    const transactionDetails = JSON.parse(transaction.details || '{}');
    const withdrawalAmount = parseFloat(transaction.amount);
    const fee = parseFloat(transactionDetails.fee || 0);
    const userWithdrawalAddress = transactionDetails.walletAddress;

    if (action === 'approve') {
      console.log(`[processWithdrawal] Approving withdrawal ID ${transactionId} for amount ${withdrawalAmount} USDT to address ${userWithdrawalAddress}.`);
      
      let finalTxHash = manualTxHash;
      let transferSuccessful = true;
      let transferError = null;
      const systemAdminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

      if (!systemAdminPrivateKey) {
          console.error('[processWithdrawal] CRITICAL ERROR: ADMIN_PRIVATE_KEY is not set in .env. Cannot perform automated transfer.');
          // Update transaction to 'failed' or a special 'admin_review_needed' status
          Transaction.updateStatus(transactionId, 'failed', 'System configuration error: Admin private key missing.', null);
          return res.status(500).json({ success: false, message: 'System configuration error. Withdrawal cannot be processed automatically.' });
      }

      if (finalTxHash) {
        console.log(`[processWithdrawal] Admin provided manualTxHash: ${finalTxHash}. Assuming external transfer is done.`);
      } else {
        // No manualTxHash, attempt automated transfer
        console.log(`[processWithdrawal] No manualTxHash provided. Attempting automated TRC20 USDT transfer for TX ID ${transactionId}.`);
        
        try {
          // The 'fromAddress' for sendUsdt can be null/undefined if the tronWeb instance in WalletUtils
          // is globally set with the admin private key, or sendUsdt handles deriving it.
          // WalletUtils.sendUsdt takes privateKey directly.
          const payoutResult = await sendUsdt(
            null, // fromAddress can be derived by tronWeb if privateKey is set
            userWithdrawalAddress, 
            withdrawalAmount, 
            systemAdminPrivateKey, // Pass the admin's private key
            'TRC20'
          );

          if (payoutResult && payoutResult.success && payoutResult.txHash) {
            finalTxHash = payoutResult.txHash;
            console.log(`[processWithdrawal] Automated transfer successful for TX ID ${transactionId}. txHash: ${finalTxHash}`);
          } else {
            transferSuccessful = false;
            transferError = (payoutResult && payoutResult.error) ? payoutResult.error : 'Automated transfer failed. Unknown error from sendUsdt.';
            console.error(`[processWithdrawal] Automated transfer FAILED for TX ID ${transactionId}: ${transferError}`);
          }
        } catch (payoutServiceError) {
          transferSuccessful = false;
          transferError = payoutServiceError.message || 'Exception during automated transfer.';
          console.error(`[processWithdrawal] Automated transfer EXCEPTION for TX ID ${transactionId}:`, payoutServiceError);
        }
      }

      if (transferSuccessful) {
        Transaction.updateStatus(transactionId, 'completed', notes, finalTxHash);

        const approvalMessage = `Your withdrawal request for ${withdrawalAmount.toFixed(2)} USDT (Transaction ID: ${transactionId}) has been approved and processed. Transaction Hash: ${finalTxHash}.`;
        await Notification.create({ userId: transaction.userId, title: 'Withdrawal Approved', message: approvalMessage, type: 'success' });
        if (user.email) {
          try {
            await sendVerificationEmail(user.email, 'Withdrawal Approved & Processed', null, `<p>${approvalMessage}</p><p>Admin notes: ${notes || 'N/A'}</p>`);
          } catch (emailError) {
            console.error(`[processWithdrawal] Failed to send approval email to ${user.email}:`, emailError);
          }
        }
        console.log(`[processWithdrawal] Withdrawal ID ${transactionId} marked as 'completed'.`);
        return res.status(200).json({ success: true, message: 'Withdrawal approved and processed successfully.', txHash: finalTxHash });
      } else {
        // Automated transfer failed
        console.error(`[processWithdrawal] Processing FAILED for withdrawal ID ${transactionId}. Reason: ${transferError}`);
        // Update transaction status to 'failed' and include the error
        Transaction.updateStatus(transactionId, 'failed', `Admin approved, but automated transfer failed: ${transferError}. ${notes || ''}`, null);
        
        // IMPORTANT: Since the funds were deducted from user's balance at the time of request,
        // and the automated transfer failed, we MUST refund the user.
        const amountToRefund = withdrawalAmount + fee;
        const currentBalance = parseFloat(wallet.balance);
        const newBalance = currentBalance + amountToRefund;

        console.log(`[processWithdrawal] Refunding ${amountToRefund} to User ID ${transaction.userId} due to failed automated transfer. Old Balance: ${currentBalance}, New Balance: ${newBalance}`);
        Wallet.updateBalance(transaction.userId, newBalance, wallet.pendingBalance);

        const failureMessage = `Your withdrawal request for ${withdrawalAmount.toFixed(2)} USDT (Transaction ID: ${transactionId}) was approved by an admin, but the automated transfer failed. The amount of ${amountToRefund.toFixed(2)} USDT (including fee) has been returned to your wallet. Please contact support. Error: ${transferError}`;
        await Notification.create({ userId: transaction.userId, title: 'Withdrawal Processing Failed', message: failureMessage, type: 'error' });
        if (user.email) {
           try {
            await sendVerificationEmail(user.email, 'Withdrawal Processing Failed', null, `<p>${failureMessage}</p>`);
           } catch (emailError) {
            console.error(`[processWithdrawal] Failed to send processing failure email to ${user.email}:`, emailError);
           }
        }
        // Optionally notify admin about the failure
        await sendAdminNotification('Automated Withdrawal Failed', { transactionId, userId: transaction.userId, amount: withdrawalAmount, error: transferError });

        return res.status(500).json({ success: false, message: `Withdrawal approved but automated transfer failed: ${transferError}` });
      }

    } else if (action === 'reject') {
      // --- Rejection Logic ---
      console.log(`[processWithdrawal] Rejecting withdrawal ID ${transactionId}.`);

      const amountToRefund = withdrawalAmount + fee;
      const currentBalance = parseFloat(wallet.balance);
      const newBalance = currentBalance + amountToRefund;

      console.log(`[processWithdrawal] Refunding ${amountToRefund} to User ID ${transaction.userId}. Old Balance: ${currentBalance}, New Balance: ${newBalance}`);
      Wallet.updateBalance(transaction.userId, newBalance, wallet.pendingBalance); 

      Transaction.updateStatus(transactionId, 'rejected', notes);

      const rejectionReason = notes ? `Reason: ${notes}` : 'Please contact support for more details.';
      const rejectionMessage = `Your withdrawal request for ${withdrawalAmount.toFixed(2)} USDT (Transaction ID: ${transactionId}) has been rejected. The amount of ${amountToRefund.toFixed(2)} USDT (including fee) has been credited back to your wallet. ${rejectionReason}`;
      await Notification.create({ userId: transaction.userId, title: 'Withdrawal Rejected', message: rejectionMessage, type: 'error' });
       if (user.email) {
        try {
            await sendVerificationEmail(user.email, 'Withdrawal Request Rejected', null, `<p>${rejectionMessage}</p>`);
        } catch (emailError) {
            console.error(`[processWithdrawal] Failed to send rejection email to ${user.email}:`, emailError);
        }
      }

      console.log(`[processWithdrawal] Withdrawal ID ${transactionId} rejected. Amount ${amountToRefund} refunded.`);
      return res.status(200).json({ success: true, message: 'Withdrawal rejected successfully and funds returned to user.' });
    }

  } catch (error) {
    console.error(`[processWithdrawal] Error processing withdrawal ID ${transactionIdParam}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process withdrawal.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
/**
 * Admin only: Get all pending withdrawals
 * Endpoint: GET /api/admin/withdrawals
 */
exports.getPendingWithdrawals = async (req, res) => {
  try {
    // The isAdmin middleware has already verified admin access for this route.
    // The check (!req.user || !req.user.isAdmin) is removed from here as it was causing a conflict
    // because req.user.isAdmin might be undefined even if req.user.role is 'admin'.
    
    // Optional search parameter
    const search = req.query.search ? req.query.search.toLowerCase() : null;
    
    // Get all pending withdrawals (and also completed/rejected ones for history)
    let withdrawals = [];
    
    if (search) {
      // If searching, we need to join with the users table to search by name/email
      const stmt = db.prepare(`
        SELECT t.*, u.firstName, u.lastName, u.email, u.username
        FROM transactions t
        JOIN users u ON t.userId = u.id
        WHERE t.type = 'Withdrawal' AND 
              (u.firstName LIKE ? OR u.lastName LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR t.id LIKE ?)
        ORDER BY t.createdAt DESC
        LIMIT 50
      `);
      const searchParam = `%${search}%`;
      withdrawals = stmt.all(searchParam, searchParam, searchParam, searchParam, searchParam);
    } else {    // If not searching, get all withdrawal transactions with improved filtering      // First, get pending withdrawals (most important for admin to see)
      // Using LOWER() to make the query case-insensitive
      const pendingWithdrawals = db.prepare(`
        SELECT * FROM transactions
        WHERE LOWER(type) = 'withdrawal' AND LOWER(status) = 'pending'
        ORDER BY createdAt DESC
      `).all();
      
      console.log(`Found ${pendingWithdrawals.length} pending withdrawals`);
        // Then get most recent non-pending withdrawals (completed/rejected)
      // Using LOWER() to make the query case-insensitive
      const recentOtherWithdrawals = db.prepare(`
        SELECT * FROM transactions
        WHERE LOWER(type) = 'withdrawal' AND LOWER(status) != 'pending'
        ORDER BY createdAt DESC
        LIMIT 30
      `).all();
      
      // Combine the results, with pending first
      withdrawals = [...pendingWithdrawals, ...recentOtherWithdrawals];
    }
    
    // Enhance with user data
    const enhancedWithdrawals = withdrawals.map(withdrawal => {
      const user = User.findById(withdrawal.userId);
      if (!user) {
        return {
          ...withdrawal,
          user: { id: withdrawal.userId, fullName: 'Unknown User', email: 'Unknown' },
          details: withdrawal.details ? JSON.parse(withdrawal.details) : {}
        };
      }
      
      return {
        ...withdrawal,
        user: {
          id: user.id,
          username: user.username || '',
          email: user.email || '',
          fullName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.username || 'Unknown')
        },
        details: withdrawal.details ? JSON.parse(withdrawal.details) : {}
      };
    });
    
    res.status(200).json({
      success: true,
      withdrawals: enhancedWithdrawals,
      count: enhancedWithdrawals.length
    });
    
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// --- Helper Functions ---

/**
 * Generate balance chart data for the last 6 months
 */
async function getBalanceChartData(userId) {
  // Get transaction data and generate chart points
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const transactions = Transaction.getByUserIdSince(userId, sixMonthsAgo.toISOString());
  
  // Process transactions to create monthly balance points
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  
  // Generate labels for the last 6 months
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    labels.push(months[monthIndex]);
  }
  
  // Calculate cumulative balance for each month
  let balance = 0;
  const data = [0, 0, 0, 0, 0, 0]; // Initialize with zeros
  
  transactions.forEach(tx => {
    const txDate = new Date(tx.createdAt);
    const monthsAgo = (currentMonth - txDate.getMonth() + 12) % 12;
    
    if (monthsAgo <= 5) {
      const amount = tx.type === 'Deposit' ? tx.amount : 
                    tx.type === 'Withdrawal' ? -tx.amount : 0;
      balance += amount;
      
      // Update all months from this point forward
      for (let i = 5 - monthsAgo; i < 6; i++) {
        data[i] = balance;
      }
    }
  });
  
  return {
    labels,
    datasets: [{
      label: 'Balance',
      data,
      borderColor: '#6366f1',
      tension: 0.1,
      fill: false
    }]
  };
}


/**
 * Admin only: Process a pending withdrawal (approve or reject)
 * Endpoint: POST /api/admin/withdrawals/:id/process  (or your defined route)
 * Body: { action: 'approve' | 'reject', notes?: string, txHash?: string (if manual approval) }
 */
exports.processWithdrawal = async (req, res) => {
  const transactionIdParam = req.params.id;
  const { action, notes, txHash: manualTxHash } = req.body; // txHash can be provided if admin processed manually

  console.log(`[processWithdrawal] Admin processing withdrawal ID: ${transactionIdParam}, Action: ${action}`);

  try {
    const transactionId = parseInt(transactionIdParam, 10);
    if (isNaN(transactionId)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID format.' });
    }

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return res.status(400).json({ success: false, message: "Invalid action. Must be 'approve' or 'reject'." });
    }

    const transaction = Transaction.getById(transactionId);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Withdrawal transaction not found.' });
    }
    if (transaction.type.toLowerCase() !== 'withdrawal') {
      return res.status(400).json({ success: false, message: 'Transaction is not a withdrawal.' });
    }
    if (transaction.status.toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `Withdrawal is not pending. Current status: ${transaction.status}` });
    }

    const user = User.findById(transaction.userId);
    if (!user) {
      // This should ideally not happen if a transaction exists for a user
      console.error(`[processWithdrawal] User not found for transaction ID ${transactionId}, UserID: ${transaction.userId}`);
      return res.status(500).json({ success: false, message: 'Associated user not found. Internal error.' });
    }

    const wallet = Wallet.findByUserId(transaction.userId);
    if (!wallet) {
      console.error(`[processWithdrawal] Wallet not found for User ID ${transaction.userId}`);
      return res.status(500).json({ success: false, message: 'User wallet not found. Internal error.' });
    }

    const transactionDetails = JSON.parse(transaction.details || '{}');
    const withdrawalAmount = parseFloat(transaction.amount); // This is the amount the user requested to withdraw
    const fee = parseFloat(transactionDetails.fee || 0);
    // const amountIncludingFee = withdrawalAmount + fee; // This was deducted initially

    if (action === 'approve') {
      // --- Approval Logic ---
      console.log(`[processWithdrawal] Approving withdrawal ID ${transactionId} for amount ${withdrawalAmount} USDT.`);
      
      // TODO: Implement actual external transfer logic here if applicable.
      // For now, we assume it's successful or admin provides a txHash.
      const finalTxHash = manualTxHash || `SIMULATED_TX_${Date.now()}_${transactionId}`; // Simulated if not provided

      Transaction.updateStatus(transactionId, 'completed', notes, finalTxHash);

      // Notify User
      const approvalMessage = `Your withdrawal request for ${withdrawalAmount.toFixed(2)} USDT (Transaction ID: ${transactionId}) has been approved and processed. Transaction Hash: ${finalTxHash}.`;
      await Notification.create({ userId: transaction.userId, title: 'Withdrawal Approved', message: approvalMessage, type: 'success' });
      if (user.email) {
        try {
            await sendVerificationEmail(user.email, 'Withdrawal Approved & Processed', null, `<p>${approvalMessage}</p><p>Admin notes: ${notes || 'N/A'}</p>`);
        } catch (emailError) {
            console.error(`[processWithdrawal] Failed to send approval email to ${user.email}:`, emailError);
        }
      }
      
      console.log(`[processWithdrawal] Withdrawal ID ${transactionId} approved.`);
      res.status(200).json({ success: true, message: 'Withdrawal approved successfully.', txHash: finalTxHash });

    } else if (action === 'reject') {
      // --- Rejection Logic ---
      console.log(`[processWithdrawal] Rejecting withdrawal ID ${transactionId}.`);

      // The amount (withdrawalAmount + fee) was already "deducted" or put on hold from the user's balance
      // when the requestWithdrawal was made. Now we need to refund it.
      const amountToRefund = withdrawalAmount + fee;
      const currentBalance = parseFloat(wallet.balance);
      const newBalance = currentBalance + amountToRefund;

      console.log(`[processWithdrawal] Refunding ${amountToRefund} to User ID ${transaction.userId}. Old Balance: ${currentBalance}, New Balance: ${newBalance}`);
      Wallet.updateBalance(transaction.userId, newBalance, wallet.pendingBalance); // Assuming pendingBalance is not affected here or handled by updateBalance

      Transaction.updateStatus(transactionId, 'rejected', notes);

      // Notify User
      const rejectionReason = notes ? `Reason: ${notes}` : 'Please contact support for more details.';
      const rejectionMessage = `Your withdrawal request for ${withdrawalAmount.toFixed(2)} USDT (Transaction ID: ${transactionId}) has been rejected. The amount of ${amountToRefund.toFixed(2)} USDT (including fee) has been credited back to your wallet. ${rejectionReason}`;
      await Notification.create({ 
        userId: transaction.userId, 
        title: 'Withdrawal Rejected', 
        message: rejectionMessage, 
        type: 'danger'  // Changed from 'error' to 'danger'
      });
      if (user.email) {
        try {
            await sendVerificationEmail(user.email, 'Withdrawal Request Rejected', null, `<p>${rejectionMessage}</p>`);
        } catch (emailError) {
            console.error(`[processWithdrawal] Failed to send rejection email to ${user.email}:`, emailError);
        }
      }

      console.log(`[processWithdrawal] Withdrawal ID ${transactionId} rejected. Amount ${amountToRefund} refunded.`);
      res.status(200).json({ success: true, message: 'Withdrawal rejected successfully and funds returned to user.' });
    }

  } catch (error) {
    console.error(`[processWithdrawal] Error processing withdrawal ID ${transactionIdParam}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process withdrawal.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


/**
 * Generate or retrieve deposit address for different networks
 */
async function generateOrGetAddressForNetwork(userId, network) {
  // This function would typically call an external service or wallet management system
  // For now, we'll return a mock address based on userId and network
  
  // In a real-world implementation, you might:
  // 1. Check if user already has an address for this network in your database
  // 2. If not, generate one using a wallet service or API
  // 3. Store the new address in your database
  // 4. Return the address
  
  // Mock implementation
  const networkPrefix = {
    'BTC': 'bc1',
    'ETH': '0x',
    'BSC': '0x',
    'TRX': 'T',
    'SOL': 'sol',
    'TRC20': 'T'
  }[network.toUpperCase()] || 'addr';
  
  const mockAddress = `${networkPrefix}${userId}abcdef123456789${Date.now().toString().slice(-6)}`;
  
  return mockAddress;
}

/**
 * Get user's transaction history filtered by type (withdrawal or deposit)
 * Endpoint: GET /api/wallet/transactions
 * Query param: type (withdrawal or deposit)
 */
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    // Validate type parameter
    if (!type || !['withdrawal', 'deposit'].includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type. Must be 'withdrawal' or 'deposit'."
      });
    }

    // Get transactions by user ID and type
    const transactions = await Transaction.getByUserIdAndType(userId, type.toLowerCase());
    
    // Format transaction dates for frontend if needed
    const formattedTransactions = transactions.map(tx => {
      // Parse details if it's a JSON string
      let details = tx.details;
      if (typeof details === 'string' && details) {
        try {
          details = JSON.parse(details);
        } catch (e) {
          console.error('Error parsing transaction details:', e);
        }
      }
      
      return {
        ...tx,
        details
      };
    });

    return res.status(200).json({
      success: true,
      transactions: formattedTransactions
    });
  } catch (error) {
    console.error(`Error fetching user ${req.query.type} transactions:`, error);
    return res.status(500).json({
      success: false, 
      message: 'Failed to fetch transaction history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Process withdrawal request
 * Endpoint: POST /api/wallet/withdraw
 */
exports.requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, walletAddress, network, pin } = req.body;

    console.log('[requestWithdrawal] Request received:', { amount, network });

    // Validate input
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
    }

    if (!walletAddress) {
      return res.status(400).json({ success: false, message: 'Please enter a valid wallet address' });
    }

    // Format amount to ensure it's a number
    const withdrawAmount = parseFloat(amount);

    // Get wallet
    const wallet = await Wallet.findByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Check balance
    if (parseFloat(wallet.balance) < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ${wallet.balance} USDT`
      });
    }
    console.log('[requestWithdrawal] Balance check passed. Proceeding to create transaction.');

    // Create withdrawal transaction
    const txDetails = {
      walletAddress,
      network,
      fee: 1 // Example fee
    };

    const transaction = await Transaction.create({
      userId,
      type: 'withdrawal',
      amount: withdrawAmount,
      status: 'pending',
      details: JSON.stringify(txDetails)
    });

    console.log('[requestWithdrawal] Info object from Transaction.create:', transaction);

    if (!transaction || !transaction.id) {
      throw new Error('Failed to create transaction record');
    }

    console.log('[requestWithdrawal] Withdrawal transaction created successfully: ID', transaction.id, 'for User', userId);

    const fee = 1; // Your fee amount
const totalWithFee = withdrawAmount + fee;
const newBalance = parseFloat(wallet.balance) - totalWithFee;
await Wallet.updateBalance(userId, newBalance);

    console.log('[requestWithdrawal] Wallet balance updated. New balance:', newBalance);

    // THIS IS THE KEY PART - SEND THE RESPONSE IMMEDIATELY
    return res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      transaction: {
        id: transaction.id,
        amount: withdrawAmount,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('[requestWithdrawal] Error processing withdrawal:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your withdrawal request'
    });
  }
};


