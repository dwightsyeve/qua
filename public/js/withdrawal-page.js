/**
 * New implementation of withdrawal functionality
 * This improves on the original by avoiding document.write()
 * and properly handling form submissions
 */

/**
 * Creates the HTML content for the withdrawal form
 * @param {number} availableBalance - The available balance for withdrawal
 * @returns {string} The HTML content
 */
function createWithdrawalFormHTML(availableBalance) {
    return `
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
    </body>
    </html>
    `;
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @param {number} maximumFractionDigits - Maximum number of fraction digits
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, maximumFractionDigits = 2) {
    if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: maximumFractionDigits,
    }).format(amount).replace('$', '') + ' USDT';
}

/**
 * Set up event listeners for the withdrawal form
 * @param {number} availableBalance - Available balance for withdrawal
 */
function setupWithdrawalFormListeners(availableBalance) {
    const form = document.getElementById('withdrawalForm');
    const submitButton = document.getElementById('submitButton');
    const backButton = document.getElementById('backToWallet');
    const recipientField = document.getElementById('recipient');
    const amountField = document.getElementById('amount');
    const recipientError = document.getElementById('recipientError');
    const amountError = document.getElementById('amountError');
    const feedbackMessage = document.getElementById('feedbackMessage');

    // Setup 'Back to Wallet' button listener
    if (backButton) {
        backButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'wallet.html';
        });
    }
    
    // Setup form submission handler
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault(); // Prevent form submission
            
            let isValid = true;
            
            // Reset error messages
            if (recipientError) recipientError.style.display = 'none';
            if (amountError) amountError.style.display = 'none';
            if (feedbackMessage) feedbackMessage.style.display = 'none';
            
            // Validate recipient address
            if (recipientField && recipientField.value.trim() === '') {
                if (recipientError) {
                    recipientError.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Recipient address is required.';
                    recipientError.style.display = 'block';
                }
                isValid = false;
            }

            // Validate amount
            const amount = parseFloat(amountField ? amountField.value : '0');
            if (isNaN(amount) || amount < 10) { // Minimum withdrawal is 10 USDT
                if (amountError) {
                    amountError.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Minimum withdrawal amount is 10 USDT.';
                    amountError.style.display = 'block';
                }
                isValid = false;
            } else if (amount + 1 > availableBalance) { // Fee is 1 USDT
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
                
                // Create a controller to abort the request if it takes too long
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
                
                fetch('/api/wallet/withdraw', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        amount: amount,
                        walletAddress: recipientField ? recipientField.value.trim() : '',
                        network: 'TRC20'
                    })
                }).then(response => {
                    // Always clear the timeout as soon as we get a response
                    clearTimeout(timeoutId);
                    
                    if (response.status === 401) {
                        // Don't redirect, just show error
                        throw new Error('Unauthorized - Please login again');
                    }
                    return response.json();
                })
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.message || 'Withdrawal request failed');
                    }
                    
                    if (submitButton) {
                        submitButton.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Request Submitted!';
                        submitButton.className = 'submit-button bg-green-500';
                    }
                    
                    if (feedbackMessage) {
                        feedbackMessage.style.backgroundColor = '#10b981'; 
                        feedbackMessage.innerHTML = '<i class="fas fa-check-circle mr-2"></i> ' + 
                            (data.message || 'Withdrawal request submitted successfully!');
                        feedbackMessage.style.display = 'block';
                    }
                    
                    if (recipientField) recipientField.disabled = true;
                    if (amountField) amountField.disabled = true;
                    
                    // Update the first step content with success message
                    const firstStepContent = document.querySelector('.step:first-child .step-content');
                    if (firstStepContent) {
                        firstStepContent.innerHTML = 
                            '<p class="text-green-600 font-bold">' +
                            '<i class="fas fa-check-circle mr-2"></i>' + 
                            'Withdrawal request submitted successfully! Your transaction is being processed.' +
                            '</p>' +
                            '<p class="text-gray-600 mt-2">' +
                            'Click "Back to Wallet" when you\'re ready to return to your wallet page.' +
                            '</p>';
                    }
                })
                .catch(error => {
                    // Clear timeout if there's an error
                    clearTimeout(timeoutId);
                    
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
            }
        });
    }
}

/**
 * Improved withdrawal page display function that avoids document.write()
 * This is the recommended replacement for the original showWithdrawPage function
 */
function improvedWithdrawalPage() {
    // Get auth token
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
        console.warn('No authentication token found, redirecting to login');
        window.location.href = '/auth.html';
        return;
    }

    // Store original page content in case we need to revert
    const originalContent = document.body.innerHTML;
    
    // Show loading spinner
    document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh;"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';

    // Fetch wallet balance to display available funds
    fetch('/api/wallet/balance', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized - Please login again');
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
        
        // Generate the HTML content - instead of document.write, we use innerHTML
        const withdrawalHTML = createWithdrawalFormHTML(availableBalance);
        
        // Replace the entire body content with our new HTML
        document.body.innerHTML = withdrawalHTML;
        
        // Set up event listeners immediately after adding the content
        setupWithdrawalFormListeners(availableBalance);
    })
    .catch(error => {
        console.error('Error fetching wallet balance:', error);
        // Revert to original content on error
        document.body.innerHTML = originalContent;
        
        // Show error message
        alert('Failed to load withdrawal page: ' + error.message);
    });
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        improvedWithdrawalPage,
        createWithdrawalFormHTML,
        setupWithdrawalFormListeners
    };
}
