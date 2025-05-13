const Notification = require('../models/Notification');
const User = require('../models/User');
const db = require('../database');

function seedNotifications() {
  console.log('Starting notifications seeder...');
  
  // Check if notifications table exists before seeding
  try {
    // Try to get table info
    const tableInfo = db.pragma('table_info(notifications)');
    
    if (!tableInfo || tableInfo.length === 0) {
      console.log('Notifications table not found - creating it now');
      Notification.createTable();
    }

    // First check if any users exist in the database
    const users = User.findAll();
    
    if (!users || users.length === 0) {
      console.log('No users found in database. Skipping notification seeding.');
      return;
    }
    
    // Use the first user's ID instead of hardcoding user ID 1
    const firstUserId = users[0].id;
    console.log(`Found existing user with ID: ${firstUserId}. Creating notifications for this user.`);
    
    // Default notifications for the first user
    const notifications = [
      {
        userId: firstUserId,
        title: 'Welcome to QuantumFX Pro!',
        message: 'Thank you for joining our platform. Start your investment journey today!',
        type: 'info'
      },
      {
        userId: firstUserId,
        title: 'Verify Your Account',
        message: 'Complete verification to unlock all platform features.',
        type: 'warning'
      },
      {
        userId: firstUserId,
        title: 'First Steps Guide',
        message: 'Check out our guide to get started with investing quickly.',
        type: 'info'
      }
    ];
    
    notifications.forEach(notification => {
      try {
        Notification.create(notification);
        console.log(`Created notification "${notification.title}" for user ${firstUserId}`);
      } catch (error) {
        console.error('Error inserting notification:', error);
      }
    });
    
    console.log('Notification seeding completed successfully.');
  } catch (error) {
    console.error('Fatal error in notification seeder:', error);
  }
}

module.exports = seedNotifications;