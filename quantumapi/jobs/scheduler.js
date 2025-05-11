const { monitorAllDeposits } = require('../services/depositMonitor');

/**
 * Sets up scheduled jobs
 */
function setupScheduler() {
  // Check for deposits every 5 minutes
  setInterval(monitorAllDeposits, 5 * 60 * 1000);
  
  console.log('Deposit monitoring scheduler initialized');
  
  // Run once on startup
  monitorAllDeposits();
}

module.exports = { setupScheduler };