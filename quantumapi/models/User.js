const crypto = require('crypto');
const bcrypt = require('bcryptjs'); // Added bcrypt for password hashing
const db = require('../database');

class User {
    static createTable() {
        return db.prepare(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            dateOfBirth TEXT NOT NULL,
            phoneNumber TEXT NOT NULL,
            country TEXT NOT NULL,
            password TEXT NOT NULL,
            pin TEXT, -- For wallet PIN, should be hashed
            referralCode TEXT UNIQUE,
            referredBy TEXT,
            isVerified INTEGER DEFAULT 0,
            verificationToken TEXT,
            trc20_wallet TEXT,
            firstLoginAfterVerification INTEGER DEFAULT 1,
            role TEXT DEFAULT 'user',
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            lastLogin TEXT,
            profilePictureUrl TEXT,
            bio TEXT,
            resetToken TEXT,
            resetTokenExpiry TEXT,
            location_timezone TEXT,
            privacy_showEmail INTEGER DEFAULT 1,
            privacy_publicProfile INTEGER DEFAULT 0,
            notifications_emailEnabled INTEGER DEFAULT 1,
            notifications_investmentUpdates INTEGER DEFAULT 1,
            notifications_balanceChanges INTEGER DEFAULT 1,
            notifications_referralActivity INTEGER DEFAULT 1,
            wallet_autoReinvest INTEGER DEFAULT 0,
            appearance_darkMode INTEGER DEFAULT 0,
            appearance_language TEXT DEFAULT 'en',
            security_twoFactorEnabled INTEGER DEFAULT 0,
            security_activityLogsEnabled INTEGER DEFAULT 1,
            cookiePreferences_performance INTEGER DEFAULT 1,
            cookiePreferences_functionality INTEGER DEFAULT 1,
            cookiePreferences_marketing INTEGER DEFAULT 0,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      }

 static findByEmail(email) {
  return db.prepare(`
    SELECT * FROM users 
    WHERE LOWER(email) = LOWER(?)
  `).get(email);
}

static findByUsername(username) {
  return db.prepare(`
    SELECT * FROM users 
    WHERE LOWER(username) = LOWER(?)
  `).get(username);
}

  static findByVerificationToken(token) {
    return db.prepare('SELECT * FROM users WHERE verificationToken = ?').get(token);
  }

  static findByReferralCode(referralCode) {
    return db.prepare('SELECT * FROM users WHERE referralCode = ?').get(referralCode);
  }

  static create(user) {
    const stmt = db.prepare(`
      INSERT INTO users (
        firstName, lastName, username, email, dateOfBirth, phoneNumber, 
        country, password, verificationToken, referredBy
      ) VALUES (
        @firstName, @lastName, @username, @email, @dateOfBirth, @phoneNumber,
        @country, @password, @verificationToken, @referredBy
      )
    `);
    const result = stmt.run(user);
    return result.lastInsertRowid;
  }

  static verifyEmail(email, token) {
    // Generate a unique referral code
    const randomStr = crypto.randomBytes(4).toString('hex');
    const username = db.prepare('SELECT username FROM users WHERE email = ? AND verificationToken = ?').get(email, token);
    
    if (!username) return false;
    
    const referralCode = `${username.username.substring(0, 5).toUpperCase()}-${randomStr}`;
    
    const stmt = db.prepare(`
      UPDATE users 
      SET isVerified = 1, verificationToken = NULL, referralCode = ?
      WHERE email = ? AND verificationToken = ?
    `);
    const result = stmt.run(referralCode, email, token);
    return result.changes > 0;
  }

  static updateLastLogin(id) {
    const stmt = db.prepare('UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  static async createAdmin(adminData) { // Make it async to use await for bcrypt
    const { 
      firstName, lastName, username, email, password, // password here is plain text or already hashed
      dateOfBirth = 'N/A', 
      phoneNumber = 'N/A', 
      country = 'N/A',
      role = 'admin', 
      isVerified = 1 
    } = adminData;

    // Determine if the password is already hashed (starts with $)
    let hashedPassword;
    if (password.startsWith('$2')) {
      // Password is already hashed
      hashedPassword = password;
    } else {
      // Hash the plain text password
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    const randomStr = crypto.randomBytes(4).toString('hex');
    const referralCode = `${username.substring(0, 5).toUpperCase()}-${randomStr}`;

    const stmt = db.prepare(`
      INSERT INTO users (
        firstName, lastName, username, email, dateOfBirth, phoneNumber,
        country, password, role, isVerified, referralCode, verificationToken
      ) VALUES (
        @firstName, @lastName, @username, @email, @dateOfBirth, @phoneNumber,
        @country, @password, @role, @isVerified, @referralCode, NULL
      )
    `);
    
    const fullAdminData = {
      firstName,
      lastName,
      username,
      email,
      dateOfBirth,
      phoneNumber,
      country,
      password: hashedPassword, // Use the hashed password with correct parameter name
      role,
      isVerified,
      referralCode
    };

    try {
      const result = stmt.run(fullAdminData);
      return result.lastInsertRowid;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        if (error.message.includes('users.email')) {
          console.error(`Admin creation failed: Email '${email}' already exists.`);
        } else if (error.message.includes('users.username')) {
          console.error(`Admin creation failed: Username '${username}' already exists.`);
        } else {
          console.error('Admin creation failed due to a unique constraint:', error.message);
        }
        return null;
      }
      throw error; // Re-throw other errors
    }
  }

  static updatePassword(userId, hashedPassword) {
    const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
    return stmt.run(hashedPassword, userId);
  }

  static updatePin(userId, hashedPin) {
    const stmt = db.prepare('UPDATE users SET pin = ? WHERE id = ?');
    return stmt.run(hashedPin, userId);
  }  static deactivate(userId) {
    const stmt = db.prepare("UPDATE users SET email = email || '_deactivated_' || id, isVerified = 0, verificationToken = NULL, trc20_wallet = NULL WHERE id = ?");
    return stmt.run(userId);
  }

  static activate(userId) {
    // Reactivate a previously deactivated user
    // First check if the email has '_deactivated_' in it
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return null;
    }
    
    // If email contains '_deactivated_', remove it
    if (user.email.includes('_deactivated_')) {
      // Extract the original email (everything before '_deactivated_')
      const originalEmail = user.email.split('_deactivated_')[0];
      
      // Update the user to activate them
      const stmt = db.prepare("UPDATE users SET email = ?, isVerified = 1 WHERE id = ?");
      return stmt.run(originalEmail, userId);
    }
    
    return { changes: 0 }; // No changes if already activated
  }

  static updateProfile(userId, profileData) {
    const { fullName, email, phoneNumber, bio, country, timezone, profilePictureUrl, privacy_showEmail, privacy_publicProfile } = profileData;
    
    let setClauses = [];
    let params = [];

    if (fullName) {
        const [firstName, ...lastNameParts] = fullName.split(' ');
        setClauses.push('firstName = ?', 'lastName = ?');
        params.push(firstName, lastNameParts.join(' '));
    }
    if (email) { setClauses.push('email = ?'); params.push(email); }
    if (phoneNumber) { setClauses.push('phoneNumber = ?'); params.push(phoneNumber); }
    if (bio) { setClauses.push('bio = ?'); params.push(bio); }
    if (country) { setClauses.push('country = ?'); params.push(country); }
    if (timezone) { setClauses.push('location_timezone = ?'); params.push(timezone); }
    if (profilePictureUrl) { setClauses.push('profilePictureUrl = ?'); params.push(profilePictureUrl); }
    if (privacy_showEmail !== undefined) { setClauses.push('privacy_showEmail = ?'); params.push(privacy_showEmail ? 1 : 0); }
    if (privacy_publicProfile !== undefined) { setClauses.push('privacy_publicProfile = ?'); params.push(privacy_publicProfile ? 1 : 0); }

    if (setClauses.length === 0) return { changes: 0 };

    const stmt = db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`);
    params.push(userId);
    return stmt.run(...params);
  }

  static updateSettings(userId, settingsData) {
    const flatSettings = {};
    if (settingsData.notifications) {
        if (settingsData.notifications.emailEnabled !== undefined) flatSettings.notifications_emailEnabled = settingsData.notifications.emailEnabled ? 1:0;
        if (settingsData.notifications.investmentUpdates !== undefined) flatSettings.notifications_investmentUpdates = settingsData.notifications.investmentUpdates ? 1:0;
        if (settingsData.notifications.balanceChanges !== undefined) flatSettings.notifications_balanceChanges = settingsData.notifications.balanceChanges ? 1:0;
        if (settingsData.notifications.referralActivity !== undefined) flatSettings.notifications_referralActivity = settingsData.notifications.referralActivity ? 1:0;
    }
    if (settingsData.wallet) {
        if (settingsData.wallet.autoReinvest !== undefined) flatSettings.wallet_autoReinvest = settingsData.wallet.autoReinvest ? 1:0;
    }
    if (settingsData.appearance) {
        if (settingsData.appearance.darkMode !== undefined) flatSettings.appearance_darkMode = settingsData.appearance.darkMode ? 1:0;
        if (settingsData.appearance.language !== undefined) flatSettings.appearance_language = settingsData.appearance.language;
    }
    if (settingsData.privacy) {
        if (settingsData.privacy.activityLogsEnabled !== undefined) flatSettings.security_activityLogsEnabled = settingsData.privacy.activityLogsEnabled ? 1:0;
        if (settingsData.privacy.publicProfile !== undefined) flatSettings.privacy_publicProfile = settingsData.privacy.publicProfile ? 1:0;
    }
    if (settingsData.twoFactorEnabled !== undefined) {
        flatSettings.security_twoFactorEnabled = settingsData.twoFactorEnabled ? 1:0;
    }
    if (settingsData.security_activityLogsEnabled !== undefined) {
        flatSettings.security_activityLogsEnabled = settingsData.security_activityLogsEnabled ? 1:0;
    }

    let setClauses = [];
    let params = [];
    for (const key in flatSettings) {
        setClauses.push(`${key} = ?`);
        params.push(flatSettings[key]);
    }

    if (setClauses.length === 0) return { changes: 0 };

    const stmt = db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`);
    params.push(userId);
    return stmt.run(...params);
  }

  static updateCookiePreferences(userId, cookieData) {
    const { performance, functionality, marketing } = cookieData;
    const stmt = db.prepare('UPDATE users SET cookiePreferences_performance = ?, cookiePreferences_functionality = ?, cookiePreferences_marketing = ? WHERE id = ?');
    return stmt.run(performance ? 1:0, functionality ? 1:0, marketing ? 1:0, userId);
  }

  static updateWalletAddress(userId, walletAddress) {
    const stmt = db.prepare('UPDATE users SET trc20_wallet = ?, firstLoginAfterVerification = 0 WHERE id = ?');
    return stmt.run(walletAddress, userId);
  }
  
  static getWalletAddress(userId) {
    const user = db.prepare('SELECT trc20_wallet FROM users WHERE id = ?').get(userId);
    return user ? user.trc20_wallet : null;
  }

  static lock(userId) {
    const stmt = db.prepare('UPDATE users SET isVerified = 0 WHERE id = ?');
    const result = stmt.run(userId);
    return result.changes > 0;
  }

  static unlock(userId) {
    const stmt = db.prepare('UPDATE users SET isVerified = 1 WHERE id = ?');
    const result = stmt.run(userId);
    return result.changes > 0;
  }

  static findAll() {
    // Selects all necessary fields for the admin user list
    // Concatenates firstName and lastName into 'name'
    // Derives 'is_locked' from 'isVerified' (0 = active, 1 = locked)
    return db.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        firstName, 
        lastName, 
        (firstName || ' ' || lastName) as name, 
        role, 
        isVerified, 
        (1 - isVerified) as is_locked, 
        createdAt,
        lastLogin,
        phoneNumber,
        country,
        referralCode,
        referredBy,
        trc20_wallet
      FROM users
    `).all();
  }


  // Add these methods to your User class

/**
 * Update user's reset token and expiry
 * @param {number} userId - User ID
 * @param {string} resetToken - Password reset token
 * @param {Date} expiryDate - Token expiration date
 * @returns {boolean} - Success status
 */
static updateResetToken(userId, resetToken, expiryDate) {
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET resetToken = ?,
          resetTokenExpiry = ?,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(
      resetToken,
      expiryDate.toISOString(),
      userId
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('Error updating reset token:', error);
    return false;
  }
}

/**
 * Update user's password and clear reset token
 * @param {number} userId - User ID
 * @param {string} hashedPassword - New hashed password
 * @returns {boolean} - Success status
 */
static updatePassword(userId, hashedPassword) {
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET password = ?,
          resetToken = NULL,
          resetTokenExpiry = NULL,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(hashedPassword, userId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error updating password:', error);
    return false;
  }
}
}





module.exports = User;
