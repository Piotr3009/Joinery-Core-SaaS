// ========== PROJECT FILES MANAGEMENT SYSTEM ==========

// Global callback for Production Sheet file selection
window.psFileSelectCallback = null;
window.psFileSelectFolder = null; // Optional: auto-open specific folder

// Multi-select mode
window.psMultiSelectMode = false;
window.psMultiSelectedFiles = [];
window.psMultiSelectCallback = null;
let currentDisplayedFiles = [];

let currentProjectFiles = {
    index: null,
    stage: null, // 'pipeline' | 'production' | 'archive'
    projectNumber: null,
    projectId: null,
    currentFolder: null
};

const projectFolders = ['drawings', 'client-drawings', 'photos', 'emails', 'notes'];

// ========== OPEN FILES MODAL ==========
async function openProjectFilesModal(projectIndex, stage) {
    let project;
    let projectNumber;
    let projectId;
    
    if (stage === 'pipeline') {
        project = pipelineProjects[projectIndex];
        projectNumber = project.projectNumber;
        projectId = project.id;
    } else if (stage === 'production') {
        project = projects[projectIndex];
        projectNumber = project.projectNumber;
        projectId = project.id;
    }
    
    if (!project) {
        showToast('Project not found', 'info');
        return;
    }
    
    openProjectFilesModalWithData(projectId, projectNumber, project.name, stage);
}

// Direct version for Production Sheet (no array lookup needed)
async function openProjectFilesModalDirect(projectId, projectNumber, projectName, stage) {
    openProjectFilesModalWithData(projectId, projectNumber, projectName, stage);
}

// Shared modal creation
async function openProjectFilesModalWithData(projectId, projectNumber, projectName, stage) {
    currentProjectFiles = {
        index: null,
        stage: stage,
        projectNumber: projectNumber,
        projectId: projectId,
        currentFolder: null
    };
    
    const modal = document.createElement('div');
    modal.id = 'projectFilesModal';
    modal.className = 'modal active';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content" style="width: 1200px !important; max-width: 1200px !important; height: 80vh; background: #1a1a1a; border: 1px solid #404040; display: flex; flex-direction: column;">
            <div class="modal-header" style="background: #252525; border-bottom: 1px solid #404040; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 16px 20px;">
                <div>
                    <div style="font-size: 18px; font-weight: 600; color: #fff;">📁 Project Files</div>
                    <div style="font-size: 14px; color: #999; margin-top: 4px;">
                        ${projectNumber} - ${projectName}
                    </div>
                </div>
                <button onclick="closeProjectFilesModal()" style="
                    background: #333;
                    border: 1px solid #555;
                    color: #fff;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    font-size: 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#ff4444'; this.style.borderColor='#ff4444'" onmouseout="this.style.background='#333'; this.style.borderColor='#555'">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px; overflow: hidden; background: #1a1a1a; flex: 1; padding: 16px;">
                <!-- Breadcrumb -->
                <div id="filesBreadcrumb" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #252525; border-radius: 6px; border: 1px solid #404040;">
                    <span style="cursor: pointer; color: #4a9eff;" onclick="showFolderList()">📁 Folders</span>
                </div>
                
                <!-- Content Area -->
                <div id="filesContent" style="flex: 1; overflow-y: auto; padding: 0 4px;">
                    <!-- Folders or Files will be rendered here -->
                </div>
            </div>
            <div id="filesModalFooter" style="padding: 16px 20px; background: #252525; border-top: 1px solid #404040; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div id="multiSelectInfo" style="color: #4a9eff; font-weight: 500;"></div>
                    <div id="uploadWarning" style="color: #f0ad4e; font-size: 12px;">
                        <span style="margin-right: 6px;">⚠️</span>Large files (>5MB) may take up to a minute to upload. Please wait.
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="modal-btn" onclick="closeProjectFilesModal()" style="
                        background: #333;
                        border: 1px solid #555;
                        color: #e0e0e0;
                        padding: 10px 24px;
                        border-radius: 6px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#404040'; this.style.borderColor='#666'" onmouseout="this.style.background='#333'; this.style.borderColor='#555'">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add confirm button if multi-select mode
    if (window.psMultiSelectMode) {
        const footer = document.getElementById('filesModalFooter');
        const btnContainer = footer.querySelector('div:last-child');
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'modal-btn';
        confirmBtn.innerHTML = '✓ Confirm Selection';
        confirmBtn.style.cssText = 'background: #4a9eff; border: 1px solid #4a9eff; color: #fff; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;';
        confirmBtn.onclick = confirmMultiSelection;
        btnContainer.appendChild(confirmBtn);
        updateMultiSelectInfo();
    }
    
    // If PS select mode with specific folder - open that folder directly
    if (window.psFileSelectFolder) {
        openFolder(window.psFileSelectFolder);
    } else {
        showFolderList();
    }
}

function closeProjectFilesModal() {
    const modal = document.getElementById('projectFilesModal');
    if (modal) modal.remove();
    currentProjectFiles = { index: null, stage: null, projectNumber: null, projectId: null, currentFolder: null };
    
    // Clear PS select callback
    window.psFileSelectCallback = null;
    window.psFileSelectFolder = null;
    
    // Clear multi-select
    window.psMultiSelectMode = false;
    window.psMultiSelectedFiles = [];
    window.psMultiSelectCallback = null;
}

// ========== MULTI-SELECT FUNCTIONS ==========
function openFilesModalForSelection(projectId, projectNumber, projectName, stage, target, currentSelection, confirmCallback) {
    window.psMultiSelectMode = true;
    window.psMultiSelectedFiles = currentSelection || [];
    window.psMultiSelectCallback = confirmCallback;
    
    openProjectFilesModalWithData(projectId, projectNumber, projectName, stage);
}

function toggleFileSelection(index) {
    const file = currentDisplayedFiles[index];
    if (!file) return;
    
    const existingIdx = window.psMultiSelectedFiles.findIndex(f => f.id === file.id);
    
    if (existingIdx >= 0) {
        window.psMultiSelectedFiles.splice(existingIdx, 1);
    } else {
        const { data: urlData } = supabaseClient.storage.from('project-documents').getPublicUrl(file.file_path);
        window.psMultiSelectedFiles.push({
            id: file.id,
            url: urlData.publicUrl,
            name: file.file_name,
            path: file.file_path,
            type: file.file_type
        });
    }
    
    updateMultiSelectInfo();
    loadFolderFiles(currentProjectFiles.currentFolder); // Refresh view
}

function confirmMultiSelection() {
    if (window.psMultiSelectCallback) {
        window.psMultiSelectCallback(window.psMultiSelectedFiles);
    }
    closeProjectFilesModal();
}

function updateMultiSelectInfo() {
    const info = document.getElementById('multiSelectInfo');
    if (info) {
        info.textContent = `${window.psMultiSelectedFiles.length} file(s) selected`;
    }
}

// ========== SHOW FOLDER LIST ==========
async function showFolderList() {
    currentProjectFiles.currentFolder = null;
    
    const breadcrumb = document.getElementById('filesBreadcrumb');
    breadcrumb.innerHTML = `
        <span style="color: #fff; font-weight: 500;">📁 Folders</span>
    `;
    
    const content = document.getElementById('filesContent');
    content.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #999;">
            <div style="font-size: 32px; margin-bottom: 12px;">⏳</div>
            <div style="font-size: 14px;">Loading folders...</div>
        </div>
    `;
    
    // Get file counts for each folder
    const folderCounts = await getFolderFileCounts();
    
    // Filter folders based on permissions
    const visibleFolders = projectFolders.filter(folder => {
        // Check if user can access this folder
        return window.canAccessFolder ? window.canAccessFolder(folder) : true;
    });
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; padding: 8px;">
            ${visibleFolders.map(folder => {
                const count = folderCounts[folder] || 0;
                return `
                <div class="folder-card" onclick="openFolder('${folder}')" style="
                    padding: 18px 16px;
                    border: 1px solid #404040;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                    background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    position: relative;
                " onmouseover="this.style.borderColor='#4a9eff'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(74,158,255,0.3)'" 
                   onmouseout="this.style.borderColor='#404040'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.3)'">
                    ${count > 0 ? `
                        <div style="
                            position: absolute;
                            top: 8px;
                            right: 8px;
                            background: linear-gradient(135deg, #88d498 0%, #6fb880 100%);
                            color: #1a1a1a;
                            font-size: 11px;
                            font-weight: 700;
                            padding: 3px 7px;
                            border-radius: 10px;
                            min-width: 20px;
                            text-align: center;
                            box-shadow: 0 2px 4px rgba(136,212,152,0.4);
                        ">${count}</div>
                    ` : ''}
                    <div style="margin-bottom: 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                        ${getFolderIcon(folder)}
                    </div>
                    <div style="font-weight: 600; text-transform: capitalize; color: #e0e0e0; font-size: 13px; letter-spacing: 0.3px;">
                        ${folder}
                    </div>
                </div>
            `}).join('')}
        </div>
    `;
}

// ========== GET FILE COUNTS FOR FOLDERS ==========
async function getFolderFileCounts() {
    try {
        let query = supabaseClient
            .from('project_files')
            .select('folder_name');
        
        if (currentProjectFiles.stage === 'pipeline') {
            query = query.eq('pipeline_project_id', currentProjectFiles.projectId);
        } else if (currentProjectFiles.stage === 'production') {
            query = query.eq('production_project_id', currentProjectFiles.projectId);
        }
        
        const { data: files, error } = await query;
        
        if (error) throw error;
        
        // Count files per folder (including subfolders)
        const counts = {};
        projectFolders.forEach(folder => counts[folder] = 0);
        
        if (files) {
            files.forEach(file => {
                // Skip placeholder files (.folder, .keep, etc)
                const fileName = file.file_name || '';
                if (file.folder_name && !fileName.startsWith('.')) {
                    // Get base folder (first part before /)
                    const baseFolder = file.folder_name.split('/')[0].toLowerCase();
                    // Find matching folder in projectFolders (case-insensitive)
                    const matchingFolder = projectFolders.find(f => f.toLowerCase() === baseFolder);
                    if (matchingFolder && counts.hasOwnProperty(matchingFolder)) {
                        counts[matchingFolder]++;
                    }
                }
            });
        }
        
        return counts;
    } catch (err) {
        console.error('Error getting folder counts:', err);
        return {};
    }
}

function getFolderIcon(folderName) {
    const icons = {
        estimates: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#059669" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 12H16M10 14H14" stroke="#059669" stroke-width="0.9" stroke-linecap="round"/>
            <circle cx="9" cy="12" r="0.5" fill="#059669"/>
            <circle cx="9" cy="14" r="0.5" fill="#059669"/>
            <text x="12" y="17.5" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#059669">£</text>
        </svg>`,
        
        invoices: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#DC2626" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8.5" y="10.5" width="7" height="6" rx="0.5" stroke="#DC2626" stroke-width="0.85"/>
            <path d="M9.5 12.5H14.5M9.5 14H13.5M9.5 15.5H14.5" stroke="#DC2626" stroke-width="0.6" stroke-linecap="round"/>
            <text x="12" y="13.2" text-anchor="middle" font-size="2.5" font-weight="bold" fill="#DC2626">£</text>
        </svg>`,
        
        drawings: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#2563EB" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 11L16 16M16 11L8 16" stroke="#2563EB" stroke-width="0.9" stroke-linecap="round"/>
            <circle cx="12" cy="13.5" r="2.8" stroke="#2563EB" stroke-width="0.9"/>
        </svg>`,
        
        photos: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#DB2777" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8.5" y="11" width="7" height="5" rx="0.8" stroke="#DB2777" stroke-width="0.85"/>
            <circle cx="12" cy="13.5" r="1.3" stroke="#DB2777" stroke-width="0.85"/>
            <circle cx="14" cy="12.3" r="0.5" fill="#DB2777"/>
        </svg>`,
        
        'client-drawings': `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#10B981" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 11L16 16M16 11L8 16" stroke="#10B981" stroke-width="0.9" stroke-linecap="round"/>
            <circle cx="12" cy="13.5" r="2.8" stroke="#10B981" stroke-width="0.9"/>
            <path d="M14 12L15 11" stroke="#10B981" stroke-width="0.7" stroke-linecap="round"/>
        </svg>`,
        
        emails: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#D97706" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8.5" y="11.5" width="7" height="4.5" rx="0.5" stroke="#D97706" stroke-width="0.85"/>
            <path d="M8.5 11.5L12 14L15.5 11.5" stroke="#D97706" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        
        notes: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#7C3AED" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8.5" y="11.5" width="7" height="4.5" rx="0.5" stroke="#7C3AED" stroke-width="0.85"/>
            <path d="M10 13H14M10 14.5H13" stroke="#7C3AED" stroke-width="0.7" stroke-linecap="round"/>
        </svg>`,
        
        others: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#64748B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="10" cy="13.5" r="0.8" fill="#64748B"/>
            <circle cx="12" cy="13.5" r="0.8" fill="#64748B"/>
            <circle cx="14" cy="13.5" r="0.8" fill="#64748B"/>
        </svg>`
    };
    return icons[folderName] || icons.others;
}

// ========== OPEN FOLDER ==========
async function openFolder(folderName) {
    currentProjectFiles.currentFolder = folderName;
    
    // Update breadcrumb
    const parts = folderName.split('/');
    let breadcrumbHTML = `<span style="cursor: pointer; color: #4a9eff;" onclick="showFolderList()">📁 Folders</span>`;
    
    let pathSoFar = '';
    parts.forEach((part, index) => {
        pathSoFar += (index > 0 ? '/' : '') + part;
        const currentPath = pathSoFar;
        breadcrumbHTML += `<span style="color: #666;"> / </span>`;
        if (index === parts.length - 1) {
            breadcrumbHTML += `<span style="color: #e0e0e0; font-weight: 500;">${part}</span>`;
        } else {
            breadcrumbHTML += `<span style="cursor: pointer; color: #4a9eff;" onclick="openFolder('${currentPath}')">${part}</span>`;
        }
    });
    
    const breadcrumb = document.getElementById('filesBreadcrumb');
    breadcrumb.innerHTML = breadcrumbHTML;
    
    const content = document.getElementById('filesContent');
    content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
            <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
            <div>Loading...</div>
        </div>
    `;
    
    // Load subfolders and files
    await loadFolderContents(folderName);
}

// ========== LOAD FOLDER CONTENTS (SUBFOLDERS + FILES) ==========
async function loadFolderContents(folderName) {
    try {
        // Get all files and subfolders
        let query = supabaseClient
            .from('project_files')
            .select('*')
            .order('uploaded_at', { ascending: false });
        
        if (currentProjectFiles.stage === 'pipeline') {
            query = query.eq('pipeline_project_id', currentProjectFiles.projectId);
        } else if (currentProjectFiles.stage === 'production') {
            query = query.eq('production_project_id', currentProjectFiles.projectId);
        }
        
        const { data: allFiles, error } = await query;
        
        if (error) throw error;
        
        // Find subfolders and files in current folder
        const subfolders = new Set();
        const files = [];
        
        // Add predefined subfolders for drawings and client-drawings
        if (folderName === 'drawings' || folderName === 'client-drawings') {
            subfolders.add('DWG');
            subfolders.add('PDF');
        }
        
        (allFiles || []).forEach(file => {
            const fileFolderName = file.folder_name || '';
            
            // Check if file is in current folder or subfolder (case-insensitive)
            const folderNameLower = folderName.toLowerCase();
            const fileFolderNameLower = fileFolderName.toLowerCase();
            
            if (fileFolderNameLower === folderNameLower) {
                // Direct file in this folder
                // Skip placeholder files from display
                if (file.file_name !== '.folder') {
                    files.push(file);
                }
            } else if (fileFolderNameLower.startsWith(folderNameLower + '/')) {
                // File in subfolder - detect the subfolder
                const remainder = fileFolderName.substring(folderName.length + 1);
                const nextFolder = remainder.split('/')[0];
                if (nextFolder) {
                    subfolders.add(nextFolder);
                }
            }
        });
        
        renderFolderContents(Array.from(subfolders), files, folderName);
        
    } catch (err) {
        console.error('Error loading folder contents:', err);
        const content = document.getElementById('filesContent');
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div>Error loading folder</div>
            </div>
        `;
    }
}

// ========== LOAD FILES FROM DATABASE (old function, keep for compatibility) ==========
async function loadFolderFiles(folderName) {
    await loadFolderContents(folderName);
}

// ========== RENDER FOLDER CONTENTS (SUBFOLDERS + FILES) ==========
function renderFolderContents(subfolders, files, folderName) {
    const content = document.getElementById('filesContent');
    
    let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
    
    // Get current view mode
    const currentView = localStorage.getItem('filesViewMode') || 'list';
    
    // Upload button
    html += `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="font-weight: 500; color: #999;">${subfolders.length} subfolder(s), ${files.length} file(s)</div>
            <div style="display: flex; gap: 8px;">
                <div style="position: relative;">
                    <button id="viewModeBtn" onclick="toggleViewModeDropdown()" style="
                        background: #333;
                        border: 1px solid #555;
                        color: #e0e0e0;
                        padding: 8px 16px;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    " onmouseover="this.style.background='#404040'" onmouseout="this.style.background='#333'">
                        👁️ View
                    </button>
                    <div id="viewModeDropdown" style="
                        display: none;
                        position: absolute;
                        top: 100%;
                        right: 0;
                        margin-top: 4px;
                        background: #2a2a2a;
                        border: 1px solid #555;
                        border-radius: 6px;
                        overflow: hidden;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                        z-index: 1000;
                        min-width: 140px;
                    ">
                        <div onclick="changeViewMode('list')" style="
                            padding: 10px 16px;
                            cursor: pointer;
                            transition: background 0.2s;
                            color: ${currentView === 'list' ? '#4a9eff' : '#e0e0e0'};
                            font-weight: ${currentView === 'list' ? '600' : '400'};
                        " onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'">
                            📋 List
                        </div>
                        <div onclick="changeViewMode('medium')" style="
                            padding: 10px 16px;
                            cursor: pointer;
                            transition: background 0.2s;
                            color: ${currentView === 'medium' ? '#4a9eff' : '#e0e0e0'};
                            font-weight: ${currentView === 'medium' ? '600' : '400'};
                        " onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'">
                            📄 Medium
                        </div>
                        <div onclick="changeViewMode('large')" style="
                            padding: 10px 16px;
                            cursor: pointer;
                            transition: background 0.2s;
                            color: ${currentView === 'large' ? '#4a9eff' : '#e0e0e0'};
                            font-weight: ${currentView === 'large' ? '600' : '400'};
                        " onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'">
                            🖼️ Large
                        </div>
                    </div>
                </div>
                <button class="modal-btn" onclick="createNewSubfolder('${folderName}')" style="
                    background: #333;
                    border: 1px solid #555;
                    color: #4a9eff;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#404040'" onmouseout="this.style.background='#333'">
                    ➕ New Subfolder
                </button>
                <button class="modal-btn primary" onclick="triggerFileUpload()">
                    📤 Upload Files
                </button>
            </div>
            <input type="file" id="fileUploadInput" multiple style="display: none;" onchange="handleFileUpload(event)">
        </div>
    `;
    
    // Subfolders
    if (subfolders.length > 0) {
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">';
        subfolders.forEach(subfolder => {
            html += `
                <div class="folder-card" onclick="openFolder('${folderName}/${subfolder}')" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: #252525;
                    border: 1px solid #404040;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    gap: 10px;
                    text-align: center;
                " onmouseover="this.style.background='#2a2a2a'; this.style.borderColor='#4a9eff'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#252525'; this.style.borderColor='#404040'; this.style.transform='translateY(0)'">
                    <div style="font-size: 32px;">📁</div>
                    <div style="font-size: 14px; font-weight: 500; color: #e0e0e0; word-break: break-word;">
                        ${subfolder}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Files - render based on view mode
    const viewMode = localStorage.getItem('filesViewMode') || 'list';
    if (files.length > 0) {
        html += renderFilesInView(files, viewMode);
    }
    
    // Empty state
    if (subfolders.length === 0 && files.length === 0) {
        html += `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
                <div style="font-size: 18px; color: #999; margin-bottom: 24px;">This folder is empty</div>
                <div style="font-size: 14px; color: #666;">Create a subfolder or upload files to get started</div>
            </div>
        `;
    }
    
    html += '</div>';
    content.innerHTML = html;
}

// ========== VIEW MODE FUNCTIONS ==========
function toggleViewModeDropdown() {
    const dropdown = document.getElementById('viewModeDropdown');
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    
    // Close dropdown when clicking outside
    if (!isVisible) {
        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!e.target.closest('#viewModeBtn') && !e.target.closest('#viewModeDropdown')) {
                    dropdown.style.display = 'none';
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 100);
    }
}

function changeViewMode(mode) {
    localStorage.setItem('filesViewMode', mode);
    document.getElementById('viewModeDropdown').style.display = 'none';
    // Reload current folder
    loadFolderFiles(currentProjectFiles.currentFolder);
}

// ========== RENDER FILES IN DIFFERENT VIEWS ==========
function renderFilesInView(files, viewMode) {
    if (viewMode === 'list') {
        return renderFilesListView(files);
    } else if (viewMode === 'medium') {
        return renderFilesMediumView(files);
    } else if (viewMode === 'large') {
        return renderFilesLargeView(files);
    }
    return renderFilesListView(files); // Default
}

// LIST VIEW - Compact with small icons
function renderFilesListView(files) {
    currentDisplayedFiles = files;
    let html = '<div style="display: flex; flex-direction: column; gap: 4px;">';
    files.forEach((file, index) => {
        const isMultiSelect = window.psMultiSelectMode;
        const isSelected = isMultiSelect && window.psMultiSelectedFiles.some(f => f.id === file.id);
        
        html += `
            <div class="file-row" style="
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                border: 1px solid ${isSelected ? '#4a9eff' : '#404040'};
                border-radius: 6px;
                background: ${isSelected ? 'rgba(74, 158, 255, 0.1)' : '#252525'};
                transition: all 0.2s;
                cursor: pointer;
            " onclick="${isMultiSelect ? `toggleFileSelection(${index})` : `previewFile('${file.file_path}', '${file.file_type}', '${file.file_name}')`}">
                ${isMultiSelect ? `<input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleFileSelection(${index})" style="width: 20px; height: 20px; cursor: pointer; accent-color: #4a9eff;">` : ''}
                <div style="font-size: 20px; flex-shrink: 0;">
                    ${getFileIcon(file.file_type, file.file_name)}
                </div>
                <div style="flex: 1; overflow: hidden; min-width: 0;">
                    <div style="font-weight: 500; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;">
                        ${file.file_name}
                    </div>
                    <div style="font-size: 11px; color: #888;">
                        ${formatFileSize(file.file_size)} • ${formatDate(file.uploaded_at)}
                    </div>
                </div>
                ${!isMultiSelect ? `<button onclick="event.stopPropagation(); deleteFile('${file.id}', '${file.file_path}')" style="
                    background: transparent;
                    border: 1px solid #ff4444;
                    color: #ff4444;
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                " onmouseover="this.style.background='#ff4444'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#ff4444'">🗑</button>` : ''}
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// MEDIUM VIEW - Grid with large icons (no image previews)
function renderFilesMediumView(files) {
    currentDisplayedFiles = files;
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;">';
    files.forEach((file, index) => {
        const isMultiSelect = window.psMultiSelectMode;
        const isSelected = isMultiSelect && window.psMultiSelectedFiles.some(f => f.id === file.id);
        
        html += `
            <div class="file-card" style="
                position: relative;
                border: 2px solid ${isSelected ? '#4a9eff' : '#404040'};
                border-radius: 8px;
                background: ${isSelected ? 'rgba(74, 158, 255, 0.1)' : '#252525'};
                transition: all 0.2s;
                cursor: pointer;
                overflow: hidden;
            " onclick="${isMultiSelect ? `toggleFileSelection(${index})` : `previewFile('${file.file_path}', '${file.file_type}', '${file.file_name}')`}">
                ${isMultiSelect ? `<input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleFileSelection(${index})" style="position: absolute; top: 8px; left: 8px; width: 22px; height: 22px; cursor: pointer; accent-color: #4a9eff; z-index: 10;">` : ''}
                <div style="width: 100%; height: 100px; display: flex; align-items: center; justify-content: center; background: #1a1a1a; border-radius: 6px 6px 0 0;">
                    <div style="font-size: 48px;">
                        ${getFileIcon(file.file_type, file.file_name)}
                    </div>
                </div>
                <div style="padding: 12px;">
                    <div style="font-weight: 600; color: #e0e0e0; font-size: 13px; margin-bottom: 6px; word-wrap: break-word; line-height: 1.3;">
                        ${file.file_name}
                    </div>
                    <div style="font-size: 11px; color: #888; margin-bottom: 2px;">
                        ${formatFileSize(file.file_size)}
                    </div>
                    <div style="font-size: 10px; color: #666;">
                        ${formatDate(file.uploaded_at)}
                    </div>
                </div>
                ${!isMultiSelect ? `<button onclick="event.stopPropagation(); deleteFile('${file.id}', '${file.file_path}')" style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(0,0,0,0.7);
                    border: 1px solid #ff4444;
                    color: #ff4444;
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#ff4444'; this.style.color='#fff'" onmouseout="this.style.background='rgba(0,0,0,0.7)'; this.style.color='#ff4444'">🗑</button>` : ''}
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// LARGE VIEW - Grid with large icons and image/PDF previews
function renderFilesLargeView(files) {
    currentDisplayedFiles = files;
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">';
    let pdfFilesToRender = [];
    
    files.forEach((file, index) => {
        const isMultiSelect = window.psMultiSelectMode;
        const isSelected = isMultiSelect && window.psMultiSelectedFiles.some(f => f.id === file.id);
        
        const isImage = file.file_type && (
            file.file_type.includes('image') || 
            file.file_type.includes('jpg') || 
            file.file_type.includes('png') ||
            file.file_type.includes('jpeg') ||
            file.file_type.includes('gif') ||
            file.file_type.includes('webp')
        );
        
        const isPdf = file.file_type && file.file_type.includes('pdf');
        
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(file.file_path);
        
        // Generate unique ID for this file
        const previewId = `file-preview-${file.id}`;
        
        let previewContent = '';
        if (isImage) {
            previewContent = `
                <div style="width: 100%; height: 120px; overflow: hidden; border-radius: 6px; background: #1a1a1a;">
                    <img src="${urlData.publicUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 48px;">
                        ${getFileIcon(file.file_type, file.file_name)}
                    </div>
                </div>
            `;
        } else if (isPdf) {
            // PDF preview placeholder - will be rendered async
            previewContent = `
                <div id="${previewId}" style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: #1a1a1a; border-radius: 6px;">
                    <div style="text-align: center;">
                        <div style="font-size: 32px; margin-bottom: 8px;">📄</div>
                        <div style="font-size: 11px; color: #888;">Loading PDF...</div>
                    </div>
                </div>
            `;
            // Store PDF info for async rendering
            pdfFilesToRender.push({
                url: urlData.publicUrl,
                elementId: previewId,
                filePath: file.file_path
            });
        } else {
            previewContent = `
                <div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: #1a1a1a; border-radius: 6px;">
                    <div style="font-size: 56px;">
                        ${getFileIcon(file.file_type, file.file_name)}
                    </div>
                </div>
            `;
        }
        
        html += `
            <div class="file-card" style="
                position: relative;
                border: 2px solid ${isSelected ? '#4a9eff' : '#404040'};
                border-radius: 8px;
                background: ${isSelected ? 'rgba(74, 158, 255, 0.1)' : '#252525'};
                transition: all 0.2s;
                cursor: pointer;
                overflow: hidden;
            " onclick="${isMultiSelect ? `toggleFileSelection(${index})` : `previewFile('${file.file_path}', '${file.file_type}', '${file.file_name}')`}">
                ${isMultiSelect ? `<input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleFileSelection(${index})" style="position: absolute; top: 8px; left: 8px; width: 22px; height: 22px; cursor: pointer; accent-color: #4a9eff; z-index: 10;">` : ''}
                ${previewContent}
                <div style="padding: 12px;">
                    <div style="font-weight: 600; color: #e0e0e0; font-size: 13px; margin-bottom: 6px; word-wrap: break-word; line-height: 1.3;">
                        ${file.file_name}
                    </div>
                    <div style="font-size: 11px; color: #888; margin-bottom: 2px;">
                        ${formatFileSize(file.file_size)}
                    </div>
                    <div style="font-size: 10px; color: #666;">
                        ${formatDate(file.uploaded_at)}
                    </div>
                </div>
                ${!isMultiSelect ? `<button onclick="event.stopPropagation(); deleteFile('${file.id}', '${file.file_path}')" style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(0,0,0,0.7);
                    border: 1px solid #ff4444;
                    color: #ff4444;
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#ff4444'; this.style.color='#fff'" onmouseout="this.style.background='rgba(0,0,0,0.7)'; this.style.color='#ff4444'">🗑</button>` : ''}
            </div>
        `;
    });
    html += '</div>';
    
    // Trigger PDF thumbnail generation after HTML is rendered
    if (pdfFilesToRender.length > 0) {
        setTimeout(() => {
            pdfFilesToRender.forEach(pdf => {
                generatePdfThumbnail(pdf.url, pdf.elementId, pdf.filePath);
            });
        }, 100);
    }
    
    return html;
}

// ========== CREATE NEW SUBFOLDER ==========
async function createNewSubfolder(parentFolder) {
    const subfolderName = prompt('Enter subfolder name:');
    
    if (!subfolderName || !subfolderName.trim()) {
        return;
    }
    
    const sanitized = subfolderName.trim().replace(/[^a-zA-Z0-9\s\-_]/g, '');
    
    if (!sanitized) {
        showToast('Invalid folder name', 'info');
        return;
    }
    
    // Subfolder path
    const newFolderPath = `${parentFolder}/${sanitized}`;
    
    try {
        // Create a placeholder file in database to mark folder as existing
        const placeholderData = {
            file_name: '.folder',
            folder_name: newFolderPath,
            file_path: `${newFolderPath}/.folder`,
            file_type: 'folder',
            file_size: 0
        };
        
        if (currentProjectFiles.stage === 'pipeline') {
            placeholderData.pipeline_project_id = currentProjectFiles.projectId;
        } else if (currentProjectFiles.stage === 'production') {
            placeholderData.production_project_id = currentProjectFiles.projectId;
        }
        
        const { error } = await supabaseClient
            .from('project_files')
            .insert([placeholderData]);
        
        if (error) throw error;
        
        
        // Reload to show new subfolder
        await loadFolderContents(parentFolder);
        
    } catch (err) {
        console.error('Error creating subfolder:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== RENDER FILES LIST ==========
function renderFilesList(files, folderName) {
    const content = document.getElementById('filesContent');
    
    if (files.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
                <div style="font-size: 18px; color: #999; margin-bottom: 24px;">No files yet</div>
                <button class="modal-btn primary" onclick="triggerFileUpload()">
                    📤 Upload Files
                </button>
                <input type="file" id="fileUploadInput" multiple style="display: none;" onchange="handleFileUpload(event)">
            </div>
        `;
        return;
    }
    
    content.innerHTML = `
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 500; color: #999;">${files.length} file(s)</div>
            <button class="modal-btn primary" onclick="triggerFileUpload()">
                📤 Upload Files
            </button>
            <input type="file" id="fileUploadInput" multiple style="display: none;" onchange="handleFileUpload(event)">
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 6px;">
            ${files.map(file => `
                <div class="file-row" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: 1px solid #404040;
                    border-radius: 6px;
                    background: #252525;
                    transition: all 0.2s;
                    cursor: pointer;
                " onclick="previewFile('${file.file_path}', '${file.file_type}', '${file.file_name}')" onmouseover="this.style.background='#2a2a2a'; this.style.borderColor='#4a9eff'" onmouseout="this.style.background='#252525'; this.style.borderColor='#404040'">
                    <div style="font-size: 22px;">
                        ${getFileIcon(file.file_type, file.file_name)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e0e0e0; font-size: 13px;">
                            ${file.file_name}
                        </div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">
                            ${formatFileSize(file.file_size)} • ${formatDate(file.uploaded_at)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;" onclick="event.stopPropagation()">
                        <button class="action-btn" onclick="downloadFile('${file.id}', '${file.file_path}', '${file.file_name}')" title="Download" style="background: #2a2a2a; border: 1px solid #404040; color: #4a9eff; padding: 6px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 14px;" onmouseover="this.style.background='#333'; this.style.borderColor='#4a9eff'" onmouseout="this.style.background='#2a2a2a'; this.style.borderColor='#404040'">
                            ⬇️
                        </button>
                        <button class="action-btn" onclick="deleteFile('${file.id}', '${file.file_path}')" title="Delete" style="background: #2a2a2a; border: 1px solid #404040; color: #ff4444; padding: 6px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 14px;" onmouseover="this.style.background='#3a1a1a'; this.style.borderColor='#ff4444'" onmouseout="this.style.background='#2a2a2a'; this.style.borderColor='#404040'">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getFileIcon(fileType, fileName = '') {
    // Najpierw sprawdź file_type
    let ext = '';
    
    if (fileType) {
        const type = fileType.toLowerCase();
        if (type.includes('pdf')) ext = 'pdf';
        else if (type.includes('image') || type.includes('jpg') || type.includes('png')) ext = 'image';
        else if (type.includes('excel') || type.includes('spreadsheet') || type.includes('sheet')) ext = 'excel';
        else if (type.includes('word') || type.includes('document')) ext = 'word';
        else if (type.includes('zip') || type.includes('rar')) ext = 'archive';
        else if (type.includes('video') || type.includes('mp4')) ext = 'video';
    }
    
    // Jeśli file_type puste, sprawdź rozszerzenie z nazwy pliku
    if (!ext && fileName) {
        const fileExt = fileName.toLowerCase().split('.').pop();
        if (fileExt === 'pdf') ext = 'pdf';
        else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileExt)) ext = 'image';
        else if (['xls', 'xlsx', 'csv'].includes(fileExt)) ext = 'excel';
        else if (['doc', 'docx'].includes(fileExt)) ext = 'word';
        else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExt)) ext = 'archive';
        else if (['mp4', 'avi', 'mov', 'wmv', 'mkv'].includes(fileExt)) ext = 'video';
        else if (['dwg', 'dxf', 'dwf'].includes(fileExt)) ext = 'dwg';
        else if (['skp'].includes(fileExt)) ext = 'sketchup';
    }
    
    // Zwróć SVG ikonę
    const icons = {
        pdf: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="17" text-anchor="middle" font-size="6" font-weight="bold" fill="#EF4444">PDF</text>
        </svg>`,
        
        dwg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="17" text-anchor="middle" font-size="5" font-weight="bold" fill="#3B82F6">DWG</text>
        </svg>`,
        
        image: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#10B981" stroke-width="2"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="#10B981"/>
            <path d="M21 15L16 10L5 21" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        
        excel: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 13L12 17M12 13L8 17" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
        
        word: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 13H10M7 17H13" stroke="#2563EB" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`,
        
        archive: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="17" text-anchor="middle" font-size="6" font-weight="bold" fill="#F59E0B">ZIP</text>
        </svg>`,
        
        video: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#EC4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#EC4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 12L14 15L10 18V12Z" fill="#EC4899"/>
        </svg>`,
        
        sketchup: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="17" text-anchor="middle" font-size="5" font-weight="bold" fill="#8B5CF6">SKP</text>
        </svg>`
    };
    
    // Default generic file icon
    const defaultIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 2V8H20" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    
    return icons[ext] || defaultIcon;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ========== FILE UPLOAD ==========
function triggerFileUpload() {
    document.getElementById('fileUploadInput').click();
}

async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const folderName = currentProjectFiles.currentFolder;
    if (!folderName) {
        showToast('Please select a folder first', 'warning');
        return;
    }
    
    const uploadBtn = event.target.previousElementSibling;
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Uploading...';
    
    try {
        for (let i = 0; i < files.length; i++) {
            await uploadSingleFile(files[i], folderName);
        }
        
        // Reload files list
        await loadFolderFiles(folderName);
        
        // Reset input
        event.target.value = '';
        
    } catch (err) {
        console.error('Upload error:', err);
        showToast('Error uploading files. Please try again.', 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📤 Upload Files';
    }
}

async function uploadSingleFile(file, folderName) {
    // Check file size - max 99MB
    const MAX_FILE_SIZE = 99 * 1024 * 1024; // 99MB in bytes
    if (file.size > MAX_FILE_SIZE) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        showToast(`File "${file.name}" is too large (${fileSizeMB} MB). Maximum file size is 99 MB. Please compress or split the file.`, 'error', 2000);
        throw new Error('File too large');
    }
    
    const folderPath = getFolderPath(currentProjectFiles.stage, currentProjectFiles.projectNumber, folderName);
    
    // Sanitize filename - remove invalid characters for Supabase Storage
    const sanitizedFileName = file.name
        .normalize('NFD')                          // Normalize unicode (ö → o + combining mark)
        .replace(/[\u0300-\u036f]/g, '')           // Remove combining diacritical marks
        .replace(/[^\x00-\x7F]/g, '_')             // Replace non-ASCII chars with underscore
        .replace(/[\[\]{}<>*?\\|:#%]/g, '_')       // Replace invalid chars with underscore
        .replace(/\s+/g, '_')                      // Replace spaces with underscore
        .replace(/_+/g, '_');                      // Remove multiple underscores
    
    const filePath = `${folderPath}/${sanitizedFileName}`;
    
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('project-documents')
        .upload(filePath, file, {
            contentType: file.type,
            upsert: true
        });
    
    if (uploadError) throw uploadError;
    
    // Save metadata to database
    const fileRecord = {
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        folder_name: folderName
    };
    
    if (currentProjectFiles.stage === 'pipeline') {
        fileRecord.pipeline_project_id = currentProjectFiles.projectId;
    } else if (currentProjectFiles.stage === 'production') {
        fileRecord.production_project_id = currentProjectFiles.projectId;
    }
    
    const { error: dbError } = await supabaseClient
        .from('project_files')
        .insert([fileRecord]);
    
    if (dbError) throw dbError;
    
}

// ========== FILE PREVIEW ==========
async function previewFile(filePath, fileType, fileName) {
    // Check if this is a file selection for Production Sheet
    if (window.psFileSelectCallback) {
        try {
            const { data: urlData } = supabaseClient.storage
                .from('project-documents')
                .getPublicUrl(filePath);
            
            window.psFileSelectCallback({
                file_path: filePath,
                file_name: fileName,
                file_type: fileType,
                public_url: urlData.publicUrl
            });
            
            // Clear callback and close modal
            window.psFileSelectCallback = null;
            window.psFileSelectFolder = null;
            closeProjectFilesModal();
            return;
        } catch (err) {
            console.error('Error selecting file:', err);
            showToast('Error selecting file', 'error');
            return;
        }
    }
    
    try {
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(filePath);
        
        const publicUrl = urlData.publicUrl;
        
        // Check if file can be previewed in browser
        if (!fileType) {
            // Unknown type - download instead
            window.open(publicUrl, '_blank');
            return;
        }
        
        const type = fileType.toLowerCase();
        
        // PDF, images, text - open in new tab
        if (type.includes('pdf') || 
            type.includes('image') || 
            type.includes('jpg') || 
            type.includes('jpeg') || 
            type.includes('png') || 
            type.includes('gif') || 
            type.includes('webp') ||
            type.includes('text')) {
            window.open(publicUrl, '_blank');
        } else {
            // Other files - download
            window.open(publicUrl, '_blank');
        }
        
    } catch (err) {
        console.error('Preview error:', err);
        showToast('Error opening file', 'error');
    }
}

// ========== FILE DOWNLOAD ==========
async function downloadFile(fileId, filePath, fileName) {
    try {
        const { data, error } = await supabaseClient.storage
            .from('project-documents')
            .download(filePath);
        
        if (error) throw error;
        
        // Create download link
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (err) {
        console.error('Download error:', err);
        showToast('Error downloading file', 'error');
    }
}

// ========== FILE DELETE ==========
async function deleteFile(fileId, filePath) {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
        // Delete from Storage
        const { error: storageError } = await supabaseClient.storage
            .from('project-documents')
            .remove([filePath]);
        
        if (storageError) throw storageError;
        
        // Delete from Database
        const { error: dbError } = await supabaseClient
            .from('project_files')
            .delete()
            .eq('id', fileId);
        
        if (dbError) throw dbError;
        
        
        // Reload files list
        await loadFolderFiles(currentProjectFiles.currentFolder);
        
    } catch (err) {
        console.error('Delete error:', err);
        showToast('Error deleting file', 'error');
    }
}

// ========== HELPER FUNCTIONS ==========
function getFolderPath(stage, projectNumber, folderName) {
    // Convert PL001/2025 → PL001-2025
    const folderSafeNumber = projectNumber.replace(/\//g, '-');
    return `${stage}/${folderSafeNumber}/${folderName}`;
}

// ========== CREATE NEW CUSTOM FOLDER ==========
async function createNewFolder() {
    const folderName = prompt('Enter new folder name (lowercase, no spaces):');
    
    if (!folderName) return;
    
    // Validate folder name
    const sanitized = folderName.toLowerCase().trim().replace(/\s+/g, '-');
    
    if (!sanitized) {
        showToast('Invalid folder name', 'info');
        return;
    }
    
    // Check if folder already exists
    if (projectFolders.includes(sanitized)) {
        showToast('Folder already exists!', 'info');
        return;
    }
    
    try {
        // Create folder in storage
        const folderPath = getFolderPath(currentProjectFiles.stage, currentProjectFiles.projectNumber, sanitized);
        const keepFilePath = `${folderPath}/.keep`;
        
        const { error } = await supabaseClient.storage
            .from('project-documents')
            .upload(keepFilePath, new Blob([''], { type: 'text/plain' }), {
                contentType: 'text/plain',
                upsert: false
            });
        
        if (error) throw error;
        
        // Add to projectFolders array
        projectFolders.push(sanitized);
        
        
        // Reload folder list
        await showFolderList();
        
    } catch (err) {
        console.error('Error creating folder:', err);
        showToast('Error creating folder. Please try again.', 'error');
    }
}

// ========== PDF PREVIEW FUNCTIONS ==========
// Load PDF.js library
let pdfJsLoaded = false;
let pdfJsLoading = false;

async function ensurePdfJsLoaded() {
    if (pdfJsLoaded) return true;
    if (pdfJsLoading) {
        // Wait for loading to complete
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (pdfJsLoaded) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
        return true;
    }
    
    pdfJsLoading = true;
    
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            // Set worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            pdfJsLoaded = true;
            pdfJsLoading = false;
            resolve(true);
        };
        script.onerror = () => {
            console.error('❌ Failed to load PDF.js');
            pdfJsLoading = false;
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

async function generatePdfThumbnail(pdfUrl, elementId, filePath) {
    try {
        // Ensure PDF.js is loaded
        const loaded = await ensurePdfJsLoaded();
        if (!loaded) {
            console.error('PDF.js not loaded');
            return;
        }
        
        // Download PDF with authorization
        const { data: blob, error } = await supabaseClient.storage
            .from('project-documents')
            .download(filePath);
        
        if (error || !blob) {
            console.error('Failed to download PDF:', error);
            throw new Error('Download failed');
        }
        
        // Convert blob to ArrayBuffer for PDF.js
        const arrayBuffer = await blob.arrayBuffer();
        
        // Load PDF from data
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        // Get first page
        const page = await pdf.getPage(1);
        
        // Calculate scale to fit 120px height container
        const viewport = page.getViewport({ scale: 1.0 });
        const containerHeight = 120;
        const scale = containerHeight / viewport.height;
        const scaledViewport = page.getViewport({ scale });
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        
        // Render page
        await page.render({
            canvasContext: context,
            viewport: scaledViewport
        }).promise;
        
        // Get the element and replace loading with canvas
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '';
            element.style.display = 'flex';
            element.style.alignItems = 'center';
            element.style.justifyContent = 'center';
            element.style.overflow = 'hidden';
            canvas.style.maxWidth = '100%';
            canvas.style.maxHeight = '100%';
            canvas.style.objectFit = 'contain';
            element.appendChild(canvas);
        }
        
    } catch (err) {
        console.error('PDF thumbnail error:', err);
        // Show fallback icon
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div style="font-size: 56px;">
                    ${getFileIcon('application/pdf', 'file.pdf')}
                </div>
            `;
        }
    }
}