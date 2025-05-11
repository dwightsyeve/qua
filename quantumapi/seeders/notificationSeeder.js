const Notification = require('../models/Notification');
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

    // Default notifications for user ID 1
    const notifications = [
      {
        userId: 1,
        title: 'Welcome to QuantumFX Pro!',
        message: 'Thank you for joining our platform. Start your investment journey today!',
        type: 'info'
      },
      // ... other notifications ...
    ];
    
    notifications.forEach(notification => {
      try {
        Notification.create(notification);
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