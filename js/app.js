// ========== INITIALIZATION WITH AUTH FIX ==========
let isInitialized = false; // Zapobiegaj wielokrotnemu uruchomieniu

window.addEventListener('DOMContentLoaded', async () => {
    if (isInitialized) return;
    isInitialized = true;
    
    // Czekaj na permissions.js (unika duplikatu getSession + profile query)
    const waitForProfile = () => new Promise((resolve) => {
        // Jeśli profil już załadowany przez permissions.js
        if (window.currentUserProfile) {
            resolve(window.currentUserProfile);
            return;
        }
        
        // Czekaj na event permissionsLoaded
        const handler = () => {
            window.removeEventListener('permissionsLoaded', handler);
            resolve(window.currentUserProfile);
        };
        window.addEventListener('permissionsLoaded', handler);
        
        // Timeout po 3s - permissions.js mógł się nie załadować
        setTimeout(() => {
            window.removeEventListener('permissionsLoaded', handler);
            resolve(null);
        }, 3000);
    });
    
    const profile = await waitForProfile();
    
    if (!profile) {
        // Nie zalogowany - przekieruj
        window.location.href = 'login.html';
        return;
    }
    
    window.currentUser = profile;
    
    // Dodaj user dropdown do toolbara (jeśli menu.js jeszcze nie dodał)
    if (!document.getElementById('userDropdownContainer')) {
        addUserDropdownToToolbar(profile);
    }
    
    // TERAZ ładuj dane i renderuj TYLKO RAZ
    await loadData(); // Czekaj na załadowanie
    
    // MIGRACJA: Uzupełnij phase_category dla starych danych
    migratePhaseCategories();
    
    updatePhasesLegend();
    render(); // Renderuj TYLKO RAZ po załadowaniu
});

// LOGOUT
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        supabaseClient.auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    }
}

// Close modals on ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// MIGRACJA: Automatycznie uzupełnij phase_category dla starych danych
function migratePhaseCategories() {
    const PRODUCTION_PHASES = ['timber', 'spray', 'glazing', 'qc'];
    const OFFICE_PHASES = ['md', 'siteSurvey', 'order', 'orderGlazing', 'orderSpray', 'dispatch', 'installation'];
    
    let migrated = 0;
    
    projects.forEach(project => {
        if (project.phases) {
            project.phases.forEach(phase => {
                if (!phase.category) {
                    // Uzupełnij category na podstawie phase_key
                    if (PRODUCTION_PHASES.includes(phase.key)) {
                        phase.category = 'production';
                        migrated++;
                    } else if (OFFICE_PHASES.includes(phase.key)) {
                        phase.category = 'office';
                        migrated++;
                    } else {
                        // Domyślnie production dla nieznanych faz
                        phase.category = 'production';
                        migrated++;
                    }
                }
            });
        }
    });
    
    if (migrated > 0) {
        saveData(); // Zapisz zmigrowane dane
    }
}

// ========== PERMISSIONS: HIDE BUTTONS FOR WORKER ==========
window.addEventListener('permissionsLoaded', function() {
    if (!window.currentUserRole) return;
    
    
    // Worker/Viewer = read-only mode
    if (window.currentUserRole === 'worker' || window.currentUserRole === 'viewer') {
        // Hide toolbar buttons
        const buttonsToHide = [
            '#addProjectBtn',
            'button[onclick="openMoveToArchiveModal()"]',
            'button[onclick="openPhaseManager()"]'
        ];
        
        buttonsToHide.forEach(selector => {
            const btn = document.querySelector(selector);
            if (btn) btn.style.display = 'none';
        });
        
        // Hide export dropdown
        const exportDropdown = document.querySelector('.export-dropdown');
        if (exportDropdown) exportDropdown.style.display = 'none';
    }
});