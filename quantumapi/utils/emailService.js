const nodemailer = require('nodemailer');
let transporter;

// Initialize transporter with better error handling
function initializeTransporter() {
  try {
    // Check if all required email config is present
    const host = process.env.EMAIL_HOST;
    const service = process.env.EMAIL_SERVICE;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS; // Check both possible variable names

    console.log('Email Config Check:', { 
      host: !!host, 
      service: !!service,
      port: !!port, 
      user: !!user, 
      pass: !!pass 
    });
    
    if (!user || !pass) {
      console.warn('⚠️ Email credentials missing - email features will be disabled');
      return null;
    }
    
    const config = {
      host,
      port,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user,
        pass
      }
    };
    
    // Add service if provided
    if (service) {
      config.service = service;
    }
    
    const emailTransporter = nodemailer.createTransport(config);
    console.log('✅ Email transporter initialized successfully');
    return emailTransporter;
  } catch (error) {
    console.error('❌ Failed to initialize email transporter:', error);
    return null;
  }
}

// Initialize the transporter right away
transporter = initializeTransporter();

exports.sendVerificationEmail = async (to, token, username = '', customContent = null) => {
  try {
    // Re-initialize transporter if undefined
    if (!transporter) {
      console.log('Attempting to re-initialize email transporter...');
      transporter = initializeTransporter();
      
      if (!transporter) {
        console.log('Email sending disabled - transporter could not be initialized');
        return false;
      }
    }
    
    // Create email content
    const frontendUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
    const verificationUrl = `https://qua-vagw.onrender.com/api/auth/verify-email/${token}`;
    const subject = 'Verify Your QuantumFX Account';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4f46e5; color: #fff; padding: 20px; text-align: center;">
          <h2>Welcome to QuantumFX</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #eee;">
          <p>Hello ${username || 'Valued Customer'},</p>
          <p>Thank you for registering with QuantumFX. Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #4f46e5; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
          </div>
          <p>If you didn't create this account, please ignore this email.</p>
          <p>This link will expire in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">If the button above doesn't work, copy and paste this URL into your browser:</p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          &copy; ${new Date().getFullYear()} QuantumFX. All rights reserved.
        </div>
      </div>
    `;
  
    const mailOptions = {
      from: `"QuantumFX" <${process.env.EMAIL_FROM || 'noreply@quantumfx.com'}>`,
      to: to, // Fixed: using the parameter 'to' instead of undefined 'email'
      subject: subject,
      html: htmlContent
    };

    try {
      console.log(`Sending email to ${to} with subject "${subject}"`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${to}:`, info.response);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      
      // Display detailed email settings (without showing full password)
      let passDisplay = 'NOT SET';
      if (process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS) {
        passDisplay = '********';
      }
      
      console.error('Email configuration:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        service: process.env.EMAIL_SERVICE,
        secure: process.env.EMAIL_SECURE,
        user: process.env.EMAIL_USER,
        pass: passDisplay
      });
      
      return false;
    }
  } catch (error) {
    console.error(`Error in sendVerificationEmail: ${error}`);
    return false;
  }
};

/**
 * Send password reset email to user
 * @param {string} email - Recipient email address
 * @param {string} resetUrl - URL with reset token
 * @param {string} name - User's name for personalization
 */
exports.sendPasswordResetEmail = async (email, resetUrl, name) => {
  try {
    // Re-initialize transporter if undefined
    if (!transporter) {
      console.log('Attempting to re-initialize email transporter...');
      transporter = initializeTransporter();
      
      if (!transporter) {
        console.log('Email sending disabled - transporter could not be initialized');
        return false;
      }
    }
    
    const subject = 'Reset Your QuantumFX Password';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4f46e5;">QuantumFX</h1>
          <h2>Password Reset</h2>
        </div>

        <div style="margin-bottom: 30px;">
          <p>Hello ${name},</p>
          <p>We received a request to reset your QuantumFX account password. If you didn't make this request, you can safely ignore this email.</p>
          <p>To reset your password, click the button below:</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>

        <div style="margin-top: 30px; font-size: 14px;">
          <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #4f46e5;">${resetUrl}</p>
          <p>This password reset link will expire in 1 hour for security reasons.</p>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} QuantumFX. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"QuantumFX" <${process.env.EMAIL_FROM || 'noreply@quantumfx.com'}>`,
      to: email,
      subject: subject,
      html: htmlContent
    };

    try {
      console.log(`Sending password reset email to ${email}`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}:`, info.response);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send password reset email to ${email}:`, error);
      return false;
    }
  } catch (error) {
    console.error(`Error in sendPasswordResetEmail: ${error}`);
    return false;
  }
};

exports.initializeEmailTransporter = initializeTransporter;
