// In routes/walletRoutes.js
const express = require('express');
const walletController = require('../controller/WalletController');
const { authenticateToken } = require('../middleware/authmiddleware'); 

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

// Admin wallet management routes
router.get('/admin/pending-withdrawals', walletController.getPendingWithdrawals);
router.post('/admin/process-withdrawal', walletController.processWithdrawal);

module.exports = router;