const { checkForDeposits } = require('../utils/tronUtill');
const db = require('../database');

/**
 * Monitors all user wallets for new deposits
 */
async function monitorAllDeposits() {
  console.log('Starting deposit monitoring job...');
  
  try {
    // Debug: Log all rows in the wallets table
    const allWallets = db.prepare('SELECT * FROM wallets').all();
    console.log('All wallets in the database:', allWallets);

    // Get all wallets
    const wallets = db.prepare('SELECT userId, trc20_address FROM wallets').all();
    
    console.log(`Checking deposits for ${wallets.length} wallets`);
    
    // Check each wallet for deposits
    for (const wallet of wallets) {
      if (wallet.trc20_address) {
        await checkForDeposits(wallet.trc20_address, wallet.userId);
      }
    }
    
    console.log('Deposit monitoring completed');
  } catch (error) {
    console.error('Error in deposit monitoring:', error);
  }
}

// Export for use in scheduled jobs
module.exports = { monitorAllDeposits };