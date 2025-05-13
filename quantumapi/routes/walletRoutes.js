// In routes/walletRoutes.js
const express = require('express');
const walletController = require('../controller/WalletController');
const { authenticateToken } = require('../middleware/authmiddleware');
const { processDepositForReferrals } = require('../controller/ReferralController');

const router = express.Router();

// Apply auth middleware to all wallet routes
router.use(authenticateToken);

// Core wallet functionality
router.get('/summary', walletController.getWalletSummary);
router.get('/history', walletController.getTransactionHistory);
router.get('/deposit-address', walletController.getDepositAddress);
router.post('/withdraw', walletController.requestWithdrawal);
router.get('/balance', walletController.getWalletBalance);
router.post('/change-pin', walletController.changeWalletPin);
router.get('/transactions', walletController.getUserTransactions);

// Custom endpoint to handle deposit notification and trigger referral processing
router.post('/deposit-notification', async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, txHash } = req.body;
        
        if (!amount) {
            return res.status(400).json({
                success: false,
                message: 'Amount is required'
            });
        }
        
        referralLogger.info(`Manual deposit notification received - User: ${userId}, Amount: ${amount}, TxHash: ${txHash || 'N/A'}`, 
            { userId, amount, txHash }, true);
        
        // Process the deposit for referrals
        const result = await processDepositForReferrals(userId, parseFloat(amount));
        
        res.status(200).json({
            success: true,
            message: 'Deposit processed for referrals',
            result
        });
    } catch (error) {
        referralLogger.error(`Error processing manual deposit notification: ${error.message}`, 
            { error: error.stack, body: req.body });
        
        res.status(500).json({
            success: false,
            message: 'Failed to process deposit notification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Admin wallet management routes
router.get('/admin/pending-withdrawals', walletController.getPendingWithdrawals);
router.post('/admin/process-withdrawal', walletController.processWithdrawal);

module.exports = router;