// ========== SETTINGS PAGE FUNCTIONS ==========
// Zarządzanie ustawieniami konta i firmy

// Toggle password visibility
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

let companySettings = null;

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Czekaj na załadowanie permisji
    await waitForPermissions();
    
    loadAccountInfo();
    loadCompanySettings();
    
    // Ukryj zakładkę Company dla nie-adminów
    if (window.currentUserRole !== 'admin') {
        const companyTab = document.getElementById('companyTab');
        if (companyTab) {
            companyTab.style.display = 'none';
        }
    }
});

function waitForPermissions() {
    return new Promise((resolve) => {
        if (window.currentUserRole) {
            resolve();
        } else {
            window.addEventListener('permissionsLoaded', resolve);
            // Timeout fallback
            setTimeout(resolve, 2000);
        }
    });
}

// ========== TAB SWITCHING ==========
function switchSettingsTab(tabName) {
    // Sprawdź czy user może otworzyć zakładkę Company
    if (tabName === 'company' && window.currentUserRole !== 'admin') {
        showToast('Only administrators can access company settings', 'error');
        return;
    }
    
    // Deaktywuj wszystkie zakładki
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
    
    // Aktywuj wybraną
    document.querySelector(`.settings-tab[onclick*="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Panel`).classList.add('active');
}

// ========== ACCOUNT FUNCTIONS ==========
async function loadAccountInfo() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userFullName').value = window.currentUserProfile?.full_name || user.user_metadata?.full_name || '';
            document.getElementById('userRole').value = window.currentUserRole || 'user';
        }
    } catch (error) {
        console.error('Error loading account info:', error);
    }
}

async function changePassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    const successDiv = document.getElementById('passwordSuccess');
    const errorDiv = document.getElementById('passwordError');
    
    // Reset messages
    successDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    
    // Walidacja
    if (!newPassword) {
        errorDiv.textContent = 'Please enter a new password';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        successDiv.textContent = 'Password changed successfully!';
        successDiv.style.display = 'block';
        
        // Wyczyść pola
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showToast('Password changed successfully!', 'success');
        
    } catch (error) {
        errorDiv.textContent = error.message || 'Failed to change password';
        errorDiv.style.display = 'block';
        showToast('Failed to change password', 'error');
    }
}

// ========== COMPANY SETTINGS FUNCTIONS ==========
async function loadCompanySettings() {
    try {
        const { data, error } = await supabaseClient
            .from('company_settings')
            .select('*')
            .limit(1)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            throw error;
        }
        
        if (data) {
            companySettings = data;
            
            // Wypełnij formularz
            document.getElementById('companyName').value = data.company_name || '';
            document.getElementById('companyAddress').value = data.company_address || '';
            document.getElementById('companyPhone').value = data.company_phone || '';
            document.getElementById('companyEmail').value = data.company_email || '';
            document.getElementById('currencyCode').value = data.currency || 'GBP';
            document.getElementById('currencySymbol').value = data.currency_symbol || '£';
            
            // Logo
            if (data.logo_url) {
                showLogoPreview(data.logo_url);
            }
        }
    } catch (error) {
        console.error('Error loading company settings:', error);
    }
}

async function saveCompanySettings() {
    if (window.currentUserRole !== 'admin') {
        showToast('Only administrators can save company settings', 'error');
        return;
    }
    
    const successDiv = document.getElementById('companySuccess');
    const errorDiv = document.getElementById('companyError');
    
    successDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    
    const settings = {
        company_name: document.getElementById('companyName').value.trim(),
        company_address: document.getElementById('companyAddress').value.trim(),
        company_phone: document.getElementById('companyPhone').value.trim(),
        company_email: document.getElementById('companyEmail').value.trim(),
        currency: document.getElementById('currencyCode').value,
        currency_symbol: document.getElementById('currencySymbol').value.trim()
    };
    
    try {
        let result;
        
        if (companySettings?.id) {
            // Update istniejącego rekordu
            result = await supabaseClient
                .from('company_settings')
                .update(settings)
                .eq('id', companySettings.id)
                .select()
                .single();
        } else {
            // Insert nowego rekordu
            result = await supabaseClient
                .from('company_settings')
                .insert(settings)
                .select()
                .single();
        }
        
        if (result.error) throw result.error;
        
        companySettings = result.data;
        
        successDiv.textContent = 'Company settings saved successfully!';
        successDiv.style.display = 'block';
        showToast('Company settings saved!', 'success');
        
    } catch (error) {
        errorDiv.textContent = error.message || 'Failed to save settings';
        errorDiv.style.display = 'block';
        showToast('Failed to save settings', 'error');
    }
}

// ========== LOGO UPLOAD ==========
async function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Walidacja
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) { // 2MB
        showToast('File size must be less than 2MB', 'error');
        return;
    }
    
    try {
        showToast('Uploading logo...', 'info');
        
        // Generuj unikalną nazwę pliku
        const fileExt = file.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;
        
        // Usuń stare logo jeśli istnieje
        if (companySettings?.logo_url) {
            const oldPath = extractPathFromUrl(companySettings.logo_url);
            if (oldPath) {
                await supabaseClient.storage
                    .from('company-assets')
                    .remove([oldPath]);
            }
        }
        
        // Upload nowego logo
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('company-assets')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (uploadError) throw uploadError;
        
        // Pobierz publiczny URL
        const { data: urlData } = supabaseClient.storage
            .from('company-assets')
            .getPublicUrl(filePath);
        
        const logoUrl = urlData.publicUrl;
        
        // Zapisz URL w bazie
        const { error: updateError } = await supabaseClient
            .from('company_settings')
            .update({ logo_url: logoUrl })
            .eq('id', companySettings.id);
        
        if (updateError) throw updateError;
        
        // Aktualizuj UI
        companySettings.logo_url = logoUrl;
        showLogoPreview(logoUrl);
        
        // Wyczyść cache brandingu dla PDF
        if (typeof clearBrandingCache === 'function') {
            clearBrandingCache();
        }
        
        showToast('Logo uploaded successfully!', 'success');
        
    } catch (error) {
        console.error('Logo upload error:', error);
        showToast('Failed to upload logo: ' + error.message, 'error');
    }
    
    // Reset input
    event.target.value = '';
}

function showLogoPreview(url) {
    const preview = document.getElementById('logoPreview');
    preview.innerHTML = `<img src="${url}" alt="Company Logo">`;
    document.getElementById('removeLogoBtn').style.display = 'block';
}

async function removeLogo() {
    if (!confirm('Are you sure you want to remove the logo?')) return;
    
    try {
        // Usuń plik ze storage
        if (companySettings?.logo_url) {
            const filePath = extractPathFromUrl(companySettings.logo_url);
            if (filePath) {
                await supabaseClient.storage
                    .from('company-assets')
                    .remove([filePath]);
            }
        }
        
        // Usuń URL z bazy
        const { error } = await supabaseClient
            .from('company_settings')
            .update({ logo_url: null })
            .eq('id', companySettings.id);
        
        if (error) throw error;
        
        // Reset UI
        companySettings.logo_url = null;
        const preview = document.getElementById('logoPreview');
        preview.innerHTML = '<span class="placeholder">No logo<br>uploaded</span>';
        document.getElementById('removeLogoBtn').style.display = 'none';
        
        // Wyczyść cache brandingu dla PDF
        if (typeof clearBrandingCache === 'function') {
            clearBrandingCache();
        }
        
        showToast('Logo removed', 'success');
        
    } catch (error) {
        showToast('Failed to remove logo: ' + error.message, 'error');
    }
}

function extractPathFromUrl(url) {
    // Wyciągnij ścieżkę pliku z pełnego URL Supabase Storage
    // URL format: https://xxx.supabase.co/storage/v1/object/public/company-assets/logos/logo_123.png
    const match = url.match(/company-assets\/(.+)/);
    return match ? match[1] : null;
}

// ========== CURRENCY ==========
function updateCurrencySymbol() {
    const currencyCode = document.getElementById('currencyCode').value;
    const symbols = {
        'GBP': '£',
        'EUR': '€',
        'USD': '$',
        'PLN': 'zł'
    };
    document.getElementById('currencySymbol').value = symbols[currencyCode] || currencyCode;
}

// ========== GLOBAL ACCESS ==========
// Funkcja do pobrania ustawień firmy z innych stron
window.getCompanySettings = async function() {
    try {
        const { data } = await supabaseClient
            .from('company_settings')
            .select('*')
            .limit(1)
            .single();
        return data;
    } catch (error) {
        console.error('Error getting company settings:', error);
        return null;
    }
};

// Funkcja do pobrania symbolu waluty
window.getCurrencySymbol = async function() {
    const settings = await window.getCompanySettings();
    return settings?.currency_symbol || '£';
};

// ========== GDPR - DATA EXPORT & DELETE ==========

async function exportAllData() {
    const btn = document.getElementById('exportDataBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Exporting...';
    
    try {
        showToast('Preparing data export...', 'info');
        
        // Pobierz wszystkie dane użytkownika
        const exportData = {
            exportDate: new Date().toISOString(),
            exportedBy: window.currentUserProfile?.email || 'unknown',
            data: {}
        };
        
        // Projects (active)
        const { data: projects } = await supabaseClient
            .from('projects')
            .select('*');
        exportData.data.projects = projects || [];
        
        // Pipeline projects
        const { data: pipelineProjects } = await supabaseClient
            .from('pipeline_projects')
            .select('*');
        exportData.data.pipelineProjects = pipelineProjects || [];
        
        // Archived projects
        const { data: archivedProjects } = await supabaseClient
            .from('archived_projects')
            .select('*');
        exportData.data.archivedProjects = archivedProjects || [];
        
        // Project phases
        const { data: projectPhases } = await supabaseClient
            .from('project_phases')
            .select('*');
        exportData.data.projectPhases = projectPhases || [];
        
        // Archived project phases
        const { data: archivedPhases } = await supabaseClient
            .from('archived_project_phases')
            .select('*');
        exportData.data.archivedProjectPhases = archivedPhases || [];
        
        // Clients
        const { data: clients } = await supabaseClient
            .from('clients')
            .select('*');
        exportData.data.clients = clients || [];
        
        // Team members
        const { data: teamMembers } = await supabaseClient
            .from('team_members')
            .select('*');
        exportData.data.teamMembers = teamMembers || [];
        
        // Wages
        const { data: wages } = await supabaseClient
            .from('wages')
            .select('*');
        exportData.data.wages = wages || [];
        
        // Materials
        const { data: materials } = await supabaseClient
            .from('materials')
            .select('*');
        exportData.data.materials = materials || [];
        
        // Material categories
        const { data: materialCategories } = await supabaseClient
            .from('material_categories')
            .select('*');
        exportData.data.materialCategories = materialCategories || [];
        
        // Suppliers
        const { data: suppliers } = await supabaseClient
            .from('suppliers')
            .select('*');
        exportData.data.suppliers = suppliers || [];
        
        // Equipment
        const { data: equipment } = await supabaseClient
            .from('equipment')
            .select('*');
        exportData.data.equipment = equipment || [];
        
        // Company settings
        const { data: companySettings } = await supabaseClient
            .from('company_settings')
            .select('*');
        exportData.data.companySettings = companySettings || [];
        
        // Custom phases
        const { data: customPhases } = await supabaseClient
            .from('custom_phases')
            .select('*');
        exportData.data.customPhases = customPhases || [];
        
        // Holidays
        const { data: holidays } = await supabaseClient
            .from('company_holidays')
            .select('*');
        exportData.data.holidays = holidays || [];
        
        // Create and download file
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `joinery-core-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export data: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📥 Export All Data';
    }
}

async function confirmDeleteAccount() {
    // Krok 1: Pierwsze potwierdzenie
    const confirm1 = confirm(
        '⚠️ DELETE ACCOUNT\n\n' +
        'This will PERMANENTLY DELETE your account and ALL data.\n\n' +
        'This action CANNOT be undone.\n\n' +
        'Are you sure you want to proceed?'
    );
    
    if (!confirm1) return;
    
    // Krok 2: Drugie potwierdzenie z wpisaniem tekstu
    const confirmText = prompt(
        'To confirm deletion, please type "DELETE" (all caps):'
    );
    
    if (confirmText !== 'DELETE') {
        showToast('Account deletion cancelled', 'info');
        return;
    }
    
    // Krok 3: Ostatnie potwierdzenie
    const confirm3 = confirm(
        '🚨 FINAL WARNING 🚨\n\n' +
        'You are about to permanently delete:\n' +
        '• All your projects and phases\n' +
        '• All client information\n' +
        '• All team members and wages\n' +
        '• All materials and equipment\n' +
        '• All files and documents\n\n' +
        'This is your LAST CHANCE to cancel.\n\n' +
        'Click OK to permanently delete everything.'
    );
    
    if (!confirm3) {
        showToast('Account deletion cancelled', 'info');
        return;
    }
    
    // Wykonaj usunięcie
    const btn = document.getElementById('deleteAccountBtn');
    btn.disabled = true;
    btn.textContent = '🗑️ Deleting...';
    
    try {
        showToast('Deleting account...', 'info');
        
        // Pobierz tenant_id
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('User not found');
        
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('tenant_id')
            .eq('user_id', user.id)
            .single();
        
        if (!profile?.tenant_id) throw new Error('Tenant not found');
        
        const tenantId = profile.tenant_id;
        
        // Usuń wszystkie dane w odpowiedniej kolejności (ze względu na foreign keys)
        // Storage files first
        try {
            const { data: files } = await supabaseClient.storage
                .from('project-files')
                .list('', { limit: 1000 });
            
            if (files && files.length > 0) {
                const filePaths = files.map(f => f.name);
                await supabaseClient.storage
                    .from('project-files')
                    .remove(filePaths);
            }
        } catch (e) {
            console.log('No files to delete or error:', e);
        }
        
        // Delete in order (child tables first)
        await supabaseClient.from('wages').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('archived_project_phases').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('project_phases').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('archived_projects').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('pipeline_projects').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('projects').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('team_members').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('clients').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('materials').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('material_categories').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('suppliers').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('equipment').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('custom_phases').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('company_holidays').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('company_settings').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('user_profiles').delete().eq('tenant_id', tenantId);
        await supabaseClient.from('tenants').delete().eq('id', tenantId);
        
        // Sign out and delete auth user
        await supabaseClient.auth.signOut();
        
        // Redirect to goodbye page or login
        showToast('Account deleted successfully', 'success');
        
        setTimeout(() => {
            window.location.href = 'login.html?deleted=1';
        }, 2000);
        
    } catch (error) {
        console.error('Delete account error:', error);
        showToast('Failed to delete account: ' + error.message, 'error');
        btn.disabled = false;
        btn.textContent = '🗑️ Delete My Account';
    }
}