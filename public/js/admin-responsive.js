/**
 * Admin Dashboard Responsive Enhancements
 * This file contains functionality to improve the mobile experience of the admin dashboard.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            if (navMenu.classList.contains('collapsed')) {
                navMenu.classList.remove('collapsed');
                navMenu.classList.add('expanded');
            } else {
                navMenu.classList.add('collapsed');
                navMenu.classList.remove('expanded');
            }
        });
    }

    // Table scroll detection and user guidance
    const scrollableTables = document.querySelectorAll('.scrollable-table');
    
    scrollableTables.forEach(tableContainer => {
        // Initial check if the table is overflowing
        checkTableOverflow(tableContainer);
        
        // Listen for window resize to check overflow
        window.addEventListener('resize', () => {
            checkTableOverflow(tableContainer);
        });
        
        // Add touch handling for better mobile scrolling
        addTouchScrolling(tableContainer);
    });

    // Function to check if table content is wider than container
    function checkTableOverflow(tableContainer) {
        const table = tableContainer.querySelector('table');
        const indicator = tableContainer.previousElementSibling;
        
        if (table && indicator && indicator.classList.contains('table-scroll-indicator')) {
            const isOverflowing = table.offsetWidth > tableContainer.offsetWidth;
            
            // Only show indicator if table overflows
            indicator.style.display = isOverflowing ? 'flex' : 'none';
            
            // Add a class to the container if it's overflowing
            if (isOverflowing) {
                tableContainer.classList.add('has-overflow');
                
                // Fade out indicator after 4 seconds
                setTimeout(() => {
                    indicator.style.opacity = '0.6';
                }, 4000);
                
                // Show indicator again when interacting with the table
                tableContainer.addEventListener('mouseenter', () => {
                    indicator.style.opacity = '1';
                });
            } else {
                tableContainer.classList.remove('has-overflow');
            }
        }
    }
    
    // Add enhanced touch scrolling behavior for mobile
    function addTouchScrolling(element) {
        let startX;
        let scrollLeft;
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].pageX - element.offsetLeft;
            scrollLeft = element.scrollLeft;
        }, { passive: true });
        
        element.addEventListener('touchmove', (e) => {
            if (!startX) return;
            
            const x = e.touches[0].pageX - element.offsetLeft;
            const distance = x - startX;
            element.scrollLeft = scrollLeft - distance;
        }, { passive: true });
        
        element.addEventListener('touchend', () => {
            startX = null;
        }, { passive: true });
    }
    
    // Add responsive behavior for modals
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        // Make sure modal fits properly on mobile
        const content = modal.querySelector('.modal-content');
        if (content) {
            window.addEventListener('resize', () => {
                const maxHeight = window.innerHeight * 0.9;
                content.style.maxHeight = `${maxHeight}px`;
                content.style.overflowY = 'auto';
            });
            // Trigger once on load
            const maxHeight = window.innerHeight * 0.9;
            content.style.maxHeight = `${maxHeight}px`;
            content.style.overflowY = 'auto';
        }
    });
    
    // Fix mobile layout issues with action buttons
    const actionButtons = document.querySelectorAll('.action-btn, .btn-action');
    
    // On small screens, stack buttons vertically in action columns
    if (window.innerWidth <= 480) {
        actionButtons.forEach(button => {
            button.style.display = 'block';
            button.style.marginBottom = '4px';
            button.style.width = '100%';
        });
    }
});
