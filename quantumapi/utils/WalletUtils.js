/**
 * Production-ready TRON wallet implementation
 * Generates real TRC20 addresses using HD wallet derivation
 */
const TronWeb = require('tronweb');
const bip39 = require('bip39');
const hdkey = require('hdkey');
const CryptoJS = require('crypto-js');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { sendVerificationEmail } = require('./emailService');

// Load environment variables
dotenv.config();

// Define USDT contract address as a constant for consistent reference
const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// CRITICAL CONFIGURATION - ENSURE THESE ARE SET IN PRODUCTION
const fullHost = process.env.TRON_FULL_NODE || 'https://api.trongrid.io';
const apiKey = process.env.TRONGRID_API_KEY;
const masterPrivateKey = process.env.ADMIN_PRIVATE_KEY;
const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
// Always use environment variables for secrets in production
const SECRET_KEY = process.env.WALLET_SECRET_KEY;

if (!SECRET_KEY) {
  throw new Error('WALLET_SECRET_KEY must be configured in environment variables');
}

if (!masterPrivateKey || masterPrivateKey.length < 10) {
  throw new Error('ADMIN_PRIVATE_KEY must be configured in environment variables');
}

if (!encryptionKey || encryptionKey === 'your_secure_encryption_key_here') {
  throw new Error('WALLET_ENCRYPTION_KEY must be configured in environment variables');
}

// Initialize TronWeb for blockchain interactions
const tronWeb = new TronWeb({
  fullHost: fullHost,
  headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined,
  privateKey: masterPrivateKey
});

/**
 * Generate a TRC20 address for the user
 * @param {number} userId - User ID to associate with the address
 * @returns {Promise<object>} Address data with encryption
 */
async function generateTRC20Address(userId) {
  try {
    if (userId === undefined || userId === null || isNaN(userId)) {
      throw new Error('Cannot generate wallet: Invalid or undefined userId');
    }
    console.log(`Generating production TRC20 address for user ${userId}`);
    
    // Generate deterministic HD wallet seed from master private key and user ID
    const seedPhrase = await generateDeterministicSeed(userId);
    
    // Create HD wallet from seed
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    const hdWallet = hdkey.fromMasterSeed(seed);
    
    // Derive child private key using TRON's BIP44 path
    const childIndex = userId % 2147483647; // Prevent overflow
    const derivationPath = `m/44'/195'/0'/0/${childIndex}`;
    const child = hdWallet.derive(derivationPath);
    
    // Get private key as hex
    const privateKey = child.privateKey.toString('hex');
    
    // Store current tronWeb private key
    const currentPrivateKey = tronWeb.defaultPrivateKey;
    
    try {
      // Generate TRON address from private key
      tronWeb.setPrivateKey(privateKey);
      const account = tronWeb.address.fromPrivateKey(privateKey);
      const address = tronWeb.address.fromHex(account);
      
      // Encrypt private key for storage
      const encryptedPrivateKey = encryptPrivateKey(privateKey);
      
      console.log(`Generated production TRC20 address ${address} for user ${userId}`);
      
      return {
        address,
        encryptedPrivateKey
      };
    } finally {
      // Always restore the original private key to avoid side effects
      if (currentPrivateKey) {
        tronWeb.setPrivateKey(currentPrivateKey);
      } else {
        tronWeb.setPrivateKey(masterPrivateKey);
      }
    }
  } catch (error) {
    console.error("Error generating TRC20 address:", error);
    throw new Error(`Failed to generate wallet address: ${error.message}`);
  }
}

/**
 * Validate a wallet address format based on network
 * @param {string} address - The wallet address to validate
 * @param {string} network - Network type (e.g., 'TRC20', 'BTC', 'ETH')
 * @returns {boolean} Whether the address format is valid
 */
function validateWalletAddress(address, network) {
  if (!address || !network) return false;
  
  const network_upper = network.toUpperCase();
  
  // Basic validation patterns for different networks
  switch (network_upper) {
    case 'TRC20':
    case 'TRON':
    case 'TRX':
      // TRON addresses start with 'T' and are 34 chars
      return /^T[0-9A-Za-z]{33}$/.test(address);
    
    case 'BTC':
    case 'BITCOIN':
      // Bitcoin addresses can have different formats
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(address);
    
    case 'ETH':
    case 'ETHEREUM':
      // Ethereum addresses are 42 chars including '0x'
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    
    case 'BSC':
    case 'BINANCE':
      // BSC uses same format as Ethereum
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    
    default:
      // For unsupported networks, perform basic validation
      return address.length >= 30 && address.length <= 60;
  }
}

/**
 * Generate a deterministic seed based on master key and user ID
 * @param {number} userId - User ID for seed generation
 * @returns {Promise<string>} BIP39 mnemonic seed phrase
 */
async function generateDeterministicSeed(userId) {
  try {
    if (!userId || isNaN(userId)) {
      throw new Error('Valid user ID is required for seed generation');
    }
    
    // For additional security, add salt and application identifier
    const appIdentifier = process.env.APP_IDENTIFIER || 'quantum_wallet';
    const envSalt = process.env.SEED_GENERATION_SALT || 'production_seed_salt';
    
    // Create a deterministic value by hashing master key, salt, and user ID
    const data = `${masterPrivateKey}-${userId}-${appIdentifier}-${envSalt}-${process.env.NODE_ENV || 'production'}`;
    
    // Use a more secure hashing approach with two rounds
    let hash = crypto.createHash('sha256').update(data).digest('hex');
    
    // Second round of hashing for extra security
    hash = crypto.createHash('sha256').update(hash).digest('hex');
    
    // Use hash as entropy for BIP39 mnemonic (32 bytes/64 hex chars)
    const entropy = Buffer.from(hash.slice(0, 64), 'hex');
    const mnemonic = bip39.entropyToMnemonic(entropy);
    
    return mnemonic;
  } catch (error) {
    console.error('Error generating deterministic seed:', error);
    throw new Error(`Failed to generate wallet seed: ${error.message}`);
  }
}

/**
 * Encrypt a private key for secure storage
 * @param {string} privateKey - Raw private key
 * @returns {string} Encrypted private key
 */
function encryptPrivateKey(privateKey) {
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SECRET_KEY, 'salt', 32);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a stored private key
 * @param {string} encryptedKey - Encrypted private key
 * @returns {string} Decrypted private key
 */
function decryptPrivateKey(encryptedKey) {
  const algorithm = 'aes-256-cbc';
  
  try {
    if (!encryptedKey || typeof encryptedKey !== 'string') {
      throw new Error('Invalid encrypted key format');
    }
    
    const parts = encryptedKey.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted key format');
    }
    
    const [ivHex, encryptedHex] = parts;
    
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(SECRET_KEY, 'salt', 32);
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting private key:', error);
    throw new Error(`Failed to decrypt private key: ${error.message}`);
  }
}

/**
 * Query USDT balance for an address
 * @param {string} address - Wallet address to check
 * @param {string} network - Network type
 * @returns {Promise<number>} Balance amount
 */
async function getUsdtBalance(address, network = 'TRC20') {
  if (!address) {
    throw new Error('Address is required to fetch USDT balance');
  }
  
  // Validate address format first
  if (!validateWalletAddress(address, network)) {
    throw new Error(`Invalid address format for network ${network}`);
  }
  
  // Use the defined constant
  const contractAddress = USDT_CONTRACT_ADDRESS;
  
  try {
    // Set timeout for balance check to prevent hanging requests
    const contract = await tronWeb.contract().at(contractAddress);
    
    const balancePromise = contract.balanceOf(address).call();
    const balance = await Promise.race([
      balancePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Balance check timed out after 15 seconds')), 15000)
      )
    ]);
    
    // Convert from smallest unit to standard unit (6 decimals for USDT)
    const balanceUsdt = parseInt(balance) / 1e6;
    
    // Log successful balance check
    console.log(`USDT Balance for ${address}: ${balanceUsdt.toFixed(6)} USDT`);
    
    return balanceUsdt;
  } catch (error) {
    console.error(`Error fetching USDT balance for ${address}:`, error);
    
    // Provide more specific error messages for different failure cases
    if (error.message && error.message.includes('timed out')) {
      throw new Error(`Balance check timed out for address ${address}`);
    } else if (error.message && error.message.includes('Invalid address')) {
      throw new Error(`Invalid TRON address format: ${address}`);
    } else if (error.message && error.message.includes('Account not found')) {
      // Address exists but has no transactions yet
      return 0;
    } else {
      throw new Error(`Failed to fetch token balance: ${error.message}`);
    }
  }
}

/**
 * Send USDT tokens
 * @param {string} fromAddress - Source address
 * @param {string} toAddress - Destination address
 * @param {number} amount - Amount to send
 * @param {string} privateKey - Private key for signing
 * @param {string} network - Network type
 * @returns {Promise<object>} Transaction result
 */
async function sendUsdt(fromAddress, toAddress, amount, privateKey, network = 'TRC20') {
  if (!validateWalletAddress(toAddress, network)) {
    throw new Error('Invalid destination address');
  }
  
  if (amount <= 0) {
    throw new Error('Invalid amount');
  }
  
  // Store current private key to restore later
  const currentPrivateKey = tronWeb.defaultPrivateKey;
    // Set the private key for transaction signing
  tronWeb.setPrivateKey(privateKey);
  
  // Use the defined constant for contract address
  const contractAddress = USDT_CONTRACT_ADDRESS;
  
  try {
    // Verify we have enough USDT balance
    const fromAddressDerived = tronWeb.address.fromPrivateKey(privateKey);
    const derivedAddressHex = tronWeb.address.toHex(fromAddressDerived);
    
    // Get contract instance
    const contract = await tronWeb.contract().at(contractAddress);
    
    // Check sender balance
    const balance = await contract.balanceOf(fromAddressDerived).call();
    const balanceUsdt = parseInt(balance) / 1e6;
    
    if (balanceUsdt < amount) {
      throw new Error(`Insufficient USDT balance: ${balanceUsdt.toFixed(2)} USDT available, ${amount.toFixed(2)} USDT needed`);
    }
    
    // Calculate amount with decimals (USDT has 6 decimals)
    const tokenAmount = Math.floor(amount * 1e6);
    
    // Send tokens with timeout
    const transaction = await Promise.race([
      contract.transfer(toAddress, tokenAmount).send(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timed out after 30 seconds')), 30000)
      )
    ]);
    
    return {
      success: true,
      txHash: transaction,
      fromAddress: fromAddressDerived,
      toAddress,
      amount,
      network,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error sending USDT:', error);
    throw new Error(`Failed to send USDT tokens: ${error.message}`);
  } finally {
    // Always restore the original private key
    if (currentPrivateKey) {
      tronWeb.setPrivateKey(currentPrivateKey);
    } else {
      tronWeb.setPrivateKey(masterPrivateKey);
    }
  }
}

/**
 * Send email notification for wallet transactions
 * @param {string} email - User email
 * @param {string} type - Notification type
 * @param {object} data - Transaction data
 */
async function sendEmailNotification(email, type, data) {
  if (!email || !type) {
    console.warn('Email notification requested but email or type is missing');
    return false;
  }
  
  if (!data) {
    data = {}; // Provide empty object to prevent errors when accessing properties
  }
  
  let subject = '';
  let content = '';
  
  try {
    switch (type) {
      case 'deposit_received':
        subject = 'Deposit Received!';
        content = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #4CAF50;">Deposit Received</h2>
            <p>Hello valued customer,</p>
            <p>Your deposit of <strong>${data.amount || '0'} USDT</strong> has been received.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
              <p><strong>Amount:</strong> ${data.amount || '0'} USDT</p>
              <p><strong>Network:</strong> ${data.network || 'TRC20'}</p>
              <p><strong>Transaction ID:</strong> ${data.txId || 'N/A'}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p>Thank you for choosing our platform!</p>
            <p style="color: #888; font-size: 0.9em;">This is an automated message. Please do not reply to this email.</p>
          </div>
        `;
        break;
        
      case 'withdrawal_processed':
        subject = 'Withdrawal Processed';
        content = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #4CAF50;">Withdrawal Processed</h2>
            <p>Hello valued customer,</p>
            <p>Your withdrawal request has been processed.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
              <p><strong>Amount:</strong> ${data.amount || '0'} USDT</p>
              <p><strong>Network:</strong> ${data.network || 'TRC20'}</p>
              <p><strong>Transaction ID:</strong> ${data.txId || 'N/A'}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p>Thank you for choosing our platform!</p>
            <p style="color: #888; font-size: 0.9em;">This is an automated message. Please do not reply to this email.</p>
          </div>
        `;
        break;
        
      case 'withdrawal_failed':
        subject = 'Withdrawal Processing Failed';
        content = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #e74c3c;">Withdrawal Processing Failed</h2>
            <p>Hello valued customer,</p>
            <p>We regret to inform you that your withdrawal request could not be processed.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
              <p><strong>Amount:</strong> ${data.amount || '0'} USDT</p>
              <p><strong>Network:</strong> ${data.network || 'TRC20'}</p>
              <p><strong>Reason:</strong> ${data.reason || 'Technical error. Please contact support.'}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p>If you have any questions, please contact our support team.</p>
            <p>Thank you for your patience and understanding.</p>
            <p style="color: #888; font-size: 0.9em;">This is an automated message. Please do not reply to this email.</p>
          </div>
        `;
        break;
        
      default:
        subject = 'Wallet Notification';
        content = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #4CAF50;">Wallet Notification</h2>
            <p>Hello valued customer,</p>
            <p>There has been an update to your wallet.</p>
            <p>Thank you for choosing our platform!</p>
            <p style="color: #888; font-size: 0.9em;">This is an automated message. Please do not reply to this email.</p>
          </div>
        `;
    }
    
    await sendVerificationEmail(email, subject, null, content);
    return true;
  } catch (error) {
    console.error('Error sending wallet notification email:', error);
    
    // Try to send alert to admins about the email failure
    try {
      await sendAdminNotification('Email Notification Failure', {
        emailType: type,
        recipientEmail: email,
        error: error.message
      });
    } catch (innerError) {
      console.error('Failed to notify admins about email failure:', innerError);
    }
    
    return false;
  }
}

/**
 * Send notification to admin(s) about important wallet activities
 * @param {string} subject - Notification subject
 * @param {object} data - Data to include in the notification
 */
async function sendAdminNotification(subject, data) {
  try {
    // Get admin email(s) from environment variables or config
    const adminEmails = process.env.ADMIN_EMAILS ? 
      process.env.ADMIN_EMAILS.split(',').filter(Boolean) : 
      ['admin@quantumfx.com']; // Fallback to default admin email
    
    if (adminEmails.length === 0) {
      console.error('No admin emails configured. Cannot send admin notification.');
      return false;
    }
    
    // Create email content with improved structure and transaction ID
    const emailContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #e74c3c;">Admin Alert: ${subject}</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
          ${data.transactionId ? `<p><strong>Transaction ID:</strong> ${data.transactionId}</p>` : ''}
          ${data.userId ? `<p><strong>User ID:</strong> ${data.userId}</p>` : ''}
          ${data.amount ? `<p><strong>Amount:</strong> ${data.amount} USDT</p>` : ''}
          ${data.walletAddress ? `<p><strong>Wallet Address:</strong> ${data.walletAddress}</p>` : ''}
          ${data.network ? `<p><strong>Network:</strong> ${data.network}</p>` : ''}
          <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="color: #888; font-size: 0.9em;">This is an automated message. Please log in to the admin panel to take action.</p>
        <div style="margin-top: 20px; text-align: center;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin.html" 
             style="background-color: #3498db; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Go to Admin Panel
          </a>
        </div>
      </div>
    `;
    
    // Send email to each admin with proper error handling for individual emails
    const emailResults = await Promise.allSettled(
      adminEmails.map(email => sendVerificationEmail(email, `ADMIN ALERT: ${subject}`, null, emailContent))
    );
    
    // Log any failed emails but don't fail the overall process
    const failedEmails = emailResults
      .map((result, index) => result.status === 'rejected' ? adminEmails[index] : null)
      .filter(Boolean);
    
    if (failedEmails.length > 0) {
      console.warn(`Failed to send admin notifications to ${failedEmails.length} of ${adminEmails.length} admins:`, failedEmails);
    }
    
    // Consider notification sent if at least one admin received it
    return emailResults.some(result => result.status === 'fulfilled');
  } catch (error) {
    console.error('Error in sendAdminNotification function:', error);
    return false;
  }
}

module.exports = {
  generateTRC20Address,
  validateWalletAddress,
  decryptPrivateKey,
  encryptPrivateKey,  // Exposing for wallet recovery tools
  getUsdtBalance,
  sendUsdt,
  sendEmailNotification,
  sendAdminNotification,
  // Export constants for consistency across the application
  USDT_CONTRACT_ADDRESS: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
};