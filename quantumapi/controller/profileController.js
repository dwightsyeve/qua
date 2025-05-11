const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const { uploadProfilePicture, UPLOAD_PATHS } = require('../middleware/uploadMiddleware');

exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        // Construct profile object based on what frontend expects
        const profile = {
            fullName: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phoneNumber: user.phoneNumber,
            bio: user.bio,
            profilePictureUrl: user.profilePictureUrl ? `/${user.profilePictureUrl}` : 'https://via.placeholder.com/100', // Adjust path as needed
            location: {
                country: user.country,
                timezone: user.location_timezone,
            },
            privacy: {
                showEmail: !!user.privacy_showEmail,
                publicProfile: !!user.privacy_publicProfile,
            },
            isVerified: !!user.isVerified,
            // isPremium: user.isPremium, // Add if you have this field
        };
        res.json({ success: true, profile });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileData = req.body;

        // If email is being changed, you might want to trigger a re-verification process.
        // This example directly updates it.
        if (profileData.email && profileData.email !== req.user.email) {
            const existingUser = User.findByEmail(profileData.email);
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ success: false, message: 'Email already in use.' });
            }
            // Add logic for email verification if needed
        }

        const result = User.updateProfile(userId, profileData);

        if (result.changes > 0) {
            const updatedUser = await User.findById(userId);
            const updatedProfile = {
                 fullName: `${updatedUser.firstName} ${updatedUser.lastName}`,
                 email: updatedUser.email,
                 phoneNumber: updatedUser.phoneNumber,
                 bio: updatedUser.bio,
                 profilePictureUrl: updatedUser.profilePictureUrl ? `/${updatedUser.profilePictureUrl}` : 'https://via.placeholder.com/100',
                 location: {
                     country: updatedUser.country,
                     timezone: updatedUser.location_timezone,
                 },
                 privacy: {
                     showEmail: !!updatedUser.privacy_showEmail,
                     publicProfile: !!updatedUser.privacy_publicProfile,
                 }
            };
            res.json({ success: true, message: 'Profile updated successfully.', profile: updatedProfile });
        } else {
            res.json({ success: true, message: 'No changes applied to profile.' });
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
};

exports.uploadProfilePicture = (req, res) => {
    uploadProfilePicture(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ 
                success: false, 
                message: err.message || 'Error uploading file' 
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file selected!' });
        }

        try {
            const userId = req.user.id;
            
            // Create a path relative to the public directory for storing in DB
            // This path will be used in HTML/CSS as the image source
            const relativePathForDb = path.join('uploads/profile-pictures', req.file.filename).replace(/\\/g, '/');
            
            // Update user profile with the new image path
            User.updateProfile(userId, { profilePictureUrl: relativePathForDb });
            
            res.json({
                success: true,
                message: 'Profile picture uploaded successfully!',
                imageUrl: `/${relativePathForDb}` // URL that the frontend can use
            });
        } catch (dbError) {
            console.error('Error saving profile picture URL to DB:', dbError);
            
            // If we fail to update the database, remove the file to avoid orphaned files
            if (req.file && req.file.path) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error removing file after failed DB update:', unlinkErr);
                });
            }
            
            res.status(500).json({ 
                success: false, 
                message: 'Failed to save profile picture information.' 
            });
        }
    });
};