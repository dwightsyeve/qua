// API endpoints for referrals
const API_ENDPOINTS = {
    getReferralStats: '/api/referrals/stats',
    getReferralsList: '/api/referrals/list',
    getCommissionHistory: '/api/referrals/commissions',
    getMilestoneProgress: '/api/referrals/milestone',
    claimMilestoneReward: '/api/referrals/claim-milestone',
    getReferralLink: '/api/referrals/link',
    triggerReferralCheck: '/api/wallet/deposit-notification', // New endpoint to manually trigger referral processing
    checkReferralStatus: '/api/referrals/check-status' // New endpoint to check referral status
};

// Helper function to get the auth token from storage
function getAuthToken() {
    // First check sessionStorage (where login stores it)
    const sessionToken = sessionStorage.getItem('authToken');
    if (sessionToken) {
        return sessionToken;
    }
    
    // Fall back to localStorage if not found in sessionStorage
    return localStorage.getItem('token');
}

// New function to manually check referral status
async function checkReferralStatus() {
    try {
        showNotification('Checking referral system status...', 'info');
        
        const response = await fetch(API_ENDPOINTS.checkReferralStatus, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to check referral status');
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Referral system check completed successfully!', 'success');
            
            // If we received updated stats, refresh the displayed stats
            if (data.stats) {
                updateReferralStats(data.stats);
            }
            
            // Show detailed status message if provided
            if (data.message) {
                // Create a modal or use an existing notification system for more detailed output
                showDetailedNotification('Referral Check Results', data.message);
            }
        } else {
            showNotification('Referral check failed: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error checking referral status:', error);
        showNotification('Failed to check referral status. Please try again.', 'error');
    }
}

// Helper function to show a more detailed notification/modal for debug info
function showDetailedNotification(title, message) {
    // Check if we already have a modal container
    let modalContainer = document.getElementById('detailedNotificationModal');
    
    // If not, create one
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'detailedNotificationModal';
        modalContainer.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
        document.body.appendChild(modalContainer);
    }
    
    // Set the modal content
    modalContainer.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
                <button id="closeDetailedModal" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="overflow-y-auto">
                <pre class="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">${message}</pre>
            </div>
            <div class="mt-6 flex justify-end">
                <button id="closeDetailedModalBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Close</button>
            </div>
        </div>
    `;
    
    // Show the modal
    modalContainer.classList.remove('hidden');
    
    // Add event listeners to close buttons
    document.getElementById('closeDetailedModal').addEventListener('click', () => {
        modalContainer.classList.add('hidden');
    });
    
    document.getElementById('closeDetailedModalBtn').addEventListener('click', () => {
        modalContainer.classList.add('hidden');
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    // Mobile sidebar functionality
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');

    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', function() {
            sidebar.classList.remove('-translate-x-full');
            sidebarOverlay.classList.remove('hidden');
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', function() {
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        });
    }

    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            // Hide all tab contents and deactivate all buttons
            tabContents.forEach(content => content.classList.add('hidden'));
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Show the selected tab content and activate the clicked button
            document.getElementById(tabId).classList.remove('hidden');
            button.classList.add('active');
            
            // Load tab-specific data
            if (tabId === 'my-referrals') {
                loadReferralsList();
            } else if (tabId === 'commissions') {
                loadCommissionHistory();
            }
        });
    });
    

    // Copy referral link functionality
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const referralLinkInput = document.getElementById('referralLink');

    if (copyLinkBtn && referralLinkInput) {
        copyLinkBtn.addEventListener('click', () => {
            referralLinkInput.select();
            document.execCommand('copy');
            showNotification('Referral link copied to clipboard!', 'success');
        });
    }

    try {
        // Initialize data
        await Promise.all([
            loadReferralLink(),
            loadReferralStats(),
            loadMilestoneData()
        ]);
        
        // Initialize charts once we have the data
        initializeCharts();
    } catch (error) {
        console.error('Error initializing referral data:', error);
        // Fallback to mock data if API calls fail
        loadMockData();
        initializeCharts();
        showNotification('Using demo data. Backend connection failed.', 'info');
    }
});

/**
 * Load user's referral link from the API
 */
async function loadReferralLink() {
    try {
        const referralLinkElement = document.getElementById('referralLink');
        if (!referralLinkElement) return;
        
        const response = await fetch(API_ENDPOINTS.getReferralLink, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch referral link');
        }
        
        const data = await response.json();
        referralLinkElement.value = data.referralLink || '';
    } catch (error) {
        console.error('Error fetching referral link:', error);
        // Set a fallback link for demo purposes
        const referralLinkElement = document.getElementById('referralLink');
        if (referralLinkElement) {
            referralLinkElement.value = 'https://quantumfx.io/ref/johndoe123';
        }
    }
}

/**
 * Load referral statistics from the API
 */
async function loadReferralStats() {
    try {
        const response = await fetch(API_ENDPOINTS.getReferralStats, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch referral stats');
        }
        
        const data = await response.json();
        
        // Update stats on the page
        document.getElementById('totalReferrals').textContent = data.totalReferrals || '0';
        document.getElementById('activeReferrals').textContent = data.activeReferrals || '0';
        document.getElementById('totalEarnings').textContent = formatCurrency(data.totalEarnings) || '$0.00';
        document.getElementById('pendingCommissions').textContent = formatCurrency(data.pendingCommissions) || '$0.00';
        
        // Store stats for charts
        window.referralStats = data;
        
    } catch (error) {
        console.error('Error fetching referral stats:', error);
        throw error;
    }
}

/**
 * Load milestone data from the API
 */
async function loadMilestoneData() {
    try {
        const response = await fetch(API_ENDPOINTS.getMilestoneProgress, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch milestone data');
        }
        
        const data = await response.json();
        
        // Initialize milestone with API data
        initializeMilestone(data.currentReferrals, data.targetReferrals, data.milestoneReached);
        
    } catch (error) {
        console.error('Error fetching milestone data:', error);
        throw error;
    }
}

/**
 * Load referrals list from the API 
 */
async function loadReferralsList() {
    const referralsTableBody = document.getElementById('referralsTableBody');
    const emptyReferrals = document.getElementById('emptyReferrals');
    
    if (!referralsTableBody) return;
    
    try {
        // Show loading state
        referralsTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading referrals...</p></td></tr>';
        
        const response = await fetch(API_ENDPOINTS.getReferralsList, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch referrals list');
        }
        
        const data = await response.json();
        const referrals = data.referrals || [];
        
        referralsTableBody.innerHTML = '';
        
        if (referrals.length === 0) {
            emptyReferrals.classList.remove('hidden');
            return;
        }
        
        emptyReferrals.classList.add('hidden');
        
        referrals.forEach(referral => {
            const row = document.createElement('tr');
            
            // Format status badge
            const statusBadge = referral.status === 'active' 
                ? '<span class="status-badge status-approved"><i class="fas fa-circle text-xs mr-1"></i> Active</span>' 
                : '<span class="status-badge status-pending"><i class="fas fa-circle text-xs mr-1"></i> Inactive</span>';
            
            // Format level badge
            let levelBadge = '';
            switch(referral.level) {
                case 1:
                    levelBadge = '<span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">Level 1</span>';
                    break;
                case 2:
                    levelBadge = '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Level 2</span>';
                    break;
                case 3:
                    levelBadge = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Level 3</span>';
                    break;
            }
            
            // Format date
            const joinDate = new Date(referral.joined);
            const formattedDate = formatDate(joinDate);
            
            row.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <img src="${referral.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(referral.username)}&background=6366f1&color=fff`}" class="w-8 h-8 rounded-full mr-3" alt="${referral.username}">
                        <span class="font-medium">${referral.username}</span>
                    </div>
                </td>
                <td class="px-6 py-4">${formattedDate}</td>
                <td class="px-6 py-4">${levelBadge}</td>
                <td class="px-6 py-4">${formatCurrency(referral.deposits)}</td>
                <td class="px-6 py-4">
                    <span class="font-medium text-green-600">${formatCurrency(referral.commission)}</span>
                </td>
                <td class="px-6 py-4">${statusBadge}</td>
            `;
            
            referralsTableBody.appendChild(row);
        });
    } catch (error) {
        referralsTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">Failed to load referrals. <button class="text-indigo-600 ml-2 underline" onclick="loadReferralsList()">Retry</button></td></tr>';
        console.error('Error loading referrals list:', error);
    }
}

/**
 * Load commission history from the API
 */
async function loadCommissionHistory() {
    const commissionsTableBody = document.getElementById('commissionsTableBody');
    const emptyCommissions = document.getElementById('emptyCommissions');
    
    if (!commissionsTableBody) return;
    
    try {
        // Show loading state
        commissionsTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading commissions...</p></td></tr>';
        
        const response = await fetch(API_ENDPOINTS.getCommissionHistory, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch commission history');
        }
        
        const data = await response.json();
        const commissions = data.commissions || [];
        
        commissionsTableBody.innerHTML = '';
        
        if (commissions.length === 0) {
            emptyCommissions.classList.remove('hidden');
            return;
        }
        
        emptyCommissions.classList.add('hidden');
        
        commissions.forEach(commission => {
            const row = document.createElement('tr');
            
            // Format status badge
            let statusBadge = '';
            if (commission.status === 'completed') {
                statusBadge = '<span class="status-badge status-approved"><i class="fas fa-check-circle mr-1"></i> Completed</span>';
            } else if (commission.status === 'pending') {
                statusBadge = '<span class="status-badge status-pending"><i class="fas fa-clock mr-1"></i> Pending</span>';
            } else {
                statusBadge = '<span class="status-badge status-rejected"><i class="fas fa-times-circle mr-1"></i> Failed</span>';
            }
            
            // Format level badge
            let levelBadge = '';
            switch(commission.level) {
                case 1:
                    levelBadge = '<span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">Level 1 (5%)</span>';
                    break;
                case 2:
                    levelBadge = '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Level 2 (2%)</span>';
                    break;
                case 3:
                    levelBadge = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Level 3 (1%)</span>';
                    break;
            }
            
            // Format date
            const commissionDate = new Date(commission.date);
            const formattedDate = formatDate(commissionDate);
            
            row.innerHTML = `
                <td class="px-6 py-4">${formattedDate}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <img src="${commission.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(commission.referral)}&background=6366f1&color=fff`}" class="w-8 h-8 rounded-full mr-3" alt="${commission.referral}">
                        <span class="font-medium">${commission.referral}</span>
                    </div>
                </td>
                <td class="px-6 py-4">${levelBadge}</td>
                <td class="px-6 py-4">${formatCurrency(commission.deposit)}</td>
                <td class="px-6 py-4">
                    <span class="font-medium text-green-600">${formatCurrency(commission.commission)}</span>
                </td>
                <td class="px-6 py-4">${statusBadge}</td>
            `;
            
            commissionsTableBody.appendChild(row);
        });
    } catch (error) {
        commissionsTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">Failed to load commission history. <button class="text-indigo-600 ml-2 underline" onclick="loadCommissionHistory()">Retry</button></td></tr>';
        console.error('Error loading commission history:', error);
    }
}

/**
 * Format a date object to a readable string
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '-';
    
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Format a number as currency
 * @param {number|string} value - The value to format
 * @returns {string} - Formatted currency string
 */
function formatCurrency(value) {
    if (value === undefined || value === null) return '$0.00';
    
    // If it's already a string with a currency symbol, return as is
    if (typeof value === 'string' && value.includes('$')) {
        return value;
    }
    
    // Convert to number if it's a string without currency symbol
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
    
    // Format the number
    return '$' + numValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Mock data for demonstration - used as fallback when API fails
function loadMockData() {
    // Sample data for referrals stats
    document.getElementById('totalReferrals').textContent = '0';
    document.getElementById('activeReferrals').textContent = '0';
    document.getElementById('totalEarnings').textContent = '$0';
    document.getElementById('pendingCommissions').textContent = '$0.00';
    
    // Store stats for charts
    window.referralStats = {
        referralsByLevel: [5, 2, 1],
        commissionsByLevel: [275, 104, 33.5]
    };
    
    // Initialize milestone with mock data
    initializeMilestone(8, 25, false);
    
    // Check if we need to load the referrals table (if we're on that tab)
    const myReferralsTab = document.getElementById('my-referrals');
    if (myReferralsTab && !myReferralsTab.classList.contains('hidden')) {
        loadMockReferrals();
    }
    
    // Check if we need to load the commissions table
    const commissionsTab = document.getElementById('commissions');
    if (commissionsTab && !commissionsTab.classList.contains('hidden')) {
        loadMockCommissions();
    }
}

// Load mock referrals data as fallback
function loadMockReferrals() {
    // Sample referrals for the table
    const referrals = [
        {
            username: 'Emma Wilson',
            avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=6366f1&color=fff',
            joined: '2025-04-15',
            level: 1,
            deposits: '$2,000',
            commission: '$100.00',
            status: 'active'
        },
        {
            username: 'Michael Brown',
            avatar: 'https://ui-avatars.com/api/?name=Michael+Brown&background=10b981&color=fff',
            joined: '2025-04-12',
            level: 1,
            deposits: '$1,500',
            commission: '$75.00',
            status: 'active'
        },
        {
            username: 'Sophia Davis',
            avatar: 'https://ui-avatars.com/api/?name=Sophia+Davis&background=f59e0b&color=fff',
            joined: '2025-04-10',
            level: 2,
            deposits: '$1,000',
            commission: '$20.00',
            status: 'active'
        },
        {
            username: 'Daniel Johnson',
            avatar: 'https://ui-avatars.com/api/?name=Daniel+Johnson&background=ef4444&color=fff',
            joined: '2025-04-08',
            level: 3,
            deposits: '$500',
            commission: '$5.00',
            status: 'active'
        },
        {
            username: 'Olivia Martinez',
            avatar: 'https://ui-avatars.com/api/?name=Olivia+Martinez&background=8b5cf6&color=fff',
            joined: '2025-04-05',
            level: 1,
            deposits: '$3,000',
            commission: '$150.00',
            status: 'active'
        },
        {
            username: 'James Taylor',
            avatar: 'https://ui-avatars.com/api/?name=James+Taylor&background=3b82f6&color=fff',
            joined: '2025-04-01',
            level: 2,
            deposits: '$2,500',
            commission: '$50.00',
            status: 'inactive'
        },
        {
            username: 'Ava Anderson',
            avatar: 'https://ui-avatars.com/api/?name=Ava+Anderson&background=6366f1&color=fff',
            joined: '2025-03-28',
            level: 1,
            deposits: '$1,000',
            commission: '$50.00',
            status: 'active'
        },
        {
            username: 'William Thomas',
            avatar: 'https://ui-avatars.com/api/?name=William+Thomas&background=10b981&color=fff',
            joined: '2025-03-25',
            level: 3,
            deposits: '$500',
            commission: '$5.00',
            status: 'inactive'
        }
    ];
    
    // Add referrals to the table
    const referralsTableBody = document.getElementById('referralsTableBody');
    if (referralsTableBody) {
        referralsTableBody.innerHTML = '';
        
        if (referrals.length > 0) {
            document.getElementById('emptyReferrals').classList.add('hidden');
            
            referrals.forEach(referral => {
                const row = document.createElement('tr');
                
                // Format status badge
                const statusBadge = referral.status === 'active' 
                    ? '<span class="status-badge status-approved"><i class="fas fa-circle text-xs mr-1"></i> Active</span>' 
                    : '<span class="status-badge status-pending"><i class="fas fa-circle text-xs mr-1"></i> Inactive</span>';
                
                // Format level badge
                let levelBadge = '';
                switch(referral.level) {
                    case 1:
                        levelBadge = '<span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">Level 1</span>';
                        break;
                    case 2:
                        levelBadge = '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Level 2</span>';
                        break;
                    case 3:
                        levelBadge = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Level 3</span>';
                        break;
                }
                
                // Format date
                const joinDate = new Date(referral.joined);
                const formattedDate = formatDate(joinDate);
                
                row.innerHTML = `
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <img src="${referral.avatar}" class="w-8 h-8 rounded-full mr-3" alt="${referral.username}">
                            <span class="font-medium">${referral.username}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">${formattedDate}</td>
                    <td class="px-6 py-4">${levelBadge}</td>
                    <td class="px-6 py-4">${referral.deposits}</td>
                    <td class="px-6 py-4">
                        <span class="font-medium text-green-600">${referral.commission}</span>
                    </td>
                    <td class="px-6 py-4">${statusBadge}</td>
                `;
                
                referralsTableBody.appendChild(row);
            });
        } else {
            document.getElementById('emptyReferrals').classList.remove('hidden');
        }
    }
}

// Load mock commissions data as fallback
function loadMockCommissions() {
    // Sample commissions for the table
    const commissions = [
        {
            date: '2025-04-20',
            referral: 'Emma Wilson',
            avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=6366f1&color=fff',
            level: 1,
            deposit: '$500',
            commission: '$25.00',
            status: 'completed'
        },
        {
            date: '2025-04-18',
            referral: 'Michael Brown',
            avatar: 'https://ui-avatars.com/api/?name=Michael+Brown&background=10b981&color=fff',
            level: 1,
            deposit: '$1,000',
            commission: '$50.00',
            status: 'completed'
        },
        {
            date: '2025-04-15',
            referral: 'Sophia Davis',
            avatar: 'https://ui-avatars.com/api/?name=Sophia+Davis&background=f59e0b&color=fff',
            level: 2,
            deposit: '$1,000',
            commission: '$20.00',
            status: 'completed'
        },
        {
            date: '2025-04-12',
            referral: 'Daniel Johnson',
            avatar: 'https://ui-avatars.com/api/?name=Daniel+Johnson&background=ef4444&color=fff',
            level: 3,
            deposit: '$500',
            commission: '$5.00',
            status: 'completed'
        },
        {
            date: '2025-04-10',
            referral: 'Olivia Martinez',
            avatar: 'https://ui-avatars.com/api/?name=Olivia+Martinez&background=8b5cf6&color=fff',
            level: 1,
            deposit: '$2,000',
            commission: '$100.00',
            status: 'completed'
        },
        {
            date: '2025-04-05',
            referral: 'Emma Wilson',
            avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=6366f1&color=fff',
            level: 1,
            deposit: '$1,000',
            commission: '$50.00',
            status: 'completed'
        },
        {
            date: '2025-05-01',
            referral: 'James Taylor',
            avatar: 'https://ui-avatars.com/api/?name=James+Taylor&background=3b82f6&color=fff',
            level: 2,
            deposit: '$1,700',
            commission: '$34.00',
            status: 'pending'
        },
        {
            date: '2025-05-01',
            referral: 'Ava Anderson',
            avatar: 'https://ui-avatars.com/api/?name=Ava+Anderson&background=6366f1&color=fff',
            level: 1,
            deposit: '$2,550',
            commission: '$51.00',
            status: 'pending'
        }
    ];
    
    // Add commissions to the table
    const commissionsTableBody = document.getElementById('commissionsTableBody');
    if (commissionsTableBody) {
        commissionsTableBody.innerHTML = '';
        
        if (commissions.length > 0) {
            document.getElementById('emptyCommissions').classList.add('hidden');
            
            commissions.forEach(commission => {
                const row = document.createElement('tr');
                
                // Format status badge
                let statusBadge = '';
                if (commission.status === 'completed') {
                    statusBadge = '<span class="status-badge status-approved"><i class="fas fa-check-circle mr-1"></i> Completed</span>';
                } else if (commission.status === 'pending') {
                    statusBadge = '<span class="status-badge status-pending"><i class="fas fa-clock mr-1"></i> Pending</span>';
                } else {
                    statusBadge = '<span class="status-badge status-rejected"><i class="fas fa-times-circle mr-1"></i> Failed</span>';
                }
                
                // Format level badge
                let levelBadge = '';
                switch(commission.level) {
                    case 1:
                        levelBadge = '<span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">Level 1 (5%)</span>';
                        break;
                    case 2:
                        levelBadge = '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Level 2 (2%)</span>';
                        break;
                    case 3:
                        levelBadge = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Level 3 (1%)</span>';
                        break;
                }
                
                // Format date
                const commissionDate = new Date(commission.date);
                const formattedDate = formatDate(commissionDate);
                
                row.innerHTML = `
                    <td class="px-6 py-4">${formattedDate}</td>
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <img src="${commission.avatar}" class="w-8 h-8 rounded-full mr-3" alt="${commission.referral}">
                            <span class="font-medium">${commission.referral}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">${levelBadge}</td>
                    <td class="px-6 py-4">${commission.deposit}</td>
                    <td class="px-6 py-4">
                        <span class="font-medium text-green-600">${commission.commission}</span>
                    </td>
                    <td class="px-6 py-4">${statusBadge}</td>
                `;
                
                commissionsTableBody.appendChild(row);
            });
        } else {
            document.getElementById('emptyCommissions').classList.remove('hidden');
        }
    }
}

// Initialize charts
function initializeCharts() {
    // Get chart data from API response or fallback to mock data
    const referralsByLevel = window.referralStats?.referralsByLevel || [5, 2, 1];
    const commissionsByLevel = window.referralStats?.commissionsByLevel || [275, 104, 33.5];
    
    // Referrals Chart
    const referralsChartCtx = document.getElementById('referralsChart');
    if (referralsChartCtx) {
        new Chart(referralsChartCtx, {
            type: 'doughnut',
            data: {
                labels: ['Level 1 (Direct)', 'Level 2', 'Level 3'],
                datasets: [{
                    data: referralsByLevel,
                    backgroundColor: [
                        '#6366f1', // Indigo
                        '#f59e0b', // Amber
                        '#10b981'  // Emerald
                    ],
                    borderColor: 'white',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                family: 'Poppins'
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value * 100) / total) + '%';
                                return `${label}: ${value} referrals (${percentage})`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }
    
    // Commissions Chart
    const commissionsChartCtx = document.getElementById('commissionsChart');
    if (commissionsChartCtx) {
        new Chart(commissionsChartCtx, {
            type: 'bar',
            data: {
                labels: ['Level 1 (5%)', 'Level 2 (2%)', 'Level 3 (1%)'],
                datasets: [{
                    label: 'Commission Amount ($)',
                    data: commissionsByLevel,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.8)', // Indigo
                        'rgba(245, 158, 11, 0.8)', // Amber
                        'rgba(16, 185, 129, 0.8)'  // Emerald
                    ],
                    borderColor: [
                        'rgb(99, 102, 241)', // Indigo
                        'rgb(245, 158, 11)', // Amber
                        'rgb(16, 185, 129)'  // Emerald
                    ],
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 50
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false,
                            color: 'rgba(226, 232, 240, 0.7)'
                        },
                        ticks: {
                            font: {
                                family: 'Poppins'
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Poppins'
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.raw;
                                return `${label}: $${value.toFixed(2)}`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1500
                }
            }
        });
    }
}

// Initialize milestone progress
function initializeMilestone(current, target, milestoneReached) {
    const currentActiveReferrals = current || 0;
    const milestoneTarget = target || 25; // Target for milestone reward
    const milestoneReward = 500; // Reward amount in $
    
    updateMilestoneProgress(currentActiveReferrals, milestoneTarget);
    
    // If milestone is reached, show claim button
    if (milestoneReached) {
        const rewardElement = document.getElementById('milestoneReward');
        if (rewardElement) {
            rewardElement.classList.remove('hidden');
        }
        
        const statusElement = document.getElementById('milestoneStatus');
        if (statusElement) {
            statusElement.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i> Milestone reached!</span>';
        }
    }
    
    // Add event listener for claim button
    const claimButton = document.getElementById('milestoneReward');
    if (claimButton) {
        claimButton.addEventListener('click', function() {
            claimMilestoneReward();
        });
    }
}

// Update milestone progress bar and status
function updateMilestoneProgress(current, target) {
    const progressElement = document.getElementById('milestoneProgress');
    const progressTextElement = document.getElementById('milestoneProgressText');
    const statusElement = document.getElementById('milestoneStatus');
    const rewardElement = document.getElementById('milestoneReward');
    
    if (!progressElement || !progressTextElement || !statusElement) return;
    
    // Calculate percentage
    const percentage = Math.min(Math.round((current / target) * 100), 100);
    
    // Update progress bar
    progressElement.style.width = `${percentage}%`;
    progressTextElement.textContent = `${current}/${target}`;
    
    // Update status text and button visibility
    if (current >= target) {
        statusElement.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i> Milestone reached!</span>';
        rewardElement.classList.remove('hidden');
    } else {
        const remaining = target - current;
        statusElement.innerHTML = `<span class="text-blue-600"><i class="fas fa-info-circle mr-1"></i> ${remaining} more active referrals needed</span>`;
        rewardElement.classList.add('hidden');
    }
    
    // Set progress bar color based on percentage
    if (percentage < 40) {
        progressElement.classList.remove('bg-yellow-500', 'bg-green-500');
        progressElement.classList.add('bg-blue-500');
    } else if (percentage < 100) {
        progressElement.classList.remove('bg-blue-500', 'bg-green-500');
        progressElement.classList.add('bg-yellow-500');
    } else {
        progressElement.classList.remove('bg-blue-500', 'bg-yellow-500');
        progressElement.classList.add('bg-green-500');
    }
    
    // Add pulse animation if milestone is reached
    if (percentage === 100) {
        progressElement.classList.add('animate-pulse');
    } else {
        progressElement.classList.remove('animate-pulse');
    }
}

// Claim milestone reward
async function claimMilestoneReward() {
    try {
        // Show loading state
        const rewardButton = document.getElementById('milestoneReward');
        if (rewardButton) {
            rewardButton.disabled = true;
            rewardButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        }
        
        // Call API to claim reward
        const response = await fetch(API_ENDPOINTS.claimMilestoneReward, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to claim milestone reward');
        }
        
        const data = await response.json();
        const rewardAmount = data.rewardAmount || 500;
        
        // Show celebration animation
        startConfetti();
        
        // Play celebration animation for 3 seconds
        setTimeout(() => {
            stopConfetti();
            
            // Show success message
            showNotification(`Congratulations! $${rewardAmount} has been added to your wallet`, 'success');
            
            // Reset milestone UI
            if (rewardButton) rewardButton.classList.add('hidden');
            
            const statusElement = document.getElementById('milestoneStatus');
            if (statusElement) {
                statusElement.innerHTML = 
                    '<span class="text-green-600"><i class="fas fa-trophy mr-1"></i> Milestone completed and reward claimed!</span>';
            }
                
            // Update the progress bar to show completion
            const progressElement = document.getElementById('milestoneProgress');
            if (progressElement) {
                progressElement.classList.remove('bg-yellow-500', 'animate-pulse');
                progressElement.classList.add('bg-gray-300');
            }
            
        }, 3000);
    } catch (error) {
        console.error('Error claiming milestone reward:', error);
        showNotification('Failed to claim reward. Please try again.', 'error');
        
        // Reset button state
        const rewardButton = document.getElementById('milestoneReward');
        if (rewardButton) {
            rewardButton.disabled = false;
            rewardButton.innerHTML = '<i class="fas fa-gift mr-2"></i> Claim $500 Reward';
        }
    }
}

// Confetti animation configuration and functions
const confettiCanvas = document.getElementById('confettiCanvas');
const confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiAnimationId;
const particles = [];

// Confetti settings
const confettiSettings = {
    particleCount: 150,
    particleSpeed: 2,
    particleSize: 6,
    colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
};

// Initialize confetti canvas dimensions
function initConfetti() {
    if (!confettiCanvas) return;
    
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    
    // Reset particles array
    particles.length = 0;
    
    // Create particles
    for (let i = 0; i < confettiSettings.particleCount; i++) {
        particles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            radius: Math.random() * confettiSettings.particleSize + 1,
            color: confettiSettings.colors[Math.floor(Math.random() * confettiSettings.colors.length)],
            speed: Math.random() * confettiSettings.particleSpeed + 1,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 2
        });
    }
}

// Draw and update confetti particles
function drawConfetti() {
    if (!confettiCtx || !confettiCanvas) return;
    
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    
    particles.forEach(particle => {
        confettiCtx.beginPath();
        confettiCtx.save();
        confettiCtx.translate(particle.x, particle.y);
        confettiCtx.rotate(particle.rotation * Math.PI / 180);
        
        // Draw a rectangle for the confetti piece
        confettiCtx.fillStyle = particle.color;
        confettiCtx.fillRect(-particle.radius, -particle.radius, particle.radius * 2, particle.radius * 2);
        
        confettiCtx.restore();
        
        // Update particle position and rotation
        particle.y += particle.speed;
        particle.rotation += particle.rotationSpeed;
        
        // Reset particle if it goes off screen
        if (particle.y > confettiCanvas.height) {
            particle.y = -particle.radius;
            particle.x = Math.random() * confettiCanvas.width;
        }
    });
    
    confettiAnimationId = requestAnimationFrame(drawConfetti);
}

// Start confetti animation
function startConfetti() {
    if (!confettiCanvas) return;
    
    // Show confetti container
    const confettiElement = document.getElementById('confetti');
    if (confettiElement) {
        confettiElement.classList.remove('hidden');
    }
    
    // Initialize and start animation
    initConfetti();
    drawConfetti();
}

// Stop confetti animation
function stopConfetti() {
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
    }
    
    // Hide confetti container
    const confettiElement = document.getElementById('confetti');
    if (confettiElement) {
        confettiElement.classList.add('hidden');
    }
}

// Add window resize event listener to adjust confetti canvas
window.addEventListener('resize', () => {
    if (confettiCanvas) {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
});

/**
 * Helper function to show notification
 * @param {string} message - The message to display
 * @param {string} type - Notification type ('success', 'error', 'info')
 */
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    // Set notification icon based on type
    let icon = 'check-circle text-green-600';
    if (type === 'error') icon = 'exclamation-circle text-red-600';
    if (type === 'info') icon = 'info-circle text-blue-600';
    
    // Set notification content
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div>${message}</div>
    `;
    
    // Show notification
    notification.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}