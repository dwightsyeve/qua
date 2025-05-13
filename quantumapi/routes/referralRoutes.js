// In routes/referralRoutes.js
const express = require('express');
const referralController = require('../controller/ReferralController');
const { authenticateToken } = require('../middleware/authmiddleware'); 
const referralMiddleware = require('../middleware/referralMiddleware');

const router = express.Router();

// Apply auth middleware to all referral routes
router.use(authenticateToken);

// User referral routes
router.get('/link', referralController.getReferralLink);
router.get('/stats', referralController.getReferralStats);
router.get('/list', referralController.getReferralsList);
router.get('/commissions', referralController.getCommissionHistory);
router.get('/milestone', referralController.getMilestoneProgress);
router.post('/claim-milestone', referralController.claimMilestoneReward);
router.post('/transfer-commission', referralController.transferCommissionToWallet);

// Admin referral routes
router.get('/admin/all', referralController.adminGetAllReferrals);
router.post('/admin/modify-commission', referralController.adminModifyCommission);

// Debug endpoints (require admin rights)
router.get('/debug/chain', (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required for debug endpoints'
        });
    }
    // Get userId from query parameter instead of route parameter
    req.params.userId = req.query.userId || null;
    next();
}, referralMiddleware.debugReferralChain);

router.post('/debug/test-commission', (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required for debug endpoints'
        });
    }
    next();
}, referralMiddleware.testCommissionCalculation);

router.get('/debug/logs', (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required for debug endpoints'
        });
    }
    
    // Return empty logs array since referralLogger is removed
    res.status(200).json({
        success: true,
        logs: [],
        message: "Logging functionality has been disabled"
    });
});

module.exports = router;