const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/authmiddleware');
const adminController = require('../controller/AdminController');
const walletController = require('../controller/WalletController');

// Token verification endpoint - simple endpoint that just validates if the token is still valid
router.get('/verify-token', authenticateToken, isAdmin, (req, res) => {
    res.json({ success: true, message: 'Token is valid', userId: req.user.id });
});

// Placeholder test route
router.get('/test', authenticateToken, isAdmin, (req, res) => {
    res.json({ message: 'Admin routes are configured and working!' });
});

// User Management Routes
router.get('/users', authenticateToken, isAdmin, adminController.listUsers);
router.get('/users/:userId', authenticateToken, isAdmin, adminController.getUserDetails);
router.put('/users/:userId', authenticateToken, isAdmin, adminController.updateUserDetails);
router.put('/users/:userId/lock', authenticateToken, isAdmin, adminController.lockUser);
router.put('/users/:userId/unlock', authenticateToken, isAdmin, adminController.unlockUser);

// Balance Management Routes
router.post('/users/:userId/balance', authenticateToken, isAdmin, adminController.updateUserBalance);

// Withdrawal Management Routes
router.get('/withdrawals', authenticateToken, isAdmin, walletController.getPendingWithdrawals);
router.get('/withdrawals/:id', authenticateToken, isAdmin, adminController.getWithdrawalDetails);
router.post('/withdrawals/:id/process', authenticateToken, isAdmin, walletController.processWithdrawal);

// Admin Transaction History Route (for all users, supports type and search)
router.get('/transactions', authenticateToken, isAdmin, adminController.listAllTransactions);

module.exports = router;
