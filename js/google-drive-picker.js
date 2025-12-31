// ========== GOOGLE DRIVE PICKER CONFIGURATION ==========

// KONFIGURACJA DLA SKYLON JOINERY
const GOOGLE_CONFIG = {
    API_KEY: 'AIzaSyCGCY0cLvJWS0RApvTxOVn15bhhEYHvP1w',
    CLIENT_ID: '320768714420-ov2q2b39khn2o803kv5mumf5slqmr6g6.apps.googleusercontent.com',
    APP_ID: '320768714420', // Project number z Client ID
    SCOPE: 'https://www.googleapis.com/auth/drive.readonly'
};

// Global variables
let pickerInited = false;
let gisInited = false;
let tokenClient;
let accessToken;
let currentProjectForPicker = null;

// Load Google APIs
function loadGoogleAPIs() {
    // Load Google Identity Services
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
        gisLoaded();
    };
    document.head.appendChild(gisScript);

    // Load Google Picker API
    const pickerScript = document.createElement('script');
    pickerScript.src = 'https://apis.google.com/js/api.js';
    pickerScript.async = true;
    pickerScript.defer = true;
    pickerScript.onload = () => {
        gapi.load('picker', () => {
            pickerInited = true;
        });
    };
    document.head.appendChild(pickerScript);
}

// Initialize Google Identity Services
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        scope: GOOGLE_CONFIG.SCOPE,
        callback: (response) => {
            if (response.error !== undefined) {
                console.error('Token error:', response);
                return;
            }
            accessToken = response.access_token;
            createPicker();
        }
    });
    gisInited = true;
}

// Open Google Drive Picker for a project
function openGoogleDrivePicker(project) {
    currentProjectForPicker = project;
    
    // Check if APIs are loaded
    if (!gisInited || !pickerInited) {
        showToast('Google APIs are still loading. Please try again in a moment.', 'warning');
        return;
    }

    // Request access token
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

// Create and display the picker
function createPicker() {
    if (!accessToken || !currentProjectForPicker) return;

    const view = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMode(google.picker.DocsViewMode.LIST);

    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setDeveloperKey(GOOGLE_CONFIG.API_KEY)
        .setAppId(GOOGLE_CONFIG.APP_ID)
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback(pickerCallback)
        .setTitle(`Select folder for: ${currentProjectForPicker.name}`)
        .build();

    picker.setVisible(true);
}

// Handle picker selection  
async function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
        const folder = data.docs[0];

        // Prepare folder URL
        const folderUrl = folder.url || `https://drive.google.com/drive/folders/${folder.id}`;
        
        // Save to current project object (for immediate UI update)
        currentProjectForPicker.google_drive_url = folderUrl;
        currentProjectForPicker.google_drive_folder_id = folder.id;
        currentProjectForPicker.google_drive_folder_name = folder.name;
        
        // Update project in projects[] array using helper function
        if (typeof window.updateProjectGoogleDrive === 'function') {
            window.updateProjectGoogleDrive(
                currentProjectForPicker.projectNumber,
                folderUrl,
                folder.id,
                folder.name
            );
        } else {
            console.error('❌ updateProjectGoogleDrive function not available');
        }

        // Save to Supabase
        if (typeof supabaseClient !== 'undefined') {
            const { error } = await supabaseClient
                .from('projects')
                .update({ 
                    google_drive_url: folderUrl,
                    google_drive_folder_id: folder.id
                })
                .eq('project_number', currentProjectForPicker.projectNumber);

            if (error) {
                console.error('Error saving to Supabase:', error);
                showToast('Failed to save Google Drive folder', 'error');
            } else {
                showToast(`Folder "${folder.name}" linked successfully!`, 'success');
                
                // Re-render to show the change
                if (typeof render !== 'undefined') render();
            }
        }

        // Save locally - now projects[] has the google_drive_url!
        if (typeof saveDataQueued !== 'undefined') saveDataQueued();
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // Check if we have API keys configured
    if (GOOGLE_CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
        console.warn('⚠️ Google Drive Picker: Please configure API keys in google-drive-picker.js');
        return;
    }
    
    // Load Google APIs
    loadGoogleAPIs();
});

// Export for use in other files
window.openGoogleDrivePicker = openGoogleDrivePicker;