/**
 * @fileoverview Wallet functionality including balance display, deposits, withdrawals, and transaction history.
 * @version 1.0.0
 * @date 2025-05-06
 */

// API Endpoints (Connected to our backend implementation)
const API_ENDPOINTS = {
    getWalletData: '/api/wallet/summary', // GET -> { balance: { total, available }, stats: { totalDeposits, totalWithdrawals }, chartData: {...} }
    getWalletBalance: '/api/wallet/balance', // GET -> { balance: { total, available, pending } }
    getTransactionHistory: '/api/wallet/history', // GET -> { transactions: [...] }
    getDepositAddress: '/api/wallet/deposit-address', // GET ?network=... -> { address, qrCodeUrl }
    requestWithdrawal: '/api/wallet/withdraw', // POST -> { amount, walletAddress, network, pin }
    changeWalletPin: '/api/wallet/change-pin' // POST -> { currentPin, newPin, confirmPin }
};

// Global state
let walletData = {};
let transactionHistory = [];
let currentDepositInfo = {};

// DOM Elements Cache
const elements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in (has token)
    const token = getUserToken();
    if (!token) {
        console.warn('No authentication token found, redirecting to login');
        window.location.href = '/auth.html';
        return;
    }
    
    // Continue with the rest of your initialization
    cacheDOMElements();
    initSidebar();
    initTabNavigation();
    initEventListeners();
    toggleBalanceVisibilitySetup();

    // Initial data load (start with overview tab)
    switchTab('overview-tab');
});

/**
 * Cache frequently used DOM elements.
 */
function cacheDOMElements() {
    // Sidebar
    elements.sidebar = document.getElementById('sidebar');
    elements.openSidebarBtn = document.getElementById('sidebarOpen');
    elements.closeSidebarBtn = document.getElementById('sidebarClose');
    elements.sidebarOverlay = document.getElementById('sidebarOverlay');

    // Balance display
    elements.totalBalance = document.getElementById('totalBalance');
    elements.hiddenBalance = document.getElementById('hiddenBalance');
    elements.availableBalance = document.getElementById('availableBalance');
    elements.totalDeposits = document.getElementById('totalDeposits');
    elements.totalWithdrawals = document.getElementById('totalWithdrawals');
    elements.balanceChartCanvas = document.getElementById('balanceChart');
    elements.toggleBalanceVisibility = document.getElementById('toggleBalanceVisibility');
    elements.visibilityIcon = document.getElementById('visibilityIcon');
    elements.walletAddress = document.getElementById('walletAddress');
    
    // Tabs
    elements.tabButtons = document.querySelectorAll('.tab-button');
    elements.tabContents = document.querySelectorAll('.tab-content');

    // Deposit Tab
    elements.depositNetworkSelect = document.getElementById('depositNetworkSelect');
    elements.depositAddress = document.getElementById('depositAddress');
    elements.depositQRCode = document.getElementById('depositQRCode');
    elements.copyAddressBtn = document.getElementById('copyAddressBtn');
    elements.depositInfoContainer = document.getElementById('depositInfoContainer');
    elements.depositLoadingSpinner = document.getElementById('depositLoadingSpinner');

    // Withdraw Tab
    elements.withdrawForm = document.getElementById('withdrawForm');
    elements.withdrawAmountInput = document.getElementById('withdrawAmount');
    elements.withdrawAddressInput = document.getElementById('withdrawAddress');
    elements.withdrawNetworkSelect = document.getElementById('withdrawNetwork');
    elements.withdrawPinInput = document.getElementById('withdrawPin');
    elements.withdrawAvailableBalance = document.getElementById('withdrawAvailableBalance');
    elements.submitWithdrawalBtn = document.getElementById('submitWithdrawalBtn');

    // History Tab
    elements.transactionHistoryTableBody = document.getElementById('transactionHistoryTableBody');
    elements.noTransactionHistory = document.getElementById('noTransactionHistory');
    
    // PIN Management
    elements.changePinForm = document.getElementById('changePinForm');
    elements.currentPinInput = document.getElementById('currentPin');
    elements.newPinInput = document.getElementById('newPin');
    elements.confirmPinInput = document.getElementById('confirmPin');
}

/**
 * Initialize sidebar functionality.
 */
function initSidebar() {
    if (elements.openSidebarBtn && elements.closeSidebarBtn && elements.sidebar && elements.sidebarOverlay) {
        elements.openSidebarBtn.addEventListener('click', () => {
            elements.sidebar.classList.remove('-translate-x-full');
            elements.sidebarOverlay.classList.remove('hidden');
        });

        const closeAction = () => {
            elements.sidebar.classList.add('-translate-x-full');
            elements.sidebarOverlay.classList.add('hidden');
        };

        elements.closeSidebarBtn.addEventListener('click', closeAction);
        elements.sidebarOverlay.addEventListener('click', closeAction);
    }
}

/**
 * Initialize tab navigation functionality.
 */
function initTabNavigation() {
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

/**
 * Initialize various event listeners.
 */
function initEventListeners() {
    // Deposit Tab Listeners
    if (elements.depositNetworkSelect) {
        elements.depositNetworkSelect.addEventListener('change', handleDepositNetworkChange);
    }
    if (elements.copyAddressBtn) {
        elements.copyAddressBtn.addEventListener('click', copyDepositAddress);
    }

    // Withdraw Tab Listeners
    if (elements.withdrawForm) {
        elements.withdrawForm.addEventListener('submit', handleWithdrawalSubmit);
    }
    
    // PIN Management
    if (elements.changePinForm) {
        elements.changePinForm.addEventListener('submit', handleChangePinSubmit);
    }
    
    // Copy wallet address
    if (elements.walletAddress) {
        elements.walletAddress.addEventListener('click', function() {
            copyToClipboard(this.textContent.trim());
        });
    }
}

/**
 * Setup toggle for showing/hiding balance
 */
function toggleBalanceVisibilitySetup() {
    if (elements.toggleBalanceVisibility && elements.totalBalance && elements.hiddenBalance && elements.visibilityIcon) {
        // Check local storage for preference
        const hideBalance = localStorage.getItem('hideBalance') === 'true';
        
        // Set initial state
        if (hideBalance) {
            elements.totalBalance.classList.add('hidden');
            elements.hiddenBalance.classList.remove('hidden');
            elements.visibilityIcon.classList.remove('fa-eye');
            elements.visibilityIcon.classList.add('fa-eye-slash');
        }
        
        elements.toggleBalanceVisibility.addEventListener('click', () => {
            // Toggle visibility
            elements.totalBalance.classList.toggle('hidden');
            elements.hiddenBalance.classList.toggle('hidden');
            
            // Update icon
            elements.visibilityIcon.classList.toggle('fa-eye');
            elements.visibilityIcon.classList.toggle('fa-eye-slash');
            
            // Save preference
            const isHidden = elements.totalBalance.classList.contains('hidden');
            localStorage.setItem('hideBalance', isHidden);
        });
    }
}

/**
 * Switch active tab and load data if needed.
 * @param {string} tabId - ID of the tab content element to switch to.
 */
async function switchTab(tabId) {
    // Hide all tab contents
    elements.tabContents.forEach(content => {
        content.classList.add('hidden');
    });

    // Deactivate all tab buttons
    elements.tabButtons.forEach(button => {
        button.classList.remove('active', 'bg-indigo-600', 'text-white');
        button.classList.add('text-gray-600', 'hover:bg-indigo-100');
    });

    // Show selected tab content and activate button
    const activeContent = document.getElementById(tabId);
    const activeButton = document.querySelector(`[data-tab="${tabId}"]`);

    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
    if (activeButton) {
        activeButton.classList.add('active', 'bg-indigo-600', 'text-white');
        activeButton.classList.remove('text-gray-600', 'hover:bg-indigo-100');
    }

    // Fetch data based on the active tab
    try {
        switch (tabId) {
            case 'overview-tab':
                await fetchWalletData();
                break;
            case 'deposit-tab':
                if (elements.depositNetworkSelect?.value) {
                    await fetchDepositAddress(elements.depositNetworkSelect.value);
                } else if (elements.depositNetworkSelect) {
                    elements.depositNetworkSelect.value = 'TRC20';
                    await fetchDepositAddress('TRC20');
                }
                break;
            case 'withdraw-tab':
                if (elements.withdrawAvailableBalance && walletData.balance) {
                    elements.withdrawAvailableBalance.textContent = formatCurrency(walletData.balance.available);
                } else {
                    await fetchWalletBalance();
                    if (elements.withdrawAvailableBalance && walletData.balance) {
                        elements.withdrawAvailableBalance.textContent = formatCurrency(walletData.balance.available);
                    }
                }
                break;
            case 'history-tab':
                await fetchTransactionHistory();
                break;
        }
    } catch (error) {
        showErrorNotification(`Failed to load data for ${tabId}. Please try again later.`);
        console.error(`Error switching to tab ${tabId}:`, error);
    }
}

/**
 * Get the user's authentication token from storage
 * @returns {string|null} The auth token or null if not found
 */
function getUserToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

/**
 * Fetch wallet summary data (balance, stats, chart).
 */
async function fetchWalletData() {
    try {
        // Show loading indicators if needed
        showElementLoading('totalBalance');
        showElementLoading('availableBalance');
        
        const token = getUserToken();
        

        const response = await fetch(API_ENDPOINTS.getWalletData, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            // Token expired or invalid
            window.location.href = '/auth.html';
            return;
        }
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch wallet data');
        }

        walletData = data; // Store fetched data

        // Update UI with wallet details
        if (elements.walletAddress && data.wallet?.address) {
            elements.walletAddress.textContent = data.wallet.address;
        }

        // Update Balance Cards
        if (elements.totalBalance) elements.totalBalance.textContent = formatCurrency(data.balance?.total || 0);
        if (elements.hiddenBalance) elements.hiddenBalance.textContent = '••••••••';
        if (elements.availableBalance) elements.availableBalance.textContent = formatCurrency(data.balance?.available || 0);
        if (elements.totalDeposits) elements.totalDeposits.textContent = formatCurrency(data.stats?.totalDeposits || 0);
        if (elements.totalWithdrawals) elements.totalWithdrawals.textContent = formatCurrency(data.stats?.totalWithdrawals || 0);

        // Update Chart (Example - adapt based on actual chart library and data)
        if (elements.balanceChartCanvas && data.chartData) {
            updateBalanceChart(data.chartData);
        }

        // Update available balance on withdraw tab if it's visible
        if (elements.withdrawAvailableBalance && document.getElementById('withdraw-tab') && 
            !document.getElementById('withdraw-tab').classList.contains('hidden')) {
            elements.withdrawAvailableBalance.textContent = formatCurrency(walletData.balance.available);
        }
        
        hideElementLoading('totalBalance');
        hideElementLoading('availableBalance');

    } catch (error) {
        console.error('Error fetching wallet data:', error);
        showErrorNotification('Could not load wallet summary. Using placeholders.');
        // Set placeholder values
        if (elements.totalBalance) elements.totalBalance.textContent = formatCurrency(0);
        if (elements.hiddenBalance) elements.hiddenBalance.textContent = '••••••••';
        if (elements.availableBalance) elements.availableBalance.textContent = formatCurrency(0);
        if (elements.totalDeposits) elements.totalDeposits.textContent = formatCurrency(0);
        if (elements.totalWithdrawals) elements.totalWithdrawals.textContent = formatCurrency(0);
        
        hideElementLoading('totalBalance');
        hideElementLoading('availableBalance');
    }
}

/**
 * Fetch wallet balance only.
 */
async function fetchWalletBalance() {
    try {
        const token = getUserToken();
        if (!token) {
            console.error('No authentication token found');
            window.location.href = '/auth.html';
            return;
        }

        const response = await fetch(API_ENDPOINTS.getWalletBalance, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            window.location.href = '/auth.html';
            return;
        }
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch wallet balance');
        }

        // Update only balance info in walletData
        walletData.balance = data.balance;

    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        showErrorNotification('Could not load wallet balance.');
        throw error;
    }
}

/**
 * Fetch transaction history.
 */
async function fetchTransactionHistory() {
    if (!elements.transactionHistoryTableBody) return;

    try {
        // Show loading state
        elements.transactionHistoryTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading history...</td></tr>';
        if (elements.noTransactionHistory) elements.noTransactionHistory.classList.add('hidden');

        const token = getUserToken();
        if (!token) {
            console.error('No authentication token found');
            window.location.href = '/auth.html';
            return;
        }

        const response = await fetch(API_ENDPOINTS.getTransactionHistory, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            window.location.href = '/auth.html';
            return;
        }
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch transaction history');
        }

        transactionHistory = data.transactions || [];

        renderTransactionHistory();

    } catch (error) {
        console.error('Error fetching transaction history:', error);
        showErrorNotification('Could not load transaction history.');
        elements.transactionHistoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Failed to load history. <button class="text-indigo-600 underline" onclick="fetchTransactionHistory()">Retry</button></td></tr>`;
        if (elements.noTransactionHistory) elements.noTransactionHistory.classList.add('hidden');
    }
}

/**
 * Render transaction history table.
 */
function renderTransactionHistory() {
    if (!elements.transactionHistoryTableBody) return;

    if (transactionHistory.length === 0) {
        // Show no history message
        elements.transactionHistoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">No transaction history found.</td></tr>`;
        if (elements.noTransactionHistory) elements.noTransactionHistory.classList.remove('hidden');
        return;
    }

    // Hide no history message
    if (elements.noTransactionHistory) elements.noTransactionHistory.classList.add('hidden');

    // Generate table rows
    const rows = transactionHistory.map(tx => {
        const isDeposit = tx.type === 'Deposit';
        const amountClass = isDeposit ? 'text-green-600' : 'text-red-600';
        const amountPrefix = isDeposit ? '+' : '-';

        return `
        <tr class="transition-colors duration-200 hover:bg-gray-50">
            <td class="py-3 px-4 border-b border-gray-200/50 text-sm text-gray-700">${formatDate(tx.date)}</td>
            <td class="py-3 px-4 border-b border-gray-200/50 text-sm text-gray-700">${tx.type}</td>
            <td class="py-3 px-4 border-b border-gray-200/50 text-sm ${amountClass} font-semibold">${amountPrefix}${formatCurrency(tx.amount)}</td>
            <td class="py-3 px-4 border-b border-gray-200/50 text-sm">${getStatusBadge(tx.status)}</td>
        </tr>
        `;
    }).join('');

    elements.transactionHistoryTableBody.innerHTML = rows;
}

/**
 * Fetch deposit address and QR code for the selected network.
 * @param {string} network - The selected network (e.g., 'BTC', 'ETH', 'TRC20').
 */
async function fetchDepositAddress(network) {
    if (!elements.depositInfoContainer || !elements.depositAddress || !elements.depositQRCode) return;

    try {
        // Show loading state
        if (elements.depositInfoContainer) elements.depositInfoContainer.classList.add('hidden');
        if (elements.depositLoadingSpinner) elements.depositLoadingSpinner.classList.remove('hidden');
        if (elements.copyAddressBtn) elements.copyAddressBtn.disabled = true;

        const token = getUserToken();
        if (!token) {
            console.error('No authentication token found');
            window.location.href = '/auth.html';
            return;
        }

        const response = await fetch(`${API_ENDPOINTS.getDepositAddress}?network=${encodeURIComponent(network)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            window.location.href = '/auth.html';
            return;
        }

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch deposit address');
        }

        currentDepositInfo = data; // Store current address info

        // Update UI
        elements.depositAddress.textContent = data.address;
        elements.depositQRCode.src = data.qrCodeUrl;
        elements.depositQRCode.alt = `${network} Deposit QR Code`;

        // Hide loading, show info
        if (elements.depositLoadingSpinner) elements.depositLoadingSpinner.classList.add('hidden');
        if (elements.depositInfoContainer) elements.depositInfoContainer.classList.remove('hidden');
        if (elements.copyAddressBtn) elements.copyAddressBtn.disabled = false;

    } catch (error) {
        console.error('Error fetching deposit address:', error);
        showErrorNotification(`Could not load deposit address for ${network}.`);
        
        // Hide loading, show error
        if (elements.depositLoadingSpinner) elements.depositLoadingSpinner.classList.add('hidden');
        if (elements.depositInfoContainer) elements.depositInfoContainer.classList.add('hidden');
        if (elements.depositAddress) elements.depositAddress.textContent = 'Error loading address.';
        if (elements.depositQRCode) elements.depositQRCode.src = '';
        currentDepositInfo = {};
        if (elements.copyAddressBtn) elements.copyAddressBtn.disabled = true;
    }
}

/**
 * Handle withdrawal form submission.
 * @param {Event} event - The form submission event.
 */
async function handleWithdrawalSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    if (!elements.withdrawForm || !elements.submitWithdrawalBtn) return;

    const amount = parseFloat(elements.withdrawAmountInput?.value);
    const address = elements.withdrawAddressInput?.value.trim();
    const network = elements.withdrawNetworkSelect?.value;
    const pin = elements.withdrawPinInput?.value.trim(); // Added PIN support

    // Basic Validation
    if (isNaN(amount) || amount <= 0) {
        showErrorNotification('Please enter a valid withdrawal amount.');
        return;
    }
    if (!address) {
        showErrorNotification('Please enter a valid withdrawal address.');
        return;
    }
    if (!network) {
        showErrorNotification('Please select a withdrawal network.');
        return;
    }
    
    // Check against available balance
    if (walletData.balance && amount > walletData.balance.available) {
        showErrorNotification(`Withdrawal amount exceeds available balance (${formatCurrency(walletData.balance.available)}).`);
        return;
    }

    // Disable button, show loading state
    elements.submitWithdrawalBtn.disabled = true;
    elements.submitWithdrawalBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';

    // Set a timeout to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
        const token = getUserToken();
        if (!token) {
            console.error('No authentication token found');
            window.location.href = '/auth.html';
            return;
        }

        const response = await fetch(API_ENDPOINTS.requestWithdrawal, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                amount,
                walletAddress: address,
                network,
                pin: pin || undefined
            }),
            signal: controller.signal // Add the abort signal
        });
        
        clearTimeout(timeoutId); // Clear timeout once response is received

        if (response.status === 401) {
            window.location.href = '/auth.html';
            return;
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `Request failed with status: ${response.status}`);
        }

        // Success
        showSuccessNotification(result.message || 'Withdrawal request submitted successfully!');
        elements.withdrawForm.reset();
        await fetchWalletData();
        await fetchTransactionHistory();
        
        // Switch to history tab to show the pending transaction
        switchTab('history-tab');

    } catch (error) {
        console.error('Error submitting withdrawal:', error);
        
        // Specific handling for timeout errors
        if (error.name === 'AbortError') {
            showErrorNotification('Request timed out. The server might be busy. Please try again later.');
        } else {
            showErrorNotification(error.message || 'Withdrawal request failed. Please try again.');
        }
    } finally {
        // Always ensure button is restored
        clearTimeout(timeoutId); // Extra safety to ensure timeout is cleared
        elements.submitWithdrawalBtn.disabled = false;
        elements.submitWithdrawalBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Submit Withdrawal';
    }
}
/**
 * Handle changing wallet PIN.
 * @param {Event} event - The form submission event.
 */
async function handleChangePinSubmit(event) {
    event.preventDefault();

    if (!elements.changePinForm) return;

    const currentPin = elements.currentPinInput?.value.trim();
    const newPin = elements.newPinInput?.value.trim();
    const confirmPin = elements.confirmPinInput?.value.trim();
    
    // Basic validations
    if (newPin !== confirmPin) {
        showErrorNotification('New PINs do not match.');
        return;
    }
    
    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
        showErrorNotification('PIN must be 4-6 digits.');
        return;
    }
    
    // Disable form and show loading
    const submitButton = elements.changePinForm.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
    }
    
    const token = getUserToken();
    if (!token) {
        console.error('No authentication token found');
        window.location.href = '/auth.html';
        return;
    }
    
    try {
        const response = await fetch(API_ENDPOINTS.changeWalletPin, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPin: currentPin || undefined, // First time setting doesn't require current PIN
                newPin,
                confirmPin
            })
        });
        
        if (response.status === 401) {
            window.location.href = '/auth.html';
            return;
        }
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || `Request failed with status: ${response.status}`);
        }
        
        // Success
        showSuccessNotification(result.message || 'Wallet PIN updated successfully!');
        elements.changePinForm.reset();
        
    } catch (error) {
        console.error('Error changing wallet PIN:', error);
        showErrorNotification(error.message || 'Failed to update wallet PIN. Please try again.');
    } finally {
        // Re-enable form
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Update PIN';
        }
    }
}

/**
 * Handle deposit network selection change.
 */
async function handleDepositNetworkChange() {
    const selectedNetwork = elements.depositNetworkSelect?.value;
    if (selectedNetwork) {
        await fetchDepositAddress(selectedNetwork);
    } else {
        // Hide address/QR if no network is selected
         if(elements.depositInfoContainer) elements.depositInfoContainer.classList.add('hidden');
         if(elements.depositAddress) elements.depositAddress.textContent = '';
         if(elements.depositQRCode) elements.depositQRCode.src = '';
         currentDepositInfo = {};
    }
}

/**
 * Copy deposit address to clipboard.
 */
function copyDepositAddress() {
    if (!currentDepositInfo.address) {
        showErrorNotification('No address loaded to copy.');
        return;
    }

    copyToClipboard(currentDepositInfo.address);
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyToClipboard(text);
        return;
    }

    navigator.clipboard.writeText(text)
        .then(() => {
            showSuccessNotification('Copied to clipboard!');
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyToClipboard(text);
        });
}

/**
 * Fallback method for copying to clipboard
 * @param {string} text - Text to copy
 */
function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';  // Prevent scrolling to bottom
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showSuccessNotification('Copied to clipboard!');
        } else {
            showErrorNotification('Could not copy address. Please copy it manually.');
        }
    } catch (err) {
        console.error('Fallback copy error:', err);
        showErrorNotification('Could not copy address. Please copy it manually.');
    }
    
    document.body.removeChild(textarea);
}

// --- Charting ---

let balanceChartInstance = null;

/**
 * Initialize or update the balance chart.
 * @param {object} chartData - Data for the chart (e.g., { labels: [], datasets: [{ data: [] }] }).
 */
function updateBalanceChart(chartData) {
    if (!elements.balanceChartCanvas) return;
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        return;
    }
    
    const ctx = elements.balanceChartCanvas.getContext('2d');

    // Default chart configuration
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value, 0);
                        }
                    }
                }
            },
            elements: {
                line: {
                    tension: 0.4 // Smooth curves
                },
                point: {
                    radius: 4,
                    hitRadius: 10,
                    hoverRadius: 6
                }
            }
        }
    };

    // If chart exists, update it; otherwise, create it
    if (balanceChartInstance) {
        balanceChartInstance.data = chartData;
        balanceChartInstance.update();
    } else {
        balanceChartInstance = new Chart(ctx, config);
    }
}

// --- UI Helpers ---

/**
 * Show loading state for an element
 * @param {string} elementId - ID of the element
 */
function showElementLoading(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.classList.add('opacity-50');
    element.setAttribute('data-loading', 'true');
}

/**
 * Hide loading state for an element
 * @param {string} elementId - ID of the element 
 */
function hideElementLoading(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.classList.remove('opacity-50');
    element.removeAttribute('data-loading');
}

// --- Utility Functions ---

/**
 * Format number as currency (e.g., USDT).
 * @param {number} amount - The amount to format.
 * @param {number} [maximumFractionDigits=2] - Maximum decimal places.
 * @returns {string} Formatted currency string.
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
 * Format date string or Date object.
 * @param {string|Date} dateInput - The date to format.
 * @returns {string} Formatted date string.
 */
function formatDate(dateInput) {
    if (!dateInput) return '-';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            return '-';
        }
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return '-';
    }
}

/**
 * Get HTML badge for transaction status.
 * @param {string} status - Transaction status ('Completed', 'Pending', 'Failed', 'Rejected').
 * @returns {string} HTML string for the status badge.
 */
function getStatusBadge(status) {
    let badgeClass = '';
    let icon = '';
    switch (status.toLowerCase()) {
        case 'completed':
        case 'success':
            badgeClass = 'bg-green-100 text-green-800';
            icon = 'fas fa-check-circle';
            break;
        case 'pending':
            badgeClass = 'bg-yellow-100 text-yellow-800';
            icon = 'fas fa-hourglass-half';
            break;
        case 'failed':
            badgeClass = 'bg-red-100 text-red-800';
            icon = 'fas fa-times-circle';
            break;
        case 'rejected':
            badgeClass = 'bg-red-100 text-red-800';
            icon = 'fas fa-ban';
            break;
        default:
            badgeClass = 'bg-gray-100 text-gray-800';
            icon = 'fas fa-question-circle';
    }
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">
                <i class="${icon} mr-1.5"></i> ${status}
            </span>`;
}

/**
 * Show a success notification.
 * @param {string} message - The message to display.
 */
function showSuccessNotification(message) {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2';
        document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center transform transition-all duration-300 translate-y-4 opacity-0';
    notification.innerHTML = `
        <i class="fas fa-check-circle mr-2"></i>
        <span>${message}</span>
        <button class="ml-3 focus:outline-none" onclick="this.parentNode.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.replace('translate-y-4', 'translate-y-0');
        notification.classList.replace('opacity-0', 'opacity-100');
    }, 10);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.classList.replace('opacity-100', 'opacity-0');
        notification.classList.replace('translate-y-0', 'translate-y-4');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

/**
 * Show an error notification.
 * @param {string} message - The message to display.
 */
function showErrorNotification(message) {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2';
        document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center transform transition-all duration-300 translate-y-4 opacity-0';
    notification.innerHTML = `
        <i class="fas fa-exclamation-circle mr-2"></i>
        <span>${message}</span>
        <button class="ml-3 focus:outline-none" onclick="this.parentNode.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.replace('translate-y-4', 'translate-y-0');
        notification.classList.replace('opacity-0', 'opacity-100');
    }, 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.replace('opacity-100', 'opacity-0');
        notification.classList.replace('translate-y-0', 'translate-y-4');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Initialize transaction history when page loads
document.addEventListener('DOMContentLoaded', async function() {
    // Fetch wallet data first
    await fetchWalletData();
    
    // Then load transaction history
    await populateWithdrawalHistory();
    await populateDepositHistory();
  });