document.addEventListener('DOMContentLoaded', () => {
    // Get token from localStorage
    const token = localStorage.getItem('adminToken');
    
    // Check if token exists, redirect to login if not
    if (!token) {
        window.location.href = 'admin-auth.html';
        return;
    }
    
    // Set base API URL
    const API_URL = '/api/admin';
    
    // Skip token verification and proceed directly to dashboard initialization
    // This avoids the session expiration issue when the verify-token endpoint is not responding
    initializeAdminDashboard();

    // Function to verify if the current token is still valid (kept for future use)
    async function verifyAdminToken() {
        try {
            // Use a simple endpoint to validate token - can be any authorized endpoint
            const response = await fetch(`${API_URL}/users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // If we get 401/403, token is invalid
            if (response.status === 401 || response.status === 403) {
                return false;
            }
            
            // Any successful response means token is valid
            return response.ok;
        } catch (error) {
            // Network error or other issues - consider token valid to prevent logout on network issues
            console.warn('Token verification request failed:', error);
            // We'll return true to avoid logout on network errors
            return true;
        }
    }

    // Handle logout process
   function handleLogout(message = null) {
        // Clear admin token
        sessionStorage.removeItem('adminToken');
        
        // Show message if provided
        if (message) {
            // Store message to show after redirect
            sessionStorage.setItem('adminLoginMessage', message);
        }
        
        // Redirect to login page
        window.location.href = 'admin-auth.html';
    }
    
    // Initialize the admin dashboard components and event listeners
    function initializeAdminDashboard() {
        // User management variables
        const usersTableBody = document.getElementById('usersTableBody');
        const userSearchInput = document.getElementById('userSearchInput');
        const searchUserButton = document.getElementById('searchUserButton');
    
        const userDetailsModal = document.getElementById('userDetailsModal');
        const editUserModal = document.getElementById('editUserModal');
        const editBalanceModal = document.getElementById('editBalanceModal');
    
        const modalUserDetailsContent = document.getElementById('modalUserDetailsContent');
        const editUserForm = document.getElementById('editUserForm');
        const editBalanceForm = document.getElementById('editBalanceForm');
    
        const editUserId = document.getElementById('editUserId');
        const editUserName = document.getElementById('editUserName');
        const editUserEmail = document.getElementById('editUserEmail');
    
        const balanceUserId = document.getElementById('balanceUserId');
        const editUserBalanceAmount = document.getElementById('editUserBalanceAmount');
    
        // Withdrawal management variables - Check if elements exist first
        const withdrawalsTableBody = document.getElementById('withdrawalsTableBody');
        const withdrawalSearchInput = document.getElementById('withdrawalSearchInput');
        const searchWithdrawalButton = document.getElementById('searchWithdrawalButton');
        
        const withdrawalDetailsModal = document.getElementById('withdrawalDetailsModal');
        const modalWithdrawalDetailsContent = withdrawalDetailsModal ? document.getElementById('modalWithdrawalDetailsContent') : null;
        const withdrawalNotes = document.getElementById('withdrawalNotes');
        const approveWithdrawalBtn = document.getElementById('approveWithdrawalBtn');
        const rejectWithdrawalBtn = document.getElementById('rejectWithdrawalBtn');
        
        // Store the current withdrawal ID being viewed
        let currentWithdrawalId = null;

        // Admin Transaction History variables
        const adminWithdrawalHistoryTableBody = document.getElementById('adminWithdrawalHistoryTableBody');
        const adminDepositHistoryTableBody = document.getElementById('adminDepositHistoryTableBody');
        const adminWithdrawalHistorySearchInput = document.getElementById('adminWithdrawalHistorySearchInput');
        const adminSearchWithdrawalHistoryButton = document.getElementById('adminSearchWithdrawalHistoryButton');
        const adminDepositHistorySearchInput = document.getElementById('adminDepositHistorySearchInput');
        const adminSearchDepositHistoryButton = document.getElementById('adminSearchDepositHistoryButton');
    
        // Function to fetch users
        async function fetchUsers(searchTerm = '') {
            try {
                const response = await fetch(`${API_URL}/users${searchTerm ? '?search=' + encodeURIComponent(searchTerm) : ''}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                // Handle unauthorized/forbidden responses
                if (response.status === 401 || response.status === 403) {
                    handleLogout('Session expired or unauthorized. Please log in again.');
                    return;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const responseData = await response.json();
                
                if (responseData && responseData.success && responseData.data) {
                    renderUsers(responseData.data);
                } else {
                    console.error('Invalid data structure from API:', responseData);
                    usersTableBody.innerHTML = '<tr><td colspan="5">Error: Invalid data from server.</td></tr>';
                }
            } catch (error) {
                console.error('Error fetching users:', error);
                usersTableBody.innerHTML = '<tr><td colspan="5">Error loading users. The server may be unavailable.</td></tr>';
            }
        }
    
        // Function to handle API responses and check for authentication errors
        async function handleApiResponse(response, errorMessage) {
            if (response.status === 401 || response.status === 403) {
                handleLogout('Session expired or unauthorized. Please log in again.');
                return null;
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorMessage);
            }
            
            return await response.json();
        }

        // Function to render users in the table
        function renderUsers(usersArray) {
            usersTableBody.innerHTML = '';
            if (!usersArray || usersArray.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
                return;
            }
            usersArray.forEach(user => {
                const row = usersTableBody.insertRow();
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td><span class="status-${user.is_locked ? 'locked' : 'active'}">${user.is_locked ? 'Locked' : 'Active'}</span></td>
                    <td>
                        <button class="action-btn view-btn" data-userid="${user.id}">View</button>
                        <button class="action-btn edit-btn" data-userid="${user.id}">Edit</button>
                        <button class="action-btn balance-btn" data-userid="${user.id}">Balance</button>
                        <button class="action-btn lock-btn" data-userid="${user.id}" data-islocked="${user.is_locked}">
                            ${user.is_locked ? 'Unlock' : 'Lock'}
                        </button>
                    </td>
                `;
            });
            addEventListenersToButtons();
        }

        // Add event listeners to withdrawal action buttons IN THE TABLE
        function addWithdrawalEventListeners() {
            document.querySelectorAll('.view-withdrawal-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    console.log('[Table Event] View button clicked for ID:', e.target.dataset.withdrawalid);
                    handleViewWithdrawal(e.target.dataset.withdrawalid);
                });
            });
            document.querySelectorAll('.approve-btn').forEach(button => { // These are for buttons in the table
                button.addEventListener('click', (e) => {
                    console.log('[Table Event] Approve button clicked for ID:', e.target.dataset.withdrawalid);
                    handleApproveWithdrawal(e.target.dataset.withdrawalid);
                });
            });
            document.querySelectorAll('.reject-btn').forEach(button => { // These are for buttons in the table
                button.addEventListener('click', (e) => {
                    console.log('[Table Event] Reject button clicked for ID:', e.target.dataset.withdrawalid);
                    handleRejectWithdrawal(e.target.dataset.withdrawalid);
                });
            });
        }
        

        // Add event listeners for the MODAL's approve/reject buttons
        if (approveWithdrawalBtn) {
            approveWithdrawalBtn.addEventListener('click', () => {
                console.log('[Modal Event] Approve button clicked. CurrentWithdrawalId:', currentWithdrawalId);
                if (currentWithdrawalId) {
                    handleApproveWithdrawal(null); // Pass null so it uses currentWithdrawalId
                } else {
                    console.warn('[Modal Event] Approve clicked but currentWithdrawalId is not set.');
                    alert('Error: No withdrawal selected in modal.');
                }
            });
        
            // Add event listeners to action buttons
            function addEventListenersToButtons() {
                document.querySelectorAll('.view-btn').forEach(button => {
                    button.addEventListener('click', (e) => handleViewUser(e.target.dataset.userid));
                });
                document.querySelectorAll('.edit-btn').forEach(button => {
                    button.addEventListener('click', (e) => handleEditUser(e.target.dataset.userid));
                });
                document.querySelectorAll('.balance-btn').forEach(button => {
                    button.addEventListener('click', (e) => handleEditBalance(e.target.dataset.userid));
                });
                document.querySelectorAll('.lock-btn').forEach(button => {
                    button.addEventListener('click', (e) => handleLockUnlockUser(e.target.dataset.userid, e.target.dataset.islocked === 'true'));
                });
            }
        
            // Handle view user
            async function handleViewUser(userId) {
                try {
                    const response = await fetch(`${API_URL}/users/${userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        if (response.status === 403 || response.status === 401) {
                            alert('Session expired or unauthorized. Please log in again.');
                            localStorage.removeItem('adminToken');
                            window.location.href = 'admin-auth.html';
                            return; // Stop execution if redirected
                        }
                        throw new Error('Failed to fetch user details');
                    }
                    const responseData = await response.json();

                    if (responseData && responseData.success && responseData.data) {
                        const userDetails = responseData.data.user; // Access the nested user object
                        const walletDetails = responseData.data.wallet; // Access the nested wallet object

                        let balance = 'N/A';
                        if (walletDetails && walletDetails.balance !== undefined) {
                            balance = parseFloat(walletDetails.balance).toFixed(2);
                        }

                        modalUserDetailsContent.innerHTML = `
                        <p><strong>ID:</strong> ${userDetails.id}</p>
                        <p><strong>Name:</strong> ${userDetails.firstName} ${userDetails.lastName}</p>
                        <p><strong>Email:</strong> ${userDetails.email}</p>
                        <p><strong>Username:</strong> ${userDetails.username || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${userDetails.phoneNumber || 'N/A'}</p>
                        <p><strong>Referral Code:</strong> ${userDetails.referralCode || 'N/A'}</p>
                        <p><strong>Referred By ID:</strong> ${userDetails.referredBy || 'N/A'}</p>
                        <p><strong>Status:</strong> ${userDetails.isVerified === 0 ? 'Locked' : 'Active'}</p>
                        <p><strong>Email Verified:</strong> ${userDetails.isVerified === 1 ? 'Yes' : 'No'}</p>
                        <p><strong>2FA Enabled:</strong> ${userDetails.security_twoFactorEnabled ? 'Yes' : 'No'}</p>
                        <p><strong>Created At:</strong> ${new Date(userDetails.createdAt).toLocaleString()}</p>
                        <p><strong>Last Login:</strong> ${userDetails.lastLogin ? new Date(userDetails.lastLogin).toLocaleString() : 'N/A'}</p>
                        <p><strong>Balance:</strong> $${balance}</p>
                    `;
                        userDetailsModal.style.display = 'block';
                    } else {
                        console.error('Invalid data structure from API for user details:', responseData);
                        alert('Could not load user details: Invalid data structure.');
                    }
                } catch (error) {
                    console.error('Error fetching user details:', error);
                    alert('Could not load user details.');
                }
            }

            // Handle edit user - populate form
            async function handleEditUser(userId) {
                try {
                    const response = await fetch(`${API_URL}/users/${userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error('Failed to fetch user details for editing');
                    const responseData = await response.json(); // Expect { success: true, data: { user: {...} } }
                
                    if (responseData && responseData.success && responseData.data && responseData.data.user) {
                        const userDetails = responseData.data.user;
                        editUserId.value = userDetails.id;
                        // Assuming 'name' in editUserForm should be split or handled if your backend expects firstName, lastName
                        editUserName.value = `${userDetails.firstName} ${userDetails.lastName}`;
                        editUserEmail.value = userDetails.email;
                        // Add other fields as necessary from your user model to the editUserForm in admin.html
                        // e.g., document.getElementById('editUserUsername').value = userDetails.username;
                        editUserModal.style.display = 'block';
                    } else {
                        console.error('Invalid data structure from API for editing user:', responseData);
                        alert('Could not load user data for editing: Invalid data structure.');
                    }
                } catch (error) {
                    console.error('Error preparing user edit form:', error);
                    alert('Could not load user data for editing.');
                }
            }        // Handle edit balance - populate form
            async function handleEditBalance(userId) {
                balanceUserId.value = userId;
                editUserBalanceAmount.value = ''; // Clear previous amount
                // Also clear the reason field if it exists
                const reasonField = document.getElementById('balanceAdjustmentReason');
                if (reasonField) reasonField.value = '';
            
                editBalanceModal.style.display = 'block';
            }

            // Handle lock/unlock user
            async function handleLockUnlockUser(userId, isLocked) {
                const action = isLocked ? 'unlock' : 'lock';
                if (!confirm(`Are you sure you want to ${action} this user?`)) return;

                try {
                    const response = await fetch(`${API_URL}/users/${userId}/${action}`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Failed to ${action} user`);
                    }
                    alert(`User ${action}ed successfully.`);
                    fetchUsers(userSearchInput.value); // Refresh user list
                } catch (error) {
                    console.error(`Error ${action}ing user:`, error);
                    alert(`Could not ${action} user: ${error.message}`);
                }
            }

            // Event listener for submitting edit user form
            editUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userId = editUserId.value;
                const updatedData = {
                    name: editUserName.value,
                    email: editUserEmail.value,
                    // Retrieve other fields from your form
                    // e.g., username: document.getElementById('editUserUsername').value
                };

                try {
                    const response = await fetch(`${API_URL}/users/${userId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(updatedData)
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to update user');
                    }
                    alert('User updated successfully.');
                    closeModal('editUserModal');
                    fetchUsers(userSearchInput.value); // Refresh user list
                } catch (error) {
                    console.error('Error updating user:', error);
                    alert(`Could not update user: ${error.message}`);
                }
            });        // Event listener for submitting edit balance form
            editBalanceForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userId = balanceUserId.value;
                const adjustmentAmount = parseFloat(editUserBalanceAmount.value);
                const reasonField = document.getElementById('balanceAdjustmentReason');
                const reason = reasonField ? reasonField.value.trim() : '';

                if (isNaN(adjustmentAmount)) {
                    alert('Please enter a valid number for the adjustment amount.');
                    return;
                }

                try {
                    // Send the adjustment amount and reason to the backend
                    const response = await fetch(`${API_URL}/users/${userId}/balance`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            adjustment: adjustmentAmount,
                            reason: reason || (adjustmentAmount >= 0 ? 'Balance increase' : 'Balance reduction')
                        })
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to adjust balance');
                    }
                
                    const actionText = adjustmentAmount >= 0 ? 'increased' : 'reduced';
                    alert(`User balance ${actionText} successfully.`);
                    closeModal('editBalanceModal');
                    fetchUsers(userSearchInput.value); // Refresh user list
                } catch (error) {
                    console.error('Error adjusting balance:', error);
                    alert(`Could not adjust balance: ${error.message}`);
                }
            });

            // --- Admin Transaction History Functions ---

            // Generic function to fetch admin transaction history (Withdrawals or Deposits)
            async function fetchAdminTransactionHistory(type, tableBodyElement, searchTerm = '') {
                if (!tableBodyElement) {
                    console.warn(`Table body for ${type} history not found. Skipping fetch.`);
                    return;
                }
                
                // Show loading state
                tableBodyElement.innerHTML = `<tr><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Loading ${type.toLowerCase()} history...</td></tr>`;
                
                try {
                    console.log(`Fetching ${type} history with search: "${searchTerm}"`);
                    
                    const response = await fetch(`${API_URL}/transactions?type=${type}&search=${encodeURIComponent(searchTerm)}&limit=50`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
            
                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            handleLogout('Session expired or unauthorized. Please log in again.');
                            return;
                        }
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
            
                    const data = await response.json();
                    console.log(`${type} history response:`, data); // Log the response for debugging
            
                    if (data && data.success && data.transactions) {
                        renderAdminTransactionHistory(data.transactions, tableBodyElement, type);
                    } else {
                        console.error(`Invalid data structure from API for ${type} history:`, data);
                        tableBodyElement.innerHTML = `<tr><td colspan="7">Error: Invalid data from server for ${type} history.</td></tr>`;
                    }
                } catch (error) {
                    console.error(`Error fetching admin ${type} history:`, error);
                    tableBodyElement.innerHTML = `<tr><td colspan="7">Error loading ${type} history: ${error.message}</td></tr>`;
                }
            }
            
            // Function to render admin transaction history in the respective table
            function renderAdminTransactionHistory(transactions, tableBodyElement, type) {
                tableBodyElement.innerHTML = ''; // Clear existing rows
                console.log(`Rendering ${transactions.length} ${type} transactions`);
                
                if (!transactions || transactions.length === 0) {
                    tableBodyElement.innerHTML = `<tr><td colspan="7">No ${type.toLowerCase()} history found.</td></tr>`;
                    return;
                }
            
                transactions.forEach(transaction => {
                    const row = tableBodyElement.insertRow();
                    const userEmail = transaction.user ? transaction.user.email : 'N/A';
                    const userId = transaction.user ? transaction.user.id : 'N/A';
                    
                    // Format the date
                    const date = transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : 'N/A';
                    
                    // Get status with appropriate styling
                    const statusClass = transaction.status && transaction.status.toLowerCase() === 'completed' ? 
                        'status-active' : (transaction.status && transaction.status.toLowerCase() === 'pending' ? 
                        'status-pending' : 'status-inactive');
                        
                    // Format amount with currency symbol
                    const amount = transaction.amount ? `$${parseFloat(transaction.amount).toFixed(2)}` : 'N/A';
                    
                    // Create details button
                    let detailsButton = '';
                    try {
                        const details = transaction.details ? 
                            (typeof transaction.details === 'string' ? JSON.parse(transaction.details) : transaction.details) : {};
                        const detailsStr = JSON.stringify(details);
                        detailsButton = `<button class="action-btn" onclick="alert('Transaction Details:\\n${detailsStr.replace(/"/g, '\\"')}')">View Details</button>`;
                    } catch (e) {
                        detailsButton = `<span>No details</span>`;
                    }
                    
                    row.innerHTML = `
                        <td>${transaction.id}</td>
                        <td>${userId}</td>
                        <td>${userEmail}</td>
                        <td>${amount}</td>
                        <td>${date}</td>
                        <td><span class="${statusClass}">${transaction.status || 'Unknown'}</span></td>
                        <td>${detailsButton}</td>
                    `;
                });
            }
            
        
            function truncateDetails(detailsString, maxLength = 50) {
                if (typeof detailsString !== 'string') return 'Invalid Details';
                if (detailsString.length <= maxLength) return detailsString;
                return detailsString.substring(0, maxLength) + '...';
            }


            // Helper function to format currency (ensure it's available or define it)
            function formatCurrency(amount) {
                const numAmount = parseFloat(amount);
                return isNaN(numAmount) ? '0.00' : numAmount.toFixed(2);
            }

            // Helper function to format date (ensure it's available or define it)
            function formatDate(dateString) {
                if (!dateString) return 'N/A';
                try {
                    return new Date(dateString).toLocaleString();
                } catch (e) {
                    return 'Invalid Date';
                }
            }
        
            // Event listeners for admin transaction history search
            if (adminSearchWithdrawalHistoryButton) {
                adminSearchWithdrawalHistoryButton.addEventListener('click', () => {
                    fetchAdminTransactionHistory('Withdrawal', adminWithdrawalHistoryTableBody, adminWithdrawalHistorySearchInput.value);
                });
            }
            if (adminWithdrawalHistorySearchInput) {
                adminWithdrawalHistorySearchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        fetchAdminTransactionHistory('Withdrawal', adminWithdrawalHistoryTableBody, adminWithdrawalHistorySearchInput.value);
                    }
                });
            }

            if (adminSearchDepositHistoryButton) {
                adminSearchDepositHistoryButton.addEventListener('click', () => {
                    fetchAdminTransactionHistory('Deposit', adminDepositHistoryTableBody, adminDepositHistorySearchInput.value);
                });
            }
            if (adminDepositHistorySearchInput) {
                adminDepositHistorySearchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        fetchAdminTransactionHistory('Deposit', adminDepositHistoryTableBody, adminDepositHistorySearchInput.value);
                    }
                });
            }

            // --- End Admin Transaction History Functions ---

            // Function to fetch pending withdrawals - Check if the withdrawal table exists first
            async function fetchWithdrawals(searchTerm = '') {
                if (!withdrawalsTableBody) {
                    console.log('Withdrawal table not found in the DOM. Skipping withdrawal fetch.');
                    return; // Skip if the withdrawal table doesn't exist
                }
            
                try {
                    const response = await fetch(`${API_URL}/withdrawals${searchTerm ? '?search=' + encodeURIComponent(searchTerm) : ''}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                
                    if (response.status === 401 || response.status === 403) {
                        handleLogout('Session expired or unauthorized. Please log in again.');
                        return;
                    }
                
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                
                    const responseData = await response.json();
                
                    if (responseData && responseData.success && responseData.withdrawals) {
                        renderWithdrawals(responseData.withdrawals);
                    } else {
                        console.error('Invalid data structure from API:', responseData);
                        withdrawalsTableBody.innerHTML = '<tr><td colspan="8">Error: Invalid data from server.</td></tr>';
                    }
                } catch (error) {
                    console.error('Error fetching withdrawals:', error);
                    withdrawalsTableBody.innerHTML = '<tr><td colspan="8">Error loading withdrawals. The server may be unavailable.</td></tr>';
                }
            }
        
            // Function to render withdrawals in the table
            function renderWithdrawals(withdrawalsArray) {
                withdrawalsTableBody.innerHTML = ''; // Clear existing rows
                if (!withdrawalsArray || withdrawalsArray.length === 0) {
                    withdrawalsTableBody.innerHTML = '<tr><td colspan="8">No pending withdrawals found.</td></tr>';
                    return;
                }
            
                withdrawalsArray.forEach(withdrawal => {
                    const details = withdrawal.details || {};
                    const row = withdrawalsTableBody.insertRow();
                
                    // Add status class based on status
                    const statusClass = withdrawal.status === 'Pending' ? 'status-pending' :
                        withdrawal.status === 'Completed' ? 'status-active' :
                            'status-inactive';
                
                    row.innerHTML = `
                    <td>${withdrawal.id}</td>
                    <td>${withdrawal.user ? withdrawal.user.fullName : 'Unknown'}</td>
                    <td>$${parseFloat(withdrawal.amount).toFixed(2)}</td>
                    <td>${new Date(withdrawal.createdAt).toLocaleString()}</td>
                    <td>${details.walletAddress || 'N/A'}</td>
                    <td>${details.network || 'TRC20'}</td>
                    <td><span class="${statusClass}">${withdrawal.status}</span></td>
                    <td>
                        <button class="action-btn view-withdrawal-btn" data-withdrawalid="${withdrawal.id}">View</button>
                        ${withdrawal.status === 'Pending' ? `
                            <button class="action-btn approve-btn" data-withdrawalid="${withdrawal.id}">Approve</button>
                            <button class="action-btn reject-btn" data-withdrawalid="${withdrawal.id}">Reject</button>
                        ` : ''}
                    </td>
                `;
                });
            
                addWithdrawalEventListeners();
            }

            // Add event listeners to withdrawal action buttons IN THE TABLE
        function addWithdrawalEventListeners() {
            document.querySelectorAll('.view-withdrawal-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    console.log('[Table Event] View button clicked for ID:', e.target.dataset.withdrawalid);
                    handleViewWithdrawal(e.target.dataset.withdrawalid);
                });
            });
            document.querySelectorAll('.approve-btn').forEach(button => { // These are for buttons in the table
                button.addEventListener('click', (e) => {
                    console.log('[Table Event] Approve button clicked for ID:', e.target.dataset.withdrawalid);
                    handleApproveWithdrawal(e.target.dataset.withdrawalid);
                });
            });
            document.querySelectorAll('.reject-btn').forEach(button => { // These are for buttons in the table
                button.addEventListener('click', (e) => {
                    console.log('[Table Event] Reject button clicked for ID:', e.target.dataset.withdrawalid);
                    handleRejectWithdrawal(e.target.dataset.withdrawalid);
                });
            });
        }

        // Add event listeners for the MODAL's approve/reject buttons
        if (approveWithdrawalBtn) {
            approveWithdrawalBtn.addEventListener('click', () => {
                console.log('[Modal Event] Approve button clicked. CurrentWithdrawalId:', currentWithdrawalId);
                if (currentWithdrawalId) {
                    handleApproveWithdrawal(null); // Pass null so it uses currentWithdrawalId
                } else {
                    console.warn('[Modal Event] Approve clicked but currentWithdrawalId is not set.');
                    alert('Error: No withdrawal selected in modal.');
                }
            });
        }

        if (rejectWithdrawalBtn) {
            rejectWithdrawalBtn.addEventListener('click', () => {
                console.log('[Modal Event] Reject button clicked. CurrentWithdrawalId:', currentWithdrawalId);
                if (currentWithdrawalId) {
                    handleRejectWithdrawal(null); // Pass null so it uses currentWithdrawalId
                } else {
                    console.warn('[Modal Event] Reject clicked but currentWithdrawalId is not set.');
                    alert('Error: No withdrawal selected in modal.');
                }
            });
        }


            // Handle view withdrawal details
            async function handleViewWithdrawal(withdrawalId) {
                console.log('[handleViewWithdrawal] Clicked View for withdrawal ID:', withdrawalId); // Log
                try {
                    const response = await fetch(`${API_URL}/withdrawals/${withdrawalId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        if (response.status === 403 || response.status === 401) {
                            alert('Session expired or unauthorized. Please log in again.');
                            localStorage.removeItem('adminToken');
                            window.location.href = 'admin-auth.html';
                            return;
                        }
                        throw new Error('Failed to fetch withdrawal details');
                    }
                    const responseData = await response.json();

                    if (responseData && responseData.success && responseData.withdrawal) {
                        const withdrawal = responseData.withdrawal;
                        const details = withdrawal.details || {};
                    
                        // Store current withdrawal ID for approve/reject actions
                        currentWithdrawalId = withdrawal.id;
                        console.log('[handleViewWithdrawal] Set currentWithdrawalId to:', currentWithdrawalId); // Log
                    
                        // Format date
                        const requestDate = new Date(withdrawal.createdAt).toLocaleString();
                        const completedDate = withdrawal.completedAt ? new Date(withdrawal.completedAt).toLocaleString() : 'N/A';
                    
                        // Show/hide action buttons based on status
                        // This check should be correct as your backend sends lowercase "pending"
                        if (withdrawal.status && withdrawal.status.toLowerCase() === 'pending') {
                            console.log('[handleViewWithdrawal] Status is pending, showing modal action buttons.'); // Log
                            approveWithdrawalBtn.style.display = 'inline-block';
                            rejectWithdrawalBtn.style.display = 'inline-block';
                            withdrawalNotes.style.display = 'block';
                        } else {
                            console.log('[handleViewWithdrawal] Status is not pending, hiding modal action buttons. Status:', withdrawal.status); // Log
                            approveWithdrawalBtn.style.display = 'none';
                            rejectWithdrawalBtn.style.display = 'none';
                            withdrawalNotes.style.display = 'none';
                        }

                        modalWithdrawalDetailsContent.innerHTML = `
                        <p><strong>Withdrawal ID:</strong> ${withdrawal.id}</p>
                        <p><strong>User:</strong> ${withdrawal.user ? `${withdrawal.user.fullName} (ID: ${withdrawal.user.id})` : 'Unknown'}</p>
                        <p><strong>Email:</strong> ${withdrawal.user ? withdrawal.user.email : 'N/A'}</p>
                        <p><strong>Amount:</strong> $${parseFloat(withdrawal.amount).toFixed(2)}</p>
                        <p><strong>Fee:</strong> $${(details.fee || 1).toFixed(2)}</p>
                        <p><strong>Total Amount:</strong> $${(parseFloat(withdrawal.amount) + parseFloat(details.fee || 1)).toFixed(2)}</p>
                        <p><strong>Network:</strong> ${details.network || 'TRC20'}</p>
                        <p><strong>Wallet Address:</strong> ${details.walletAddress || 'N/A'}</p>
                        <p><strong>Status:</strong> <span class="status-${withdrawal.status ? withdrawal.status.toLowerCase() : 'unknown'}">${withdrawal.status}</span></p>
                        <p><strong>Date Requested:</strong> ${requestDate}</p>
                        <p><strong>Date Processed:</strong> ${completedDate}</p>
                        ${withdrawal.notes ? `<p><strong>Notes:</strong> ${withdrawal.notes}</p>` : ''}
                        ${withdrawal.txHash ? `<p><strong>TxHash:</strong> ${withdrawal.txHash}</p>` : ''}
                    `;
                    
                        withdrawalDetailsModal.style.display = 'block';
                    } else {
                        console.error('[handleViewWithdrawal] Invalid data structure from API for withdrawal details:', responseData); // Log
                        alert('Could not load withdrawal details: Invalid data structure.');
                    }
                } catch (error) {
                    console.error('[handleViewWithdrawal] Error fetching withdrawal details:', error); // Log
                    alert('Could not load withdrawal details.');
                }
            }
        
            // Handle approve/reject withdrawal
            async function handleProcessWithdrawal(withdrawalId, action) {
                console.log(`[handleProcessWithdrawal] Attempting to ${action} withdrawal ID: ${withdrawalId}`); // Log
                const notes = withdrawalNotes ? withdrawalNotes.value.trim() : ''; // Ensure withdrawalNotes exists
                console.log(`[handleProcessWithdrawal] Notes: "${notes}"`); // Log
            
                if (!confirm(`Are you sure you want to ${action} this withdrawal request?`)) {
                    console.log(`[handleProcessWithdrawal] User cancelled ${action} action.`); // Log
                    return;
                }

                console.log(`[handleProcessWithdrawal] User confirmed. Proceeding with ${action}.`); // Log
                try {
                    const response = await fetch(`${API_URL}/withdrawals/${withdrawalId}/process`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            action: action,
                            notes: notes
                            // txHash is not sent from UI, backend handles automated transfer
                        })
                    });
                    console.log(`[handleProcessWithdrawal] API response status: ${response.status}`); // Log

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response from server.' })); // Graceful error parsing
                        console.error(`[handleProcessWithdrawal] API error data for ${action}:`, errorData); // Log
                        throw new Error(errorData.message || `Failed to ${action} withdrawal`);
                    }

                    const responseData = await response.json();
                    console.log(`[handleProcessWithdrawal] API success data for ${action}:`, responseData); // Log
                    alert(`Withdrawal successfully ${action === 'approve' ? 'approved' : 'rejected'}.`);
                    closeModal('withdrawalDetailsModal');
                    fetchWithdrawals(withdrawalSearchInput ? withdrawalSearchInput.value : ''); // Refresh withdrawal list
                } catch (error) {
                    console.error(`[handleProcessWithdrawal] Error processing withdrawal:`, error); // Log
                    alert(`Could not ${action} withdrawal: ${error.message}`);
                }
            }

            // Handle approve withdrawal
            function handleApproveWithdrawal(withdrawalIdFromTable) { // Renamed param for clarity
                console.log('[handleApproveWithdrawal] Called. withdrawalIdFromTable:', withdrawalIdFromTable, 'Current modal ID:', currentWithdrawalId);
                const idToUse = withdrawalIdFromTable || currentWithdrawalId; // Prioritize ID from table click, fallback to modal's current ID
                if (!idToUse) {
                    console.warn('[handleApproveWithdrawal] No withdrawal ID available.');
                    alert('No withdrawal selected.');
                    return;
                }
                console.log('[handleApproveWithdrawal] Using ID:', idToUse, 'for action: approve');
                handleProcessWithdrawal(idToUse, 'approve');
            }
    
            // Handle reject withdrawal
            function handleRejectWithdrawal(withdrawalIdFromTable) { // Renamed param for clarity
                console.log('[handleRejectWithdrawal] Called. withdrawalIdFromTable:', withdrawalIdFromTable, 'Current modal ID:', currentWithdrawalId);
                const idToUse = withdrawalIdFromTable || currentWithdrawalId; // Prioritize ID from table click, fallback to modal's current ID
                if (!idToUse) {
                    console.warn('[handleRejectWithdrawal] No withdrawal ID available.');
                    alert('No withdrawal selected.');
                    return;
                }
                console.log('[handleRejectWithdrawal] Using ID:', idToUse, 'for action: reject');
                handleProcessWithdrawal(idToUse, 'reject');
            }// Search functionality
            searchUserButton.addEventListener('click', () => {
                fetchUsers(userSearchInput.value.trim());
            });
            userSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    fetchUsers(userSearchInput.value.trim());
                }
            });
        
            // Withdrawal search functionality
            if (searchWithdrawalButton) {
                searchWithdrawalButton.addEventListener('click', () => {
                    fetchWithdrawals(withdrawalSearchInput.value.trim());
                });
            }
        
            if (withdrawalSearchInput) {
                withdrawalSearchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        fetchWithdrawals(withdrawalSearchInput.value.trim());
                    }
                });
            }
        
            // Make closeModal globally accessible for inline HTML onclick in admin.html
            window.closeModal = function (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'none';
                }
            }
        
            // Setup logout button
            const logoutButton = document.getElementById('logoutButton');
            if (logoutButton) {
                logoutButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleLogout();
                });
            }
    
            // Add event listeners to all close buttons within modals
            document.querySelectorAll('.modal .close-button').forEach(button => {
                button.addEventListener('click', () => {
                    button.closest('.modal').style.display = 'none';
                });
            });
        
            // Close modal if clicked outside of the modal content
            window.addEventListener('click', (event) => {
                if (event.target.classList.contains('modal')) {
                    event.target.style.display = 'none';
                }
            });
    
            // Initial data fetch
            fetchUsers();
            fetchWithdrawals(); // For the existing withdrawal management section
            // Fetch admin transaction histories on load
            if (adminWithdrawalHistoryTableBody) {
                fetchAdminTransactionHistory('Withdrawal', adminWithdrawalHistoryTableBody, '');
            }
            if (adminDepositHistoryTableBody) {
                fetchAdminTransactionHistory('Deposit', adminDepositHistoryTableBody, '');
            }
        }
    }
})
