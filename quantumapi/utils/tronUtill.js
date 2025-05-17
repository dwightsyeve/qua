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
 * Check if a transaction is a valid USDT deposit to the user's address.
 * @param {Object} tx - The transaction object from TronGrid.
 * @param {string} userDepositAddress - The user's TRC20 deposit address.
 * @returns {boolean} True if it's a valid deposit, false otherwise.
 */
function isUSDTDeposit(tx, userDepositAddress) {
  try {
    if (!tx || !userDepositAddress) {
      console.error('[isUSDTDeposit] Invalid parameters: tx or userDepositAddress is null/undefined.');
      return false;
    }

    const txToAddress = tx.to;
    const tokenInfo = tx.token_info;
    // TronGrid typically provides contract address in token_info.address or token_info.id
    // Prefer token_info.address if available
    const txContractAddress = tokenInfo?.address || tokenInfo?.id;
    const txType = tx.type; // e.g., 'Transfer'
    const txValue = tx.value; // Amount in smallest unit (string)

    if (txType !== 'Transfer') {
      // console.log(`[isUSDTDeposit] TXID ${tx.transaction_id || tx.txID}: Not a 'Transfer' type (Type: ${txType}). Skipping.`);
      return false;
    }

    if (!txToAddress || !txContractAddress || txValue === undefined) {
      console.error(`[isUSDTDeposit] TXID ${tx.transaction_id || tx.txID}: Missing critical transaction data (to, contract, or value).`);
      return false;
    }

    const isToCorrectUserAddress = txToAddress.toLowerCase() === userDepositAddress.toLowerCase();
    const isCorrectUSDTContract = txContractAddress.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase();
    
    // Ensure txValue is a string and can be parsed to a number
    const numericValue = typeof txValue === 'string' ? parseInt(txValue, 10) : Number(txValue);
    const isValidValue = !isNaN(numericValue) && numericValue > 0;

    if (!isToCorrectUserAddress) {
      // console.log(`[isUSDTDeposit] TXID ${tx.transaction_id || tx.txID}: To address mismatch. Expected ${userDepositAddress}, got ${txToAddress}.`);
    }
    if (!isCorrectUSDTContract) {
      // console.log(`[isUSDTDeposit] TXID ${tx.transaction_id || tx.txID}: Contract address mismatch. Expected ${USDT_CONTRACT_ADDRESS}, got ${txContractAddress}.`);
    }
    if (!isValidValue) {
      // console.log(`[isUSDTDeposit] TXID ${tx.transaction_id || tx.txID}: Invalid or zero value (${txValue}).`);
    }

    return isToCorrectUserAddress && isCorrectUSDTContract && isValidValue;

  } catch (error) {
    console.error(`[isUSDTDeposit] EXCEPTION for TXID ${tx.transaction_id || tx.txID}:`, error);
    return false;
  }
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
    if (!address || userId === undefined || userId === null) {
      console.error('Invalid parameters in checkForDeposits:', { address, userId });
      return false;
    }

    // console.log(`Checking deposits for address ${address} and user ${userId}`);
    
    // Get the transaction history for this address
    const transactions = await fetchTronTransactions(address);
    
    if (!transactions || !Array.isArray(transactions)) {
      console.error('No valid transactions returned by fetchTronTransactions for address:', address);
      return false; // Or handle as no new transactions
    }
    
    // console.log(`Found ${transactions.length} transactions for address ${address}`);
    
    // Set of processed transaction IDs to avoid duplicates
    const processedTxIds = await getProcessedTransactionIds(userId);
    // console.log(`Found ${processedTxIds.size} previously processed transactions for user ${userId}`);
    
    let depositCount = 0;
    
    for (const tx of transactions) {
      const txId = tx.transaction_id || tx.txID; // Prefer transaction_id if available
      if (!txId) {
        // console.warn('[checkForDeposits] Transaction missing ID:', tx);
        continue;
      }

      // console.log(`[checkForDeposits] Analyzing transaction ${txId}`);
      
      // Skip already processed transactions
      if (processedTxIds.has(txId)) {
        // console.log(`[checkForDeposits] Transaction ${txId} already processed, skipping`);
        continue;
      }
      
      // Check if this is a deposit to our address
      if (isUSDTDeposit(tx, address)) { // Pass the actual transaction object
        // console.log(`[checkForDeposits] Processing deposit transaction ${txId}`);
        const success = await processDeposit(tx, userId); // Pass the actual transaction object
        if (success) {
          await markTransactionAsProcessed(txId, userId); // Use the consistent txId
          depositCount++;
        }
      } else {
        // console.log(`[checkForDeposits] Skipping transaction ${txId} - not a valid USDT deposit or other issue.`);
      }
    }
    
    if (depositCount > 0) {
      console.log(`Processed ${depositCount} new deposits for user ${userId}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error checking deposits for ${address}, user ${userId}:`, error);
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
      //if (attempt >= maxRetries) {
       // console.error('Max retries reached. Using fallback approach.');
        
        // For development, return mock data
       // if (process.env.NODE_ENV === 'development') {
         // console.log('Using mock transaction data for development');
          //return getMockTransactions(address);
        //}
        
       /**
        * description
        */ //return [];
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
  const db = require('../database'); // Ensure db is required here if not at top level of module
  const txId = tx.transaction_id || tx.txID; // Use consistent txId

  // console.log(`[processDeposit] Attempting to process TXID: ${txId} for UserID: ${userId}`);
  try {
    db.prepare('BEGIN').run();
    // console.log('[processDeposit] DB Transaction BEGIN');

    const tokenInfo = tx.token_info;
    const decimals = tokenInfo?.decimals !== undefined ? parseInt(tokenInfo.decimals, 10) : 6; // Default to 6 if undefined
    const rawAmount = tx.value; // This is usually a string

    if (typeof rawAmount !== 'string' && typeof rawAmount !== 'number') {
        console.error(`[processDeposit] Invalid rawAmount type: ${typeof rawAmount} for TXID ${txId}. Rolling back.`);
        db.prepare('ROLLBACK').run();
        return false;
    }
    
    const numericRawAmount = typeof rawAmount === 'string' ? parseInt(rawAmount, 10) : Number(rawAmount);

    if (isNaN(numericRawAmount)) {
        console.error(`[processDeposit] rawAmount "${rawAmount}" is not a number for TXID ${txId}. Rolling back.`);
        db.prepare('ROLLBACK').run();
        return false;
    }

    const amount = numericRawAmount / Math.pow(10, decimals);

    if (isNaN(amount) || amount <= 0) {
        console.error(`[processDeposit] Invalid calculated amount: ${amount} (from raw ${numericRawAmount}, decimals ${decimals}) for TXID ${txId}. Rolling back.`);
        db.prepare('ROLLBACK').run();
        return false;
    }
    // console.log(`[processDeposit] Calculated amount: ${amount}`);

    const existingTransaction = Transaction.findByTxHash(txId);
    if (existingTransaction) {
      console.warn(`[processDeposit] Transaction with hash ${txId} already exists in transactions table. Skipping insertion, but will check wallet balance. UserID: ${userId}`);
      // This case should ideally be caught by getProcessedTransactionIds, but as a safeguard:
      // Potentially update wallet balance if it wasn't updated before, though this indicates an inconsistent state.
      // For now, we assume getProcessedTransactionIds is the primary guard.
      // If we reach here, it implies markTransactionAsProcessed might have failed previously,
      // or getProcessedTransactionIds logic needs review.
      // We will proceed to update balance if the transaction record exists but might not have been fully processed.
    } else {
        Transaction.create({
          userId,
          type: 'Deposit',
          amount,
          status: 'Completed', // Deposits are usually considered completed once verified on-chain
          currency: tokenInfo?.symbol || 'USDT',
          txHash: txId,
          description: `Deposit of ${amount} ${tokenInfo?.symbol || 'USDT'}`,
          fee: 0, // Blockchain fees are paid by sender
          payment_method: 'TRC20',
          wallet_address: tx.to, // The user's deposit address
          // completedAt: new Date(tx.block_timestamp).toISOString(), // Use block_timestamp
          // block_timestamp is in milliseconds
          completedAt: tx.block_timestamp ? new Date(tx.block_timestamp).toISOString() : new Date().toISOString(),
        });
        // console.log(`[processDeposit] Inserted into transactions table for TXID: ${txId}`);
    }


    const wallet = Wallet.findByUserId(userId);
    if (!wallet) {
      console.error(`[processDeposit] No wallet found for user ${userId}. Rolling back.`);
      db.prepare('ROLLBACK').run();
      return false;
    }
    // console.log(`[processDeposit] Current wallet balance for UserID ${userId}: ${wallet.balance}`);

    const newBalance = (parseFloat(wallet.balance) || 0) + amount; // Ensure wallet.balance is treated as number
    // console.log(`[processDeposit] New calculated wallet balance for UserID ${userId}: ${newBalance}`);

    Wallet.updateBalance(userId, newBalance, wallet.pendingBalance); // Assuming pendingBalance is handled elsewhere or not affected by deposits
    // console.log(`[processDeposit] Updated wallets table for UserID ${userId}.`);

    db.prepare('COMMIT').run();
    // console.log(`[processDeposit] DB Transaction COMMIT for TXID: ${txId}`);

    // Send notifications
    try {
      const user = db.prepare('SELECT email, username FROM users WHERE id = ?').get(userId);
      if (user) {
        await sendEmailNotification(user.email, 'Deposit Confirmation', {
          username: user.username,
          amount: amount.toFixed(2), // Format amount
          currency: tokenInfo?.symbol || 'USDT',
          transactionId: txId,
          walletAddress: tx.to,
          timestamp: new Date(tx.block_timestamp).toLocaleString()
        });
        await Notification.create({
          userId,
          message: `Your deposit of ${amount.toFixed(2)} ${tokenInfo?.symbol || 'USDT'} has been confirmed. Transaction ID: ${txId.substring(0,10)}...`,
          type: 'deposit_success',
          isRead: false,
          link: `/wallet?transaction=${txId}`
        });
      }
    } catch (notificationError) {
      console.error(`[processDeposit] Failed to send notifications for TXID ${txId}:`, notificationError);
      // Do not roll back for notification failure
    }
    return true;
  } catch (error) {
    console.error(`[processDeposit] EXCEPTION for TXID: ${txId}, UserID: ${userId}:`, error);
    try {
      db.prepare('ROLLBACK').run();
      // console.log('[processDeposit] DB Transaction ROLLED BACK due to exception.');
    } catch (rbError) {
      console.error('[processDeposit] CRITICAL: Failed to ROLLBACK DB Transaction:', rbError);
    }
    return false;
  }
}

/**
 * Get a set of transaction IDs that have already been processed for a user
 * @param {number} userId - User ID
 * @returns {Promise<Set>} Set of processed transaction IDs
 */
async function getProcessedTransactionIds(userId) {
  // This function should ideally check a dedicated 'processed_transactions' table
  // or rely on the existence of the transaction in the 'transactions' table with a 'Completed' status.
  // The current implementation in the prompt was:
  // const rows = db.prepare('SELECT txHash FROM transactions WHERE userId = ? AND type = ? AND status = ?').all(userId, 'Deposit', 'Completed');
  // This seems reasonable if 'Completed' deposits are considered fully processed.
  const rows = db.prepare(
    `SELECT txHash FROM transactions 
     WHERE userId = ? AND type = 'Deposit' AND (status = 'Completed' OR status = 'Pending')` // Consider pending if it means "seen but not yet fully confirmed for balance"
  ).all(userId); // Removed type and status to catch any record of this txHash for the user.
                 // A more robust system might have a specific table for "seen" tx hashes by the monitor.
                 // For now, if it's in transactions table for this user, assume it's been "seen".
  
  const txIds = new Set();
  for (const row of rows) {
    if (row.txHash) { // Ensure txHash is not null or undefined
        txIds.add(row.txHash);
    }
  }
  return txIds;
}

async function markTransactionAsProcessed(txId, userId) {
  // This function, as per the original code structure, might be inserting into a separate 'processed_transactions' table.
  // However, if getProcessedTransactionIds relies on the main 'transactions' table,
  // then successfully inserting into 'transactions' (as done in processDeposit)
  // effectively marks it as "seen" or "processed" for the next run of checkForDeposits.
  // If 'processed_transactions' table is indeed used and separate:
  /*
  try {
    db.prepare('INSERT OR IGNORE INTO processed_transactions (txHash, userId, processedAt) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run(txId, userId);
    // console.log(`[markTransactionAsProcessed] Marked TXID ${txId} for UserID ${userId} as processed.`);
  } catch (error) {
    console.error(`[markTransactionAsProcessed] Failed to mark TXID ${txId} for UserID ${userId}:`, error);
  }
  */
  // For now, assuming that successful insertion into the main 'transactions' table by processDeposit
  // is sufficient for getProcessedTransactionIds to pick it up.
  // If there's a separate `processed_transactions` table being used by `createProcessedTransactionsTable`,
  // then the insert logic here should be uncommented and verified.
  // console.log(`[markTransactionAsProcessed] TXID ${txId} for UserID ${userId} is considered processed by virtue of being in 'transactions' table via processDeposit.`);
  return; // No separate action if main transaction table is the source of truth for "processed"
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
/* function getMockTransactions(address) {
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
*/ 
/**
 * Create a processed_transactions table to track which transactions have been processed
 * This helps prevent double-processing of deposits
 */
exports.createProcessedTransactionsTable = () => {
  // This function implies a separate table. If it exists and is used,
  // then markTransactionAsProcessed should use it, and getProcessedTransactionIds might also need to.
  // For simplicity and to avoid potential conflicts if this table isn't central to the existing logic,
  // I'm keeping the "processed" check tied to the main 'transactions' table.
  // If this table IS central, the logic in getProcessedTransactionIds and markTransactionAsProcessed needs to be aligned with it.
  db.prepare(
    `CREATE TABLE IF NOT EXISTS processed_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txHash TEXT UNIQUE NOT NULL,
      userId INTEGER, 
      processedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`
  ).run();
  // console.log("Processed transactions table checked/created.");
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
//exports.getMockTransactions = getMockTransactions;