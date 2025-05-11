// In routes/referralRoutes.js
const express = require('express');
const referralController = require('../controller/ReferralController');
const { authenticateToken } = require('../middleware/authmiddleware'); 

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

module.exports = router;