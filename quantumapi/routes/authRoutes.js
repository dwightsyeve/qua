const express = require('express');
const userController = require('../controller/userController');
const { authenticateToken, isAdmin } = require('../middleware/authmiddleware'); // Modified import

const router = express.Router();

// Register new user
router.post('/register', userController.register);

// Verify email
router.get('/verify-email/:token', userController.verifyEmail);

// Login user
router.post('/login', userController.login);

// Change password
router.post('/change-password', authenticateToken, userController.changePassword);

// Deactivate account
router.post('/deactivate', authenticateToken, userController.deactivateAccount);

// Check auth status
router.get('/check-status', authenticateToken, userController.checkStatus); 

// Admin-specific routes
router.post('/admin/auth/login', userController.adminLogin); // New admin login route
router.post('/admin/auth/register', authenticateToken, isAdmin, userController.registerAdmin); // New admin registration route (protected)
router.post('/admin/impersonate/:userId', authenticateToken, isAdmin, userController.impersonateUser);
router.post('/admin/revert-impersonation', authenticateToken, userController.revertImpersonation);

// Password reset routes
router.post('/reset-password-request', userController.requestPasswordReset);
router.post('/reset-password', userController.resetPassword);


module.exports = router;