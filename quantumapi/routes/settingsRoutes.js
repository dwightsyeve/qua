const express = require('express');
const settingsController = require('../controller/settingsController');
const { authenticateToken } = require('../middleware/authmiddleware');

const router = express.Router();

// All settings routes require authentication
router.use(authenticateToken);

// Get all user-specific settings
router.get('/user', settingsController.getUserSettings);

// Update user-specific settings (partial updates)
router.patch('/user', settingsController.updateUserSettings);

// Get cookie preferences
router.get('/cookies', settingsController.getCookiePreferences);

// Update cookie preferences
router.patch('/cookies', settingsController.updateCookiePreferences);

module.exports = router;
