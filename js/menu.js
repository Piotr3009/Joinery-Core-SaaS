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
            background: #AA8E68 !important;
            border-color: #AA8E68 !important;
        }
        .flatpickr-day.today {
            border-color: #C8A678 !important;
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
            background: #AA8E68 !important;
            color: #171719 !important;
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
                    border-top: 4px solid #AA8E68;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                ">
                    <img src="landingimg/logo black tlo.jpeg" alt="JC" style="
                        width: 32px;
                        height: 32px;
                        border-radius: 4px;
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
            // Small delay to avoid flickering on rapid show/hide
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                const el = overlay();
                if (el && activeOperations === 0) {
                    el.style.display = 'none';
                }
                hideTimeout = null;
            }, 100);
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
    // SVG Icons
    const icons = {
        production: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>',
        office: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
        pipeline: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
        archive: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"></path></svg>',
        accounting: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
        team: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        clients: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        stock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>',
        suppliers: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>',
        equipment: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>'
    };
    
    // Help icon
    const helpIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    
    const menuHTML = `
        <div class="navigation-links">
            <a href="pipeline.html" class="nav-link nav-link-pipeline">${icons.pipeline} Pipeline</a>
            <a href="dashboard.html" class="nav-link nav-link-production">${icons.production} Production</a>
            <a href="office.html" class="nav-link nav-link-office">${icons.office} Office</a>
            <a href="archive.html" class="nav-link nav-link-archive" data-role-required="admin">${icons.archive} Archive</a>
            <a href="accounting.html" class="nav-link nav-link-accounting" data-role-required="admin">${icons.accounting} Accounting</a>
            <a href="team.html" class="nav-link nav-link-team" data-role-required="admin,manager">${icons.team} Team</a>
            <a href="clients.html" class="nav-link nav-link-clients" data-role-required="admin">${icons.clients} Clients</a>
            <a href="stock.html" class="nav-link nav-link-stock">${icons.stock} Stock</a>
            <a href="suppliers.html" class="nav-link nav-link-suppliers">${icons.suppliers} Suppliers</a>
            <a href="equipment.html" class="nav-link nav-link-equipment">${icons.equipment} Equipment</a>
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
    
    // Add Help button to top-right corner
    if (!document.getElementById('helpBtnCorner')) {
        const helpBtnHTML = `
            <a href="help.html" id="helpBtnCorner" target="_blank" rel="noopener noreferrer" title="Pomoc / Help" style="
                position: fixed;
                top: 10px;
                right: 15px;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 38px;
                height: 38px;
                background: transparent;
                border: 2px solid #d4a574;
                border-radius: 50%;
                color: #d4a574;
                text-decoration: none;
                font-weight: bold;
                font-size: 22px;
                box-shadow: 0 2px 8px rgba(212, 165, 116, 0.3);
                animation: helpPulse 2s ease-in-out infinite;
                transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
            " onmouseover="this.style.transform='scale(1.1)';this.style.background='rgba(212,165,116,0.15)';this.style.boxShadow='0 4px 12px rgba(212, 165, 116, 0.5)';" onmouseout="this.style.transform='scale(1)';this.style.background='transparent';this.style.boxShadow='0 2px 8px rgba(212, 165, 116, 0.3)';">
                ?
            </a>
            <style>
                @keyframes helpPulse {
                    0%, 100% { box-shadow: 0 2px 8px rgba(212, 165, 116, 0.3); }
                    50% { box-shadow: 0 2px 12px rgba(212, 165, 116, 0.5); }
                }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', helpBtnHTML);
    }
    
    // Add Calculator button before Help button
    if (!document.getElementById('calculatorBtn')) {
        const calcBtnHTML = `
            <button id="calculatorBtn" onclick="openCalculatorModal()" title="Calculator" style="
                position: fixed;
                top: 10px;
                right: 60px;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 38px;
                height: 38px;
                background: transparent;
                border: 2px solid #d4a574;
                border-radius: 50%;
                color: #d4a574;
                text-decoration: none;
                font-weight: bold;
                font-size: 18px;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(212, 165, 116, 0.3);
                transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
            " onmouseover="this.style.transform='scale(1.1)';this.style.background='rgba(212,165,116,0.15)';this.style.boxShadow='0 4px 12px rgba(212, 165, 116, 0.5)';" onmouseout="this.style.transform='scale(1)';this.style.background='transparent';this.style.boxShadow='0 2px 8px rgba(212, 165, 116, 0.3)';">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                    <line x1="8" y1="6" x2="16" y2="6"></line>
                    <line x1="8" y1="10" x2="8" y2="10.01"></line>
                    <line x1="12" y1="10" x2="12" y2="10.01"></line>
                    <line x1="16" y1="10" x2="16" y2="10.01"></line>
                    <line x1="8" y1="14" x2="8" y2="14.01"></line>
                    <line x1="12" y1="14" x2="12" y2="14.01"></line>
                    <line x1="16" y1="14" x2="16" y2="14.01"></line>
                    <line x1="8" y1="18" x2="8" y2="18.01"></line>
                    <line x1="12" y1="18" x2="12" y2="18.01"></line>
                    <line x1="16" y1="18" x2="16" y2="18.01"></line>
                </svg>
            </button>
        `;
        document.body.insertAdjacentHTML('beforeend', calcBtnHTML);
    }
    
    // Add Calculator modal
    if (!document.getElementById('calculatorModal')) {
        const calcModalHTML = `
            <div id="calculatorModal" style="
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
                justify-content: center;
                align-items: center;
            " onclick="if(event.target === this) closeCalculatorModal()">
                <div id="calculatorBox" style="
                    background: #1e1e1e;
                    border: 1px solid #3e3e42;
                    border-radius: 8px;
                    padding: 16px;
                    width: 280px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    position: absolute;
                ">
                    <div id="calcHeader" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; cursor: move; user-select: none;">
                        <span style="color: #e8e2d5; font-weight: 600; font-size: 14px;">Calculator</span>
                        <button onclick="closeCalculatorModal()" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                    </div>
                    <div id="calcDisplay" style="background: #2d2d2d; border: 1px solid #3e3e42; border-radius: 4px; padding: 12px 16px; margin-bottom: 12px; text-align: right; font-size: 28px; font-family: 'Consolas', 'Monaco', monospace; color: #e8e2d5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">0</div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                        <button onclick="calcClear()" class="calc-btn calc-btn-func">C</button>
                        <button onclick="calcClearEntry()" class="calc-btn calc-btn-func">CE</button>
                        <button onclick="calcPercent()" class="calc-btn calc-btn-func">%</button>
                        <button onclick="calcSetOperator('/')" class="calc-btn calc-btn-op">÷</button>
                        <button onclick="calcInputDigit('7')" class="calc-btn">7</button>
                        <button onclick="calcInputDigit('8')" class="calc-btn">8</button>
                        <button onclick="calcInputDigit('9')" class="calc-btn">9</button>
                        <button onclick="calcSetOperator('*')" class="calc-btn calc-btn-op">×</button>
                        <button onclick="calcInputDigit('4')" class="calc-btn">4</button>
                        <button onclick="calcInputDigit('5')" class="calc-btn">5</button>
                        <button onclick="calcInputDigit('6')" class="calc-btn">6</button>
                        <button onclick="calcSetOperator('-')" class="calc-btn calc-btn-op">−</button>
                        <button onclick="calcInputDigit('1')" class="calc-btn">1</button>
                        <button onclick="calcInputDigit('2')" class="calc-btn">2</button>
                        <button onclick="calcInputDigit('3')" class="calc-btn">3</button>
                        <button onclick="calcSetOperator('+')" class="calc-btn calc-btn-op">+</button>
                        <button onclick="calcToggleSign()" class="calc-btn">±</button>
                        <button onclick="calcInputDigit('0')" class="calc-btn">0</button>
                        <button onclick="calcInputDecimal()" class="calc-btn">.</button>
                        <button onclick="calcCalculate()" class="calc-btn calc-btn-equals">=</button>
                    </div>
                </div>
            </div>
            <style>
                .calc-btn { 
                    padding: 14px; 
                    font-size: 16px; 
                    font-weight: 500; 
                    border: none; 
                    border-radius: 3px; 
                    background: #3e3e42; 
                    color: #e8e2d5; 
                    cursor: pointer; 
                    transition: all 0.2s; 
                }
                .calc-btn:hover { background: #4e4e52; }
                .calc-btn:active { background: #5e5e62; transform: scale(0.97); }
                .calc-btn-func { background: #2a2a2e; color: #a1a1aa; border: 1px solid #3e3e42; }
                .calc-btn-func:hover { background: #3e3e42; color: #e8e2d5; }
                .calc-btn-op { background: #2a2a2e; color: #d4a574; border: 1px solid #d4a574; }
                .calc-btn-op:hover { background: rgba(212, 165, 116, 0.15); }
                .calc-btn-equals { 
                    background: linear-gradient(135deg, #CDB28C 0%, #AA8E68 20%, #8B7355 60%, #6B5A47 100%); 
                    color: #171719; 
                    font-weight: 600; 
                    border: none;
                    box-shadow: 0 2px 8px rgba(170, 142, 104, 0.3);
                }
                .calc-btn-equals:hover { 
                    box-shadow: 0 4px 12px rgba(170, 142, 104, 0.5);
                    transform: translateY(-1px);
                }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', calcModalHTML);
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
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    // TODAY button is now directly in HTML on dashboard, office, pipeline
    // No need to inject it dynamically
    const todayPages = [];
    
    if (toolbar && !document.getElementById('todayBtnContainer') && todayPages.includes(currentPage)) {
        const todayHTML = `
            <div id="todayBtnContainer" style="margin-left: 30px; border-left: 1px solid #444; padding-left: 20px;">
                <a href="today.html" class="nav-link nav-link-today" style="display: inline-block;">TODAY</a>
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
    
    // Hide links based on role requirements
    const roleLinks = document.querySelectorAll('[data-role-required]');
    roleLinks.forEach(link => {
        const allowedRoles = link.getAttribute('data-role-required').split(',');
        if (!allowedRoles.includes(window.currentUserRole)) {
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

// ========================================
// CALCULATOR FUNCTIONS
// ========================================
let calcDisplay = '0';
let calcFirstOperand = null;
let calcOperator = null;
let calcWaitingForSecondOperand = false;

function openCalculatorModal() {
    const modal = document.getElementById('calculatorModal');
    if (modal) modal.style.display = 'flex';
}

function closeCalculatorModal() {
    const modal = document.getElementById('calculatorModal');
    if (modal) modal.style.display = 'none';
}

function updateCalcDisplay() {
    const display = document.getElementById('calcDisplay');
    if (display) {
        let displayValue = calcDisplay;
        if (!isNaN(parseFloat(displayValue)) && isFinite(displayValue)) {
            const parts = displayValue.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            displayValue = parts.join('.');
        }
        display.textContent = displayValue;
    }
}

function calcInputDigit(digit) {
    if (calcWaitingForSecondOperand) {
        calcDisplay = digit;
        calcWaitingForSecondOperand = false;
    } else {
        calcDisplay = calcDisplay === '0' ? digit : calcDisplay + digit;
    }
    updateCalcDisplay();
}

function calcInputDecimal() {
    if (calcWaitingForSecondOperand) {
        calcDisplay = '0.';
        calcWaitingForSecondOperand = false;
        updateCalcDisplay();
        return;
    }
    if (!calcDisplay.includes('.')) {
        calcDisplay += '.';
    }
    updateCalcDisplay();
}

function calcClear() {
    calcDisplay = '0';
    calcFirstOperand = null;
    calcOperator = null;
    calcWaitingForSecondOperand = false;
    updateCalcDisplay();
}

function calcClearEntry() {
    calcDisplay = '0';
    updateCalcDisplay();
}

function calcToggleSign() {
    calcDisplay = String(-parseFloat(calcDisplay));
    updateCalcDisplay();
}

function calcPercent() {
    calcDisplay = String(parseFloat(calcDisplay) / 100);
    updateCalcDisplay();
}

function calcSetOperator(nextOperator) {
    const inputValue = parseFloat(calcDisplay);
    if (calcOperator && calcWaitingForSecondOperand) {
        calcOperator = nextOperator;
        return;
    }
    if (calcFirstOperand === null) {
        calcFirstOperand = inputValue;
    } else if (calcOperator) {
        const result = performCalcOperation(calcFirstOperand, inputValue, calcOperator);
        calcDisplay = String(result);
        calcFirstOperand = result;
        updateCalcDisplay();
    }
    calcWaitingForSecondOperand = true;
    calcOperator = nextOperator;
}

function performCalcOperation(first, second, operator) {
    let result;
    switch (operator) {
        case '+': result = first + second; break;
        case '-': result = first - second; break;
        case '*': result = first * second; break;
        case '/': result = second !== 0 ? first / second : 'Error'; break;
        default: result = second;
    }
    // Fix floating point errors - round to 2 decimal places
    if (typeof result === 'number') {
        result = Math.round(result * 100) / 100;
    }
    return result;
}

function calcCalculate() {
    if (!calcOperator || calcWaitingForSecondOperand) return;
    const inputValue = parseFloat(calcDisplay);
    const result = performCalcOperation(calcFirstOperand, inputValue, calcOperator);
    calcDisplay = String(result);
    calcFirstOperand = null;
    calcOperator = null;
    calcWaitingForSecondOperand = false;
    updateCalcDisplay();
}

// Calculator keyboard support
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('calculatorModal');
    if (!modal || modal.style.display !== 'flex') return;
    
    if (e.key >= '0' && e.key <= '9') calcInputDigit(e.key);
    else if (e.key === '.') calcInputDecimal();
    else if (e.key === '+') calcSetOperator('+');
    else if (e.key === '-') calcSetOperator('-');
    else if (e.key === '*') calcSetOperator('*');
    else if (e.key === '/') { e.preventDefault(); calcSetOperator('/'); }
    else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calcCalculate(); }
    else if (e.key === 'Escape') closeCalculatorModal();
    else if (e.key === 'Backspace') {
        calcDisplay = calcDisplay.length > 1 ? calcDisplay.slice(0, -1) : '0';
        updateCalcDisplay();
    }
    else if (e.key.toLowerCase() === 'c') calcClear();
});

// Calculator drag & drop
let calcDragOffset = { x: 0, y: 0 };
let calcIsDragging = false;

document.addEventListener('mousedown', (e) => {
    const header = document.getElementById('calcHeader');
    if (!header || !header.contains(e.target)) return;
    if (e.target.tagName === 'BUTTON') return;
    
    const box = document.getElementById('calculatorBox');
    if (!box) return;
    
    calcIsDragging = true;
    const rect = box.getBoundingClientRect();
    calcDragOffset.x = e.clientX - rect.left;
    calcDragOffset.y = e.clientY - rect.top;
    box.style.transition = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!calcIsDragging) return;
    
    const box = document.getElementById('calculatorBox');
    if (!box) return;
    
    let newX = e.clientX - calcDragOffset.x;
    let newY = e.clientY - calcDragOffset.y;
    
    // Keep within viewport
    newX = Math.max(0, Math.min(newX, window.innerWidth - box.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - box.offsetHeight));
    
    box.style.left = newX + 'px';
    box.style.top = newY + 'px';
});

document.addEventListener('mouseup', () => {
    calcIsDragging = false;
});