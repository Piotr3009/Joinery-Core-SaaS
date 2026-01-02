// ========== UNIFIED MENU SYSTEM ==========
// One menu to rule them all - no more copy-paste nightmare

// ========== FLATPICKR DATEPICKER ==========
// Load Flatpickr globally for consistent date pickers
(function loadFlatpickr() {
    // Add CSS
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css';
    document.head.appendChild(css);
    
    // Add monthSelect plugin CSS
    const monthCss = document.createElement('link');
    monthCss.rel = 'stylesheet';
    monthCss.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/plugins/monthSelect/style.css';
    document.head.appendChild(monthCss);
    
    // Add custom CSS fixes for dark theme
    const customCss = document.createElement('style');
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
    script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
    script.onload = function() {
        // Load monthSelect plugin
        const monthPlugin = document.createElement('script');
        monthPlugin.src = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/plugins/monthSelect/index.js';
        monthPlugin.onload = function() {
            initFlatpickr();
            // Re-init when new content is added (for modals etc)
            if (document.body) {
                const observer = new MutationObserver(() => initFlatpickr());
                observer.observe(document.body, { childList: true, subtree: true });
            }
        };
        document.head.appendChild(monthPlugin);
    };
    document.head.appendChild(script);
})();

function initFlatpickr() {
    if (typeof flatpickr === 'undefined') return;
    
    // Regular date inputs
    document.querySelectorAll('input[type="date"]:not(.flatpickr-input)').forEach(el => {
        const existingValue = el.value;
        
        flatpickr(el, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true,
            defaultDate: existingValue || null
        });
    });
    
    // Month picker inputs (marked with data-month-picker)
    document.querySelectorAll('input[data-month-picker="true"]:not(.flatpickr-input)').forEach(el => {
        const existingValue = el.value;
        
        if (typeof monthSelectPlugin !== 'undefined') {
            flatpickr(el, {
                plugins: [new monthSelectPlugin({
                    shorthand: true,
                    dateFormat: "Y-m",
                    altFormat: "F Y"
                })],
                altInput: true,
                altFormat: "F Y",
                dateFormat: "Y-m",
                defaultDate: existingValue || null
            });
        }
    });
}

// ========== GLOBAL LOADING SYSTEM ==========
// Automatic loading indicator for all Supabase operations

(function initGlobalLoading() {
    // Create loading overlay HTML
    const loadingHTML = `
        <div id="globalLoadingOverlay" style="
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 99999;
            justify-content: center;
            align-items: center;
        ">
            <div style="
                background: #2a2a2a;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
            ">
                <div id="loadingSpinner" style="
                    width: 60px;
                    height: 60px;
                    border: 4px solid #444;
                    border-top: 4px solid #4CAF50;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                ">
                    <img src="favicon.svg" alt="JC" style="
                        width: 32px;
                        height: 32px;
                        animation: spinReverse 0.8s linear infinite;
                    ">
                </div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes spinReverse {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(-360deg); }
            }
            #globalLoadingOverlay.error #loadingSpinner {
                border-top-color: #ef4444 !important;
            }
        </style>
    `;
    
    // Inject loading overlay when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.insertAdjacentHTML('beforeend', loadingHTML);
            wrapSupabaseClient();
        });
    } else {
        document.body.insertAdjacentHTML('beforeend', loadingHTML);
        wrapSupabaseClient();
    }
    
    // Counter to track concurrent operations
    let activeOperations = 0;
    let hideTimeout = null;
    const overlay = () => document.getElementById('globalLoadingOverlay');
    
    // Show loading
    window.showLoading = function() {
        activeOperations++;
        // Cancel pending hide
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        const el = overlay();
        if (el) {
            el.style.display = 'flex';
            el.classList.remove('error');
        }
    };
    
    // Hide loading with delay
    window.hideLoading = function() {
        activeOperations--;
        if (activeOperations <= 0) {
            activeOperations = 0;
            // Delay hide by 800ms to avoid flickering
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                const el = overlay();
                if (el && activeOperations === 0) {
                    el.style.display = 'none';
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
    
    // Wrap Supabase client to automatically show loading
    function wrapSupabaseClient() {
        // Wait for supabaseClient to be defined
        const checkInterval = setInterval(() => {
            if (typeof supabaseClient !== 'undefined') {
                clearInterval(checkInterval);
                
                // Wrap the 'from' method to intercept all table operations
                const originalFrom = supabaseClient.from.bind(supabaseClient);
                supabaseClient.from = function(table) {
                    const builder = originalFrom(table);
                    
                    // Wrap all query methods
                    ['select', 'insert', 'update', 'delete', 'upsert'].forEach(method => {
                        const original = builder[method];
                        if (original) {
                            builder[method] = function(...args) {
                                const query = original.apply(this, args);
                                
                                // Wrap the final execution (when promise is created)
                                const originalThen = query.then.bind(query);
                                query.then = function(onSuccess, onError) {
                                    showLoading();
                                    return originalThen(
                                        (result) => {
                                            hideLoading();
                                            return onSuccess ? onSuccess(result) : result;
                                        },
                                        (error) => {
                                            showLoadingError();
                                            return onError ? onError(error) : Promise.reject(error);
                                        }
                                    );
                                };
                                
                                return query;
                            };
                        }
                    });
                    
                    return builder;
                };
                
                // Wrap storage operations
                if (supabaseClient.storage) {
                    const originalStorage = supabaseClient.storage.from.bind(supabaseClient.storage);
                    supabaseClient.storage.from = function(bucket) {
                        const bucketObj = originalStorage(bucket);
                        
                        // Wrap storage methods
                        ['upload', 'download', 'remove', 'list'].forEach(method => {
                            const original = bucketObj[method];
                            if (original) {
                                bucketObj[method] = async function(...args) {
                                    showLoading();
                                    try {
                                        const result = await original.apply(this, args);
                                        hideLoading();
                                        return result;
                                    } catch (error) {
                                        showLoadingError();
                                        throw error;
                                    }
                                };
                            }
                        });
                        
                        return bucketObj;
                    };
                }
                
            }
        }, 100);
        
        // Stop checking after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 2500);
    }
})();

function loadUnifiedMenu() {
    const menuHTML = `
        <div class="navigation-links">
            <a href="index.html" class="nav-link nav-link-production">🏭 Production</a>
            <a href="office.html" class="nav-link nav-link-office">🗂️ Office</a>
            <a href="pipeline.html" class="nav-link nav-link-pipeline">📋 Pipeline</a>
            <a href="archive.html" class="nav-link nav-link-archive" data-role-required="admin">📦 Archive</a>
            <a href="accounting.html" class="nav-link nav-link-accounting" data-role-required="admin">💰 Accounting</a>
            <a href="team.html" class="nav-link nav-link-team" data-role-required="admin">🧑‍🤝‍🧑 Team Management</a>
            <a href="clients.html" class="nav-link nav-link-clients" data-role-required="admin">👤 Clients</a>
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
        }
    }
    
    // Add TODAY button to toolbar (only on pipeline, office, production pages)
    const toolbar = document.querySelector('.toolbar');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const todayPages = ['index.html', 'office.html', 'pipeline.html'];
    
    if (toolbar && !document.getElementById('todayBtnContainer') && todayPages.includes(currentPage)) {
        const todayHTML = `
            <div id="todayBtnContainer" style="margin-left: 30px; border-left: 1px solid #444; padding-left: 20px;">
                <a href="today.html" class="nav-link nav-link-today" style="display: inline-block;">📅 TODAY</a>
            </div>
        `;
        // Insert at the beginning of toolbar
        toolbar.insertAdjacentHTML('afterbegin', todayHTML);
    }
    
    // Highlight active menu item based on current page
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('nav-link-active');
        }
    });
    
    // Apply role-based visibility when permissions are loaded
    window.addEventListener('permissionsLoaded', applyMenuPermissions);
    
    // Also try immediately in case permissions already loaded
    setTimeout(applyMenuPermissions, 100);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const btn = document.getElementById('userDropdownBtn');
        const menu = document.getElementById('userDropdownMenu');
        const container = document.getElementById('userDropdownContainer');
        
        if (menu && menu.style.display === 'block') {
            // Sprawdź czy klik był poza buttonem i menu
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
    
    // Usuń stary przycisk logout jeśli istnieje
    const oldLogout = document.getElementById('logoutBtn');
    if (oldLogout) oldLogout.remove();
    
    // Sprawdź czy dropdown już istnieje
    if (document.getElementById('userDropdownContainer')) return;
    
    const displayName = profile.full_name ? profile.full_name.split(' ')[0] : (profile.email || 'User');
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
    
    if (!btn || !menu) return;
    
    const isOpen = menu.style.display === 'block';
    
    if (isOpen) {
        menu.style.display = 'none';
        btn.parentElement.classList.remove('open');
    } else {
        // Oblicz pozycję menu względem buttona
        const rect = btn.getBoundingClientRect();
        const rightOffset = window.innerWidth - rect.right;
        
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.right = rightOffset + 'px';
        menu.style.left = 'auto';
        menu.style.display = 'block';
        btn.parentElement.classList.add('open');
    }
}

// Global logout function
function globalLogout() {
    if (confirm('Are you sure you want to logout?')) {
        supabaseClient.auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    }
}

function applyMenuPermissions() {
    if (!window.currentUserRole) {
        return;
    }
    
    // Hide admin-only links for non-admins
    const adminLinks = document.querySelectorAll('[data-role-required="admin"]');
    adminLinks.forEach(link => {
        if (window.currentUserRole !== 'admin') {
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