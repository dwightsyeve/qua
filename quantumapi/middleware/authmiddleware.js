const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to authenticate JWT tokens from request headers
 * Extracts user from token and adds to request object
 */
exports.authenticateToken = async (req, res, next) => {
  try {
    // Get auth header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
    
    // Check for impersonation token first in a custom header or cookie if preferred
    let impersonationToken = req.headers['x-impersonation-token'];

    if (impersonationToken) {
      jwt.verify(impersonationToken, process.env.JWT_SECRET || 'your-jwt-secret', async (err, decoded) => {
        if (err) {
          // If impersonation token is invalid, try the original token
          return verifyOriginalToken(token, req, res, next);
        }
        // Valid impersonation token
        const user = await User.findById(decoded.id);
        if (!user) {
          return res.status(404).json({ success: false, message: 'Impersonated user not found' });
        }
        req.user = user; // User is the impersonated user
        req.isImpersonating = true;
        req.originalAdminId = decoded.originalAdminId; // Store who is impersonating
        return next();
      });
    } else {
      return verifyOriginalToken(token, req, res, next);
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

// Helper function to verify the original authentication token
async function verifyOriginalToken(token, req, res, next) {
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret', async (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    
    try {
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      req.user = user;
      next();
    } catch (findError) {
      console.error('Error finding user:', findError);
      res.status(500).json({ 
        success: false, 
        message: 'Error finding user' 
      });
    }
  });
}

exports.isAdmin = (req, res, next) => {
  // Add detailed logging to help diagnose the issue
  console.log('User in isAdmin check:', req.user ? {
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    isAdmin: req.user.isAdmin, // Include isAdmin in the log
    isVerified: req.user.isVerified
  } : 'No user in request');
  
  // Check by role (trimmed and lowercased) or isAdmin flag
  if (
    req.user &&
    (
      (typeof req.user.role === 'string' && req.user.role.trim().toLowerCase() === 'admin') ||
      req.user.isAdmin === true || // Check for boolean true
      req.user.isAdmin === 1       // Check for integer 1
    )
  ) {
    console.log(`Admin access granted for user ${req.user.id} (${req.user.username})`);
    return next(); // Use return to ensure next() is called and then function exits
  } else {
    console.log('Admin access denied:', req.user ? 
      `User ${req.user.id} has role "${req.user.role}" and isAdmin: ${req.user.isAdmin}` : 
      'No user in request');
    
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};