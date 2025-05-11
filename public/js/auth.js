/**
 * Authentication JavaScript
 * Handles login, registration, and other authentication-related functionality.
 */

document.addEventListener('DOMContentLoaded', () => {
    setupAuthForms();
    checkRedirectParam();
});

/**
 * Setup authentication forms and event listeners
 */
function setupAuthForms() {
    // Get the forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    
    // Get the tabs
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const forgotPasswordTab = document.getElementById('forgot-password-tab');
    
    // Set up tab switching
    if (loginTab && registerTab && forgotPasswordTab) {
        loginTab.addEventListener('click', (e) => {
            e.preventDefault();
            showForm('login');
        });
        
        registerTab.addEventListener('click', (e) => {
            e.preventDefault();
            showForm('register');
        });
        
        forgotPasswordTab.addEventListener('click', (e) => {
            e.preventDefault();
            showForm('forgot-password');
        });
    }
    
    // Set up form submissions
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    }
}

/**
 * Show the specified form and hide others
 * @param {string} formName - Name of form to show (login, register, forgot-password)
 */
function showForm(formName) {
    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.add('hidden');
    });
    
    // Show the requested form
    const form = document.getElementById(`${formName}-form`);
    if (form) {
        form.classList.remove('hidden');
    }
    
    // Update active tab
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`${formName}-tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}

/**
 * Handle login form submission
 * @param {Event} e - Form submit event
 */
async function handleLogin(e) {
    e.preventDefault();
    
    // Get form data
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    // Show loading state
    const submitButton = document.getElementById('login-submit');
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    submitButton.disabled = true;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        // Store token in localStorage
        localStorage.setItem('token', data.token);
        
        // Check if user is admin and handle redirect
        const redirectParam = new URLSearchParams(window.location.search).get('redirect');
        
        if (data.user && data.user.role === 'admin' && redirectParam === 'admin') {
            // Redirect to admin page
            window.location.href = 'admin.html';
        } else {
            // Regular user, redirect to dashboard
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Login error:', error);
        showAuthError('login-error', error.message || 'Login failed. Please check your email and password.');
        
        // Reset button
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
    }
}

/**
 * Handle registration form submission
 * @param {Event} e - Form submit event
 */
async function handleRegister(e) {
    e.preventDefault();
    
    // Get form data
    const firstName = document.getElementById('register-firstname').value;
    const lastName = document.getElementById('register-lastname').value;
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const dateOfBirth = document.getElementById('register-dob').value;
    const phoneNumber = document.getElementById('register-phone').value;
    const country = document.getElementById('register-country').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showAuthError('register-error', 'Passwords do not match');
        return;
    }
    
    // Show loading state
    const submitButton = document.getElementById('register-submit');
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
    submitButton.disabled = true;
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName,
                lastName,
                username,
                email,
                dateOfBirth,
                phoneNumber,
                country,
                password
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }
        
        // Show success message
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('registration-success').classList.remove('hidden');
    } catch (error) {
        console.error('Registration error:', error);
        showAuthError('register-error', error.message || 'Registration failed. Please try again.');
        
        // Reset button
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
    }
}

/**
 * Handle forgot password form submission
 * @param {Event} e - Form submit event
 */
async function handleForgotPassword(e) {
    e.preventDefault();
    
    // Get form data
    const email = document.getElementById('forgot-email').value;
    
    // Show loading state
    const submitButton = document.getElementById('forgot-submit');
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitButton.disabled = true;
    
    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        // Show success message
        document.getElementById('forgot-password-form').classList.add('hidden');
        document.getElementById('forgot-password-success').classList.remove('hidden');
    } catch (error) {
        console.error('Forgot password error:', error);
        showAuthError('forgot-error', error.message || 'Request failed. Please try again.');
        
        // Reset button
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
    }
}

/**
 * Display an error message for the specified form
 * @param {string} elementId - ID of error element
 * @param {string} message - Error message to display
 */
function showAuthError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
}

/**
 * Check for redirect parameter in URL and show appropriate form
 */
function checkRedirectParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect === 'admin') {
        // Update page title to indicate admin login
        document.title = 'Admin Login - QuantumFX';
        
        // Hide registration tab if this is admin login
        const registerTab = document.getElementById('register-tab');
        if (registerTab) {
            registerTab.classList.add('hidden');
        }
        
        // Add admin login indicator
        const loginHeader = document.querySelector('#login-form h2');
        if (loginHeader) {
            loginHeader.textContent = 'Admin Login';
        }
    }
}
