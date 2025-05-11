/**
 * Transaction histories module
 * Handles loading and displaying withdrawal and deposit histories
 */

// DOM Elements
let depositHistoryTableBody = null;
let withdrawalHistoryTableBody = null;

// Initialize transaction history tables when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    depositHistoryTableBody = document.getElementById('depositHistoryTableBody');
    withdrawalHistoryTableBody = document.getElementById('withdrawalHistoryTableBody');
    
    if (depositHistoryTableBody || withdrawalHistoryTableBody) {
        loadTransactionHistories();
    }
});

/**
 * Load both transaction histories
 */
async function loadTransactionHistories() {
    try {
        if (withdrawalHistoryTableBody) {
            fetchTransactionHistory('Withdrawal', withdrawalHistoryTableBody);
        }
        
        if (depositHistoryTableBody) {
            fetchTransactionHistory('Deposit', depositHistoryTableBody);
        }
    } catch (error) {
        console.error('Error loading transaction histories:', error);
    }
}

/**
 * Fetch transaction history by type
 * @param {string} type - Transaction type (Deposit or Withdrawal)
 * @param {HTMLElement} tableBody - Table body element to update
 */
async function fetchTransactionHistory(type) {
    const token = sessionStorage.getItem('authToken');
    
    try {
      const response = await fetch(`/api/wallet/transactions?type=${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch transaction history');
      }
      
      const data = await response.json();
      return data.transactions || [];
    } catch (error) {
      console.error(`Error fetching ${type} history:`, error);
      return [];
    }
  }

/**
 * Render transaction history table
 * @param {Array} transactions - Array of transactions
 * @param {string} type - Transaction type
 * @param {HTMLElement} tableBody - Table body element to update
 */
function renderTransactionHistory(transactions, type, tableBody) {
    if (!tableBody) return;

    if (transactions.length === 0) {
        // Show no history message
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500">No ${type.toLowerCase()} history found.</td></tr>`;
        return;
    }

    // Generate table rows
    const rows = transactions.map(tx => {
        const isDeposit = type === 'Deposit';
        const amountClass = isDeposit ? 'text-green-600' : 'text-red-600';
        const amountPrefix = isDeposit ? '+' : '-';
        const description = isDeposit 
            ? `${tx.details?.network || 'USDT'} Deposit`
            : tx.type;

        return `
        <tr class="transition-colors duration-200 hover:bg-gray-50">
            <td class="py-3 px-4 border-b border-gray-200/50 text-sm text-gray-700">${formatDate(tx.date)}</td>
            <td class="py-3 px-4 border-b border-gray-200/50 text-sm text-gray-700">${description}</td>
            <td class="py-3 px-4 border-b border-gray-200/50 text-sm ${amountClass} font-semibold">${amountPrefix}${formatCurrency(tx.amount)}</td>
            <td class="py-3 px-4 border-b border-gray-200/50 text-sm">${getStatusBadge(tx.status)}</td>
        </tr>
        `;
    }).join('');

    tableBody.innerHTML = rows;
}

/**
 * Format a date string
 * @param {string} dateStr - Date string to format
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    
    try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
    } catch (e) {
        console.error('Error formatting date:', e);
        return dateStr || 'N/A';
    }
}

/**
 * Format currency with $ prefix
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    if (isNaN(parseFloat(amount))) return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount).replace('$', ''); // Remove $ prefix as we'll add it when rendering
}

/**
 * Get colored status badge HTML
 * @param {string} status - Transaction status
 * @returns {string} HTML for status badge
 */
function getStatusBadge(status) {
    if (!status) return '<span class="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">Unknown</span>';

    let colorClass;
    switch (status) {
        case 'Completed':
            colorClass = 'bg-green-100 text-green-700';
            break;
        case 'Pending':
            colorClass = 'bg-yellow-100 text-yellow-700';
            break;
        case 'Processing':
            colorClass = 'bg-blue-100 text-blue-700';
            break;
        case 'Failed':
            colorClass = 'bg-red-100 text-red-700';
            break;
        case 'Cancelled':
            colorClass = 'bg-gray-100 text-gray-700';
            break;
        default:
            colorClass = 'bg-gray-100 text-gray-700';
    }

    return `<span class="${colorClass} px-2 py-1 rounded-full text-xs font-semibold">${status}</span>`;
}

// Original Deposit Page functionality
function showDepositPage() {
    // Get wallet data and deposit address from the API
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
        console.warn('No authentication token found, redirecting to login');
        window.location.href = '/auth.html';
        return;
    }

    // First try to get the address from the wallet.js available global state
    let walletAddress = '';
    let qrCodeUrl = '';
    
    // Show loading spinner while we fetch data
    document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh;"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';

    // Fetch the deposit address from API
    fetch('/api/wallet/deposit-address?network=TRC20', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/auth.html';
                throw new Error('Unauthorized');
            }
            throw new Error('Failed to fetch deposit address');
        }
        return response.json();
    })
    .then(data => {
        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch deposit address');
        }
        
        walletAddress = data.address;
        qrCodeUrl = data.qrCodeUrl;
        
        // Now generate the deposit page
        generateDepositPage(walletAddress, qrCodeUrl);
    })
    .catch(error => {
        console.error('Error fetching deposit address:', error);
        // If we fail, use a fallback approach with the wallet.js address if available
        const addressElement = document.getElementById('walletAddress');
        walletAddress = addressElement ? addressElement.innerText.trim() : '';
        
        if (!walletAddress) {
            alert('Could not load deposit address. Please try again later.');
            window.location.href = 'wallet.html';
            return;
        }
        
        // Generate the page with what we have
        generateDepositPage(walletAddress, '');
    });
}

/**
 * Generate the deposit page UI
 */
function generateDepositPage(walletAddress, qrCodeUrl) {
    document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deposit USDT (TRC20)</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/styles.css">
    <style>
        body {
            background: linear-gradient(135deg, #f5f7ff 0%, #e4ecfb 100%);
            font-family: 'Poppins', sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 2rem 1rem;
        }
        
        .container {
            max-width: 650px;
            width: 100%;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 1.5rem;
            padding: 2.5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.12);
        }
        
        .header-icon {
            width: 70px;
            height: 70px;
            background: linear-gradient(45deg, #10b981, #0ea5e9);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 1.5rem;
            box-shadow: 0 10px 20px rgba(10, 167, 138, 0.2);
            color: white;
            font-size: 1.8rem;
        }
        
        .address-box {
            background-color: #f8fafc;
            border: 1px dashed #cbd5e1;
            border-radius: 1rem;
            padding: 1.25rem;
            font-family: 'Courier New', monospace;
            word-break: break-all;
            margin-bottom: 2rem;
            text-align: center;
            color: #334155;
            position: relative;
            transition: all 0.2s ease;
        }
        
        .address-box:hover {
            background-color: #f1f5f9;
        }
        
        .copy-btn {
            position: absolute;
            top: -10px;
            right: -10px;
            background: white;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
            cursor: pointer;
            color: #6366f1;
            border: 1px solid rgba(99, 102, 241, 0.2);
            transition: all 0.2s ease;
        }
        
        .copy-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 5px 15px rgba(99, 102, 241, 0.15);
        }
        
        .warning {
            background: linear-gradient(135deg, #fffbeb, #fef3c7);
            border-left: 4px solid #f59e0b;
            color: #92400e;
            padding: 1rem 1.5rem;
            border-radius: 0.75rem;
            font-size: 0.9rem;
            margin-bottom: 2rem;
            position: relative;
            overflow: hidden;
        }
        
        .warning::before {
            content: "";
            position: absolute;
            top: -30px;
            left: -30px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(245, 158, 11, 0.1);
            z-index: 0;
        }
        
        .warning i {
            margin-right: 0.5rem;
            position: relative;
            z-index: 1;
        }
        
        .qr-container {
            background: white;
            padding: 1.5rem;
            border-radius: 1rem;
            width: 180px;
            height: 180px;
            margin: 0 auto 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
            border: 1px solid #f1f5f9;
        }
        
        .qr-code {
            width: 150px;
            height: 150px;
            background-color: #f1f5f9;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #64748b;
            font-size: 0.75rem;
            text-align: center;
        }
        
        .back-button {
            background: linear-gradient(45deg, #6366f1, #8b5cf6);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            text-decoration: none;
            transition: all 0.3s;
            display: inline-block;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
            border: none;
            cursor: pointer;
            font-size: 0.95rem;
        }
        
        .back-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3);
            background: linear-gradient(45deg, #5a67d8, #7c3aed);
        }
        
        .copy-address-btn {
            background: linear-gradient(45deg, #475569, #64748b);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            text-decoration: none;
            transition: all 0.3s;
            display: inline-block;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(71, 85, 105, 0.2);
            border: none;
            cursor: pointer;
            font-size: 0.95rem;
        }
        
        .copy-address-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(71, 85, 105, 0.3);
            background: linear-gradient(45deg, #334155, #475569);
        }
        
        .network-tag {
            display: inline-block;
            background: linear-gradient(45deg, #f43f5e, #fb7185);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 2rem;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 0.5rem;
            vertical-align: middle;
        }
        
        .step {
            display: flex;
            align-items: flex-start;
            margin-bottom: 1.5rem;
        }
        
        .step-number {
            background: #f1f5f9;
            color: #334155;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.9rem;
            margin-right: 1rem;
            flex-shrink: 0;
        }
        
        .step-content {
            flex-grow: 1;
        }
        
        .fade-in {
            animation: fadeIn 0.5s ease-out forwards;
        }
        
        @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        
        .pulse {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(10, 167, 138, 0.5); }
            70% { box-shadow: 0 0 0 10px rgba(10, 167, 138, 0); }
            100% { box-shadow: 0 0 0 0 rgba(10, 167, 138, 0); }
        }
        
        .feedback-message {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            display: none;
            z-index: 1000;
        }
        
        .loader {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #6366f1;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container fade-in">
        <div class="card">
            <div class="header-icon pulse">
                <i class="fas fa-arrow-down"></i>
            </div>
            
            <h1 class="text-2xl font-semibold text-gray-800 mb-2 text-center">Deposit USDT <span class="network-tag">TRC20</span></h1>
            <p class="text-gray-600 text-sm mb-8 text-center">Use the address below to deposit USDT on the TRON network.</p>

            <div class="warning animate__animated animate__fadeIn">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Important:</strong> Only send USDT (TRC20) to this address. Using another network or sending any other coin may result in permanent loss of funds.
            </div>

            <div class="mb-6">
                <h2 class="text-lg font-medium text-gray-700 mb-2">Your Deposit Address:</h2>
                <div class="address-box" id="depositAddress">
                    ${walletAddress || 'Loading address...'}
                    <div class="copy-btn" onclick="copyDepositAddress()">
                        <i class="fas fa-copy"></i>
                    </div>
                </div>
            </div>

            <div class="qr-container">
                <div class="qr-code" id="qrCode">
                    ${qrCodeUrl ? 
                      `<img src="${qrCodeUrl}" alt="Deposit QR Code" width="150" height="150">` : 
                      `<div style="width: 130px; height: 130px; background-color: white; position: relative;">
                        <div style="position: absolute; top: 10px; left: 10px; width: 30px; height: 30px; background-color: black; border: 8px solid black;"></div>
                        <div style="position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; background-color: black; border: 8px solid black;"></div>
                        <div style="position: absolute; bottom: 10px; left: 10px; width: 30px; height: 30px; background-color: black; border: 8px solid black;"></div>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background-color: black;"></div>
                        <div style="position: absolute; top: 25px; width: 100%; height: 2px; background-color: black;"></div>
                        <div style="position: absolute; top: 103px; width: 100%; height: 2px; background-color: black;"></div>
                        <div style="position: absolute; left: 25px; height: 100%; width: 2px; background-color: black;"></div>
                        <div style="position: absolute; left: 103px; height: 100%; width: 2px; background-color: black;"></div>
                      </div>`}
                </div>
            </div>

            <div class="mb-8">
                <h3 class="text-md font-medium text-gray-700 mb-3">How to deposit:</h3>
                
                <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <p class="text-gray-600">Copy the address above or scan the QR code with your wallet app.</p>
                    </div>
                </div>
                
                <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <p class="text-gray-600">Select USDT and make sure you're using the <strong>TRC20</strong> network.</p>
                    </div>
                </div>
                
                <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <p class="text-gray-600">Enter the amount you want to deposit and confirm the transaction.</p>
                    </div>
                </div>
            </div>

            <div class="bg-blue-50 p-4 rounded-lg mb-8">
                <p class="text-sm text-blue-800">
                    <i class="fas fa-info-circle mr-1"></i>
                    Deposits typically require 10-20 network confirmations and may take 10-30 minutes to reflect in your balance.
                </p>
            </div>

            <div class="text-center">
                <button onclick="window.location.href='wallet.html';" class="back-button">
                    <i class="fas fa-arrow-left mr-1"></i> Back to Wallet
                </button>
                <button onclick="copyDepositAddress()" class="copy-address-btn ml-3">
                    <i class="fas fa-copy mr-1"></i> Copy Address
                </button>
            </div>
            
            <div id="feedbackMessage" class="feedback-message">
                <i class="fas fa-check-circle mr-2"></i> Address copied to clipboard!
            </div>
        </div>
    </div>
    
    <script>
        // Store the address for the copy function
        let depositAddress = "${walletAddress}";

        // Copy function for the deposit address
        function copyDepositAddress() {
            const address = depositAddress || document.getElementById('depositAddress').textContent.trim();
            const feedbackMessage = document.getElementById('feedbackMessage');
            
            navigator.clipboard.writeText(address).then(() => {
                // Show feedback
                feedbackMessage.style.display = 'block';
                feedbackMessage.classList.add('animate__animated', 'animate__fadeIn');
                
                // Change copy button icon temporarily
                const copyBtn = document.querySelector('.copy-btn i');
                const originalIcon = copyBtn.className;
                copyBtn.className = 'fas fa-check';
                
                // Hide feedback after 2 seconds
                setTimeout(() => {
                    feedbackMessage.classList.remove('animate__fadeIn');
                    feedbackMessage.classList.add('animate__fadeOut');
                    
                    setTimeout(() => {
                        feedbackMessage.style.display = 'none';
                        feedbackMessage.classList.remove('animate__fadeOut');
                        
                        // Restore original icon
                        copyBtn.className = originalIcon;
                    }, 500);
                }, 2000);
                
            }).catch(err => {
                console.error('Failed to copy: ', err);
                alert('Failed to copy address to clipboard');
            });
        }
    </script>
</body>
</html>
    `);
    document.close(); // Close the document after writing
}

/**
 * Generates and displays a withdrawal form page with enhanced visual styling.
 * This will replace the current page content with a visually appealing design.
 */
function showWithdrawPage() {
    // Get wallet data first to populate the balance
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
        console.warn('No authentication token found, redirecting to login');
        window.location.href = '/auth.html';
        return;
    }

    // Show loading spinner while we fetch data
    document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh;"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';

    // Fetch wallet balance
    fetch('/api/wallet/balance', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/auth.html';
                throw new Error('Unauthorized');
            }
            throw new Error('Failed to fetch wallet balance');
        }
        return response.json();
    })
    .then(data => {
        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch wallet balance');
        }
        
        const availableBalance = data.balance?.available || 0;
        generateWithdrawalPage(availableBalance);
    })
    .catch(error => {
        console.error('Error fetching wallet balance:', error);
        // If we fail, use a placeholder
        generateWithdrawalPage(0);
    });
}

/**
 * Generate the withdrawal page UI
 * @param {number} availableBalance - Available balance for withdrawal
 */
function generateWithdrawalPage(availableBalance) {
    document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Withdraw USDT (TRC20)</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/styles.css">
    <style>
        body {
            background: linear-gradient(135deg, #f5f7ff 0%, #e4ecfb 100%);
            font-family: 'Poppins', sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 2rem 1rem;
        }
        
        .container {
            max-width: 650px;
            width: 100%;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 1.5rem;
            padding: 2.5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.12);
        }
        
        .header-icon {
            width: 70px;
            height: 70px;
            background: linear-gradient(45deg, #f43f5e, #fb7185);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 1.5rem;
            box-shadow: 0 10px 20px rgba(244, 63, 94, 0.2);
            color: white;
            font-size: 1.8rem;
        }
        
        .pulse {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.5); }
            70% { box-shadow: 0 0 0 10px rgba(244, 63, 94, 0); }
            100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); }
        }
        
        .input-group {
            position: relative;
            margin-bottom: 1.5rem;
        }
        
        .form-input {
            width: 100%;
            padding: 1rem 1rem 1rem 3rem;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 0.75rem;
            font-size: 0.95rem;
            color: #1f2937;
            transition: all 0.3s;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #f43f5e;
            background: #fff;
            box-shadow: 0 0 0 4px rgba(244, 63, 94, 0.1);
        }
        
        .input-icon {
            position: absolute;
            top: 50%;
            left: 1rem;
            transform: translateY(-50%);
            color: #9ca3af;
            transition: all 0.3s;
        }
        
        .form-input:focus + .input-icon {
            color: #f43f5e;
        }
        
        .input-label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            font-weight: 500;
            color: #4b5563;
        }
        
        .warning {
            background: linear-gradient(135deg, #fffbeb, #fef3c7);
            border-left: 4px solid #f59e0b;
            color: #92400e;
            padding: 1rem 1.5rem;
            border-radius: 0.75rem;
            font-size: 0.9rem;
            margin-bottom: 2rem;
            position: relative;
            overflow: hidden;
        }
        
        .warning::before {
            content: "";
            position: absolute;
            top: -30px;
            left: -30px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(245, 158, 11, 0.1);
            z-index: 0;
        }
        
        .warning i {
            margin-right: 0.5rem;
            position: relative;
            z-index: 1;
        }
        
        .network-tag {
            display: inline-block;
            background: linear-gradient(45deg, #f43f5e, #fb7185);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 2rem;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 0.5rem;
            vertical-align: middle;
        }
        
        .submit-button {
            background: linear-gradient(45deg, #f43f5e, #fb7185);
            color: white;
            padding: 1rem 2rem;
            border-radius: 0.75rem;
            text-decoration: none;
            transition: all 0.3s;
            display: inline-block;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(244, 63, 94, 0.2);
            border: none;
            cursor: pointer;
            font-size: 0.95rem;
            width: 100%;
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .submit-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(244, 63, 94, 0.3);
            background: linear-gradient(45deg, #e11d48, #f43f5e);
        }
        
        .submit-button:disabled {
            background: linear-gradient(45deg, #fca5a5, #fda4af);
            cursor: not-allowed;
            transform: none;
        }
        
        .back-button {
            background: linear-gradient(45deg, #6366f1, #8b5cf6);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            text-decoration: none;
            transition: all 0.3s;
            display: inline-block;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
            border: none;
            cursor: pointer;
            font-size: 0.95rem;
        }
        
        .back-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3);
            background: linear-gradient(45deg, #5a67d8, #7c3aed);
        }
        
        .error-message {
            color: #ef4444;
            font-size: 0.85rem;
            padding-left: 0.5rem;
            margin-top: -0.8rem;
            margin-bottom: 0.8rem;
            display: none;
        }
        
        .info-text {
            color: #4b5563;
            font-size: 0.85rem;
            margin-top: -0.8rem;
            margin-bottom: 1.5rem;
            padding-left: 0.5rem;
            display: flex;
            align-items: center;
        }
        
        .info-text i {
            color: #6b7280;
            margin-right: 0.5rem;
        }
        
        .step {
            display: flex;
            align-items: flex-start;
            margin-bottom: 1.5rem;
        }
        
        .step-number {
            background: #fee2e2;
            color: #b91c1c;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.9rem;
            margin-right: 1rem;
            flex-shrink: 0;
        }
        
        .step-content {
            flex-grow: 1;
        }

        .fade-in {
            animation: fadeIn 0.5s ease-out forwards;
        }
        
        @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        
        .balance-info {
            background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
            border-radius: 0.75rem;
            padding: 1.2rem;
            margin-bottom: 2rem;
        }
        
        .balance-label {
            color: #334155;
            font-size: 0.85rem;
            font-weight: 500;
            margin-bottom: 0.3rem;
        }
        
        .balance-value {
            color: #0f172a;
            font-weight: 700;
            font-size: 1.5rem;
        }
        
        .available-badge {
            background: #dcfce7;
            color: #166534;
            padding: 0.25rem 0.5rem;
            border-radius: 0.5rem;
            font-size: 0.75rem;
            font-weight: 500;
            margin-left: 1rem;
        }

        .fee-badge {
            background: #f3e8ff;
            color: #7e22ce;
            padding: 0.25rem 0.5rem;
            border-radius: 0.5rem;
            font-size: 0.75rem;
            font-weight: 500;
            margin-left: 0.5rem;
        }
        
        .loader {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #f43f5e;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
            display: none;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .feedback-message {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            display: none;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="container fade-in">
        <div class="card">
            <div class="header-icon pulse">
                <i class="fas fa-arrow-up"></i>
            </div>
            
            <h1 class="text-2xl font-semibold text-gray-800 mb-2 text-center">Withdraw USDT <span class="network-tag">TRC20</span></h1>
            <p class="text-gray-600 text-sm mb-8 text-center">Complete the form below to withdraw your USDT to an external wallet.</p>

            <div class="warning animate__animated animate__fadeIn">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Important:</strong> Double check your withdrawal address. Transfers to incorrect addresses cannot be reversed. Only use TRC20 network for USDT withdrawals.
            </div>

            <div class="balance-info">
                <div class="balance-label">Available Balance</div>
                <div class="flex items-center">
                    <span class="balance-value" id="availableBalance">${formatCurrency(availableBalance)}</span>
                    <span class="available-badge">Available for withdrawal</span>
                </div>
            </div>

            <form id="withdrawalForm">
                <div class="mb-4">
                    <label class="input-label" for="recipient">Recipient TRC20 Address</label>
                    <div class="input-group">
                        <input type="text" id="recipient" class="form-input" placeholder="Enter wallet address (TRC20 network)" required>
                        <i class="fas fa-wallet input-icon"></i>
                    </div>
                    <div id="recipientError" class="error-message">
                        <i class="fas fa-exclamation-circle mr-1"></i>Please enter a valid TRC20 address.
                    </div>
                </div>

                <div class="mb-6">
                    <label class="input-label" for="amount">Amount (USDT)</label>
                    <div class="input-group">
                        <input type="number" id="amount" class="form-input" placeholder="0.00" step="0.01" min="1" required>
                        <i class="fas fa-coins input-icon"></i>
                    </div>
                    <div id="amountError" class="error-message">
                        <i class="fas fa-exclamation-circle mr-1"></i>Please enter a valid amount.
                    </div>
                    <div class="info-text">
                        <i class="fas fa-info-circle"></i>
                        <span>Minimum withdrawal: 10 USDT</span>
                        <span class="fee-badge">Fee: 1 USDT</span>
                    </div>
                </div>

               
                  <h3 class="text-md font-medium text-gray-700 mb-3">Withdrawal Security Steps:</h3>
                
                <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <p class="text-gray-600">Your withdrawal request will be verified automatically by our system.</p>
                    </div>
                </div>
                
                <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <p class="text-gray-600">Your withdrawal will be processed within 30 minutes after verification.</p>
                    </div>
                </div>
                
                <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <p class="text-gray-600">You'll receive a confirmation email once your funds are sent.</p>
                    </div>
                </div>

                <div class="mt-8">
                    <button type="submit" id="submitButton" class="submit-button">
                        <i class="fas fa-paper-plane mr-2"></i> Submit Withdrawal Request
                    </button>
                    
                    <div class="text-center">
                        <button type="button" id="backToWallet" class="back-button">
                            <i class="fas fa-arrow-left mr-1"></i> Back to Wallet
                        </button>
                    </div>
                </div>
            </form>
            
            <div id="feedbackMessage" class="feedback-message">
                <i class="fas fa-exclamation-circle mr-2"></i> Please review the form for errors.
            </div>
        </div>
    </div>
    
    <script>
        // Store the available balance for validation
        const availableBalance = ${availableBalance};

        function formatCurrency(amount, maximumFractionDigits = 2) {
            if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: maximumFractionDigits,
            }).format(amount).replace('$', '') + ' USDT';
        }

       document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('withdrawalForm');
            const submitButton = document.getElementById('submitButton');
            const backButton = document.getElementById('backToWallet');
            const recipientField = document.getElementById('recipient');
            const amountField = document.getElementById('amount');
            const recipientError = document.getElementById('recipientError');
            const amountError = document.getElementById('amountError');
            const feedbackMessage = document.getElementById('feedbackMessage');

            // Setup 'Back to Wallet' button listener separately
            // This ensures it only fires when the back button itself is clicked.
            if (backButton) {
                backButton.addEventListener('click', function() {
                    window.location.href = 'wallet.html';
                });
            }
            
            if (form) {
                form.addEventListener('submit', function(e) {
                    e.preventDefault(); // CRITICAL: Prevents default form submission and redirect/reload
                    
                    let isValid = true;
                    
                    // Reset error messages
                    if (recipientError) recipientError.style.display = 'none';
                    if (amountError) amountError.style.display = 'none';
                    if (feedbackMessage) feedbackMessage.style.display = 'none'; // Hide general feedback initially
                    
                    // Validate recipient address (basic check)
                    if (recipientField && recipientField.value.trim() === '') {
                        if (recipientError) {
                            recipientError.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Recipient address is required.';
                            recipientError.style.display = 'block';
                        }
                        isValid = false;
                    }

                    // Validate amount
                    const amount = parseFloat(amountField ? amountField.value : '0');
                    if (isNaN(amount) || amount < 10) { // Assuming 10 is min withdrawal
                        if (amountError) {
                            amountError.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Minimum withdrawal amount is 10 USDT.';
                            amountError.style.display = 'block';
                        }
                        isValid = false;
                    } else if (amount + 1 > availableBalance) { // Assuming fee is 1 USDT
                        if (amountError) {
                            amountError.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Amount plus fee exceeds your available balance.';
                            amountError.style.display = 'block';
                        }
                        isValid = false;
                    }
                    
                                
                    if (isValid) {
                        if (submitButton) {
                            submitButton.disabled = true;
                            submitButton.innerHTML = '<div class="loader" style="display: inline-block; margin-right: 10px;"></div> Processing...';
                        }
                        
                        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
                        
                        fetch('/api/wallet/withdraw', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify({
                                amount: amount,
                                walletAddress: recipientField ? recipientField.value.trim() : '',
                                network: 'TRC20'
                            })
                        })
                        .then(response => {
                            if (response.status === 401) {
                                window.location.href = '/auth.html'; // Redirect to login if unauthorized
                                throw new Error('Unauthorized');
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (!data.success) {
                                throw new Error(data.message || 'Withdrawal request failed');
                            }
                            
                            if (submitButton) {
                                submitButton.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Request Submitted!';
                                submitButton.className = submitButton.className.replace('bg-red', 'bg-green');
                                // submitButton.disabled = true; // Remains disabled after success
                            }
                            
                            if (feedbackMessage) {
                                feedbackMessage.style.backgroundColor = '#10b981'; 
                                feedbackMessage.innerHTML = '<i class="fas fa-check-circle mr-2"></i> ' + 
                                    (data.message || 'Withdrawal request submitted successfully!');
                                feedbackMessage.style.display = 'block';
                            }
                            
                            if (recipientField) recipientField.disabled = true;
                            if (amountField) amountField.disabled = true;
                            
                            // Update back button text, but its click listener is already set up
                            if (backButton) {
                                backButton.innerHTML = '<i class="fas fa-arrow-left mr-1"></i> Return to Wallet';
                            }
                            // NO AUTOMATIC REDIRECT TO wallet.html HERE
                        })
                        .catch(error => {
                            console.error('Withdrawal error:', error);
                            if (feedbackMessage) {
                                feedbackMessage.style.backgroundColor = '#ef4444';
                                feedbackMessage.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i> ' + 
                                    (error.message || 'Withdrawal request failed. Please try again.');
                                feedbackMessage.style.display = 'block';
                            }
                            
                            if (submitButton) {
                                submitButton.disabled = false;
                                submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Submit Withdrawal Request';
                            }
                        });
                    } else {
                        // If form is not valid and specific errors were shown, this general message might be redundant
                        // or could be a fallback if no specific errors are caught.
                        // For now, let individual field errors handle the display.
                        // If you want a general message when isValid is false:
                        // if (feedbackMessage) {
                        //    feedbackMessage.style.backgroundColor = '#ef4444';
                        //    feedbackMessage.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i> Please correct the errors above.';
                        //    feedbackMessage.style.display = 'block';
                        // }
                    }
                }); // End form.addEventListener('submit')
            } // End if (form)
        }); // End document.addEventListener('DOMContentLoaded')
    </script>
</body>
</html>
    `);
    document.close(); // Close the document after writing
}

// Initialize all event listeners when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set up deposit and withdraw button listeners if they exist
    const depositBtn = document.getElementById('depositButton');
    const withdrawBtn = document.getElementById('withdrawButton');
    
    if (depositBtn) {
        depositBtn.addEventListener('click', showDepositPage);
    }
    
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', showWithdrawPage);
    }
});


async function populateWithdrawalHistory() {
    const withdrawals = await fetchTransactionHistory('withdrawal');
    const tableBody = document.getElementById('withdrawalHistoryTableBody');
    
    if (!withdrawals || withdrawals.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="py-3 px-4 text-center text-gray-500">No withdrawal history found.</td></tr>';
      return;
    }
    
    // Render withdrawal history rows
    tableBody.innerHTML = withdrawals.map(tx => `
      <tr class="transition-colors duration-200">
        <td class="py-3 px-4 border-b border-gray-200/50 text-sm text-gray-700">${new Date(tx.createdAt).toLocaleDateString()}</td>
        <td class="py-3 px-4 border-b border-gray-200/50 text-sm text-gray-700">USDT Withdrawal</td>
        <td class="py-3 px-4 border-b border-gray-200/50 text-sm text-red-600 font-semibold">-$${parseFloat(tx.amount).toFixed(2)}</td>
        <td class="py-3 px-4 border-b border-gray-200/50 text-sm">
          <span class="px-2 py-1 rounded-full text-xs font-semibold ${
            tx.status === 'completed' ? 'bg-green-100 text-green-700' :
            tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }">${tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}</span>
        </td>
      </tr>
    `).join('');
  }