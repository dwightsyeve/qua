const nodemailer = require('nodemailer');

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'vivianlukas2@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'fsfdgdwedpasgnnw'
  }
});

// Send verification email or any email content
exports.sendVerificationEmail = async (email, token, name, customContent = null, customSubject = null) => {
  if (!email) {
    console.error('Email address is required to send an email');
    throw new Error('Email address is required');
  }
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  let subject = customSubject;
  let htmlContent;
  
  // If custom content is provided, use it
  if (customContent) {
    htmlContent = customContent;
    subject = customSubject || 'QuantumFX Notification';
  } else {
    // Otherwise generate verification email
    if (!token) {
      console.error('Token is required for verification emails');
      throw new Error('Token is required for verification emails');
    }
    
    const verificationUrl = `${frontendUrl}/api/auth/verify-email/${token}`;
    subject = 'Verify Your QuantumFX Account';
    
    htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4f46e5; color: #fff; padding: 20px; text-align: center;">
          <h2>Welcome to QuantumFX</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #eee;">
          <p>Hello ${name || 'Valued Customer'},</p>
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
  }
  
  const mailOptions = {
    from: `"QuantumFX" <${process.env.EMAIL_FROM || 'noreply@quantumfx.com'}>`,
    to: email,
    subject: subject,
    html: htmlContent
  };

  try {
    console.log(`Sending email to ${email} with subject "${subject}"`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${email}. Message ID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw error;
  }
};