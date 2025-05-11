const express = require('express');
const profileController = require('../controller/profileController');
const { authenticateToken } = require('../middleware/authmiddleware');

const router = express.Router();

// All profile routes require authentication
router.use(authenticateToken);

// Get user profile
router.get('/', profileController.getUserProfile);

// Update user profile (PATCH for partial updates)
router.patch('/update', profileController.updateUserProfile);

// Upload profile picture
router.post('/upload-picture', profileController.uploadProfilePicture);

module.exports = router;
