// In utils/qrCodeGenerator.js
const qrcode = require('qrcode');

exports.generateQRCode = async (text) => {
  try {
    // Generate QR code as Data URL (base64)
    return await qrcode.toDataURL(text);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};