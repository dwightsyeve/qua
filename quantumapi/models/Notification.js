const db = require('../database');

class Notification {
  /**
   * Create notifications table if not exists
   */
  static createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('info', 'success', 'warning', 'danger')),
        isRead INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `;
    db.exec(query);
    console.log("Notifications table schema checked/created.");
  }

  /**
   * Get all notifications for a user
   * @param {number} userId - User ID
   * @param {boolean} unreadOnly - Get only unread notifications
   * @returns {Array} Notifications
   */
  static getByUserId(userId, unreadOnly = false) {
    try {
      let query = 'SELECT * FROM notifications WHERE userId = ?';
      
      if (unreadOnly) {
        query += ' AND isRead = 0';
      }
      
      query += ' ORDER BY createdAt DESC';
      
      return db.prepare(query).all(userId);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Create a new notification
   * @param {object} notification - Notification object
   * @returns {number} Created notification ID
   */
  static create(notification) {
    try {
      const { userId, title, message, type = 'info' } = notification;
      
      const stmt = db.prepare(`
        INSERT INTO notifications (userId, title, message, type, createdAt)
        VALUES (?, ?, ?, ?, STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW'))
      `);
      
      const result = stmt.run(userId, title, message, type);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {number} id - Notification ID
   * @param {number} userId - User ID (for security check)
   * @returns {object} Result
   */
  static markAsRead(id, userId) {
    try {
      const stmt = db.prepare(`
        UPDATE notifications
        SET isRead = 1
        WHERE id = ? AND userId = ?
      `);
      
      return stmt.run(id, userId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {number} userId - User ID
   * @returns {object} Result
   */
  static markAllAsRead(userId) {
    try {
      const stmt = db.prepare(`
        UPDATE notifications
        SET isRead = 1
        WHERE userId = ?
      `);
      
      return stmt.run(userId);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }
/**
 * Mark notification as read
 * @param {number} id - Notification ID
 * @param {number} userId - User ID (for security check)
 * @returns {object} Result
 */
static markAsRead(id, userId) {
    try {
      const stmt = db.prepare(`
        UPDATE notifications
        SET isRead = 1
        WHERE id = ? AND userId = ?
      `);
      
      return stmt.run(id, userId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }
/**
 * Delete a notification
 * @param {number} id - Notification ID
 * @param {number} userId - User ID (for security check)
 * @returns {object} Result
 */
static deleteNotification(id, userId) {
    try {
      const stmt = db.prepare(`
        DELETE FROM notifications
        WHERE id = ? AND userId = ?
      `);
      
      return stmt.run(id, userId);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }
    
}

module.exports = Notification;