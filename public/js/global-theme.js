// filepath: c:\Users\THIS PC\Desktop\qua\qua\public\js\global-theme.js
(async function () {
    function getUserToken() {
        // This function should be consistent with how you retrieve the token elsewhere (e.g., in settings.js)
        return sessionStorage.getItem('authToken');
    }

    async function fetchUserThemeSettings(token) {
        if (!token) {
            // console.log('GlobalTheme: No token, cannot fetch settings.');
            return null;
        }
        try {
            const response = await fetch('/api/settings/user', { // Your API endpoint for user settings
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching
                    'Pragma': 'no-cache', // For HTTP/1.0 proxies
                    'Expires': '0' //    
                }
            });
            if (response.ok) {
                const data = await response.json();
                // Based on your API response: data.settings contains the appearance object
                return data.settings; 
            }
            console.error('GlobalTheme: Failed to fetch user settings:', response.status);
            return null;
        } catch (error) {
            console.error('GlobalTheme: Error fetching user settings:', error);
            return null;
        }
    }

    function applyThemeToBody(isDarkMode) {
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }
    
    // We need to wait for the DOM to be ready to safely access document.body
    document.addEventListener('DOMContentLoaded', async () => {
        const token = getUserToken();
        if (token) {
            const settings = await fetchUserThemeSettings(token);
            if (settings && settings.appearance && settings.appearance.darkMode) {
                applyThemeToBody(true);
            } else {
                applyThemeToBody(false); // Explicitly set light mode if not enabled or settings not found
            }
        } else {
            // console.log('GlobalTheme: No user token, default to light mode.');
            applyThemeToBody(false); // Default to light mode if no token
        }
    });
})();