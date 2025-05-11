const express = require('express');
const router = express.Router();
const DashboardController = require('../controller/DashboardController');
const { authenticateToken } = require('../middleware/authmiddleware');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for the authenticated user
 * @access  Private
 */
router.get('/', authenticateToken, DashboardController.getNotifications);
router.put('/:id/read', authenticateToken, DashboardController.markAsRead);

router.delete('/:id', authenticateToken, DashboardController.deleteNotification);

// Add more notification-specific routes here if needed in the future
// For example, marking notifications as read
router.post('/mark-all-read', authenticateToken, DashboardController.markAllNotificationsAsRead);

module.exports = router;
