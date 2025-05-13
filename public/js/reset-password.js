/**
 * Password Reset JavaScript
 * Handles the password reset flow including request and reset steps
 */

document.addEventListener('DOMContentLoaded', function () {
    // Get step containers and forms
    const stepRequest = document.getElementById('step-request');
    const stepReset = document.getElementById('step-reset');
    const requestResetForm = document.getElementById('requestResetForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const requestSuccess = document.getElementById('requestSuccess');
    const resetSuccess = document.getElementById('resetSuccess');
    
    // Check which step we're on based on URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');
    
    // If there's a token in the URL, show the reset password step
    if (token) {
        stepRequest.classList.add('hidden');
        stepReset.classList.remove('hidden');
    }
    
    // Request reset link form submit
    if (requestResetForm) {
        requestResetForm.addEventListener('submit', handleRequestReset);
    }
    
    // Reset password form submit
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', handleResetPassword);
        initPasswordStrengthMeter();
    }
    
    /**
     * Display notification message to user
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (success, error, warning)
     */
    function showNotification(message, type = 'success') {
        // Remove any existing notifications
        const existingNotification = document.querySelector('.notification-message');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification-message animate__animated animate__fadeInRight';
        
        // Set background color based on type
        if (type === 'success') {
            notification.style.backgroundColor = '#10b981'; // Success green
        } else if (type === 'error') {
            notification.style.backgroundColor = '#ef4444'; // Error red
        } else if (type === 'warning') {
            notification.style.backgroundColor = '#f59e0b'; // Warning yellow
        } else if (type === 'info') {
            notification.style.backgroundColor = '#3b82f6'; // Info blue
        }
        
        // Set notification content
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="notification-content">
                ${message}
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add notification to DOM
        document.body.appendChild(notification);
        
        // Add event listener to close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.remove('animate__fadeInRight');
            notification.classList.add('animate__fadeOutRight');
            setTimeout(() => {
                notification.remove();
            }, 500);
        });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.classList.remove('animate__fadeInRight');
                notification.classList.add('animate__fadeOutRight');
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        notification.remove();
                    }
                }, 500);
            }
        }, 5000);
    }
    
    /**
     * Set button to loading state
     * @param {HTMLElement} button - Button element
     * @param {boolean} isLoading - Whether to show loading state
     */
    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            // Store original text
            button.setAttribute('data-original-text', button.textContent);
            // Change to loading state
            button.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Loading...`;
            button.disabled = true;
        } else {
            // If there's stored original text, restore it
            const originalText = button.getAttribute('data-original-text');
            if (originalText) {
                button.textContent = originalText;
            }
            button.disabled = false;
        }
    }
    
    /**
     * Check if password meets strength requirements
     * @param {string} password - Password to check
     * @returns {boolean} - Whether password is strong enough
     */
    function isPasswordStrong(password) {
        // Check minimum length (8 characters)
        const hasMinLength = password.length >= 8;
        
        // Check if contains uppercase
        const hasUppercase = /[A-Z]/.test(password);
        
        // Check if contains special characters
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        
        // Return true if meets all requirements
        return hasMinLength && hasUppercase && hasSpecialChar;
    }
    
    /**
     * Initialize password strength meter functionality
     */
    function initPasswordStrengthMeter() {
        const passwordInput = document.getElementById('newPassword');
        const strengthBar = document.getElementById('passwordStrength');
        const lengthCheck = document.getElementById('lengthCheck');
        const uppercaseCheck = document.getElementById('uppercaseCheck');
        const specialCharCheck = document.getElementById('specialCharCheck');
        
        // Add input event listener to password field
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            
            // Check requirements
            const hasMinLength = password.length >= 8;
            const hasUppercase = /[A-Z]/.test(password);
            const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
            
            // Update requirement indicators
            updateRequirementCheck(lengthCheck, hasMinLength);
            updateRequirementCheck(uppercaseCheck, hasUppercase);
            updateRequirementCheck(specialCharCheck, hasSpecialChar);
            
            // Calculate strength percentage
            let strength = 0;
            if (hasMinLength) strength += 33;
            if (hasUppercase) strength += 33;
            if (hasSpecialChar) strength += 34;
            
            // Update strength bar
            strengthBar.style.width = `${strength}%`;
            
            // Update color based on strength
            if (strength < 33) {
                strengthBar.className = 'bg-red-500';
            } else if (strength < 67) {
                strengthBar.className = 'bg-yellow-500';
            } else {
                strengthBar.className = 'bg-green-500';
            }
        });
        
        // Update confirm password field to check for matches
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const passwordMatchMessage = document.getElementById('passwordMatchMessage');
        
        confirmPasswordInput.addEventListener('input', function() {
            if (this.value && this.value !== passwordInput.value) {
                passwordMatchMessage.classList.remove('hidden');
            } else {
                passwordMatchMessage.classList.add('hidden');
            }
        });
    }
    
    /**
     * Update requirement check icon
     * @param {HTMLElement} element - Check element
     * @param {boolean} isValid - Whether requirement is met
     */
    function updateRequirementCheck(element, isValid) {
        const icon = element.querySelector('i');
        
        if (isValid) {
            icon.className = 'fas fa-check text-green-500 mr-1';
            element.classList.remove('text-red-500');
            element.classList.add('text-green-500');
        } else {
            icon.className = 'fas fa-times text-red-500 mr-1';
            element.classList.remove('text-green-500');
            element.classList.add('text-red-500');
        }
    }

    /**
     * Handle the request for a password reset link
     * @param {Event} e - Form submit event
     */
    async function handleRequestReset(e) {
        e.preventDefault();
    
        const email = document.getElementById('email').value;
        const requestResetBtn = document.getElementById('requestResetBtn');
    
        if (!email) {
            showNotification('Please enter your email address', 'error');
            return;
        }
    
        // Show loading state
        setButtonLoading(requestResetBtn, true);
    
        try {
            const response = await fetch('/api/auth/reset-password-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
        
            const data = await response.json();
        
            if (response.ok) {
                requestSuccess.classList.remove('hidden');
            
                // Disable the form to prevent multiple submissions
                document.getElementById('email').disabled = true;
                requestResetBtn.disabled = true;
            
                // Reset button state but keep it disabled
                setButtonLoading(requestResetBtn, false);
                requestResetBtn.textContent = 'Email Sent';
            } else {
                showNotification(data.message || 'Failed to send reset link. Please try again.', 'error');
                setButtonLoading(requestResetBtn, false);
            }
        } catch (error) {
            console.error('Error requesting password reset:', error);
            showNotification('An error occurred. Please try again later.', 'error');
        
            // Reset button state
            setButtonLoading(requestResetBtn, false);
        }
    }

    /**
     * Handle the password reset (setting a new password)
     * @param {Event} e - Form submit event
     */
    async function handleResetPassword(e) {
        e.preventDefault();
    
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    
        // Verify passwords match
        if (newPassword !== confirmPassword) {
            document.getElementById('passwordMatchMessage').classList.remove('hidden');
            return;
        }
    
        // Verify password strength
        if (!isPasswordStrong(newPassword)) {
            showNotification('Your password does not meet the strength requirements.', 'error');
            return;
        }
    
        // Show loading state
        setButtonLoading(resetPasswordBtn, true);
    
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const email = urlParams.get('email');

            if (!token || !email) {
                showNotification('Invalid reset link. Please request a new password reset.', 'error');
                setButtonLoading(resetPasswordBtn, false);
                return;
            }
        
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token,
                    email,
                    newPassword
                })
            });
        
            const data = await response.json();
        
            if (response.ok) {
                resetSuccess.classList.remove('hidden');
            
                // Disable the form
                document.getElementById('newPassword').disabled = true;
                document.getElementById('confirmPassword').disabled = true;
                resetPasswordBtn.disabled = true;
            
                // Reset button state but keep it disabled
                setButtonLoading(resetPasswordBtn, false);
                resetPasswordBtn.textContent = 'Password Reset Successfully';

                // Add a login redirect button
                const loginRedirect = document.createElement('div');
                loginRedirect.className = 'mt-4 text-center';
                loginRedirect.innerHTML = `
                    <a href="/auth.html" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
                        Go to Login
                    </a>
                `;
                document.querySelector('.card-body').appendChild(loginRedirect);
            } else {
                showNotification(data.message || 'Failed to reset password. Please try again.', 'error');
                setButtonLoading(resetPasswordBtn, false);
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            showNotification('An error occurred. Please try again later.', 'error');
        
            // Reset button state
            setButtonLoading(resetPasswordBtn, false);
        }
    }
});