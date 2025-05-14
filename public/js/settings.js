/**
 * @fileoverview Settings page functionality including toggle switches, modals, form validations
 * and user settings management with backend integration.
 * @version 2.0.0
 * @date 2025-05-03
 */

// API Endpoints for Settings
const API_ENDPOINTS = {
    getUserSettings: '/api/settings/user',
    updateUserSettings: '/api/settings/user',
    getUserProfile: '/api/profile',
    updateUserProfile: '/api/profile/update',
    uploadProfilePicture: '/api/profile/upload-picture',
    changePassword: '/api/auth/change-password',
    changePin: '/api/wallet/change-pin',
    getCookiePreferences: '/api/settings/cookies',
    updateCookiePreferences: '/api/settings/cookies',
    deactivateAccount: '/api/auth/deactivate'
};

/**
 * Fetches user settings or profile data from the backend.
 * @param {string} endpoint - The API endpoint to fetch from.
 * @returns {Promise<object|null>} The fetched data or null on error.
 */
async function fetchUserData(endpoint) {
    try {
        const token = getUserToken(); // Get the token
        if (!token) {
            console.error('Authentication token not found. Please log in.');
            throw new Error('Authentication token not found. Please log in.');
        }
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Add the token here
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.error('Unauthorized. Token might be invalid or expired.');
            }
            throw new Error(`Failed to fetch data from ${endpoint}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching user data:', error);
        showFeedbackMessage('Failed to load settings. Please try again.', 'error');
        return null;
    }
}

/**
 * Sends updated settings or profile data to the backend.
 * @param {string} endpoint - The API endpoint to send data to.
 * @param {object} data - The data payload to send.
 * @param {string} method - HTTP method (default: 'POST').
 * @returns {Promise<object|null>} The response data or null on error.
 */
async function updateUserData(endpoint, data, method = 'POST') {
    try {
        const token = getUserToken(); // Get the token
        if (!token) {
            console.error('Authentication token not found. Please log in.');
            throw new Error('Authentication token not found. Please log in.');
        }
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Add the token here
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('Unauthorized. Token might be invalid or expired.');
            }
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to update data at ${endpoint}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error updating user data:', error);
        showFeedbackMessage(error.message || 'Failed to save settings. Please try again.', 'error');
        return null;
    }
}

/**
 * Shows a feedback message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success', 'error', 'warning', 'info')
 */
function showFeedbackMessage(message = 'Settings saved successfully!', type = 'success') {
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (!feedbackMessage) return;

    // Clear existing classes and set base class
    feedbackMessage.className = 'feedback-message'; 
    
    // Add appropriate styling based on type
    switch (type) {
        case 'success':
            feedbackMessage.classList.add('bg-green-500', 'text-white');
            feedbackMessage.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${message}`;
            break;
        case 'error':
            feedbackMessage.classList.add('bg-red-500', 'text-white');
            feedbackMessage.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i> ${message}`;
            break;
        case 'warning':
            feedbackMessage.classList.add('bg-yellow-500', 'text-white');
            feedbackMessage.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i> ${message}`;
            break;
        case 'info':
            feedbackMessage.classList.add('bg-blue-500', 'text-white');
            feedbackMessage.innerHTML = `<i class="fas fa-info-circle mr-2"></i> ${message}`;
            break;
        default:
            feedbackMessage.classList.add('bg-gray-700', 'text-white');
            feedbackMessage.innerHTML = message;
    }
    
    // Show and then hide after animation
    feedbackMessage.classList.add('show');
    setTimeout(() => {
        feedbackMessage.classList.remove('show');
    }, 3000); // Hide after 3 seconds
}

/**
 * Handles the profile picture upload to the backend.
 */
function handleProfilePictureUpload() {
    const fileInput = document.getElementById('profilePictureUpload');
    const profilePicElements = document.querySelectorAll('.profile-picture, #profilePreview'); // Select all elements displaying the profile pic
    
    if (!fileInput || !profilePicElements.length) return;
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const token = getUserToken(); // Get the token
        if (!token) {
            console.error('Authentication token not found. Please log in.');
            showFeedbackMessage('Authentication token not found. Please log in.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('profilePicture', file);

        // Show loading state (optional)
        profilePicElements.forEach(el => el.style.opacity = '0.5');

        try {
            const response = await fetch(API_ENDPOINTS.uploadProfilePicture, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}` // Add the token here
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload profile picture.');
            }

            const data = await response.json();
            const newImageUrl = data.imageUrl; // Assuming the API returns the new image URL

            // Update profile picture elements with the new URL
            profilePicElements.forEach(el => {
                el.src = newImageUrl;
                el.style.opacity = '1'; // Restore opacity
            });

            showFeedbackMessage('Profile picture updated successfully!', 'success');

        } catch (error) {
            console.error('Error uploading profile picture:', error);
            showFeedbackMessage(error.message, 'error');
            profilePicElements.forEach(el => el.style.opacity = '1'); // Restore opacity on error
        }
    });
}

/**
 * Initializes the password strength meter
 */
function initPasswordStrengthMeter() {
    const passwordInput = document.getElementById('newPassword');
    const confirmInput = document.getElementById('confirmPassword');
    const strengthBar = document.getElementById('passwordStrength');
    const lengthCheck = document.getElementById('lengthCheck');
    const uppercaseCheck = document.getElementById('uppercaseCheck');
    const specialCharCheck = document.getElementById('specialCharCheck');
    const matchMessage = document.getElementById('passwordMatchMessage');
    
    if (!passwordInput || !strengthBar) return;
    
    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        let strength = 0;
        let requirementsMet = { length: false, uppercase: false, special: false };

        // Length check
        if (password.length >= 8) {
            strength += 33;
            requirementsMet.length = true;
            lengthCheck.innerHTML = '<i class="fas fa-check text-green-500 mr-1"></i> At least 8 characters';
        } else {
            lengthCheck.innerHTML = '<i class="fas fa-times text-red-500 mr-1"></i> At least 8 characters';
        }

        // Uppercase check
        if (/[A-Z]/.test(password)) {
            strength += 33;
            requirementsMet.uppercase = true;
            uppercaseCheck.innerHTML = '<i class="fas fa-check text-green-500 mr-1"></i> At least 1 uppercase letter';
        } else {
            uppercaseCheck.innerHTML = '<i class="fas fa-times text-red-500 mr-1"></i> At least 1 uppercase letter';
        }

        // Special character check
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            strength += 34; // Make it add up to 100
            requirementsMet.special = true;
            specialCharCheck.innerHTML = '<i class="fas fa-check text-green-500 mr-1"></i> At least 1 special character';
        } else {
            specialCharCheck.innerHTML = '<i class="fas fa-times text-red-500 mr-1"></i> At least 1 special character';
        }

        // Update strength bar
        strengthBar.style.width = `${strength}%`;
        if (strength < 34) {
            strengthBar.className = 'bg-red-500 h-full';
        } else if (strength < 67) {
            strengthBar.className = 'bg-yellow-500 h-full';
        } else {
            strengthBar.className = 'bg-green-500 h-full';
        }

        // Check password match if confirm input exists
        if (confirmInput) checkPasswordMatch();
    });
    
    // Check if passwords match
    if (confirmInput && matchMessage) {
        confirmInput.addEventListener('input', checkPasswordMatch);
    }
    
    function checkPasswordMatch() {
        if (passwordInput.value === confirmInput.value) {
            matchMessage.classList.add('hidden');
            confirmInput.classList.remove('border-red-500');
        } else {
            matchMessage.classList.remove('hidden');
            confirmInput.classList.add('border-red-500');
        }
    }
}

/**
 * Handles the change password form submission to the backend.
 */
function initChangePasswordForm() {
    const form = document.getElementById('changePasswordForm');
    const submitButton = document.getElementById('submitPasswordChange');
    if (!form || !submitButton) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showFeedbackMessage('New passwords do not match.', 'error');
            return;
        }

        // Basic strength check (can be more sophisticated)
        if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
             showFeedbackMessage('New password does not meet strength requirements.', 'error');
             return;
        }

        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Changing...';

        const result = await updateUserData(API_ENDPOINTS.changePassword, {
            currentPassword,
            newPassword
        });

        // Re-enable button and reset text
        submitButton.disabled = false;
        submitButton.innerHTML = 'Change Password';

        if (result) {
            showFeedbackMessage('Password changed successfully!', 'success');
            closePasswordModal();
            form.reset(); // Clear the form
        } 
        // Error message is handled by updateUserData
    });
}

/**
 * Opens the change password modal
 */
function openPasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Optionally reset form fields when opening
        const form = document.getElementById('changePasswordForm');
        if (form) form.reset();
        // Reset strength meter and match message
        const strengthBar = document.getElementById('passwordStrength');
        if (strengthBar) strengthBar.style.width = '0%';
        const matchMessage = document.getElementById('passwordMatchMessage');
        if (matchMessage) matchMessage.classList.add('hidden');
    }
}

/**
 * Closes the change password modal
 */
function closePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Opens the change PIN modal
 */
function openPinModal() {
    const modal = document.getElementById('changePinModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Optionally reset form fields
        const form = document.getElementById('changePinForm');
        if (form) form.reset();
        const matchMessage = document.getElementById('pinMatchMessage');
        if (matchMessage) matchMessage.classList.add('hidden');
    }
}

/**
 * Closes the change PIN modal
 */
function closePinModal() {
    const modal = document.getElementById('changePinModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Opens the cookie preferences modal
 */
function openCookieModal() {
    const modal = document.getElementById('cookieModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Optionally load current preferences when opening
        loadCookiePreferences(); 
    }
}

/**
 * Closes the cookie preferences modal
 */
function closeCookieModal() {
    const modal = document.getElementById('cookieModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Opens the edit profile modal and loads current data
 */
async function openProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.classList.remove('hidden');
        await loadProfileDataIntoModal(); // Load data when modal opens
    }
}

/**
 * Closes the edit profile modal
 */
function closeProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Initializes toggle switches, fetches state from backend, and sets up change handlers.
 */
async function initToggleSwitches() {
    const settings = await fetchUserData(API_ENDPOINTS.getUserSettings);
  /*  if (!settings) {
        console.error("Could not load user settings for toggles.");
        // Optionally set default states or show error
        return;
    }
*/
    const toggles = {
        'twoFactorToggle': settings.twoFactorEnabled || false,
        'emailNotificationsToggle': settings.notifications?.emailEnabled || true,
        'investmentUpdatesToggle': settings.notifications?.investmentUpdates || true,
        'balanceChangesToggle': settings.notifications?.balanceChanges || true,
        'referralActivityToggle': settings.notifications?.referralActivity || true,
        'autoReinvestToggle': settings.wallet?.autoReinvest || false,
        'darkModeToggle': settings.appearance?.darkMode || false, // Keep dark mode potentially client-side? Or sync?
        'activityLogsToggle': settings.privacy?.activityLogsEnabled || true,
        'publicProfileToggle': settings.privacy?.publicProfile || false,
    };
    
    Object.keys(toggles).forEach(toggleId => {
        const toggleElement = document.getElementById(toggleId);
        if (toggleElement) {
            toggleElement.checked = toggles[toggleId];

            // Add change listener to update backend
            toggleElement.addEventListener('change', async (e) => {
                const newState = e.target.checked;
                const settingKey = toggleId.replace('Toggle', ''); // Simple key mapping

                // Prepare data payload based on toggle ID structure
                let updateData = {};
                if (settingKey.includes('Notifications') || settingKey === 'emailNotifications') {
                    updateData.notifications = { [settingKey.replace('Notifications', '').replace('email','emailEnabled')]: newState };
                } else if (settingKey === 'twoFactor') {
                    updateData[`${settingKey}Enabled`] = newState;
                } else if (settingKey === 'autoReinvest') {
                    updateData.wallet = { autoReinvest: newState };
                } else if (settingKey === 'darkMode') {
                    updateData.appearance = { darkMode: newState };
                    // Apply dark mode immediately (client-side)
                    document.body.classList.toggle('dark-mode', newState); 
                } else if (settingKey === 'activityLogs' || settingKey === 'publicProfile') {
                     updateData.privacy = { [`${settingKey}Enabled`]: newState };
                     if(settingKey === 'publicProfile') updateData.privacy = { publicProfile: newState };
                } else {
                    updateData[settingKey] = newState; // Fallback
                }

                const result = await updateUserData(API_ENDPOINTS.updateUserSettings, updateData, 'PATCH'); // Use PATCH for partial updates
                if (result) {
                    showFeedbackMessage('Setting updated.', 'success');
                    handleSpecialToggleCases(toggleId, newState); // Handle UI changes like showing 2FA options
                } else {
                    // Revert toggle state on failure
                    e.target.checked = !newState; 
                    // If the failed update was for dark mode, revert the body class as well
                    if (settingKey === 'darkMode') {
                        document.body.classList.toggle('dark-mode', !newState);
                    }
                }
            });

            // Initial UI handling for special cases (like 2FA)
            handleSpecialToggleCases(toggleId, toggleElement.checked);
        }
    });
    
    /**
     * Handles special UI changes based on toggle state (e.g., show/hide 2FA setup).
     * @param {string} toggleId - ID of the toggle element
     * @param {boolean} state - The current state of the toggle (checked or unchecked)
     */
    function handleSpecialToggleCases(toggleId, state) {
        if (toggleId === 'twoFactorToggle') {
            const twoFactorOptions = document.getElementById('twoFactorOptions');
            if (twoFactorOptions) {
                twoFactorOptions.classList.toggle('hidden', !state);
                // If enabling, might need to fetch QR code/setup info here
            }
        }
        // Add other special cases if needed
    }
}

/**
 * Initializes the PIN change form submission to the backend.
 */
function initPinChangeForm() {
    const form = document.getElementById('changePinForm');
    const submitButton = document.getElementById('submitPinChange');
    if (!form || !submitButton) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPin = document.getElementById('currentPin').value;
        const newPin = document.getElementById('newPin').value;
        const confirmPin = document.getElementById('confirmPin').value;

        if (newPin !== confirmPin) {
            showFeedbackMessage('New PINs do not match.', 'error');
            document.getElementById('pinMatchMessage').classList.remove('hidden');
            return;
        } else {
             document.getElementById('pinMatchMessage').classList.add('hidden');
        }

        if (!/^\d{6}$/.test(newPin)) {
            showFeedbackMessage('PIN must be exactly 6 digits.', 'error');
            return;
        }

        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Changing...';

        const result = await updateUserData(API_ENDPOINTS.changePin, {
            currentPin,
            newPin
        });

        // Re-enable button and reset text
        submitButton.disabled = false;
        submitButton.innerHTML = 'Change PIN';

        if (result) {
            showFeedbackMessage('Withdrawal PIN changed successfully!', 'success');
            closePinModal();
            form.reset(); // Clear the form
        }
        // Error message handled by updateUserData
    });
}

/**
 * Loads and initializes the cookie preferences form.
 */
async function initCookiePreferencesForm() {
    const form = document.getElementById('cookiePreferencesForm');
    if (!form) return;

    // Load current preferences
    await loadCookiePreferences();

    // Accept all button
    const acceptAllBtn = document.getElementById('acceptAllCookies');
    if (acceptAllBtn) {
        acceptAllBtn.addEventListener('click', () => {
            setCookieToggles(true);
            saveCookiePreferences(); // Save immediately
        });
    }
    
    // Reject all button
    const rejectAllBtn = document.getElementById('rejectAllCookies');
    if (rejectAllBtn) {
        rejectAllBtn.addEventListener('click', () => {
            setCookieToggles(false);
            saveCookiePreferences(); // Save immediately
        });
    }
    
    // Form submission (Save Preferences button)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCookiePreferences();
    });
}

/** Helper to load cookie preferences from backend */
async function loadCookiePreferences() {
    const prefs = await fetchUserData(API_ENDPOINTS.getCookiePreferences);
    if (prefs) {
        const performanceToggle = document.getElementById('performanceCookiesToggle');
        const functionalityToggle = document.getElementById('functionalityCookiesToggle');
        const marketingToggle = document.getElementById('marketingCookiesToggle');

        if (performanceToggle) performanceToggle.checked = prefs.performance || false;
        if (functionalityToggle) functionalityToggle.checked = prefs.functionality || false;
        if (marketingToggle) marketingToggle.checked = prefs.marketing || false;
    }
}

/** Helper to set all optional cookie toggles */
function setCookieToggles(state) {
    const performanceToggle = document.getElementById('performanceCookiesToggle');
    const functionalityToggle = document.getElementById('functionalityCookiesToggle');
    const marketingToggle = document.getElementById('marketingCookiesToggle');
    if (performanceToggle) performanceToggle.checked = state;
    if (functionalityToggle) functionalityToggle.checked = state;
    if (marketingToggle) marketingToggle.checked = state;
}

/** Helper to save cookie preferences to backend */
async function saveCookiePreferences() {
    const performance = document.getElementById('performanceCookiesToggle')?.checked || false;
    const functionality = document.getElementById('functionalityCookiesToggle')?.checked || false;
    const marketing = document.getElementById('marketingCookiesToggle')?.checked || false;

    const submitButton = document.getElementById('saveCookiePreferences');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    }

    const result = await updateUserData(API_ENDPOINTS.updateCookiePreferences, {
        performance,
        functionality,
        marketing
    }, 'PATCH');

    if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Save Preferences';
    }

    if (result) {
        showFeedbackMessage('Cookie preferences saved.', 'success');
        closeCookieModal();
    }
}

/**
 * Initializes the language selector, loads from backend, saves changes.
 */
async function initLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect) return;

    const settings = await fetchUserData(API_ENDPOINTS.getUserSettings);
    const savedLanguage = settings?.appearance?.language || 'en'; // Default to 'en'

    languageSelect.value = savedLanguage;
    
    languageSelect.addEventListener('change', async () => {
        const newLanguage = languageSelect.value;
        const result = await updateUserData(API_ENDPOINTS.updateUserSettings, {
            appearance: { language: newLanguage }
        }, 'PATCH');

        if (result) {
            showFeedbackMessage('Language preference updated.', 'success');
            // Potentially reload the page or dynamically load language strings
            // location.reload(); 
        } else {
            // Revert selection if save failed
            languageSelect.value = savedLanguage;
        }
    });
}

/**
 * Handles the in-place email editing (requires backend confirmation).
 * This is simplified; a real implementation needs verification steps.
 */
function initEmailEditor() {
    const changeEmailBtn = document.getElementById('changeEmailBtn');
    const userEmailSpan = document.getElementById('userEmail');
    
    if (!changeEmailBtn || !userEmailSpan) return;
    
    changeEmailBtn.addEventListener('click', () => {
        const currentEmail = userEmailSpan.textContent.trim();
        const newEmail = prompt('Enter new email address:', currentEmail);

        if (newEmail && newEmail !== currentEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            console.warn("Email change initiated. Backend verification needed.");
            showFeedbackMessage('Verification email sent to the new address.', 'info');
        } else if (newEmail && newEmail !== currentEmail) {
            showFeedbackMessage('Invalid email format.', 'error');
        }
    });
}

/**
 * Initializes account action buttons to trigger backend API calls.
 */
function initAccountActions() {
    // Deactivate Account button
    const deactivateAccountBtn = document.getElementById('deactivateAccountBtn');
    if (deactivateAccountBtn) {
        deactivateAccountBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to deactivate your account? This action cannot be undone easily.')) return;
            
            const password = prompt("Please enter your password to confirm deactivation:");
            if (!password) return;

            const result = await updateUserData(API_ENDPOINTS.deactivateAccount, { password });
            if (result) {
                showFeedbackMessage('Account deactivated successfully. You will be logged out.', 'success');
                setTimeout(() => { window.location.href = '/logout'; }, 3000); 
            } else {
                 showFeedbackMessage('Failed to deactivate account. Please check your password.', 'error');
            }
        });
    }
}

/**
 * Initializes the save settings button (might be less needed if saving individually).
 * Kept for potential bulk profile updates or as a fallback.
 */
function initSaveSettingsButton() {
    const saveButton = document.getElementById('saveSettingsBtn');
    if (!saveButton) return;
    
    saveButton.addEventListener('click', () => {
        console.log("Save Settings button clicked - individual settings should save on change.");
        showFeedbackMessage('Settings are saved automatically on change.', 'info');
    });
}

/**
 * Loads user profile data from the backend and updates the UI.
 */
async function loadUserProfile() {
    const apiResponse = await fetchUserData(API_ENDPOINTS.getUserProfile);

    if (!apiResponse || !apiResponse.success || !apiResponse.profile) {
        console.error('Failed to load user profile data or profile data is missing in the response.');
        // Fallback UI updates
        const profileNameElement = document.getElementById('userProfileName');
        if (profileNameElement) profileNameElement.textContent = 'User';

        const userEmailSpan = document.getElementById('userEmail');
        if (userEmailSpan) userEmailSpan.textContent = 'Unable to load email';

        const profilePicDisplay = document.getElementById('profilePictureDisplay');
        if (profilePicDisplay) profilePicDisplay.src = 'https://randomuser.me/api/portraits/men/32.jpg'; // Default image

        const verificationBadge = document.querySelector('.bg-green-100.text-green-700');
        if (verificationBadge) verificationBadge.style.display = 'none';
        return;
    }

    const userProfile = apiResponse.profile; // Use the nested profile object

    const profileNameElement = document.getElementById('userProfileName');
    const userEmailSpan = document.getElementById('userEmail');
    const profilePicElements = document.querySelectorAll('.profile-picture'); // Existing selector for profile picture(s)
    // The main display image has id="profilePictureDisplay" and class="profile-picture"

    if (profileNameElement) {
        profileNameElement.textContent = userProfile.fullName || 'User';
    }

    if (userEmailSpan) {
        // Check privacy settings for email
        if (userProfile.privacy && typeof userProfile.privacy.showEmail === 'boolean') {
            if (userProfile.privacy.showEmail) {
                userEmailSpan.textContent = userProfile.email || 'No email set';
                const changeEmailBtn = document.getElementById('changeEmailBtn');
                if (changeEmailBtn) changeEmailBtn.style.display = 'inline-block'; // Or 'block' depending on original style
            } else {
                userEmailSpan.textContent = 'Email hidden by privacy settings';
                const changeEmailBtn = document.getElementById('changeEmailBtn');
                if (changeEmailBtn) changeEmailBtn.style.display = 'none';
            }
        } else {
            // Fallback if privacy settings are not structured as expected, but email might still be available
            userEmailSpan.textContent = userProfile.email || 'Email display preference not set';
            const changeEmailBtn = document.getElementById('changeEmailBtn');
            if (changeEmailBtn) changeEmailBtn.style.display = 'inline-block'; // Show if email is shown
        }
    }

    if (profilePicElements.length) {
        profilePicElements.forEach(el => {
            // Ensure the src is updated from userProfile
            el.src = userProfile.profilePictureUrl || 'https://randomuser.me/api/portraits/men/32.jpg'; // Default placeholder
        });
    }

    const verificationBadge = document.querySelector('.bg-green-100.text-green-700');
    if (verificationBadge) {
        if (userProfile.isVerified) {
            verificationBadge.style.display = 'flex'; // Show badge
        } else {
            verificationBadge.style.display = 'none'; // Hide badge
        }
    }
    
    // Premium badge logic can be added here if it's dynamic
    // const premiumBadge = document.querySelector('.bg-indigo-100.text-indigo-700');
    //  if (premiumBadge) {
    //     if (userProfile.isPremium) { // Assuming a property like userProfile.isPremium
    //         premiumBadge.style.display = 'flex';
    //     } else {
    //         premiumBadge.style.display = 'none';
    //     }
    //  }
}

/** Loads profile data specifically into the Edit Profile Modal fields */
async function loadProfileDataIntoModal() {
    const profile = await fetchUserData(API_ENDPOINTS.getUserProfile);
    if (!profile) return;

    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('profileEmail');
    const phoneInput = document.getElementById('phoneNumber');
    const bioInput = document.getElementById('userBio');
    const countrySelect = document.getElementById('country');
    const timezoneSelect = document.getElementById('timezone');
    const showEmailToggle = document.getElementById('showEmailToggle');
    const publicProfileToggleModal = document.getElementById('publicProfileToggleModal');
    const profilePreview = document.getElementById('profilePreview');

    if (fullNameInput) fullNameInput.value = profile.fullName || '';
    if (emailInput) emailInput.value = profile.email || '';
    if (phoneInput) phoneInput.value = profile.phoneNumber || '';
    if (bioInput) bioInput.value = profile.bio || '';
    if (countrySelect) countrySelect.value = profile.location?.country || '';
    if (timezoneSelect) timezoneSelect.value = profile.location?.timezone || '';
    if (showEmailToggle) showEmailToggle.checked = profile.privacy?.showEmail || false;
    if (publicProfileToggleModal) publicProfileToggleModal.checked = profile.privacy?.publicProfile || false;
    if (profilePreview) profilePreview.src = profile.profilePictureUrl || 'https://via.placeholder.com/100';
}

/**
 * Initializes the edit profile form, loads data, and handles submission.
 */
function initEditProfileForm() {
    const form = document.getElementById('editProfileForm');
    const saveButton = document.getElementById('saveProfileChanges');
    if (!form || !saveButton) return;

    const profilePictureUploadModal = document.getElementById('profilePictureUploadModal');
    const profilePreview = document.getElementById('profilePreview');
    if (profilePictureUploadModal && profilePreview) {
         profilePictureUploadModal.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    profilePreview.src = event.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const profileData = {
            fullName: document.getElementById('fullName')?.value,
            email: document.getElementById('profileEmail')?.value,
            phoneNumber: document.getElementById('phoneNumber')?.value,
            bio: document.getElementById('userBio')?.value,
            country: document.getElementById('country')?.value,
            timezone: document.getElementById('timezone')?.value,
            privacy_showEmail: document.getElementById('showEmailToggle')?.checked,
            privacy_publicProfile: document.getElementById('publicProfileToggleModal')?.checked,
        };

        const pictureInput = document.getElementById('profilePictureUploadModal');
        const pictureFile = pictureInput?.files[0];
        
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

        let updateSuccess = false;
        let pictureUploadSuccess = true;

        if (pictureFile) {
             const formData = new FormData();
             formData.append('profilePicture', pictureFile);
             const token = getUserToken();
             if (!token) {
                console.error('Authentication token not found for picture upload.');
                showFeedbackMessage('Authentication token not found. Please log in.', 'error');
                saveButton.disabled = false;
                saveButton.innerHTML = 'Save Changes';
                return;
             }
             try {
                const picResponse = await fetch(API_ENDPOINTS.uploadProfilePicture, { 
                    method: 'POST', 
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData 
                });
                if (!picResponse.ok) throw new Error('Failed to upload profile picture.');
                const picData = await picResponse.json();
                profileData.profilePictureUrl = picData.imageUrl;
                pictureUploadSuccess = true;
                document.querySelectorAll('.profile-picture').forEach(el => el.src = picData.imageUrl);
             } catch (error) {
                 console.error(error);
                 showFeedbackMessage('Failed to upload profile picture.', 'error');
                 pictureUploadSuccess = false;
             }
        }

        if (pictureUploadSuccess) {
            const result = await updateUserData(API_ENDPOINTS.updateUserProfile, profileData, 'PATCH');
            if (result) {
                updateSuccess = true;
                await loadUserProfile(); 
            }
        }

        saveButton.disabled = false;
        saveButton.innerHTML = 'Save Changes';

        if (updateSuccess) {
            showFeedbackMessage('Profile updated successfully!', 'success');
            closeProfileModal();
        }
    });
    
    const cancelButton = document.getElementById('cancelProfileEdit');
    if (cancelButton) {
        cancelButton.addEventListener('click', closeProfileModal);
    }
}

/**
 * Retrieves the user token from sessionStorage or localStorage.
 * Redirects to login if no token is found.
 * @returns {string|null} The token or null if not found.
 */
function getUserToken() {
    // First check sessionStorage (where login might store it as 'authToken')
    const sessionToken = sessionStorage.getItem('authToken');
    if (sessionToken) {
        return sessionToken;
    }

    // Fall back to localStorage if not found in sessionStorage (e.g., 'token')
    const localToken = localStorage.getItem('token');

    // If no token is found in either storage, redirect to login for settings page
    if (!localToken && !sessionToken) { // Check both before redirecting
        console.warn('No authentication token found, redirecting to login');
        window.location.href = '/auth.html?redirect=settings.html'; // Correct redirect for settings
        return null;
    }

    return localToken || sessionToken; // Return whichever token was found (localToken could be null here if only sessionToken was found)
}

// Initialize all functionalities when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();
    await initToggleSwitches();
    await initLanguageSelector();
    
    handleProfilePictureUpload();
    initPasswordStrengthMeter();
    initChangePasswordForm();
    initPinChangeForm();
    initCookiePreferencesForm();
    initEmailEditor();
    initAccountActions();
    initSaveSettingsButton();
    initEditProfileForm();
    
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const closePasswordModalBtn = document.getElementById('closePasswordModal');
    const cancelPasswordBtn = document.getElementById('cancelPasswordChange');
    
    if (changePasswordBtn) changePasswordBtn.onclick = openPasswordModal;
    if (closePasswordModalBtn) closePasswordModalBtn.onclick = closePasswordModal;
    if (cancelPasswordBtn) cancelPasswordBtn.onclick = closePasswordModal;
    
    const changeWithdrawalPINBtn = document.getElementById('changeWithdrawalPINBtn');
    const closePinModalBtn = document.getElementById('closePinModal');
    const cancelPinBtn = document.getElementById('cancelPinChange');
    
    if (changeWithdrawalPINBtn) changeWithdrawalPINBtn.onclick = openPinModal;
    if (closePinModalBtn) closePinModalBtn.onclick = closePinModal;
    if (cancelPinBtn) cancelPinBtn.onclick = closePinModal;
    
    const cookiePreferencesBtn = document.getElementById('cookiePreferencesBtn');
    const closeCookieModalBtn = document.getElementById('closeCookieModal');
    
    if (cookiePreferencesBtn) cookiePreferencesBtn.onclick = openCookieModal;
    if (closeCookieModalBtn) closeCookieModalBtn.onclick = closeCookieModal;
    
    const editProfileBtn = document.querySelector('.settings-card .settings-btn-primary'); 
    const closeProfileModalBtn = document.getElementById('closeProfileModal');
    
    if (editProfileBtn) editProfileBtn.onclick = openProfileModal;
    if (closeProfileModalBtn) closeProfileModalBtn.onclick = closeProfileModal;

    const settings = await fetchUserData(API_ENDPOINTS.getUserSettings);
    if (settings?.appearance?.darkMode) {
        document.body.classList.add('dark-mode');
    }
});