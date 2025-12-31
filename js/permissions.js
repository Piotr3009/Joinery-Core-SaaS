// ========== GLOBAL PERMISSIONS SYSTEM ==========
// Role-based access control for Skylon ERP

(function initPermissions() {
    // Current user data (will be loaded from user_profiles)
    window.currentUserRole = null;
    window.currentUserId = null;
    
    // Role definitions
    const ROLES = {
        ADMIN: 'admin',
        MANAGER: 'manager',
        WORKER: 'worker',
        VIEWER: 'viewer'
    };
    
    // Page access rules
    const PAGE_ACCESS = {
        // Admin only
        'accounting.html': ['admin'],
        'archive.html': ['admin'],
        'clients.html': ['admin'],
        'team.html': ['admin'],
        
        // Admin + Manager
        'index.html': ['admin', 'manager', 'worker'], // Production (worker read-only)
        'pipeline.html': ['admin', 'manager', 'worker'], // Pipeline (worker read-only)
        'equipment.html': ['admin', 'manager'], // Machines (manager full access)
        'suppliers.html': ['admin', 'manager', 'worker'], // Suppliers (manager/worker read-only)
        
        // Admin + Manager + Worker
        'stock.html': ['admin', 'manager', 'worker'], // Stock (manager/worker read-only)
        'office.html': ['admin', 'manager', 'worker'], // Office
        'settings.html': ['admin', 'manager', 'worker'], // Settings (company tab admin only)
        
        // Public
        'login.html': ['admin', 'manager', 'worker', 'viewer'],
        'index-public.html': ['admin', 'manager', 'worker', 'viewer']
    };
    
    // Feature permissions by role
    const PERMISSIONS = {
        admin: {
            canEdit: true,
            canDelete: true,
            canAdd: true,
            canMovePhases: true,
            canAccessEstimates: true,
            canAccessEmails: true,
            canEditPrices: true,
            canEditStock: true,
            canOrderStock: true,
            canManageTeam: true,
            canViewAccounting: true,
            canEditClients: true,
            canArchive: true
        },
        manager: {
            canEdit: true,
            canDelete: true,
            canAdd: true,
            canMovePhases: true,
            canAccessEstimates: false, // NO access to Estimate folder
            canAccessEmails: false, // NO access to Emails folder
            canEditPrices: true,
            canEditStock: false, // Stock read-only
            canOrderStock: false,
            canManageTeam: false,
            canViewAccounting: false,
            canEditClients: false,
            canArchive: true
        },
        worker: {
            canEdit: false, // Read-only
            canDelete: false,
            canAdd: false,
            canMovePhases: false, // Cannot move phases
            canAccessEstimates: false, // NO access to Estimate folder
            canAccessEmails: false, // NO access to Emails folder
            canEditPrices: false,
            canEditStock: false,
            canOrderStock: false,
            canManageTeam: false,
            canViewAccounting: false,
            canEditClients: false,
            canArchive: false
        },
        viewer: {
            canEdit: false,
            canDelete: false,
            canAdd: false,
            canMovePhases: false,
            canAccessEstimates: false,
            canAccessEmails: false,
            canEditPrices: false,
            canEditStock: false,
            canOrderStock: false,
            canManageTeam: false,
            canViewAccounting: false,
            canEditClients: false,
            canArchive: false
        }
    };
    
    // Load current user role
    window.loadUserRole = async function() {
        try {
            if (typeof supabaseClient === 'undefined') {
                console.warn('Supabase not loaded yet');
                return null;
            }
            
            const { data: { session } } = await supabaseClient.auth.getSession();
            
            if (!session) {
                return null;
            }
            
            const { data: profile } = await supabaseClient
                .from('user_profiles')
                .select('id, role, full_name, team_member_id')
                .eq('id', session.user.id)
                .single();
            
            if (profile) {
                window.currentUserRole = profile.role || 'viewer';
                window.currentUserId = profile.id;
                window.currentUserProfile = profile;
                return profile;
            }
            
            return null;
        } catch (error) {
            console.error('Error loading user role:', error);
            return null;
        }
    };
    
    // Check if user has permission for a feature
    window.hasPermission = function(permission) {
        if (!window.currentUserRole) {
            return false;
        }
        
        const rolePermissions = PERMISSIONS[window.currentUserRole];
        if (!rolePermissions) {
            return false;
        }
        
        return rolePermissions[permission] === true;
    };
    
    // Check if user can access a page
    window.canAccessPage = function(pageName) {
        if (!window.currentUserRole) {
            return false;
        }
        
        // Get current page if not specified
        if (!pageName) {
            pageName = window.location.pathname.split('/').pop();
        }
        
        const allowedRoles = PAGE_ACCESS[pageName];
        
        // If page not in list, allow by default (for now)
        if (!allowedRoles) {
            return true;
        }
        
        return allowedRoles.includes(window.currentUserRole);
    };
    
    // Check if current page is accessible and redirect if not
    window.checkPageAccess = function() {
        const currentPage = window.location.pathname.split('/').pop();
        
        // Skip check for login page
        if (currentPage === 'login.html' || currentPage === '') {
            return;
        }
        
        if (!canAccessPage(currentPage)) {
            console.warn('Access denied to:', currentPage);
            showToast('You do not have permission to access this page.', 'info');
            window.location.href = 'index.html'; // Redirect to production
        }
    };
    
    // Hide elements by role
    window.hideForRole = function(selector, roles = []) {
        const elements = document.querySelectorAll(selector);
        
        if (!window.currentUserRole) {
            return;
        }
        
        if (roles.includes(window.currentUserRole)) {
            elements.forEach(el => {
                el.style.display = 'none';
            });
        }
    };
    
    // Show elements only for specific roles
    window.showForRole = function(selector, roles = []) {
        const elements = document.querySelectorAll(selector);
        
        if (!window.currentUserRole) {
            return;
        }
        
        if (!roles.includes(window.currentUserRole)) {
            elements.forEach(el => {
                el.style.display = 'none';
            });
        }
    };
    
    // Disable buttons/inputs for read-only access
    window.makeReadOnly = function(selector) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(el => {
            if (el.tagName === 'BUTTON') {
                el.disabled = true;
                el.style.opacity = '0.5';
                el.style.cursor = 'not-allowed';
            } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                el.disabled = true;
                el.style.opacity = '0.7';
            }
        });
    };
    
    // Check if user can access a folder (for file filtering)
    window.canAccessFolder = function(folderName) {
        if (!folderName) {
            return true;
        }
        
        const lowerFolder = folderName.toLowerCase();
        
        // Check for restricted folders
        if (lowerFolder.includes('estimate') || lowerFolder.includes('estimates')) {
            return hasPermission('canAccessEstimates');
        }
        
        if (lowerFolder.includes('email') || lowerFolder.includes('emails')) {
            return hasPermission('canAccessEmails');
        }
        
        return true;
    };
    
    // Initialize permissions on page load
    window.initPermissions = async function() {
        // Wait for supabase to be ready
        const waitForSupabase = setInterval(async () => {
            if (typeof supabaseClient !== 'undefined') {
                clearInterval(waitForSupabase);
                
                await loadUserRole();
                
                // Check page access
                checkPageAccess();
                
                // Apply read-only styles for worker/viewer
                applyReadOnlyMode();
                
                // Dispatch event that permissions are ready
                window.dispatchEvent(new Event('permissionsLoaded'));
                
            }
        }, 100);
        
        // Stop checking after 5 seconds
        setTimeout(() => clearInterval(waitForSupabase), 5000);
    };
    
    // Apply read-only mode for worker/viewer
    function applyReadOnlyMode() {
        if (window.currentUserRole === 'worker' || window.currentUserRole === 'viewer') {
            // Inject CSS to disable interactions
            const style = document.createElement('style');
            style.innerHTML = `
                /* Disable phase interactions for worker/viewer */
                .phase-bar {
                    cursor: default !important;
                    pointer-events: none !important;
                }
                
                /* Disable edit icons */
                .edit-icon,
                .delete-icon,
                .action-icon {
                    display: none !important;
                }
                
                /* Disable form inputs in modals */
                .modal input:not([type="search"]),
                .modal textarea,
                .modal select {
                    opacity: 0.6;
                    pointer-events: none;
                }
                
                /* Keep search working */
                .modal input[type="search"] {
                    opacity: 1;
                    pointer-events: auto;
                }
            `;
            document.head.appendChild(style);
            
        }
    }

    
    // Auto-initialize when DOM is ready (tylko przez event listener, NIE bezpośrednio!)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initPermissions);
    } else {
        // DOM już załadowany - wywołaj funkcję initPermissions
        window.initPermissions();
    }
    
    // Export roles for easy reference
    window.ROLES = ROLES;
    
})();