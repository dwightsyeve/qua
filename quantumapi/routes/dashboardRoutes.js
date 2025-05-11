// filepath: c:\Users\shalewa\Desktop\New folder (4)\quantumapi\routes\dashboardRoutes.js
const express = require('express');
const router = express.Router();
const DashboardController = require('../controller/DashboardController');
const { authenticateToken } = require('../middleware/authmiddleware');

// Apply authentication middleware to all dashboard routes
router.use(authenticateToken);

/**
 * @route   GET /api/dashboard
 * @desc    Root dashboard endpoint (redirects to overview for backward compatibility)
 * @access  Private
 */
router.get('/', DashboardController.getDashboardData);


/**
 * @route   GET /api/dashboard/overview
 * @desc    Get dashboard overview data including balances, investment counts, etc.
 * @access  Private
 */
router.get('/overview', DashboardController.getDashboardData);

/**
 * @route   GET /api/dashboard/profit-chart
 * @desc    Get profit chart data
 * @access  Private
 */
router.get('/profit-chart', DashboardController.getProfitChartData);

/**
 * @route   GET /api/dashboard/referrals
 * @desc    Get referral statistics
 * @access  Private
 */
router.get('/referrals', DashboardController.getReferralData);

/**
 * @route   GET /api/dashboard/activity
 * @desc    Get recent activities
 * @access  Private
 */
router.get('/activity', DashboardController.getRecentActivity);

/**
 * @route   GET /api/dashboard/recent-activity
 * @desc    Alias for activity endpoint for backward compatibility
 * @access  Private
 */
router.get('/recent-activity', DashboardController.getRecentActivity);

/**
 * @route   GET /api/dashboard/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/notifications', DashboardController.getNotifications);
// Add this route with your other dashboard routes

module.exports = router;