document.addEventListener('DOMContentLoaded', () => {
    const adminLoginForm = document.getElementById('adminLoginForm');
    const errorMessageElement = document.getElementById('adminLoginErrorMessage');

    // Check if there's a login message from a previous session expiration
    const storedMessage = sessionStorage.getItem('adminLoginMessage');
    if (storedMessage) {
        errorMessageElement.textContent = storedMessage;
        errorMessageElement.style.display = 'block';
        // Clear the message so it doesn't show up on refresh
        sessionStorage.removeItem('adminLoginMessage');
    }

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorMessageElement.style.display = 'none';
            errorMessageElement.textContent = '';

            const emailOrUsernameValue = document.getElementById('emailOrUsername').value;
            const passwordValue = document.getElementById('password').value;

            // Show loading state
            const submitButton = adminLoginForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

            try {
                const response = await fetch('/api/auth/admin/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ identifier: emailOrUsernameValue, password: passwordValue }),
                });

                const data = await response.json();

                if (response.ok && data.token) {
                    // Store token in localStorage
                    localStorage.setItem('adminToken', data.token);
                    
                    // Store user info if available
                    if (data.user) {
                        localStorage.setItem('adminUser', JSON.stringify({
                            id: data.user.id,
                            name: data.user.name || `${data.user.firstName} ${data.user.lastName}`,
                            email: data.user.email,
                            role: data.user.role || 'admin'
                        }));
                    }
                    
                    // Redirect to the admin dashboard
                    window.location.href = '/admin.html'; 
                } else {
                    errorMessageElement.textContent = data.message || 'Admin login failed. Please check your credentials.';
                    errorMessageElement.style.display = 'block';
                    
                    // Reset button state
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                }
            } catch (error) {
                console.error('Admin login error:', error);
                errorMessageElement.textContent = 'Network error. Please check your internet connection and try again.';
                errorMessageElement.style.display = 'block';
                
                // Reset button state
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        });
    }
});
