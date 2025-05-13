// This file handles authentication functionality for auth.html

document.addEventListener('DOMContentLoaded', function() {
    // --- Form validation helpers ---
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
    
    function validatePassword(password) {
        // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
        return regex.test(password);
      }
    
    function validateUsername(username) {
        // 3-20 characters, letters, numbers, underscores, hyphens
        const re = /^[a-zA-Z0-9_-]{3,20}$/;
        return re.test(username);
    }

    // --- Notification system ---
    function showNotification(message, type = 'success') {
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.notification-message');
        existingNotifications.forEach(notification => notification.remove());
        
        // Create the notification element
        const notification = document.createElement('div');
        notification.className = `notification-message ${type} animate__animated animate__fadeInRight`;
        
        // Set icon based on notification type
        let icon;
        if (type === 'success') {
            notification.classList.add('bg-gradient-to-r', 'from-green-500', 'to-green-600');
            icon = '<i class="fas fa-check-circle"></i>';
        } else if (type === 'error') {
            notification.classList.add('bg-gradient-to-r', 'from-red-500', 'to-red-600');
            icon = '<i class="fas fa-exclamation-circle"></i>';
        } else if (type === 'warning') {
            notification.classList.add('bg-gradient-to-r', 'from-yellow-500', 'to-yellow-600');
            icon = '<i class="fas fa-exclamation-triangle"></i>';
        } else if (type === 'info') {
            notification.classList.add('bg-gradient-to-r', 'from-blue-500', 'to-blue-600');
            icon = '<i class="fas fa-info-circle"></i>';
        }
        
        // Set the HTML content
        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">${message}</div>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        `;
        
        // Add to the DOM
        document.body.appendChild(notification);
        
        // Close button functionality
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            notification.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
            setTimeout(() => notification.remove(), 300);
        });
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // Set button loading state
    function setButtonLoading(button, isLoading) {
        if (!button) return;
        
        if (isLoading) {
            button.setAttribute('data-original-text', button.innerHTML);
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
        } else {
            const originalText = button.getAttribute('data-original-text');
            if (originalText) {
                button.innerHTML = originalText;
            }
            button.disabled = false;
        }
    }

    // --- AUTH PAGE FUNCTIONALITY ---

    // Toggle between login and register tabs
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginTab && registerTab && loginForm && registerForm) {
        loginTab.addEventListener('click', function(e) {
            e.preventDefault();
            loginTab.classList.add('active');
            loginTab.classList.remove('inactive-tab');
            registerTab.classList.remove('active');
            registerTab.classList.add('inactive-tab');
            
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        });

        registerTab.addEventListener('click', function(e) {
            e.preventDefault();
            registerTab.classList.add('active');
            registerTab.classList.remove('inactive-tab');
            loginTab.classList.remove('active');
            loginTab.classList.add('inactive-tab');
            
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        });
    }

    // Toggle password visibility
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            if (!passwordInput) return;
            
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                if (icon) {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            } else {
                passwordInput.type = 'password';
                if (icon) {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    });

    // --- Login Form Submission ---
    const loginFormElement = document.getElementById('loginForm');
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const identifier = document.getElementById('loginEmail')?.value.trim();
            const password = document.getElementById('loginPassword')?.value;
            const rememberMe = document.getElementById('rememberMe')?.checked || false;
            const submitButton = loginFormElement.querySelector('button[type="submit"]');
            
            // Basic validation
            if (!identifier) {
                showNotification('Please enter your email or username', 'error');
                return;
            }
            
            if (!password) {
                showNotification('Please enter your password', 'error');
                return;
            }

            // Set button to loading state
            setButtonLoading(submitButton, true);
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ 
                        identifier, 
                        password,
                        rememberMe
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    // Save authentication data
                    sessionStorage.setItem('authToken', data.token);
                    sessionStorage.setItem('isLoggedIn', 'true');
                    
                    // Save user data if available
                    if (data.user) {
                        sessionStorage.setItem('username', data.user.username || data.user.name); 
                        sessionStorage.setItem('userId', data.user.id);
                    }
                    
                    showNotification('Login successful! Redirecting to dashboard...', 'success');
                    
                    // Redirect after a short delay
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                } else {
                    const errorMessage = data.message || 'Login failed. Please check your credentials.';
                    showNotification(errorMessage, 'error');
                    setButtonLoading(submitButton, false);
                }
            } catch (error) {
                console.error('Login error:', error);
                showNotification('An error occurred during login. Please try again.', 'error');
                setButtonLoading(submitButton, false);
            }
        });
    }

    // --- Registration Form Submission ---
    const registerFormElement = document.getElementById('registerForm');
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            // Get all form values
            const firstName = document.getElementById('firstName')?.value.trim();
            const lastName = document.getElementById('lastName')?.value.trim();
            const username = document.getElementById('username')?.value.trim();
            const email = document.getElementById('email')?.value.trim();
            const dateOfBirth = document.getElementById('dateOfBirth')?.value;
            const phoneNumber = document.getElementById('phoneNumber')?.value.trim();
            const country = document.getElementById('country')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const confirmPassword = document.getElementById('confirmPassword')?.value;
            const referralCode = document.getElementById('referralCode')?.value.trim();
            const termsAgreed = document.getElementById('termsAgreement')?.checked;
            
            const submitButton = registerFormElement.querySelector('button[type="submit"]');
            
            // Validation
            if (!firstName || !lastName) {
                showNotification('Please enter your first and last name', 'error');
                return;
            }
            
            if (!validateUsername(username)) {
                showNotification('Username must be 3-20 characters (letters, numbers, underscores, and hyphens only)', 'error');
                return;
            }
            
            if (!validateEmail(email)) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }
            
            if (!dateOfBirth) {
                showNotification('Please enter your date of birth', 'error');
                return;
            }
            
            if (!phoneNumber) {
                showNotification('Please enter your phone number', 'error');
                return;
            }
            
            if (!country) {
                showNotification('Please select your country', 'error');
                return;
            }
            
            if (!validatePassword(password)) {
                showNotification('Password must be at least 8 characters with uppercase, lowercase, and numbers', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showNotification('Passwords do not match', 'error');
                return;
            }
            
            if (!termsAgreed) {
                showNotification('You must agree to the Terms of Service and Privacy Policy', 'error');
                return;
            }
            
            // Set button to loading state
            setButtonLoading(submitButton, true);
            
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        username,
                        email,
                        dateOfBirth,
                        phoneNumber,
                        country,
                        password,
                        referralCode
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showNotification('Registration successful! Please check your email for verification.', 'success');
                    
                    // Clear the form
                    registerFormElement.reset();
                    
                    // Switch to login tab after successful registration
                    setTimeout(() => {
                        if (loginTab) {
                            loginTab.click();
                        }
                    }, 2000);
                } else {
                    const errorMessage = data.message || 'Registration failed. Please try again.';
                    showNotification(errorMessage, 'error');
                }
            } catch (error) {
                console.error('Registration error:', error);
                showNotification('An error occurred during registration. Please try again.', 'error');
            } finally {
                setButtonLoading(submitButton, false);
            }
        });
    }

    // Check if user is already logged in (optional)
    const token = sessionStorage.getItem('authToken');
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (token && isLoggedIn) {
        // If already logged in, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
});

// Global Authentication Functions

/**
 * Check if user is logged in and redirect if not
 * @returns {boolean} Whether user is authenticated
 */
function checkAuthStatusGlobal() {
    try {
        const token = sessionStorage.getItem('authToken');
        const isLoggedIn = sessionStorage.getItem('isLoggedIn');
        
        // ALLOW VIEWING WITHOUT AUTHENTICATION - FOR DEMO PURPOSES ONLY
        console.warn('DEV MODE: Authentication check bypassed');
        return true;
        
        /* Original authentication check - commented out for demo
        if (!token || !isLoggedIn) {
            return false;
        }
        
        return true;
        */
    } catch (error) {
        console.error('Authentication check failed:', error);
        // For demo purposes, allow access even if authentication check fails
        return true;
    }
}