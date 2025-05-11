const User = require('../models/User');
const db = require('../database');

// Helper to extract settings from user object
const extractUserSettings = (user) => {
    if (!user) return null;
    return {
        // Security settings
        twoFactorEnabled: !!user.security_twoFactorEnabled,
        activityLogsEnabled: !!user.security_activityLogsEnabled, // From User model

        // Notification Settings
        notifications: {
            emailEnabled: !!user.notifications_emailEnabled,
            investmentUpdates: !!user.notifications_investmentUpdates,
            balanceChanges: !!user.notifications_balanceChanges,
            referralActivity: !!user.notifications_referralActivity,
        },
        // Wallet Settings
        wallet: {
            autoReinvest: !!user.wallet_autoReinvest,
            // withdrawalTimeout: user.wallet_withdrawalTimeout, // Example if you add this field
        },
        // Appearance Settings
        appearance: {
            darkMode: !!user.appearance_darkMode,
            language: user.appearance_language || 'en',
            // accentColor: user.appearance_accentColor, // Example
        },
        // Privacy Settings (some might be in profile, adjust as needed)
        privacy: {
            publicProfile: !!user.privacy_publicProfile, // From User model
            // activityLogsEnabled: !!user.privacy_activityLogsEnabled, // Already under security
        }
    };
};

exports.getUserSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const settings = extractUserSettings(user);
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error fetching user settings:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve settings.' });
    }
};

exports.updateUserSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const settingsData = req.body; // e.g. { appearance: { darkMode: true }, notifications: { emailEnabled: false } }

        // The User.updateSettings method is designed to take flattened keys or a structured object
        // Let's ensure the structure matches what User.updateSettings expects or adapt here
        // Based on User.updateSettings, it expects keys like 'notifications_emailEnabled' or structured like frontend
        
        const result = User.updateSettings(userId, settingsData);

        if (result.changes > 0) {
            const updatedUser = await User.findById(userId);
            const updatedSettings = extractUserSettings(updatedUser);
            res.json({ success: true, message: 'Settings updated successfully.', settings: updatedSettings });
        } else {
            // This might happen if the data sent doesn't actually change any values
            // or if User.updateSettings didn't find matching keys to update.
            // Consider if this should be an error or a "no changes made" success.
            const currentUser = await User.findById(userId);
            const currentSettings = extractUserSettings(currentUser);
            res.json({ success: true, message: 'No changes applied to settings or settings are already up to date.', settings: currentSettings });
        }
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings.' });
    }
};

exports.getCookiePreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({
            success: true,
            preferences: {
                performance: !!user.cookiePreferences_performance,
                functionality: !!user.cookiePreferences_functionality,
                marketing: !!user.cookiePreferences_marketing,
            }
        });
    } catch (error) {
        console.error('Error fetching cookie preferences:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve cookie preferences.' });
    }
};

exports.updateCookiePreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const { performance, functionality, marketing } = req.body;

        const result = User.updateCookiePreferences(userId, {
            performance: !!performance,
            functionality: !!functionality,
            marketing: !!marketing,
        });

        if (result.changes > 0) {
            res.json({ success: true, message: 'Cookie preferences updated.' });
        } else {
            res.json({ success: true, message: 'No changes to cookie preferences.' });
        }
    } catch (error) {
        console.error('Error updating cookie preferences:', error);
        res.status(500).json({ success: false, message: 'Failed to update cookie preferences.' });
    }
};
