/**
 * @fileoverview Investments functionality including plans management, calculations, and API interactions
 * @version 2.0.0
 * @date 2025-05-03
 */

// API endpoints
const API_ENDPOINTS = {
    getPlans: '/api/investment/plans',
    getActiveInvestments: '/api/investment/active',
    getInvestmentHistory: '/api/investment/history',
    createInvestment: '/api/investment/create',
    cancelInvestment: '/api/investment/cancel',
    getWalletBalance: '/api/wallet/balance'
};

// Store for investment plans data from API
let investmentPlans = {}

/**
 * Get authentication token from storage
 * @returns {string|null} Authentication token or null if not found
 */
function getAuthToken() {
    // First check sessionStorage (where login stores it)
    const sessionToken = sessionStorage.getItem('authToken');
    if (sessionToken) {
        return sessionToken;
    }
    
    // Fall back to localStorage if not found in sessionStorage
    const localToken = localStorage.getItem('token');
    
    // If no token is found in either storage, redirect to login
    if (!localToken) {
        console.warn('No authentication token found, redirecting to login');
        window.location.href = '/auth.html?redirect=investment.html';
        return null;
    }
    
    return localToken;
}

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', async () => {
    initTabNavigation();
    initSidebar();
    await fetchInvestmentPlans(); // This will now also call renderPlanCards

    // Removed modal event listeners for plan selection modal as we are redirecting
});

/**
 * Initialize tab navigation
 */
function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

/**
 * Switch active tab and load data if needed
 * @param {string} tabId - ID of the tab to switch to
 */
async function switchTab(tabId) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.add('hidden');
    });
    
    // Deactivate all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content and activate button
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    try {
        // Fetch data based on the active tab
        if (tabId === 'active-investments') {
            await fetchAndRenderActiveInvestments();
        } else if (tabId === 'investment-history') {
            await fetchAndRenderInvestmentHistory();
        }
    } catch (error) {
        showErrorNotification('Failed to load data. Please try again later.');
        console.error(error);
    }
}

/**
 * Initialize sidebar functionality
 */
function initSidebar() {
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('sidebarClose');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (openSidebarBtn && closeSidebarBtn && sidebar && overlay) {
        openSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        });
        
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        });
        
        overlay.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        });
    }
}

/**
 * Fetch investment plans from the backend
 */
async function fetchInvestmentPlans() {
    try {
        const token = getAuthToken();
        const response = await fetch(API_ENDPOINTS.getPlans, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch investment plans');
        }
        
        const data = await response.json();
        investmentPlans = data.data; 
        console.log("Loaded investment plans from API:", investmentPlans);
        renderPlanCards(); 
        switchTab('investment-plans');
    } catch (error) {
        console.error('Error fetching investment plans:', error);
    }
}

/**
 * Fetch and render active investments
 */
function fetchAndRenderActiveInvestments() {
    const activeInvestmentsContainer = document.getElementById('activeInvestmentsContainer');
    const noActiveInvestmentsElement = document.getElementById('noActiveInvestments');
    
    // Reset the container
    activeInvestmentsContainer.innerHTML = '';
    
    // Get authentication token
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'auth.html';
        return;
    }
    
    // Show loading state
    activeInvestmentsContainer.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading investments...</div>';
    
    // Fetch active investments from API
    fetch(API_ENDPOINTS.getActiveInvestments, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            sessionStorage.removeItem('authToken');
            window.location.href = 'auth.html';
            throw new Error('Unauthorized');
        }
        return response.json();
    })
    .then(data => {
        // Clear loading indicator
        activeInvestmentsContainer.innerHTML = '';
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load investments');
        }
        
        const activeInvestments = data.data || [];
        
        // KEY FIX: When no investments, always show the "no investments" message
        // Don't use classList.remove('hidden') which was failing before
        if (activeInvestments.length === 0) {
            // Make container empty and show the "no investments" message
            activeInvestmentsContainer.style.display = 'none';
            noActiveInvestmentsElement.style.display = 'block'; // Force display
            return;
        }
        
        // We have investments, hide the "no investments" message
        activeInvestmentsContainer.style.display = 'grid';
        noActiveInvestmentsElement.style.display = 'none';
        
        // Render investments as before...
        activeInvestments.forEach(investment => {
            // Your existing rendering code
        });
    })
    .catch(error => {
        console.error('Error fetching active investments:', error);
        activeInvestmentsContainer.innerHTML = `<div class="text-center py-4 text-red-500">
            <i class="fas fa-exclamation-circle mr-2"></i> ${error.message || 'Failed to load investments'}
        </div>`;
    });
}

/**
 * Calculate investment progress percentage
 * @param {Date} startDate - Investment start date
 * @param {Date} endDate - Investment end date
 * @returns {number} - Progress percentage
 */
// Update investment calculation function in investments.js
function calculateInvestmentMetrics(investment) {
    const initialAmount = parseFloat(investment.amount);
    // Use planDetails from the investment object for rates and total return, as these were fixed at the time of investment.
    const planDetails = investment.planDetails || {};
    const dailyRoiRate = parseFloat(planDetails.dailyRoi || investment.dailyRoi || 0); // Prioritize planDetails, then investment.dailyRoi
    const totalReturnMultiplier = parseFloat(planDetails.totalReturn || investment.totalReturn || 1); // Prioritize planDetails

    const startDate = new Date(investment.startDate);
    const endDate = new Date(investment.endDate);
    const today = new Date();
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error("Invalid start or end date for investment:", investment.id);
        return {
            currentValue: initialAmount,
            progress: 0,
            daysRemaining: 0,
            expectedReturn: initialAmount,
            roiPercentage: 0
        };
    }

    const totalDurationDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    let daysElapsed = 0;
    if (today > startDate) {
        // Calculate days elapsed but ensure it does not exceed totalDurationDays or go past endDate for calculation
        const effectiveCalcDate = today > endDate ? endDate : today;
        daysElapsed = Math.max(0, Math.floor((effectiveCalcDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
    daysElapsed = Math.min(daysElapsed, totalDurationDays); // Ensure daysElapsed doesn't exceed total plan duration

    // Calculate current value with daily compounding
    let currentValue = initialAmount * Math.pow(1 + dailyRoiRate, daysElapsed);
    
    // Cap current value by totalReturnMultiplier
    const maxPossibleValueFromTotalReturn = initialAmount * totalReturnMultiplier;
    currentValue = Math.min(currentValue, maxPossibleValueFromTotalReturn);
    
    // Calculate progress percentage
    const progress = totalDurationDays > 0 ? Math.min(100, (daysElapsed / totalDurationDays) * 100) : 0;
    
    // Calculate expected return at the end of the term
    let expectedReturnAtEnd = initialAmount * Math.pow(1 + dailyRoiRate, totalDurationDays);
    // Cap expected return by totalReturnMultiplier
    expectedReturnAtEnd = Math.min(expectedReturnAtEnd, maxPossibleValueFromTotalReturn);
    
    // Calculate current ROI percentage based on the calculated current value
    const roiPercentage = initialAmount > 0 ? ((currentValue / initialAmount) - 1) * 100 : 0;

    const daysRemaining = Math.max(0, totalDurationDays - daysElapsed);
    
    return {
      currentValue: parseFloat(currentValue.toFixed(2)),
      progress: parseFloat(progress.toFixed(2)), // Progress can be decimal for more precision if needed
      daysRemaining: daysRemaining,
      expectedReturn: parseFloat(expectedReturnAtEnd.toFixed(2)),
      roiPercentage: parseFloat(roiPercentage.toFixed(2)) // ROI can be decimal
    };
  }
/**
 * Get color for a specific plan
 * @param {string} planId - Plan identifier
 * @returns {string} - Color hex code
 */
function getPlanColor(planId) {
    return investmentPlans[planId]?.color || '#6366f1';
}

// New function: renderPlanCards
function renderPlanCards() {
    const container = document.getElementById('investmentPlansContainer');
    if (!container) {
        console.error('Investment plans container (#investmentPlansContainer) not found.');
        return;
    }
    container.innerHTML = ''; 

    if (!investmentPlans || Object.keys(investmentPlans).length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-10">No investment plans available at the moment.</p>';
        return;
    }

    Object.keys(investmentPlans).forEach(planId => {
        const plan = investmentPlans[planId];
        if (!plan) {
            console.warn(`Plan data for ${planId} is missing or undefined. Skipping card rendering.`);
            return; 
        }

        const card = document.createElement('div');
        card.className = 'plan-card bg-white rounded-xl shadow-lg p-6 flex flex-col transition-all duration-300 hover:shadow-xl min-h-[420px]';
        
        const maxDepositText = plan.maxDeposit === Infinity || typeof plan.maxDeposit !== 'number' ? "Unlimited" : `${plan.maxDeposit.toLocaleString()} USDT`;
        const totalReturnText = typeof plan.totalReturn === 'number' ? `${(plan.totalReturn * 100).toFixed(0)}%` : "N/A";
        const dailyRoiText = typeof plan.dailyRoi === 'number' ? `${(plan.dailyRoi * 100).toFixed(1)}%` : "N/A";
        const durationText = typeof plan.duration === 'number' ? `${plan.duration} Days` : "N/A";
        const minDepositText = typeof plan.minDeposit === 'number' ? `${plan.minDeposit.toLocaleString()} USDT` : "N/A";

        const description = plan.description || (planId === 'vip' ? "For serious investors seeking maximum returns." : "Standard investment plan.");
        const capitalReturnedText = plan.capitalReturned === true ? 'Yes' : (plan.capitalReturned === false ? 'No' : 'N/A');
        const hasDedicatedManager = Array.isArray(plan.features) && plan.features.includes("Dedicated Account Manager");

        card.innerHTML = `
            <div class="flex-grow">
                <h3 class="text-2xl font-bold text-indigo-700 mb-1">${plan.name || 'Unnamed Plan'}</h3>
                <p class="text-sm text-gray-500 mb-4 h-12 overflow-hidden">${description}</p>
                <ul class="space-y-1.5 mb-6 text-sm text-gray-700">
                    <li><i class="fas fa-chart-line text-indigo-500 mr-2 w-4 text-center"></i><strong>Daily ROI:</strong> ${dailyRoiText}</li>
                    <li><i class="far fa-calendar-alt text-indigo-500 mr-2 w-4 text-center"></i><strong>Duration:</strong> ${durationText}</li>
                    <li><i class="fas fa-dollar-sign text-indigo-500 mr-2 w-4 text-center"></i><strong>Min. Deposit:</strong> ${minDepositText}</li>
                    <li><i class="fas fa-coins text-indigo-500 mr-2 w-4 text-center"></i><strong>Max. Deposit:</strong> ${maxDepositText}</li>
                    <li><i class="fas fa-percentage text-indigo-500 mr-2 w-4 text-center"></i><strong>Total Return:</strong> ${totalReturnText}</li>
                    ${plan.hasOwnProperty('capitalReturned') ? `<li><i class="fas fa-undo-alt text-indigo-500 mr-2 w-4 text-center"></i><strong>Capital Returned:</strong> ${capitalReturnedText}</li>` : ''}
                    ${hasDedicatedManager ? `<li><i class="fas fa-user-tie text-indigo-500 mr-2 w-4 text-center"></i>Dedicated Account Manager</li>` : ''}
                </ul>
            </div>
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg w-full invest-now-button transition-colors duration-200 mt-auto" data-plan-id="${planId}">
                Invest Now
            </button>
        `;
        container.appendChild(card);
    });    // Add event listeners to "Invest Now" buttons to redirect
    document.querySelectorAll('#investmentPlansContainer .invest-now-button').forEach(button => {
        button.addEventListener('click', function() {
            const selectedPlanId = this.dataset.planId;
            window.location.href = `investnow.html?plan=${selectedPlanId}`;
        });
    });
}

/**
 * Fetch and render investment history
 */
async function fetchAndRenderInvestmentHistory() {
    const tableBody = document.getElementById('investmentHistoryTableBody');
    const noHistoryElement = document.getElementById('noInvestmentHistory');
    
    if (!tableBody) return;
    
    try {
        // Show loading state
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading history...</td></tr>';
        
        const token = getAuthToken();
        const response = await fetch(API_ENDPOINTS.getInvestmentHistory, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch investment history');
        }
        
        const data = await response.json();
        const investmentHistory = data.data || []; // Corrected: Access data.data
        
        // Clear container
        tableBody.innerHTML = '';
        
        if (investmentHistory.length === 0) {
            noHistoryElement.classList.remove('hidden');
            return;
        }
        
        noHistoryElement.classList.add('hidden');
        
        investmentHistory.forEach(investment => {
            const startDate = new Date(investment.startDate);
            const endDate = investment.endDate ? new Date(investment.endDate) : null;
            
            const row = document.createElement('tr');
            
            // Status badge HTML
            let statusBadge;
            if (investment.status === 'completed') {
                statusBadge = `<span class="status-badge status-completed"><i class="fas fa-check-circle mr-1"></i> Completed</span>`;
            } else if (investment.status === 'cancelled') {
                statusBadge = `<span class="status-badge status-rejected"><i class="fas fa-times-circle mr-1"></i> Cancelled</span>`;
            }
              // Add null check for investmentPlans[investment.plan]
            const planInfo = investmentPlans[investment.plan] || { name: `Plan #${investment.plan || 'Unknown'}` };
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium">${planInfo.name}</div>
                    <div class="text-xs text-gray-500">${investment.id}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${investment.amount?.toLocaleString() || '0'} USDT
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${formatDate(startDate)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${endDate ? formatDate(endDate) : '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${investment.status === 'completed' && investment.returnAmount ? 
                        `<span class="text-green-600 font-medium">+${investment.returnAmount.toLocaleString()} USDT</span>` : 
                        '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${statusBadge}
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">
            Failed to load investment history. 
            <button class="text-indigo-600 ml-2 underline" onclick="fetchAndRenderInvestmentHistory()">Retry</button>
        </td></tr>`;
        console.error('Error fetching investment history:', error);
    }
}

/**
 * Format date to a readable string
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    if (!date) return '-';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Submit investment to backend
 */
async function submitInvestment() {
    const modal = document.getElementById('investmentModal'); // Changed ID
    const investmentAmountInput = document.getElementById('investmentAmount');
    const termsAgreementCheckbox = document.getElementById('termsAgreement');
    const paymentMethodSelect = document.getElementById('paymentMethod');
    const submitButton = document.getElementById('submitButton'); // Assuming this is the ID of the submit button inside the form
    
    if (!modal || !investmentAmountInput || !termsAgreementCheckbox || !paymentMethodSelect || !submitButton) {
        console.error("Required form elements not found for submission");
        showErrorNotification('An error occurred. Please refresh and try again.');
        return;
    }
      // Validate form
    const planId = modal.dataset.planId;
    if (!planId) {
        console.error("No plan ID found in modal dataset");
        showErrorNotification('Investment plan not selected. Please try again.');
        return;
    }
    
    const plan = investmentPlans[planId];
    if (!plan) {
        console.error("Plan not found:", planId);
        showErrorNotification('Invalid investment plan selected.');
        return;
    }
    
    // Create safe plan object with defaults to avoid undefined property access
    const safePlan = {
        name: plan.name || `Plan ${planId}`,
        minDeposit: plan.minDeposit || 50,
        maxDeposit: plan.maxDeposit || Infinity
    };
    
    const amount = parseFloat(investmentAmountInput.value);
    if (isNaN(amount) || amount < safePlan.minDeposit || (safePlan.maxDeposit !== Infinity && amount > safePlan.maxDeposit)) {
        showErrorNotification(`Please enter a valid amount between ${safePlan.minDeposit.toLocaleString()} and ${safePlan.maxDeposit !== Infinity ? safePlan.maxDeposit.toLocaleString() : 'unlimited'} USDT.`);
        return;
    }
    
    if (!paymentMethodSelect.value) {
        showErrorNotification('Please select a payment method.');
        return;
    }
    
    if (!termsAgreementCheckbox.checked) {
        showErrorNotification('Please agree to the terms and conditions.');
        return;
    }
    
    try {
        // Disable submit button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        
        // Get authentication token - ensure token is available
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required. Please login again.');
        }
        
        console.log("Sending investment request:", { planId, amount, paymentMethod: paymentMethodSelect.value });
        
        // Send investment data to server
        const response = await fetch(API_ENDPOINTS.createInvestment, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                planId,
                amount,
                paymentMethod: paymentMethodSelect.value
            })
        });
        
        // Handle unauthorized response
        if (response.status === 401) {
            // Token is invalid or expired
            showErrorNotification('Your session has expired. Please log in again.');
            window.location.href = '/auth.html?redirect=investment.html';
            return;
        }
        
        // Handle insufficient balance
        if (response.status === 400) {
            const errorData = await response.json();
            if (errorData.message && errorData.message.includes('Insufficient')) {
                showErrorNotification('Insufficient wallet balance. Please deposit funds first.');
                return;
            }
        }
        
        // Handle other non-successful responses
        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create investment');
            } else {
                throw new Error(`Server error (${response.status}): Please try again later`);
            }
        }
        
        const data = await response.json();
        console.log("Investment created successfully:", data);
        
        // Show success notification
        showSuccessNotification('Investment created successfully! Your investment is now active.');
        
        // Switch to active investments tab and update view
        await switchTab('active-investments');
    } catch (error) {
        console.error('Error creating investment:', error);
        showErrorNotification(error.message || 'Failed to create investment. Please try again.');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = 'Confirm Investment';
    }
}

/**
 * Show cancel investment modal
 * @param {string} investmentId - Investment ID
 */
function showCancelInvestmentModal(investmentId) {
    // In a real app, you would show a confirmation modal
    if (confirm('Are you sure you want to cancel this investment? You may incur cancellation fees.')) {
        cancelInvestment(investmentId);
    }
}

/**
 * Cancel investment via API
 * @param {string} investmentId - Investment ID
 */
async function cancelInvestment(investmentId) {
    try {
        const token = getAuthToken();
        const response = await fetch(`${API_ENDPOINTS.cancelInvestment}/${investmentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to cancel investment');
        }
        
        // Show success notification
        showSuccessNotification('Investment has been cancelled successfully.');
        
        // Refresh active investments
        await fetchAndRenderActiveInvestments();
        
    } catch (error) {
        showErrorNotification(error.message || 'Failed to cancel investment. Please try again.');
        console.error('Error cancelling investment:', error);
    }
}

/**
 * Show success notification
 * @param {string} message - Notification message
 */
function showSuccessNotification(message) {
    // You can implement a proper notification system here
    // For simplicity, we'll use alert
    alert(message);
}

/**
 * Show error notification
 * @param {string} message - Error message
 */
function showErrorNotification(message) {
    // You can implement a proper error notification system here
    // For simplicity, we'll use alert
    alert(`Error: ${message}`);
}