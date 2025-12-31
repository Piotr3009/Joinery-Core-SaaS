// ========== SETTINGS PAGE FUNCTIONS ==========
// Zarządzanie ustawieniami konta i firmy

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