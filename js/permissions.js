/**
 * Joinery Core SaaS - Permissions System
 * Poprawki:
 * - normalizeRole: owner -> admin
 * - maybeSingle() zamiast single()
 * - Guard dla showToast
 * - Timeout fallback
 */

(function() {
    'use strict';

    // Role permissions matrix
    const PERMISSIONS = {
        admin: {
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canViewFinancials: true,
            canManageTeam: true,
            canManageSettings: true,
            canExport: true,
            canArchive: true,
            canEditClients: true
        },
        manager: {
            canCreate: true,
            canEdit: true,
            canDelete: false,
            canViewFinancials: true,
            canManageTeam: true,
            canManageSettings: false,
            canExport: true,
            canArchive: true,
            canEditClients: true
        },
        worker: {
            canCreate: false,
            canEdit: true,
            canDelete: false,
            canViewFinancials: false,
            canManageTeam: false,
            canManageSettings: false,
            canExport: false,
            canArchive: false,
            canEditClients: false
        },
        viewer: {
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canViewFinancials: false,
            canManageTeam: false,
            canManageSettings: false,
            canExport: false,
            canArchive: false,
            canEditClients: false
        }
    };

    // Page access by role
    const PAGE_ACCESS = {
        'index.html': ['admin', 'manager', 'worker', 'viewer'],
        'office.html': ['admin', 'manager', 'worker', 'viewer'],
        'pipeline.html': ['admin', 'manager', 'worker', 'viewer'],
        'production-sheet.html': ['admin', 'manager', 'worker', 'viewer'],
        'archive.html': ['admin', 'manager', 'viewer'],
        'stock.html': ['admin', 'manager', 'worker', 'viewer'],
        'equipment.html': ['admin', 'manager', 'worker', 'viewer'],
        'clients.html': ['admin', 'manager'],
        'suppliers.html': ['admin', 'manager'],
        'team.html': ['admin', 'manager'],
        'accounting.html': ['admin', 'manager'],
        'settings.html': ['admin'],
        'holidays.html': ['admin', 'manager'],
        'today.html': ['admin', 'manager', 'worker', 'viewer']
    };

    // Normalize role (owner -> admin, etc.)
    function normalizeRole(role) {
        const r = String(role || '').toLowerCase();
        const map = {
            owner: 'admin',
            superadmin: 'admin',
            admin: 'admin',
            manager: 'manager',
            worker: 'worker',
            viewer: 'viewer'
        };
        return map[r] || 'viewer';
    }

    // Load current user role
    window.loadUserRole = async function() {
        try {
            if (typeof supabaseClient === 'undefined') {
                console.warn('Supabase not loaded yet');
                return null;
            }

            const { data, error: sessErr } = await supabaseClient.auth.getSession();
            const session = data?.session;

            if (sessErr || !session?.access_token) {
                return null;
            }

            const userId = session.user?.id || (await supabaseClient.auth.getUser()).data?.user?.id;
            if (!userId) return null;

            const res = await supabaseClient
                .from('user_profiles')
                .select('id, role, full_name, team_member_id')
                .eq('id', userId)
                .maybeSingle();

            const profile = res?.data || null;
            const profileError = res?.error || null;

            if (profileError) {
                console.warn('Profile load error:', profileError);
            }

            window.currentUserRole = normalizeRole(profile?.role);
            window.currentUserId = profile?.id || userId;
            window.currentUserProfile = profile || { id: userId, role: window.currentUserRole, full_name: '' };

            return window.currentUserProfile;
        } catch (error) {
            console.error('Error loading user role:', error);
            window.currentUserRole = 'viewer';
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

        if (!pageName) {
            pageName = window.location.pathname.split('/').pop() || 'index.html';
        }

        const allowedRoles = PAGE_ACCESS[pageName];

        // If page not defined -> allow (for flexibility)
        if (!allowedRoles) {
            return true;
        }

        return allowedRoles.includes(window.currentUserRole);
    };

    // Check if current page is accessible and redirect if not
    window.checkPageAccess = function() {
        const currentPage = window.location.pathname.split('/').pop();

        // Skip check for login/register pages
        if (currentPage === 'login.html' || currentPage === '' || currentPage === 'register.html') {
            return;
        }

        // Skip if role not loaded yet
        if (!window.currentUserRole) {
            return;
        }

        if (!canAccessPage(currentPage)) {
            console.warn('Access denied to:', currentPage);
            if (typeof showToast === 'function') {
                showToast('You do not have permission to access this page.', 'info');
            }
            if (currentPage !== 'index.html') {
                window.location.href = 'index.html';
            }
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

    // Disable form elements for non-editors
    window.disableForViewers = function(selector) {
        if (!hasPermission('canEdit')) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.disabled = true;
                el.classList.add('disabled');
            });
        }
    };

    // Initialize permissions on page load
    window.initPermissions = async function() {
        const startedAt = Date.now();

        const timer = setInterval(async () => {
            if (typeof supabaseClient !== 'undefined') {
                clearInterval(timer);

                await loadUserRole();
                checkPageAccess();
                applyReadOnlyMode();

                window.dispatchEvent(new Event('permissionsLoaded'));
                return;
            }

            // Timeout 5s: fallback viewer + event
            if (Date.now() - startedAt > 5000) {
                clearInterval(timer);
                if (!window.currentUserRole) {
                    window.currentUserRole = 'viewer';
                }
                applyReadOnlyMode();
                window.dispatchEvent(new Event('permissionsLoaded'));
            }
        }, 100);
    };

    // Apply read-only mode for worker/viewer
    function applyReadOnlyMode() {
        if (window.currentUserRole === 'worker' || window.currentUserRole === 'viewer') {
            const style = document.createElement('style');
            style.innerHTML = `
                /* Disable phase interactions for worker/viewer */
                .phase-bar {
                    cursor: default !important;
                    pointer-events: none !important;
                }
                
                /* Hide action buttons */
                .action-buttons .delete-btn,
                .action-buttons .edit-btn {
                    display: none !important;
                }
                
                /* Disable drag handles */
                .drag-handle {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Auto-init on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPermissions);
    } else {
        initPermissions();
    }

})();
