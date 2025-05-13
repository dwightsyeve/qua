/**
 * TronUtill.js - Utility functions for Tron blockchain integration
 * Handles monitoring addresses for deposits and processing transaction data
 * @version 1.0.0
 * @date 2025-05-10
 */

// Import required modules
const fetch = require('node-fetch');
const db = require('../database');
const { sendEmailNotification, sendAdminNotification } = require('./WalletUtils');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Notification = require('../models/Notification');
const TronWeb = require('tronweb');

// Import the USDT contract address from WalletUtils for consistency
const { USDT_CONTRACT_ADDRESS } = require('./WalletUtils');

// Initialize TronWeb instance if environment variables are available
let tronWeb;
try {
  const fullHost = process.env.TRON_FULL_NODE || 'https://api.trongrid.io';
  const apiKey = process.env.TRONGRID_API_KEY;
  
  tronWeb = new TronWeb({
    fullHost: fullHost,
    headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined
  });
  
  console.log('TronWeb initialized successfully');
} catch (error) {
  console.error('Error initializing TronWeb:', error);
}

/**
 * Monitor address for incoming TRC20 deposits
 * This would typically be part of a background job or service
 * @param {string} address - TRON address to monitor
 * @param {number} userId - User ID associated with this address
 * @returns {Promise<boolean>} Success status
 */
exports.checkForDeposits = async (address, userId) => {
  try {
    // Input validation
    if (!address || !userId) {
      console.error('Invalid parameters in checkForDeposits:', { address, userId });
      return false;
    }

    console.log(`Checking deposits for address ${address} and user ${userId}`);
    
    // Get the transaction history for this address
    const transactions = await fetchTronTransactions(address);
    
    if (!transactions || !Array.isArray(transactions)) {
      console.error('No valid transactions returned for address:', address);
      return false;
    }
    
    console.log(`Found ${transactions.length} transactions for address ${address}`);
    
    // Set of processed transaction IDs to avoid duplicates
    const processedTxIds = await getProcessedTransactionIds(userId);
    
    let depositCount = 0;
    
    for (const tx of transactions) {
      // Skip already processed transactions
      if (processedTxIds.has(tx.txID)) {
        continue;
      }
      
      // Check if this is a deposit to our address using the exported function
      if (exports.isUSDTDeposit(tx, address)) {
        console.log(`Processing deposit transaction ${tx.txID}`);
        await processDeposit(tx, userId);
        
        // Mark as processed
        await markTransactionAsProcessed(tx.txID, userId);
        depositCount++;
      }
    }
    
    console.log(`Processed ${depositCount} new deposits for user ${userId}`);
    
    return true;
  } catch (error) {
    console.error(`Error checking deposits for ${address}:`, error);
    
    // Send admin notification for critical failures
    try {
      const { sendAdminNotification } = require('./WalletUtils');
      sendAdminNotification('Deposit Monitoring Error', 
        `Failed to check deposits for address ${address} (User ID: ${userId})\n\nError: ${error.message}`);
    } catch (notifyError) {
      console.error('Failed to send admin notification:', notifyError);
    }
    
    return false;
  }
};

/**
 * Fetch real transaction data from the TRON blockchain with retry logic
 * @param {string} address - The address to check for transactions
 * @returns {Promise<Array>} Array of transactions
 */
async function fetchTronTransactions(address) {
  const maxRetries = 3;
  const timeout = 10000; // 10 seconds timeout
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use TronGrid API to get transactions
      const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`;
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add API key if available
      const apiKey = process.env.TRONGRID_API_KEY;
      if (apiKey) {
        headers['TRON-PRO-API-KEY'] = apiKey;
      } else {
        console.warn('No TRONGRID_API_KEY found in environment variables. API requests may be rate limited.');
      }
      
      console.log(`Fetching transactions for ${address} (Attempt ${attempt}/${maxRetries})`);
      
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`TronGrid API Error: ${response.status} ${response.statusText}`);
        
        // If we get a specific error that retrying won't help with, throw immediately
        if (response.status === 401 || response.status === 403) {
          throw new Error(`API authorization error: ${response.status} ${response.statusText}`);
        }
        
        // For other errors, retry if we haven't reached max retries
        if (attempt < maxRetries) {
          const delay = attempt * 2000; // Progressive backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data || [];
      
    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // If this is an abort error (timeout), we should retry
      if (error.name === 'AbortError' && attempt < maxRetries) {
        const delay = attempt * 2000; // Progressive backoff
        console.log(`Request timed out. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If we've reached max retries or have a non-timeout error
      if (attempt >= maxRetries) {
        console.error('Max retries reached. Using fallback approach.');
        
        // For development, return mock data
        if (process.env.NODE_ENV === 'development') {
          console.log('Using mock transaction data for development');
          return getMockTransactions(address);
        }
        
        return [];
      }
    }
  }
  
  // If we somehow exit the loop without returning, return empty array
  return [];
}

/**
 * Process a valid deposit
 * @param {Object} tx - Transaction object
 * @param {number} userId - User ID
 */
async function processDeposit(tx, userId) {
  const db = require('../database');
  
  try {
    // Start a database transaction
    db.prepare('BEGIN').run();
    
    // Calculate the amount in standard units
    const decimals = tx.token_info?.decimals || 6;
    const rawAmount = tx.value;
    const amount = rawAmount / Math.pow(10, decimals);
    
    // Create a deposit record
    db.prepare(`
      INSERT INTO transactions (
        userId, 
        type, 
        amount, 
        status, 
        txHash,
        details
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      'Deposit',
      amount,
      'Completed',
      tx.txID,
      JSON.stringify({
        network: 'TRC20',
        tokenName: tx.token_info?.name || 'USDT',
        fromAddress: tx.from,
        timestamp: tx.block_timestamp,
        blockNumber: tx.blockNumber || 0
      })
    );
    
    // Update user's wallet balance
    const wallet = db.prepare('SELECT * FROM wallets WHERE userId = ?').get(userId);
    
    if (!wallet) {
      throw new Error(`No wallet found for user ${userId}`);
    }
    
    const newBalance = wallet.balance + amount;
    
    db.prepare(`
      UPDATE wallets 
      SET balance = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE userId = ?
    `).run(newBalance, userId);
      // Commit the transaction
    db.prepare('COMMIT').run();
    
    console.log(`Deposit processed: ${amount} USDT for user ${userId}, tx: ${tx.txID}`);
    
    // Process referral commissions for this deposit
    try {
      const { processDepositForReferrals } = require('../controller/ReferralController');
      const referralLogger = require('./referralLogger');
      
      referralLogger.info(`Deposit detected in blockchain monitor - User: ${userId}, Amount: ${amount}, TxHash: ${tx.txID}`, 
        { userId, amount, txHash: tx.txID }, true);
      
      // Process the deposit for referrals (don't await, let it run in background)
      processDepositForReferrals(userId, amount)
        .then(result => {
          referralLogger.info(`Referral commission processing completed for blockchain deposit: ${result ? 'Success' : 'Failed'}`, 
            { userId, amount, txHash: tx.txID, result }, true);
        })
        .catch(error => {
          referralLogger.error(`Error processing referral commission: ${error.message}`, 
            { userId, amount, txHash: tx.txID, error: error.stack }, true);
        });
    } catch (referralError) {
      console.error('Error initiating referral processing:', referralError);
      // Don't fail the deposit process if referral processing fails
    }
    
    return true;
  } catch (error) {
    // Rollback the transaction on error
    db.prepare('ROLLBACK').run();
    console.error('Error processing deposit:', error);
    return false;
  }
}

/**
 * Get a set of transaction IDs that have already been processed for a user
 * @param {number} userId - User ID
 * @returns {Promise<Set>} Set of processed transaction IDs
 */
async function getProcessedTransactionIds(userId) {
  const db = require('../database');
  
  try {
    const rows = db.prepare('SELECT txHash FROM transactions WHERE userId = ?').all(userId);
    return new Set(rows.map(row => row.txHash).filter(Boolean));
  } catch (error) {
    console.error('Error getting processed transactions:', error);
    return new Set();
  }
}

/**
 * Mark a transaction as processed
 * @param {string} txId - Transaction ID
 * @param {number} userId - User ID
 */
async function markTransactionAsProcessed(txId, userId) {
  const db = require('../database');
  
  try {
    // Record this tx in a separate table to prevent duplicate processing
    db.prepare(`
      INSERT OR IGNORE INTO processed_transactions (
        txHash, 
        userId, 
        processedAt
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(txId, userId);
    
    return true;
  } catch (error) {
    console.error('Error marking transaction as processed:', error);
    return false;
  }
}

/**
 * Get transaction details from TRON blockchain
 * @param {string} txHash - Transaction hash/ID
 * @returns {Promise<Object>} Transaction details or null if not found
 */
exports.getTransactionDetails = async (txHash) => {
  try {
    // Use TronWeb to get transaction info
    const txInfo = await tronWeb.trx.getTransaction(txHash);
    return txInfo;
  } catch (error) {
    console.error(`Error getting transaction details for ${txHash}:`, error);
    return null;
  }
};

/**
 * Generate mock transaction data for development purposes
 * @param {string} address - The address to generate mock data for
 * @returns {Array} Array of mock transactions
 */
function getMockTransactions(address) {
  const currentTimestamp = Date.now();
  
  return [
    {
      txID: `mock_tx_${Date.now()}_1`,
      from: 'TXHvwxYbqDgKaPradrY7DPgKTRnd2HzAEA', // Random sender address
      to: address,
      block_timestamp: currentTimestamp - 3600000, // 1 hour ago
      value: 5000000, // 5 USDT with 6 decimals
      token_info: {
        id: USDT_CONTRACT_ADDRESS,
        name: 'USDT',
        symbol: 'USDT',
        decimals: 6
      }
    },
    {
      txID: `mock_tx_${Date.now()}_2`,
      from: 'TEg2nhY9RXcQnQcuqDS3DEUPvHuQfVfSVp', // Another random sender address
      to: address,
      block_timestamp: currentTimestamp - 7200000, // 2 hours ago
      value: 10000000, // 10 USDT with 6 decimals
      token_info: {
        id: USDT_CONTRACT_ADDRESS,
        name: 'USDT',
        symbol: 'USDT',
        decimals: 6
      }
    }
  ];
}

/**
 * Create a processed_transactions table to track which transactions have been processed
 * This helps prevent double-processing of deposits
 */
exports.createProcessedTransactionsTable = () => {
  const db = require('../database');
  
  return db.prepare(`
    CREATE TABLE IF NOT EXISTS processed_transactions (
      txHash TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      processedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `).run();
};

/**
 * Get all processed transactions from the database
 * @returns {Array} Array of processed transactions
 */
exports.getProcessedTransactions = () => {
  const db = require('../database');
  
  try {
    return db.prepare('SELECT * FROM processed_transactions ORDER BY processedAt DESC').all();
  } catch (error) {
    console.error('Error getting processed transactions:', error);
    return [];
  }
};

/**
 * Setup regular deposit checking for all users
 * @param {number} intervalMs - Interval in milliseconds between checks (default: 5 minutes)
 */
exports.startDepositMonitoring = async (intervalMs = process.env.DEPOSIT_CHECK_INTERVAL || 300000) => {
  const Wallet = require('../models/Wallet');
  const db = require('../database');
  
  console.log(`Starting deposit monitoring at ${new Date().toISOString()}`);
  console.log(`Check interval: ${intervalMs}ms (${intervalMs / 60000} minutes)`);
  
  try {
    // Schedule regular checks
    setInterval(async () => {
      try {
        console.log(`Running scheduled deposit check at ${new Date().toISOString()}`);
        
        // Get all active wallets
        const wallets = db.prepare('SELECT * FROM wallets WHERE status = ?').all('active');
        
        console.log(`Checking deposits for ${wallets.length} active wallets`);
        
        // Check each wallet for deposits
        for (const wallet of wallets) {
          try {
            await exports.checkForDeposits(wallet.address, wallet.userId);
          } catch (walletError) {
            console.error(`Error checking deposits for wallet ${wallet.address}:`, walletError);
          }
        }
      } catch (error) {
        console.error('Error in deposit monitoring interval:', error);
      }
    }, intervalMs);
    
    return true;
  } catch (error) {
    console.error('Failed to start deposit monitoring:', error);
    return false;
  }
};

// Export helper functions to make them available to other modules
exports.fetchTronTransactions = fetchTronTransactions;
exports.processDeposit = processDeposit;
exports.getProcessedTransactionIds = getProcessedTransactionIds;
exports.markTransactionAsProcessed = markTransactionAsProcessed;
exports.getMockTransactions = getMockTransactions;

/**
 * Check if a transaction is a valid USDT deposit
 * @param {Object} tx - Transaction object
 * @param {string} address - The address to check
 * @returns {boolean} True if it's a valid USDT deposit, false otherwise
 */
function isUSDTDeposit(tx, address) {
  try {
    // Validate inputs
    if (!tx || !address) {
      console.error('Invalid parameters in isUSDTDeposit:', { txExists: !!tx, addressExists: !!address });
      return false;
    }
    
    // Handle different transaction formats from TronGrid API
    if (tx.type === 'Transfer' || tx.type === 'TransferContract') {
      // For standard TRC20 transfers
      // Check the correct recipient address and USDT contract
      const isToCorrectAddress = tx.to && tx.to.toLowerCase() === address.toLowerCase();
      const isUSDTContract = tx.token_info?.id?.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase();
      
      return isToCorrectAddress && isUSDTContract;
    } else if (tx.type === 'TriggerSmartContract' && tx.contract_address) {
      // For smart contract calls
      const isUSDTContract = tx.contract_address?.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase();
      const isToCorrectAddress = tx.parameter?.value?._to?.toLowerCase() === address.toLowerCase();
      
      return isUSDTContract && isToCorrectAddress;
    } else if (tx.token_info) {
      // For TransferAssetContract or other token transfers from the API
      const isToCorrectAddress = tx.to && tx.to.toLowerCase() === address.toLowerCase();
      const isUSDTContract = tx.token_info?.id?.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase();
      
      return isToCorrectAddress && isUSDTContract;
    }
    
    return false;
  } catch (error) {
    console.error('Error in isUSDTDeposit:', error);
    return false;
  }
}

// Export the function so it can be used elsewhere
exports.isUSDTDeposit = isUSDTDeposit;