const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const db = require('../database');
const { sendVerificationEmail } = require('../utils/emailService');
const { generateTRC20Address } = require('../utils/WalletUtils');

// Controller for user registration
exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      dateOfBirth,
      phoneNumber,
      country,
      password,
      referralCode
    } = req.body;

    // Validate inputs
    if (!firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter your first and last name' 
      });
    }

    if (!validateUsername(username)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be 3-20 characters (letters, numbers, underscores, and hyphens only)' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid email address' 
      });
    }

    if (!dateOfBirth) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter your date of birth' 
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter your phone number' 
      });
    }

    if (!country) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please select your country' 
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers' 
      });
    }

    // Check if user already exists
    const existingEmail = User.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    const existingUsername = User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken'
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Check referral code if provided
    let referredBy = null;
    if (referralCode) {
      const referrer = User.findByReferralCode(referralCode);
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    

    // Send verification email
    await sendVerificationEmail(email, verificationToken, `${firstName} ${lastName}`);


    // Create new user
    const userId = User.create({
      firstName,
      lastName,
      username,
      email,
      dateOfBirth,
      phoneNumber,
      country,
      password: hashedPassword,
      verificationToken,
      referredBy
    });

    if (referredBy) {
      // Create the referral relationship immediately
      Referral.create({
        referrerId: referredBy,
        referredId: userId,
        level: 1
      });
      
      // Optional: Update referrer's statistics
      db.prepare('UPDATE user_stats SET total_referrals = total_referrals + 1 WHERE userId = ?')
        .run(referredBy);
    }


    // Send successful response
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for verification.'
    });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

// Controller for email verification
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user by verification token
    const user = User.findByVerificationToken(token);
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    // Update user verification status
    const success = User.verifyEmail(user.email, token);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Email verified successfully! You can now log in.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to verify email. Please try again.'
      });
    }
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false, 
      message: 'Email verification failed. Please try again.'
    });
  }
};

// Controller for user login
exports.login = async (req, res) => {
    try {
      const { identifier, password } = req.body;
      
      // Find user by email or username
      let user = User.findByEmail(identifier);
      if (!user) {
        user = User.findByUsername(identifier);
      }
      
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if user is verified
      if (user.isVerified !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Please verify your email before logging in'
        });
      }
      
      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if this is first login after verification and user doesn't have a TRC20 wallet yet
      if (user.firstLoginAfterVerification === 1 && !user.trc20_wallet) {
        const trc20WalletData = await Wallet.createForUser(user.id);
        console.log('Wallet created:', trc20WalletData);
      
        // Update user with wallet address and set firstLoginAfterVerification to 0
        const updateStmt = db.prepare(`
          UPDATE users
          SET trc20_wallet = ?, firstLoginAfterVerification = 0
          WHERE id = ?
        `);
        updateStmt.run(trc20WalletData.address, user.id);
        
        // Update user object with the new wallet address
        user.trc20_wallet = trc20WalletData.address;

        // Send email with wallet details
        const emailContent = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #4CAF50;">Welcome, ${user.firstName} ${user.lastName}!</h2>
            <p>We are excited to inform you that your TRC20 wallet has been successfully created.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
              <p><strong>Wallet Address:</strong> ${trc20WalletData.address}</p>
              <p><strong>Mobile:</strong> ${user.phoneNumber}</p>
            </div>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Thank you for choosing our platform!</p>
            <p style="color: #888; font-size: 0.9em;">This is an automated message. Please do not reply to this email.</p>
          </div>
        `;
        await sendVerificationEmail(user.email, null, null, emailContent);
      }
  
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your-jwt-secret',
        { expiresIn: '7d' }
      );
      
      // Update last login time
      User.updateLastLogin(user.id);
      
      res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email,
          trc20_wallet: user.trc20_wallet,
          dateOfBirth: user.dateOfBirth,
          phoneNumber: user.phoneNumber,
          country: user.country,
          isVerified: user.isVerified,
          referralCode: user.referralCode,
          referredBy: user.referredBy,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        } 
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed. Please try again.'
      });
    } console.log("successful login");
  };

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Incorrect current password.' });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({ 
                success: false, 
                message: 'New password must be at least 8 characters with uppercase, lowercase, and numbers' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        User.updatePassword(userId, hashedPassword);

        res.json({ success: true, message: 'Password changed successfully.' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Failed to change password.' });
    }
};

exports.deactivateAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { password } = req.body; // Require password for deactivation

        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required to deactivate account.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Incorrect password.' });
        }

        User.deactivate(userId);
        // Future: Add token invalidation or session clearing here

        res.json({ success: true, message: 'Account deactivated successfully.' });

    } catch (error) {
        console.error('Deactivate account error:', error);
        res.status(500).json({ success: false, message: 'Failed to deactivate account.' });
    }
};

// Helper functions for validation
function validateUsername(username) {
  const regex = /^[a-zA-Z0-9_-]{3,20}$/;
  return regex.test(username);
}

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validatePassword(password) {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
  return regex.test(password);
}

// Controller for checking auth status
exports.checkStatus = async (req, res) => {
  try {
    // If the middleware (authenticateToken) passes, the user is authenticated
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({
      success: true,
      message: 'User is authenticated.',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        trc20_wallet: user.trc20_wallet,
        dateOfBirth: user.dateOfBirth,
        phoneNumber: user.phoneNumber,
        country: user.country,
        isVerified: user.isVerified,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role // Make sure to include the role
      }
    });
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({ success: false, message: 'Failed to check authentication status.' });
  }
};

// Admin-specific login controller
exports.adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    // Find user by email or username
    let user = User.findByEmail(identifier);
    if (!user) {
      user = User.findByUsername(identifier);
    }
    
    // First check if user exists
    if (!user) {
      console.log(`Admin login attempt failed: User with identifier '${identifier}' not found`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or insufficient privileges'
      });
    }
    
    // Then check if user has admin role
    if (user.role !== 'admin') {
      console.log(`Admin login attempt failed: User '${user.username}' with ID ${user.id} is not an admin`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or insufficient privileges'
      });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Admin login attempt failed: Password mismatch for user '${user.username}'`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token for admin
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '24h' } // Shorter expiry for admin tokens as a security measure
    );
    
    // Update last login time
    User.updateLastLogin(user.id);
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role
      } 
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

// Controller for registering a new admin user
// This is protected by the isAdmin middleware
exports.registerAdmin = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      password,
      dateOfBirth = '',
      phoneNumber = '',
      country = ''
    } = req.body;

    // Validate inputs
    if (!firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter first and last name' 
      });
    }

    if (!validateUsername(username)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be 3-20 characters (letters, numbers, underscores, and hyphens only)' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid email address' 
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers' 
      });
    }

    // Check if admin already exists
    const existingEmail = User.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    const existingUsername = User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken'
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user with pre-verified status
    const adminId = await User.createAdmin({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
      dateOfBirth,
      phoneNumber,
      country
    });

    if (!adminId) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create admin account'
      });
    }

    // Send successful response
    res.status(201).json({
      success: true,
      message: 'Admin account created successfully.'
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

// Controller for admin to impersonate a user
exports.impersonateUser = async (req, res) => {
  try {
    const adminUser = req.user; // Authenticated admin user
    const { userId: targetUserId } = req.params;

    // Ensure admin is not trying to impersonate themselves
    if (adminUser.id.toString() === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Admin cannot impersonate themselves.'
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found.'
      });
    }

    // Prevent impersonating another admin for security reasons (optional, based on policy)
    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot impersonate another admin user.'
      });
    }

    // Generate an impersonation JWT token for the target user
    // This token will contain the target user's ID and the original admin's ID for auditing
    const impersonationToken = jwt.sign(
      { 
        id: targetUser.id, 
        email: targetUser.email, 
        username: targetUser.username, 
        role: targetUser.role, 
        originalAdminId: adminUser.id // Store the admin who initiated impersonation
      },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '1h' } // Shorter expiry for impersonation tokens is a good practice
    );

    // Log the impersonation action (optional but recommended)
    console.log(`Admin ${adminUser.username} (ID: ${adminUser.id}) started impersonating user ${targetUser.username} (ID: ${targetUser.id})`);

    res.status(200).json({
      success: true,
      message: `Successfully impersonating ${targetUser.username}.`,
      impersonationToken,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role
      },
      redirectUrl: '/dashboard.html' // Suggest redirect to user dashboard
    });

  } catch (error) {
    console.error('Impersonate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to impersonate user. Please try again.'
    });
  }
};

// Controller for admin to revert impersonation
exports.revertImpersonation = async (req, res) => {
  try {
    // The authenticateToken middleware will have already identified the original admin 
    // if an impersonation was active via x-impersonation-token and then a regular token was sent.
    // Or, the frontend will clear the impersonation token and send the original admin token.

    const adminUser = req.user; // This should be the original admin user

    // Log the revert action
    // If req.isImpersonating was set by middleware, it means the x-impersonation-token was cleared by client
    // and now the original admin token is being used.
    // If originalAdminId was part of a specific impersonation token, it would be available if that token was still in use.
    console.log(`Admin (ID: ${adminUser.id}) reverted impersonation.`);

    // Generate a new token for the admin to ensure a clean session state
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, username: adminUser.username, role: adminUser.role },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Successfully reverted to admin account.',
      token: adminToken, // Send back the original admin's token or a new one
      user: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role
      },
      redirectUrl: '/admin/admindashboard.html' // Suggest redirect to admin dashboard
    });

  } catch (error) {
    console.error('Revert impersonation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revert impersonation. Please try again.'
    });
  }
};