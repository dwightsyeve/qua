/**
 * @fileoverview Dashboard functionality including charts, notifications, and sidebar toggles
 * @version 1.0.0
 * @date 2025-05-03
 */

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components regardless of authentication
    initSidebar();
    
    // Only initialize dashboard-specific components if we're on the dashboard page
    const isDashboardPage = window.location.pathname === '/dashboard.html' || window.location.pathname === '/';
    
    if (isDashboardPage) {
        initCharts(); // Make sure charts are initialized
        updateLastUpdated();
        
        // Check authentication but don't redirect immediately
        checkAuthStatus().then(authenticated => {
            if (authenticated) {
                // Fetch data only if authenticated
                fetchNotifications();
                fetchDashboardData();
            } else {
                // Show login prompt instead of redirect
                showLoginPrompt();
            }
        });
    }
    
    // Add click handlers for buttons
    document.querySelectorAll('button').forEach(button => {
        if (button.id !== 'openSidebar' && button.id !== 'closeSidebar' && 
            button.id !== 'notificationButton' && button.id !== 'markAllRead') {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const buttonText = this.textContent.trim();
                
                if (buttonText.includes('New Investment')) {
                    window.location.href = 'investment.html';
                } else if (buttonText.includes('Deposit')) {
                    window.location.href = 'wallet.html?action=deposit';
                } else if (buttonText.includes('Withdraw')) {
                    window.location.href = 'wallet.html?action=withdraw';
                }
            });
        }
    });
    
    // Period selector for profit chart
    const periodSelector = document.getElementById('profit-period-selector');
    if (periodSelector) {
        periodSelector.addEventListener('change', () => {
            fetchProfitChartData(periodSelector.value);
        });
    }
});

/**
 * Show login prompt without redirecting
 */
function showLoginPrompt() {
    const mainContent = document.querySelector('main');
    if (!mainContent) return;
    
    const loginPrompt = document.createElement('div');
    loginPrompt.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    loginPrompt.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 class="text-xl font-bold mb-4 text-gray-800">Session Expired</h2>
            <p class="mb-6 text-gray-600">Your session has expired or you are not logged in. Please log in to continue.</p>
            <div class="flex justify-end space-x-3">
                <button id="stayOnPage" class="px-4 py-2 bg-gray-200 rounded-md text-gray-800 hover:bg-gray-300">
                    Stay Here
                </button>
                <a href="auth.html" class="px-4 py-2 bg-indigo-600 rounded-md text-white hover:bg-indigo-700">
                    Log In
                </a>
            </div>
        </div>
    `;
    
    document.body.appendChild(loginPrompt);
    
    // Allow user to dismiss and stay on page
    const stayButton = document.getElementById('stayOnPage');
    if (stayButton) {
        stayButton.addEventListener('click', () => {
            loginPrompt.remove();
            // Load demo data
            loadDemoData();
        });
    }
}

/**
 * Load demo data when not authenticated
 */
function loadDemoData() {
    // Set demo profile image
    const avatarElement = document.querySelector('.rounded-full');
    if (avatarElement) {
        // Try to load from profile picture or use placeholder
        loadProfilePicture(avatarElement);
    }
    
    // Initialize charts with demo data
    const profitChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        investmentValues: [10000, 10200, 10500, 10800, 11200],
        initialValues: [10000, 10000, 10000, 10000, 10000]
    };
    
    const referralData = {
        activeReferrals: 12,
        pendingSignups: 3,
        totalEarnings: 421.80
    };
    
    updateProfitChart(profitChartData);
    updateReferralChart(referralData);
}

/**
 * Load profile picture with error handling
 * @param {HTMLImageElement} imgElement - The image element to update
 */
function loadProfilePicture(imgElement) {
    // Check if user has a profile picture URL in sessionStorage
    const profilePicUrl = sessionStorage.getItem('profilePictureUrl');
    
    if (profilePicUrl) {
        // Try to load the user's profile picture
        const tempImg = new Image();
        tempImg.onload = function() {
            imgElement.src = profilePicUrl;
        };
        tempImg.onerror = function() {
            // Fall back to placeholder on error
            imgElement.src = "https://ui-avatars.com/api/?name=User&background=6366f1&color=fff";
        };
        tempImg.src = profilePicUrl;
    } else {
        // Use placeholder if no profile picture URL is stored
        imgElement.src = "https://ui-avatars.com/api/?name=User&background=6366f1&color=fff";
    }
}

/**
 * Check authentication status
 * @returns {Promise<boolean>} Whether the user is authenticated
 */
async function checkAuthStatus() {
    try {
        const token = sessionStorage.getItem('authToken');
        
        if (!token) {
            return false;
        }
        
        const response = await fetch('/api/auth/check-status', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            return true;
        } else {
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('isLoggedIn');
            return false;
        }
        
    } catch (error) {
        // Don't remove tokens on network errors - might be temporary connectivity issue
        return false; 
    }
}

/**
 * Get Auth Token
 * @returns {string|null} Authentication token
 */
function getAuthToken() {
    return sessionStorage.getItem('authToken');
}

/**
 * Initialize sidebar functionality
 */
function initSidebar() {
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
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
 * Fetch dashboard data from backend
 */
async function fetchDashboardData() {
    try {
        const token = getAuthToken();
        const response = await fetch('/api/dashboard', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateDashboardUI(data);
            fetchProfitChartData('month');
            fetchReferralData();
            fetchRecentActivity();
        } else {
            showError('Could not load dashboard data. Please try refreshing the page.');
        }    } catch (error) {
        console.error('Dashboard data fetch error:', error);
        if (!navigator.onLine) {
            showError('You are currently offline. Please check your internet connection.');
        } else {
            showError('Could not connect to the backend server. Please ensure the server is running.');
        }
    }
}

async function deleteNotification(notificationId) {
    try {
        const token = getAuthToken();
        const response = await fetch(`/api/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            fetchNotifications();
        } else {
            showError('Failed to delete notification. Please try again.');
        }
    } catch (error) {
        showError('Error deleting notification. Please check your connection.');
    }
}

/**
 * Update user info in the sidebar
 * @param {Object} user - User information
 */
function updateUserInfo(user) {
    // Update avatar with correct user name
    const avatarElement = document.querySelector('.rounded-full');
    if (avatarElement) {
        // Use the actual user name for the avatar
        const formattedName = encodeURIComponent(user.name || 'User');
        avatarElement.src = `https://ui-avatars.com/api/?name=${formattedName}&background=6366f1&color=fff`;
    }
    
    // Update user name text
    const nameElement = document.querySelector('h3.text-center.font-semibold');
    if (nameElement) {
        nameElement.textContent = user.name || 'User';
    }
    
    // Update user level/role text
    const levelElement = document.querySelector('.text-center.text-xs.text-indigo-300');
    if (levelElement) {
        levelElement.textContent = user.level || 'Standard Investor';
    }
    
    // Update verification status if needed
    const verificationElement = document.querySelector('.status-badge.status-approved');
    if (verificationElement) {
        if (user.isVerified) {
            verificationElement.classList.remove('hidden');
        } else {
            verificationElement.classList.add('hidden');
        }
    }
}

/**
 * Fetch notifications from backend
 */
async function fetchNotifications() {
    try {
        const token = getAuthToken();
        const response = await fetch('/api/notifications', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const notifications = await response.json();
            const notificationsList = document.getElementById('notifications-list');
            renderNotifications(notifications, notificationsList);
            const mainNotificationsList = document.getElementById('main-notifications-list');
            renderMainNotifications(notifications, mainNotificationsList);
            updateNotificationCount(notifications);
            initNotificationsDropdown();
        } else {
            showError('Failed to fetch notifications. Please try again.');
        }
    } catch (error) {
        showError('Error fetching notifications. Please check your connection.');
    }
}

/**
 * Initialize notifications dropdown
 */
function initNotificationsDropdown() {
    const notificationButton = document.getElementById('notificationButton');
    const notificationsDropdown = document.getElementById('notifications-dropdown');
    const markAllReadBtn = document.getElementById('markAllRead');
    
    if (notificationButton && notificationsDropdown) {
        notificationButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = notificationsDropdown.style.display === 'block';
            
            if (isVisible) {
                notificationsDropdown.style.display = 'none';
            } else {
                notificationsDropdown.style.display = 'block';
            }
        });
        
        document.addEventListener('click', (e) => {
            if (notificationsDropdown.style.display === 'block' && 
                !notificationsDropdown.contains(e.target) && 
                e.target !== notificationButton) {
                notificationsDropdown.style.display = 'none';
            }
        });
    }
    
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            try {
                const token = getAuthToken();
                const response = await fetch('/api/notifications/mark-all-read', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    fetchNotifications();
                    const feedbackElement = document.createElement('div');
                    feedbackElement.className = 'bg-green-100 text-green-800 text-xs p-2 mb-2 rounded';
                    feedbackElement.textContent = 'All notifications marked as read';
                    notificationsDropdown.insertBefore(feedbackElement, notificationsDropdown.firstChild.nextSibling);
                    
                    setTimeout(() => {
                        feedbackElement.remove();
                    }, 3000);
                } else {
                    showError('Failed to mark all notifications as read. Please try again.');
                }
            } catch (error) {
                showError('Error marking all notifications as read. Please check your connection.');
            }
        });
    }
}

/**
 * Render notifications in the dropdown
 * @param {Array} notifications - Array of notification objects
 * @param {HTMLElement} container - Container to render notifications in
 */
function renderNotifications(notifications, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    notifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item p-3 rounded hover:bg-gray-50 ${!notification.read ? 'unread bg-blue-50' : ''}`;
        notificationItem.dataset.id = notification.id;
        
        let iconClass = 'fa-bell';
        let iconColor = 'text-gray-400';
        
        switch (notification.type) {
            case 'success':
                iconClass = 'fa-check-circle';
                iconColor = 'text-green-500';
                break;
            case 'info':
                iconClass = 'fa-info-circle';
                iconColor = 'text-blue-500';
                break;
            case 'warning':
                iconClass = 'fa-exclamation-circle';
                iconColor = 'text-yellow-500';
                break;
            case 'danger':
                iconClass = 'fa-exclamation-triangle';
                iconColor = 'text-red-500';
                break;
            case 'referral':
                iconClass = 'fa-user-plus';
                iconColor = 'text-purple-500';
                break;
        }
        
        notificationItem.innerHTML = `
            <div class="flex items-start">
                <div class="mr-3 pt-1">
                    <i class="fas ${iconClass} ${iconColor}"></i>
                </div>
                <div class="flex-1">
                    <p class="font-medium text-sm">${notification.title}</p>
                    <p class="text-xs text-gray-600">${notification.message}</p>
                    <p class="text-xs text-gray-400 mt-1">${notification.time}</p>
                </div>
                ${!notification.read ? '<span class="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>' : ''}
            </div>
        `;
        
        notificationItem.addEventListener('click', async () => {
            if (!notification.read) {
                try {
                    const token = getAuthToken();
                    const response = await fetch(`/api/notifications/${notification.id}/read`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        fetchNotifications();
                    } else {
                        showError('Failed to mark notification as read. Please try again.');
                    }
                } catch (error) {
                    showError('Error marking notification as read. Please check your connection.');
                }
            }
        });
        
        container.appendChild(notificationItem);
    });
}

/**
 * Render notifications in the main notifications center
 * @param {Array} notifications - Array of notification objects
 * @param {HTMLElement} container - Container to render notifications in
 */
function renderMainNotifications(notifications, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    notifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `flex items-center border border-gray-100 rounded-lg p-4 ${!notification.read ? 'bg-blue-50' : 'bg-white'}`;
        notificationItem.dataset.id = notification.id;
        
        let iconClass = 'fa-bell';
        let iconColor = 'text-gray-400';
        let bgColor = 'bg-gray-100';
        
        switch (notification.type) {
            case 'success':
                iconClass = 'fa-check-circle';
                iconColor = 'text-green-500';
                bgColor = 'bg-green-100';
                break;
            case 'info':
                iconClass = 'fa-info-circle';
                iconColor = 'text-blue-500';
                bgColor = 'bg-blue-100';
                break;
            case 'warning':
                iconClass = 'fa-exclamation-circle';
                iconColor = 'text-yellow-500';
                bgColor = 'bg-yellow-100';
                break;
            case 'danger':
                iconClass = 'fa-exclamation-triangle';
                iconColor = 'text-red-500';
                bgColor = 'bg-red-100';
                break;
            case 'referral':
                iconClass = 'fa-user-plus';
                iconColor = 'text-purple-500';
                bgColor = 'bg-purple-100';
                break;
        }
        
        notificationItem.innerHTML = `
            <div class="mr-4 p-3 ${bgColor} rounded-full">
                <i class="fas ${iconClass} ${iconColor}"></i>
            </div>
            <div class="flex-1">
                <h4 class="text-sm font-medium">${notification.title}</h4>
                <p class="text-sm text-gray-600">${notification.message}</p>
                <span class="text-xs text-gray-400">${notification.time}</span>
            </div>
            <div>
                <button class="text-gray-400 hover:text-gray-600 delete-notification">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        const deleteButton = notificationItem.querySelector('.delete-notification');
        if (deleteButton) {
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                try {
                    const token = getAuthToken();
                    const response = await fetch(`/api/notifications/${notification.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        notificationItem.remove();
                        fetchNotifications();
                    } else {
                        showError('Failed to delete notification. Please try again.');
                    }
                } catch (error) {
                    showError('Error deleting notification. Please check your connection.');
                }
            });
        }
        
        container.appendChild(notificationItem);
    });
    
    if (notifications.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'flex flex-col items-center justify-center p-8 text-center text-gray-500';
        emptyMessage.innerHTML = `
            <i class="fas fa-bell-slash text-3xl mb-4"></i>
            <p>No notifications yet</p>
            <p class="text-xs mt-1">We'll notify you when something happens</p>
        `;
        container.appendChild(emptyMessage);
    }
}

/**
 * Update notification count badge
 * @param {Array} notifications - Array of notification objects
 */
function updateNotificationCount(notifications) {
    const notificationCount = document.getElementById('notification-count');
    if (!notificationCount) return;
    
    const unreadCount = notifications.filter(n => !n.read).length;
    
    notificationCount.textContent = unreadCount;
    
    if (unreadCount === 0) {
        notificationCount.style.display = 'none';
    } else {
        notificationCount.style.display = 'flex';
    }
}

/**
 * Fetch profit chart data from backend
 * @param {string} period - Time period for chart data (week, month, year, all)
 */
async function fetchProfitChartData(period) {
    try {
        const token = getAuthToken();
        const response = await fetch(`/api/dashboard/profit-chart?period=${period}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const chartData = await response.json();
            updateProfitChart(chartData);
        } else {
            showError('Failed to fetch profit chart data. Please try again.');
        }
    } catch (error) {
        showError('Error fetching profit chart data. Please check your connection.');
    }
}

/**
 * Initialize charts
 */
function initCharts() {
    initProfitChart();
    initReferralChart();
}

/**
 * Initialize profit growth chart
 */
function initProfitChart() {
    const ctx = document.getElementById('profitChart');
    if (!ctx) return;
    
    window.profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Investment Value',
                    data: [],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Initial Investment',
                    data: [],
                    borderColor: '#94a3b8',
                    borderDash: [5, 5],
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD'
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                }
            }
        }
    });
}

/**
 * Update profit chart with data from API
 * @param {Object} chartData - Chart data from API
 */
function updateProfitChart(chartData) {
    if (!window.profitChart) {
        initProfitChart();
    }
    
    if (chartData && chartData.labels && chartData.investmentValues && chartData.initialValues) {
        window.profitChart.data.labels = chartData.labels;
        window.profitChart.data.datasets[0].data = chartData.investmentValues;
        window.profitChart.data.datasets[1].data = chartData.initialValues;
        window.profitChart.update();
    }
}

/**
 * Fetch referral data from backend
 */
async function fetchReferralData() {
    try {
        const token = getAuthToken();
        const response = await fetch('/api/dashboard/referrals', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const referralData = await response.json();
        if (response.ok) {
            updateReferralChart(referralData);
        } else {
            showError('Failed to fetch referral data. Please try again.');
        }
    } catch (error) {
        showError('Error fetching referral data. Please check your connection.');
    }
}

/**
 * Initialize referral donut chart
 */
function initReferralChart() {
    const ctx = document.getElementById('referralChart');
    if (!ctx) return;
    
    window.referralChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active Referrals', 'Pending Signups', 'Total Earnings'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    '#6366f1',
                    '#60a5fa',
                    '#c084fc'
                ],
                borderWidth: 0,
                borderRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    display: false,
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if we have user data in session storage
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    if (userData && userData.user) {
        // Update the user information with the nested user object
        updateUserInfo(userData.user);
    } else {
        // If no userData in session, try to fetch it
        const token = sessionStorage.getItem('authToken');
        if (token) {
            fetch('/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => response.json())
            .then(data => {
                // Store the complete response in sessionStorage
                sessionStorage.setItem('userData', JSON.stringify(data));
                // Update the UI with the user object
                if (data.user) {
                    updateUserInfo(data.user);
                }
            })
            .catch(error => console.error('Error fetching user profile:', error));
        }
    }
    
    // Update available balance
    const availableBalanceElement = document.getElementById('availableBalance');
    if (availableBalanceElement && userData) {
        availableBalanceElement.textContent = formatCurrency(userData.availableBalance || 0);
    }
});
/**
 * Update referral chart with data from API
 * @param {Object} referralData - Referral data from API
 */
function updateReferralChart(referralData) {
    if (!window.referralChart) {
        initReferralChart();
    }
    
    if (referralData) {
        window.referralChart.data.datasets[0].data = [
            referralData.activeReferrals || 0,
            referralData.pendingSignups || 0,
            referralData.totalEarnings || 0
        ];
        window.referralChart.update();
        
        const statsContainer = document.querySelector('.referral-chart').parentElement.nextElementSibling;
        if (statsContainer) {
            const stats = statsContainer.querySelectorAll('.flex.justify-between');
            if (stats.length >= 3) {
                stats[0].querySelector('span:last-child').textContent = referralData.activeReferrals || 0;
                stats[1].querySelector('span:last-child').textContent = referralData.pendingSignups || 0;
                stats[2].querySelector('span:last-child').textContent = formatCurrency(referralData.totalEarnings || 0);
            }
        }
    }
}

/**
 * Fetch recent activity data from backend
 */
async function fetchRecentActivity() {
    try {
        const token = getAuthToken();
        const response = await fetch('/api/dashboard/recent-activity', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const activityData = await response.json();
            updateRecentActivity(activityData);
        } else {
            showError('Failed to fetch recent activity. Please try again.');
        }
    } catch (error) {
        showError('Error fetching recent activity. Please check your connection.');
    }
}

/**
 * Update recent activity list with data from API
 * @param {Array} activities - Activities data from API
 */
function updateRecentActivity(activities) {
    const activityList = document.getElementById('recent-activity-list');
    if (!activityList) {
        console.warn('Recent activity list element (#recent-activity-list) not found.');
        return;
    }
    activityList.innerHTML = '';

    if (!activities || activities.length === 0) {
        const noActivityItem = document.createElement('li');
        noActivityItem.textContent = 'No recent activity to display.';
        noActivityItem.className = 'text-gray-500 text-center p-4';
        activityList.appendChild(noActivityItem);
        return;
    }

    activities.slice(0, 8).forEach(activity => {
        const listItem = document.createElement('li');
        listItem.className = 'py-3 px-2 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors duration-150 ease-in-out';
        
        const iconClass = activity.iconClass || 'fa-bell';
        const activityTime = activity.timestamp ? new Date(activity.timestamp).toLocaleString() : (activity.time || 'Recently');

        listItem.innerHTML = `
            <div class="flex items-center">
                <div class="mr-3">
                    <i class="fas ${iconClass} text-gray-400"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-800">${activity.description || 'Activity description missing'}</p>
                    <p class="text-xs text-gray-500">${activityTime}</p>
                </div>
                ${activity.detailsLink ? `<a href="${activity.detailsLink}" class="text-xs text-indigo-600 hover:text-indigo-800">View</a>` : ''}
            </div>
        `;
        activityList.appendChild(listItem);
    });
}

/**
 * Format a number as currency
 * @param {number} value - Value to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}

/**
 * Show error message on dashboard
 * @param {string} message - Error message to display
 */
function showError(message) {
    console.error("Error: " + message);
    
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('errorNotificationContainer');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'errorNotificationContainer';
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
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.replace('translate-y-0', 'translate-y-4');
            notification.classList.replace('opacity-100', 'opacity-0');
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}


/**
 * Update dashboard UI with data from the API
 * @param {Object} data - Dashboard data from the API
 */
function updateDashboardUI(data) {
    console.log("Updating dashboard with data:", data);
    
    // Format currency helper
    function formatCurrency(amount) {
        return amount !== null && amount !== undefined 
            ? '$' + parseFloat(amount).toFixed(2) 
            : '$0.00';
    }

    // Update balance elements by ID
    const totalBalanceEl = document.getElementById('totalBalance');
    if (totalBalanceEl) {
        totalBalanceEl.textContent = formatCurrency(data.totalBalance);
    } else {
        console.warn("Total balance element not found by ID");
        // Fallback to more generic selector
        const fallbackEl = document.querySelector('.bg-green .text-2xl');
        if (fallbackEl) fallbackEl.textContent = formatCurrency(data.totalBalance);
    }
    
    // Update available balance
    const availableBalanceEl = document.getElementById('availableBalance');
    if (availableBalanceEl) {
        availableBalanceEl.textContent = formatCurrency(data.availableBalance);
    }
    
    // Update pending balance
    const pendingBalanceEl = document.getElementById('pendingBalance');
    if (pendingBalanceEl) {
        pendingBalanceEl.textContent = formatCurrency(data.pendingBalance || 0);
    }
    
    // Update monthly growth
    const monthlyGrowthEl = document.getElementById('monthlyGrowth');
    if (monthlyGrowthEl && data.monthlyGrowth !== undefined) {
        monthlyGrowthEl.textContent = `${data.monthlyGrowth >= 0 ? '+' : ''}${data.monthlyGrowth}% this month`;
    }
    
    // Update last updated timestamp
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = new Date().toLocaleString();
    }
}

// Add this to your existing DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', function() {
    // Fetch dashboard data from API
    const token = sessionStorage.getItem('authToken');    
    if (!token) {
        window.location.href = 'auth.html';
        return;
    }
    
    fetch('/api/dashboard', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch dashboard data');
        }
        return response.json();
    })
    .then(data => {
        console.log("Dashboard data received:", data);
        // Call the update UI function with the data
        updateDashboardUI(data);
    })
    .catch(error => {
        console.error('Error fetching dashboard data:', error);
    });
});

/**
 * Log out the user
 */
document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById('logoutButton'); // Corrected selector
    if (logoutButton) {
        logoutButton.addEventListener('click', async function(e) {
            e.preventDefault();
            
            try {
                const token = getAuthToken();
                // Optional: Call a backend logout endpoint if you have one
                if (token) { // Only call if token exists
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                }
                
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('isLoggedIn'); // Ensure this is also cleared
                window.location.href = 'auth.html';
            } catch (error) {
                console.error('Error during logout:', error); // Log the error
                showError('Error during logout. Redirecting to login page.');
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('isLoggedIn');
                window.location.href = 'auth.html';
            }
        });
    }

    
    const token = sessionStorage.getItem('authToken'); // Corrected to getItem

    if (!token && (window.location.pathname.includes('dashboard.html'))) { // Added path check
        // Only redirect if on dashboard and no token
        // window.location.href = 'auth.html'; // This redirect might be too aggressive here, consider showLoginPrompt
        return;
    }

    // The rest of your fetch logic for /api/dashboard
    if (token && window.location.pathname.includes('dashboard.html')) { // Ensure token exists and on dashboard
        fetch('/api/dashboard', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) { // Unauthorized or Forbidden
                    sessionStorage.removeItem('authToken');
                    sessionStorage.removeItem('isLoggedIn');
                    // window.location.href = 'auth.html'; // Redirect if auth fails
                    showLoginPrompt(); // Or show prompt
                    return null; // Stop further processing
                }
                throw new Error('Failed to fetch dashboard data, status: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data) { // Check if data is not null (due to auth failure)
                console.log("Dashboard data received:", data);
                updateDashboardUI(data);
            }
        })
        .catch(error => {
            console.error('Error fetching dashboard data:', error);
            // showError('Could not load dashboard data. Please ensure you are logged in.');
            // Potentially showLoginPrompt() here as well if the error is auth-related
        });
    }
});

/**
 * Update the updateReferralChart function to handle the earnings correctly
 * @param {Object} referralData - Referral data from the API
 */
function updateReferralChart(referralData) {
    if (!window.referralChart) {
        initReferralChart();
    }
    
    if (referralData) {
        // For the chart, we'll use counts for active and pending, but we need a 
        // normalized value for earnings to display properly on the chart
        const activeCount = referralData.activeReferrals || 0;
        const pendingCount = referralData.pendingSignups || 0;
        // Scale earnings to be visually comparable to the counts
        const normalizedEarnings = Math.min(Math.max(1, activeCount + pendingCount), 10);
        
        window.referralChart.data.datasets[0].data = [
            activeCount,
            pendingCount, 
            normalizedEarnings
        ];
        window.referralChart.update();
        
        const statsContainer = document.querySelector('.referral-chart-container').parentElement.nextElementSibling;
        if (statsContainer) {
            const stats = statsContainer.querySelectorAll('.flex.justify-between');
            if (stats.length >= 3) {
                stats[0].querySelector('span:last-child').textContent = activeCount;
                stats[1].querySelector('span:last-child').textContent = pendingCount;
                stats[2].querySelector('span:last-child').textContent = formatCurrency(referralData.totalEarnings || 0);
            }
        }
    }
}


/**
 * Update last updated timestamp
 */
function updateLastUpdated() {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (lastUpdatedElement) {
        const now = new Date();
        lastUpdatedElement.textContent = `Last updated: ${now.toLocaleString()}`;
    }
}

// IMMEDIATE FIX - Add this to the end of your file
(function() {
  // Get user data directly from the dashboard API response
  const userData = JSON.parse(sessionStorage.getItem('userData'));
  
  if (userData && userData.user) {
    // First approach - direct DOM manipulation
    const nameElement = document.querySelector('h3.text-center.font-semibold');
    const levelElement = document.querySelector('.text-center.text-xs.text-indigo-300');
    const avatarElement = document.querySelector('.rounded-full');
    
    if (nameElement) nameElement.textContent = userData.user.name || 'User';
    if (levelElement) levelElement.textContent = userData.user.level || 'Standard';
    if (avatarElement) {
      const formattedName = encodeURIComponent(userData.user.name || 'User');
      avatarElement.src = `https://ui-avatars.com/api/?name=${formattedName}&background=6366f1&color=fff`;
    }
    
    console.log('User info updated with:', userData.user.name);
  } else {
    console.warn('No user data found in sessionStorage');
  }
})();
