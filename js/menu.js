// ========== UNIFIED MENU SYSTEM ==========
// One menu to rule them all - no more copy-paste nightmare

// ========== FLATPICKR DATEPICKER ==========
// Load Flatpickr globally for consistent date pickers
(function loadFlatpickr() {
    // Guard - don't add duplicate links
    if (document.getElementById('flatpickr-css')) return;
    
    // Add CSS
    const css = document.createElement('link');
    css.id = 'flatpickr-css';
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css';
    document.head.appendChild(css);
    
    // Add monthSelect plugin CSS
    const monthCss = document.createElement('link');
    monthCss.id = 'flatpickr-month-css';
    monthCss.rel = 'stylesheet';
    monthCss.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/plugins/monthSelect/style.css';
    document.head.appendChild(monthCss);
    
    // Add custom CSS fixes for dark theme
    const customCss = document.createElement('style');
    customCss.id = 'flatpickr-custom-css';
    customCss.textContent = `
        .flatpickr-calendar {
            background: #2d2d30 !important;
            border: 1px solid #555 !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        }
        .flatpickr-months .flatpickr-month,
        .flatpickr-current-month .flatpickr-monthDropdown-months,
        .flatpickr-current-month input.cur-year {
            background: #2d2d30 !important;
            color: #e8e2d5 !important;
        }
        .flatpickr-monthDropdown-months option {
            background: #2d2d30 !important;
            color: #e8e2d5 !important;
        }
        .flatpickr-weekdays {
            background: #2d2d30 !important;
        }
        .flatpickr-weekday {
            color: #888 !important;
        }
        .flatpickr-day {
            color: #e8e2d5 !important;
        }
        .flatpickr-day:hover {
            background: #3e3e42 !important;
            border-color: #555 !important;
        }
        .flatpickr-day.selected {
            background: #3b82f6 !important;
            border-color: #3b82f6 !important;
        }
        .flatpickr-day.today {
            border-color: #f59e0b !important;
        }
        .flatpickr-day.prevMonthDay,
        .flatpickr-day.nextMonthDay {
            color: #666 !important;
        }
        /* Month select plugin fixes */
        .flatpickr-monthSelect-months {
            background: #2d2d30 !important;
        }
        .flatpickr-monthSelect-month {
            color: #e8e2d5 !important;
            background: transparent !important;
        }
        .flatpickr-monthSelect-month:hover {
            background: #3e3e42 !important;
        }
        .flatpickr-monthSelect-month.selected {
            background: #3b82f6 !important;
            color: white !important;
        }
        span.flatpickr-monthSelect-month {
            color: #e8e2d5 !important;
        }
    `;
    document.head.appendChild(customCss);
    
    // Add JS
    const script = document.createElement('script');
    script.id = 'flatpickr-js';
    script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
    script.onload = function() {
        // Load monthSelect plugin
        const monthPlugin = document.createElement('script');
        monthPlugin.id = 'flatpickr-month-js';
        monthPlugin.src = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/plugins/monthSelect/index.js';
        monthPlugin.onload = function() {
            initFlatpickr();
            // Re-init when new content is added (for modals etc) - WITH DEBOUNCE
            if (document.body) {
                let fpTimer = null;
                const observer = new MutationObserver(() => {
                    clearTimeout(fpTimer);
                    fpTimer = setTimeout(initFlatpickr, 200);
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
        };
        document.head.appendChild(monthPlugin);
    };
    document.head.appendChild(script);
})();

// Initialize flatpickr on date inputs
function initFlatpickr() {
    if (typeof flatpickr === 'undefined') return;
    
    // Regular date inputs
    document.querySelectorAll('input[type="date"]:not(.flatpickr-input)').forEach(input => {
        const existingValue = input.value;
        
        flatpickr(input, {
            dateFormat: "Y-m-d",
            defaultDate: existingValue || null,
            allowInput: true,
            theme: "dark"
        });
    });
    
    // Month pickers (for stock/accounting)
    document.querySelectorAll('.month-picker:not(.flatpickr-input)').forEach(input => {
        if (typeof flatpickr.monthSelectPlugin === 'undefined') return;
        
        flatpickr(input, {
            plugins: [new flatpickr.monthSelectPlugin({
                shorthand: false,
                dateFormat: "Y-m",
                altFormat: "F Y"
            })],
            theme: "dark"
        });
    });
}

// ========== LOADING OVERLAY ==========
(function initLoadingOverlay() {
    // Create loading overlay HTML
    const overlayHTML = `
        <div id="globalLoadingOverlay" class="loading-overlay">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    // Create loading styles
    const styles = `
        <style id="loadingOverlayStyles">
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 999999;
                backdrop-filter: blur(2px);
            }
            .loading-overlay.visible {
                display: flex;
            }
            .loading-overlay.error .loading-spinner {
                border-top-color: #ef4444 !important;
            }
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid #333;
                border-top: 4px solid #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    // Inject when DOM is ready
    function inject() {
        if (!document.getElementById('loadingOverlayStyles')) {
            document.head.insertAdjacentHTML('beforeend', styles);
        }
        if (!document.getElementById('globalLoadingOverlay')) {
            document.body.insertAdjacentHTML('beforeend', overlayHTML);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
    
    // Loading functions
    let loadingCount = 0;
    let hideTimeout = null;
    
    const overlay = () => document.getElementById('globalLoadingOverlay');
    
    window.showLoading = function() {
        loadingCount++;
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        const el = overlay();
        if (el) {
            el.classList.remove('error');
            el.classList.add('visible');
        }
    };
    
    window.hideLoading = function() {
        loadingCount = Math.max(0, loadingCount - 1);
        if (loadingCount === 0) {
            hideTimeout = setTimeout(() => {
                const el = overlay();
                if (el) {
                    el.classList.remove('visible', 'error');
                }
                hideTimeout = null;
            }, 800);
        }
    };
    
    // Show error state
    window.showLoadingError = function() {
        const el = overlay();
        if (el) {
            el.classList.add('error');
            setTimeout(() => {
                hideLoading();
            }, 2000);
        }
    };
})();

function loadUnifiedMenu() {
    const menuHTML = `
        <div class="navigation-links">
            <a href="today.html" class="nav-link nav-link-today">📅 TODAY</a>
            <a href="index.html" class="nav-link nav-link-production">🏭 Production</a>
            <a href="office.html" class="nav-link nav-link-office">🗂️ Office</a>
            <a href="pipeline.html" class="nav-link nav-link-pipeline">📋 Pipeline</a>
            <a href="archive.html" class="nav-link nav-link-archive" data-permission="canArchive">📦 Archive</a>
            <a href="accounting.html" class="nav-link nav-link-accounting" data-permission="canViewFinancials">💰 Accounting</a>
            <a href="team.html" class="nav-link nav-link-team" data-permission="canManageTeam">🧑‍🤝‍🧑 Team Management</a>
            <a href="clients.html" class="nav-link nav-link-clients" data-permission="canEditClients">👤 Clients</a>
            <a href="stock.html" class="nav-link nav-link-stock">📦 Stock</a>
            <a href="suppliers.html" class="nav-link nav-link-suppliers">🚚 Suppliers</a>
            <a href="equipment.html" class="nav-link nav-link-equipment">🔧 Equipment</a>
        </div>
    `;
    
    // User dropdown styles
    const dropdownStyles = `
        <style id="userDropdownStyles">
            .user-dropdown-container {
                position: relative;
                margin-left: auto;
            }
            .user-dropdown-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                background: #333;
                border: 1px solid #444;
                border-radius: 6px;
                color: #e8e2d5;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
                height: 36px;
                box-sizing: border-box;
            }
            .user-dropdown-btn:hover {
                background: #3a3a3a;
                border-color: #555;
            }
            .user-avatar {
                font-size: 16px;
            }
            .user-name {
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .dropdown-arrow {
                font-size: 10px;
                color: #888;
                transition: transform 0.2s;
            }
            .user-dropdown-container.open .dropdown-arrow {
                transform: rotate(180deg);
            }
            .dropdown-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 15px;
                color: #e8e2d5;
                text-decoration: none;
                font-size: 13px;
                transition: background 0.2s;
                cursor: pointer;
                border: none;
                background: none;
                width: 100%;
                text-align: left;
            }
            .dropdown-item:hover {
                background: #333;
            }
            .dropdown-item span {
                font-size: 14px;
            }
            .dropdown-divider {
                height: 1px;
                background: #444;
                margin: 5px 0;
            }
            .dropdown-logout:hover {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }
        </style>
    `;
    
    // Inject styles if not already present
    if (!document.getElementById('userDropdownStyles')) {
        document.head.insertAdjacentHTML('beforeend', dropdownStyles);
    }
    
    // Find the menu container and inject
    const menuContainer = document.querySelector('.header');
    if (menuContainer) {
        const existingMenu = menuContainer.querySelector('.navigation-links');
        if (existingMenu) {
            existingMenu.outerHTML = menuHTML;
        } else {
            // FIX: Insert menu if it doesn't exist
            menuContainer.insertAdjacentHTML('afterbegin', menuHTML);
        }
    }
    
    // Apply role-based visibility when permissions are loaded
    window.addEventListener('permissionsLoaded', applyMenuPermissions);
    
    // Also try immediately in case permissions already loaded
    setTimeout(applyMenuPermissions, 100);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('userDropdownMenu');
        const container = document.getElementById('userDropdownContainer');
        
        if (menu && menu.style.display === 'block') {
            if (container && !container.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = 'none';
                if (container) container.classList.remove('open');
            }
        }
    });
}

/**
 * Dodaje user dropdown do toolbara (zamiast starego przycisku Logout)
 * Wywołaj tę funkcję po załadowaniu profilu usera
 * @param {object} profile - profil usera z user_profiles
 */
function addUserDropdownToToolbar(profile) {
    if (!profile) return;
    
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;
    
    // FIX: Usuń stare menu dropdown jeśli istnieje
    const oldMenu = document.getElementById('userDropdownMenu');
    if (oldMenu) oldMenu.remove();
    
    // Usuń stary przycisk logout jeśli istnieje
    const oldLogout = document.getElementById('logoutBtn');
    if (oldLogout) oldLogout.remove();
    
    // Sprawdź czy dropdown już istnieje
    if (document.getElementById('userDropdownContainer')) return;
    
    // FIX: Użyj full_name zamiast email (email nie jest pobierany)
    const displayName = profile.full_name ? profile.full_name.split(' ')[0] : 'User';
    const year = new Date().getFullYear();
    
    // Program info + Button w toolbar
    const btnHTML = `
        <div style="margin-left: auto; display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 10px; color: #666; white-space: nowrap;">Joinery Core v1.0 · © ${year} Skylon Development LTD</span>
            <div class="user-dropdown-container" id="userDropdownContainer" style="position: relative;">
                <button class="user-dropdown-btn" id="userDropdownBtn" onclick="toggleUserDropdown(event)">
                    <span class="user-avatar">👤</span>
                    <span class="user-name">${displayName}</span>
                    <span class="dropdown-arrow">▼</span>
                </button>
            </div>
        </div>
    `;
    
    toolbar.insertAdjacentHTML('beforeend', btnHTML);
    
    // Menu renderowane na BODY (portal) - poza stacking context
    const menuHTML = `
        <div class="user-dropdown-menu" id="userDropdownMenu" style="
            display: none;
            position: fixed;
            top: 0;
            left: auto;
            right: 0;
            min-width: 180px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 999999;
            overflow: hidden;
        ">
            <a href="settings.html" class="dropdown-item">
                <span>⚙️</span> My Account
            </a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item dropdown-logout" onclick="globalLogout()">
                <span>🚪</span> Logout
            </button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', menuHTML);
}

// Toggle user dropdown
function toggleUserDropdown(event) {
    event.stopPropagation();
    const btn = document.getElementById('userDropdownBtn');
    const menu = document.getElementById('userDropdownMenu');
    const container = document.getElementById('userDropdownContainer');
    
    if (!btn || !menu) return;
    
    const isOpen = menu.style.display === 'block';
    
    if (isOpen) {
        menu.style.display = 'none';
        if (container) container.classList.remove('open');
    } else {
        // Oblicz pozycję menu względem buttona
        const rect = btn.getBoundingClientRect();
        const rightOffset = window.innerWidth - rect.right;
        
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.right = rightOffset + 'px';
        menu.style.left = 'auto';
        menu.style.display = 'block';
        if (container) container.classList.add('open');
    }
}

// Global logout function
function globalLogout() {
    if (confirm('Are you sure you want to logout?')) {
        supabaseClient.auth.signOut().then(() => {
            sessionStorage.removeItem('redirecting');
            window.location.href = 'login.html';
        });
    }
}

function applyMenuPermissions() {
    // FIX: Używaj hasPermission() zamiast sprawdzać role bezpośrednio
    // To automatycznie obsługuje owner -> admin przez normalizeRole w permissions.js
    
    // Hide links based on permissions
    const permissionLinks = document.querySelectorAll('[data-permission]');
    permissionLinks.forEach(link => {
        const permission = link.getAttribute('data-permission');
        if (typeof hasPermission === 'function' && !hasPermission(permission)) {
            link.style.display = 'none';
        }
    });
    
    // Automatycznie dodaj user dropdown do toolbara
    if (window.currentUserProfile) {
        addUserDropdownToToolbar(window.currentUserProfile);
    }
}

// Load menu when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadUnifiedMenu();
    });
} else {
    loadUnifiedMenu();
}
