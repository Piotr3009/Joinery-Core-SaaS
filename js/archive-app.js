// ========== ARCHIVE APP ==========

let archivedProjects = [];
let allClients = {};
let allWorkers = {};
let filteredProjects = [];
let currentEditingProject = null;

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadClients();
    await loadWorkers();
    await loadArchivedProjects();
    setupFilters();
    renderProjects();
});

// Check authentication
async function checkAuth() {
    if (typeof supabaseClient !== 'undefined') {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
    }
}

// Load clients for filter and display
async function loadClients() {
    try {
        const { data, error } = await supabaseClient
            .from('clients')
            .select('id, client_number, company_name, contact_person');
        
        if (error) throw error;
        
        data.forEach(client => {
            allClients[client.id] = client;
        });
        
        // Populate client filter
        const clientFilter = document.getElementById('clientFilter');
        data.sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));
        data.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.client_number} - ${client.company_name || client.contact_person}`;
            clientFilter.appendChild(option);
        });
        
    } catch (err) {
        console.error('Error loading clients:', err);
    }
}

// Load workers for display
async function loadWorkers() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('id, name, color');
        
        if (error) throw error;
        
        data.forEach(worker => {
            allWorkers[worker.id] = worker;
        });
        
    } catch (err) {
        console.error('Error loading workers:', err);
    }
}

// Load archived projects
async function loadArchivedProjects() {
    try {
        const { data, error } = await supabaseClient
            .from('archived_projects')
            .select('*')
            .order('archived_date', { ascending: false });
        
        if (error) throw error;
        
        archivedProjects = data || [];
        
        // Load file sizes for each project
        await loadProjectFileSizes();
        
        filteredProjects = [...archivedProjects];
        
        
        // Update stats
        updateStats();
        
        // Populate year filter
        populateYearFilter();
        
    } catch (err) {
        console.error('Error loading archived projects:', err);
        archivedProjects = [];
        filteredProjects = [];
    }
}

// Load file sizes for all projects
async function loadProjectFileSizes() {
    try {
        // Get all files with their sizes
        const { data: allFiles, error } = await supabaseClient
            .from('archived_project_files')
            .select('project_number, file_size');
        
        if (error) {
            console.error('Error loading file sizes:', error);
            return;
        }
        
        // Calculate total size per project
        const sizesByProject = {};
        if (allFiles) {
            allFiles.forEach(file => {
                if (!sizesByProject[file.project_number]) {
                    sizesByProject[file.project_number] = 0;
                }
                sizesByProject[file.project_number] += file.file_size || 0;
            });
        }
        
        // Add storage_size to each project
        archivedProjects.forEach(project => {
            project.storage_size = sizesByProject[project.project_number] || 0;
        });
        
        
    } catch (err) {
        console.error('Error calculating file sizes:', err);
    }
}

// Update statistics
function updateStats() {
    const total = archivedProjects.length;
    const completed = archivedProjects.filter(p => p.archive_reason === 'completed').length;
    const failed = archivedProjects.filter(p => p.archive_reason === 'failed').length;
    const cancelled = archivedProjects.filter(p => p.archive_reason === 'cancelled' || p.archive_reason === 'canceled').length;
    
    document.getElementById('totalCount').textContent = total;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('failedCount').textContent = failed;
    document.getElementById('cancelledCount').textContent = cancelled;
}

// Populate year filter
function populateYearFilter() {
    const years = new Set();
    archivedProjects.forEach(project => {
        if (project.archived_date) {
            const year = new Date(project.archived_date).getFullYear();
            years.add(year);
        }
    });
    
    const yearFilter = document.getElementById('yearFilter');
    Array.from(years).sort((a, b) => b - a).forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

// Setup filters
function setupFilters() {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('sourceFilter').addEventListener('change', applyFilters);
    document.getElementById('reasonFilter').addEventListener('change', applyFilters);
    document.getElementById('clientFilter').addEventListener('change', applyFilters);
    document.getElementById('yearFilter').addEventListener('change', applyFilters);
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sourceFilter = document.getElementById('sourceFilter').value;
    const reasonFilter = document.getElementById('reasonFilter').value;
    const clientFilter = document.getElementById('clientFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    
    filteredProjects = archivedProjects.filter(project => {
        // Search filter
        if (searchTerm) {
            const matchesSearch = 
                (project.project_number || '').toLowerCase().includes(searchTerm) ||
                (project.name || '').toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;
        }
        
        // Source filter
        if (sourceFilter && project.source !== sourceFilter) {
            return false;
        }
        
        // Reason filter (handle both cancelled and canceled spelling)
        if (reasonFilter) {
            if (reasonFilter === 'cancelled') {
                if (project.archive_reason !== 'cancelled' && project.archive_reason !== 'canceled') {
                    return false;
                }
            } else if (project.archive_reason !== reasonFilter) {
                return false;
            }
        }
        
        // Client filter
        if (clientFilter && project.client_id !== clientFilter) {
            return false;
        }
        
        // Year filter
        if (yearFilter) {
            const projectYear = new Date(project.archived_date).getFullYear();
            if (projectYear.toString() !== yearFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    renderProjects();
}

// Render projects
function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    const noProjects = document.getElementById('noProjects');
    
    if (filteredProjects.length === 0) {
        grid.style.display = 'none';
        noProjects.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    noProjects.style.display = 'none';
    
    grid.innerHTML = filteredProjects.map(project => createProjectCard(project)).join('');
}

// Create project card HTML
function createProjectCard(project) {
    const client = allClients[project.client_id];
    const clientName = client ? (client.company_name || client.contact_person) : 'Unknown Client';
    const clientNumber = client ? client.client_number : '-';
    
    const timberWorker = allWorkers[project.timber_worker_id];
    const sprayWorker = allWorkers[project.spray_worker_id];
    
    // Normalize canceled/cancelled spelling
    let reasonClass = project.archive_reason || 'completed';
    if (reasonClass === 'canceled') reasonClass = 'cancelled';
    
    const reasonIcon = {
        'completed': '✅',
        'failed': '❌',
        'cancelled': '⚠️',
        'onHold': '⏸️'
    }[reasonClass] || '📦';
    
    const reasonText = reasonClass.charAt(0).toUpperCase() + reasonClass.slice(1);
    
    const sourceIcon = project.source === 'pipeline' ? '📄' : '🏭';
    const sourceText = project.source === 'pipeline' ? 'Pipeline' : 'Production';
    const sourceBg = project.source === 'pipeline' ? '#2c5a8f' : '#5a4632';
    
    const archivedDate = project.archived_date ? 
        new Date(project.archived_date).toLocaleDateString('en-GB') : '-';
    
    const deadlineDate = project.deadline ? 
        new Date(project.deadline).toLocaleDateString('en-GB') : '-';
    
    return `
        <div class="project-card ${reasonClass}">
            <div class="project-header-row">
                <div class="project-main-info">
                    <div class="project-number">${project.project_number || '-'}</div>
                    <div class="project-name">${project.name || 'Unnamed Project'}</div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <span class="project-type-badge">${project.type || 'other'}</span>
                        <span class="project-type-badge" style="background: ${sourceBg};">${sourceIcon} ${sourceText}</span>
                    </div>
                </div>
                <div class="project-dates">
                    <div style="margin-bottom: 8px;">
                        <div class="archive-reason reason-${reasonClass}">
                            ${reasonIcon} ${reasonText}
                        </div>
                    </div>
                    <div style="margin-bottom: 10px;">Archived: ${archivedDate}</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="toolbar-btn" style="padding: 6px 12px; font-size: 12px;" onclick="openArchiveMaterialsModal('${project.project_number}', '${project.id}')">📦 Materials</button>
                        <button class="toolbar-btn" style="padding: 6px 12px; font-size: 12px;" onclick="openArchiveFilesModal('${project.project_number}')">📁 Files</button>
                        <button class="toolbar-btn" style="padding: 6px 12px; font-size: 12px;" onclick="openEditModal('${project.id}')">✏️ Edit</button>
                        <button class="toolbar-btn danger" style="padding: 6px 12px; font-size: 12px;" onclick="openDeleteModal('${project.id}')">🗑️ Delete</button>
                    </div>
                </div>
            </div>
            
            <div class="project-details">
                <div class="detail-item">
                    <div class="detail-label">Client</div>
                    <div class="detail-value">${clientNumber} - ${clientName}</div>
                </div>
                
                ${project.source === 'production' ? `
                <div class="detail-item">
                    <div class="detail-label">Deadline</div>
                    <div class="detail-value">${deadlineDate}</div>
                </div>
                ` : ''}
                
                <div class="detail-item">
                    <div class="detail-label">${project.source === 'production' ? 'Contract Value' : 'Estimated Value'}</div>
                    <div class="detail-value">£${(project.contract_value || 0).toLocaleString()}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Storage Used</div>
                    <div class="detail-value">${formatFileSize(project.storage_size || 0)}</div>
                </div>
                
                ${timberWorker ? `
                <div class="detail-item">
                    <div class="detail-label">Timber Worker</div>
                    <div class="detail-value">
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${timberWorker.color_code || timberWorker.color}; border-radius: 50%; margin-right: 6px;"></span>
                        ${timberWorker.name}
                    </div>
                </div>
                ` : ''}
                
                ${sprayWorker ? `
                <div class="detail-item">
                    <div class="detail-label">Spray Worker</div>
                    <div class="detail-value">
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${sprayWorker.color_code || sprayWorker.color}; border-radius: 50%; margin-right: 6px;"></span>
                        ${sprayWorker.name}
                    </div>
                </div>
                ` : ''}
                
                ${project.archive_notes ? `
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Notes</div>
                    <div class="detail-value">${project.archive_notes}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ========== EDIT FUNCTIONALITY ==========

function openEditModal(projectId) {
    currentEditingProject = archivedProjects.find(p => p.id === projectId);
    
    if (!currentEditingProject) {
        showToast('Project not found', 'info');
        return;
    }
    
    // Populate form
    document.getElementById('editContractValue').value = currentEditingProject.contract_value || 0;
    document.getElementById('editArchiveReason').value = currentEditingProject.archive_reason || 'completed';
    document.getElementById('editArchiveNotes').value = currentEditingProject.archive_notes || '';
    
    // Show modal
    document.getElementById('editArchiveModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editArchiveModal').style.display = 'none';
    currentEditingProject = null;
}

async function saveArchiveEdit() {
    if (!currentEditingProject) return;
    
    const contractValue = parseFloat(document.getElementById('editContractValue').value) || 0;
    const archiveReason = document.getElementById('editArchiveReason').value;
    const archiveNotes = document.getElementById('editArchiveNotes').value.trim();
    
    try {
        const { error } = await supabaseClient
            .from('archived_projects')
            .update({
                contract_value: contractValue,
                archive_reason: archiveReason,
                archive_notes: archiveNotes
            })
            .eq('id', currentEditingProject.id);
        
        if (error) throw error;
        
        
        // Update local data
        currentEditingProject.contract_value = contractValue;
        currentEditingProject.archive_reason = archiveReason;
        currentEditingProject.archive_notes = archiveNotes;
        
        // Refresh display
        renderProjects();
        updateStats();
        closeEditModal();
        
        showToast('Project updated successfully!', 'success');
        
    } catch (err) {
        console.error('Error updating project:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== DELETE FUNCTIONALITY ==========

function openDeleteModal(projectId) {
    currentEditingProject = archivedProjects.find(p => p.id === projectId);
    
    if (!currentEditingProject) {
        showToast('Project not found', 'info');
        return;
    }
    
    // Show project name in modal
    document.getElementById('deleteProjectName').textContent = 
        `${currentEditingProject.project_number} - ${currentEditingProject.name}`;
    
    // Show modal
    document.getElementById('deleteArchiveModal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('deleteArchiveModal').style.display = 'none';
    currentEditingProject = null;
}

async function confirmDeleteArchive() {
    if (!currentEditingProject) return;
    
    try {
        
        // 1. Usuń pliki z archived_project_files
        const { data: files, error: fetchFilesError } = await supabaseClient
            .from('archived_project_files')
            .select('file_path')
            .eq('project_number', currentEditingProject.project_number);
        
        if (fetchFilesError) {
            console.error('Error fetching files:', fetchFilesError);
        } else if (files && files.length > 0) {
            
            // Usuń fizyczne pliki z Supabase Storage
            const filePaths = files.map(f => f.file_path);
            const { data: storageData, error: storageError } = await supabaseClient.storage
                .from('project-documents')
                .remove(filePaths);
            
            if (storageError) {
                console.error('Error deleting files from storage:', storageError);
            } else {
            }
            
            // Usuń rekordy z tabeli archived_project_files
            const { error: deleteFilesError } = await supabaseClient
                .from('archived_project_files')
                .delete()
                .eq('project_number', currentEditingProject.project_number);
            
            if (deleteFilesError) {
                console.error('Error deleting file records:', deleteFilesError);
            } else {
            }
        }
        
        // 2. Usuń materiały z archived_project_materials
        const { error: deleteMaterialsError } = await supabaseClient
            .from('archived_project_materials')
            .delete()
            .eq('project_number', currentEditingProject.project_number);
        
        if (deleteMaterialsError) {
            console.error('Error deleting materials:', deleteMaterialsError);
        } else {
        }
        
        // 3. Usuń projekt z archived_projects
        const { error } = await supabaseClient
            .from('archived_projects')
            .delete()
            .eq('id', currentEditingProject.id);
        
        if (error) throw error;
        
        
        // Remove from local arrays
        archivedProjects = archivedProjects.filter(p => p.id !== currentEditingProject.id);
        filteredProjects = filteredProjects.filter(p => p.id !== currentEditingProject.id);
        
        // Refresh display
        renderProjects();
        updateStats();
        closeDeleteModal();
        
        showToast('Project and all associated files deleted successfully!', 'success');
        
    } catch (err) {
        console.error('Error deleting project:', err);
        showToast('Error deleting: ' + err.message, 'error');
    }
}

// ========== FILES FUNCTIONALITY ==========

async function openArchiveFilesModal(projectNumber) {
    document.getElementById('archiveFilesProjectNumber').textContent = projectNumber;
    document.getElementById('archiveFilesModal').style.display = 'flex';
    
    await loadArchiveFiles(projectNumber);
}

function closeArchiveFilesModal() {
    document.getElementById('archiveFilesModal').style.display = 'none';
}

async function loadArchiveFiles(projectNumber) {
    const container = document.getElementById('archiveFilesContainer');
    const noFiles = document.getElementById('archiveNoFiles');
    
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Loading files...</div>';
    
    try {
        const { data: files, error } = await supabaseClient
            .from('archived_project_files')
            .select('*')
            .eq('project_number', projectNumber)
            .order('uploaded_at', { ascending: false });
        
        if (error) {
            console.error('Error loading archived files:', error);
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error loading files</div>';
            return;
        }
        
        if (!files || files.length === 0) {
            container.style.display = 'none';
            noFiles.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        noFiles.style.display = 'none';
        
        container.innerHTML = files.map(file => createArchiveFileCard(file)).join('');
        
    } catch (err) {
        console.error('Error:', err);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error loading files</div>';
    }
}

function createArchiveFileCard(file) {
    const fileIcon = getFileIcon(file.file_type);
    const fileSize = formatFileSize(file.file_size);
    const uploadDate = file.uploaded_at ? new Date(file.uploaded_at).toLocaleString('en-GB') : '-';
    
    return `
        <div style="background: #252525; border: 1px solid #404040; border-radius: 8px; padding: 15px; margin-bottom: 10px; display: flex; align-items: center; gap: 15px;">
            <div style="font-size: 32px;">${fileIcon}</div>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #e8e2d5; margin-bottom: 4px;">${file.file_name}</div>
                <div style="font-size: 12px; color: #999;">
                    ${fileSize} • Uploaded: ${uploadDate}
                    ${file.uploaded_by ? ` • By: ${file.uploaded_by}` : ''}
                    ${file.folder_name ? ` • Folder: ${file.folder_name}` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="toolbar-btn" onclick="previewArchiveFile('${file.file_path}', '${file.file_type}', '${file.file_name}')" style="padding: 6px 12px; font-size: 12px;">
                    👁️ Preview
                </button>
                <button class="toolbar-btn" onclick="downloadArchiveFile('${file.file_path}', '${file.file_name}')" style="padding: 6px 12px; font-size: 12px;">
                    📥 Download
                </button>
            </div>
        </div>
    `;
}

function getFileIcon(fileType) {
    if (!fileType) return '📄';
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return '📕';
    if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return '🖼️';
    if (type.includes('word') || type.includes('doc')) return '📘';
    if (type.includes('excel') || type.includes('sheet') || type.includes('csv')) return '📊';
    if (type.includes('zip') || type.includes('rar')) return '🗜️';
    return '📄';
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function previewArchiveFile(filePath, fileType, fileName) {
    if (!filePath) {
        showToast('File path not available', 'info');
        return;
    }
    
    try {
        // Get public URL from Supabase Storage
        const { data } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(filePath);
        
        if (data && data.publicUrl) {
            // Open preview in new window
            if (fileType && (fileType.includes('image') || fileType.includes('pdf'))) {
                window.open(data.publicUrl, '_blank');
            } else {
                // For other files, just download
                downloadArchiveFile(filePath, fileName);
            }
        }
    } catch (error) {
        console.error('Error previewing file:', error);
        showToast('Error previewing file', 'error');
    }
}

async function downloadArchiveFile(filePath, fileName) {
    if (!filePath) {
        showToast('File path not available', 'info');
        return;
    }
    
    try {
        // Download file from Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('project-documents')
            .download(filePath);
        
        if (error) {
            console.error('Error downloading file:', error);
            showToast('Error: ' + error.message, 'error');
            return;
        }
        
        if (data) {
            // Create blob URL and trigger download
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        showToast('Error downloading file', 'error');
    }
}

// ========== MATERIALS MODAL ==========

async function openArchiveMaterialsModal(projectNumber, projectId) {
    
    try {
        // Load materials from archived_project_materials
        const { data: materials, error } = await supabaseClient
            .from('archived_project_materials')
            .select('*')
            .eq('project_number', projectNumber)
            .order('item_name');
        
        if (error) {
            console.error('Error loading materials:', error);
            showToast('Error loading: ' + error.message, 'error');
            return;
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'archiveMaterialsModal';
        modal.style.display = 'flex';
        
        const materialsHTML = materials && materials.length > 0 ? 
            materials.map(mat => {
                const stage = mat.used_in_stage || '-';
                const supplier = mat.supplier_id ? '(Supplier ID: ' + mat.supplier_id + ')' : '';
                
                return `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #3e3e42;">
                            <strong>${mat.item_name}</strong>
                            ${mat.is_bespoke ? '<span style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 6px;">BESPOKE</span>' : ''}
                            ${mat.bespoke_description ? '<br><span style="color: #999; font-size: 12px;">' + mat.bespoke_description + '</span>' : ''}
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #3e3e42; text-align: center;">${stage}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #3e3e42; text-align: right;">
                            ${(mat.quantity_needed || 0).toFixed(2)} ${mat.unit || ''}
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #3e3e42; text-align: right; color: #10b981;">
                            ${(mat.quantity_used || 0).toFixed(2)} ${mat.unit || ''}
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #3e3e42; text-align: right; color: #f97316;">
                            ${(mat.quantity_wasted || 0).toFixed(2)} ${mat.unit || ''}
                            ${mat.waste_reason ? '<br><span style="color: #999; font-size: 11px;">' + mat.waste_reason + '</span>' : ''}
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #3e3e42; text-align: right;">
                            ${mat.unit_cost ? '£' + (mat.unit_cost || 0).toFixed(2) : '-'}
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #3e3e42;">
                            ${mat.item_notes || '-'}
                            ${mat.purchase_link ? '<br><a href="' + mat.purchase_link + '" target="_blank" style="color: #3b82f6; font-size: 11px;">🔗 Link</a>' : ''}
                        </td>
                    </tr>
                `;
            }).join('') :
            '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #999;">No materials recorded for this project</td></tr>';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1400px; width: 95%;">
                <div class="modal-header">
                    <h2>📦 Project Materials</h2>
                    <div style="color: #999; font-size: 14px; margin-top: 5px;">
                        ${projectNumber}
                        ${materials && materials.length > 0 ? ' - ' + materials.length + ' items' : ''}
                    </div>
                </div>
                <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead style="position: sticky; top: 0; background: #18181b; z-index: 10;">
                            <tr style="border-bottom: 2px solid #3e3e42;">
                                <th style="padding: 10px 8px; text-align: left;">Item</th>
                                <th style="padding: 10px 8px; text-align: center;">Stage</th>
                                <th style="padding: 10px 8px; text-align: right;">Needed</th>
                                <th style="padding: 10px 8px; text-align: right;">Used</th>
                                <th style="padding: 10px 8px; text-align: right;">Wasted</th>
                                <th style="padding: 10px 8px; text-align: right;">Unit Cost</th>
                                <th style="padding: 10px 8px; text-align: left;">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${materialsHTML}
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn" onclick="closeArchiveMaterialsModal()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Error loading materials', 'error');
    }
}

function closeArchiveMaterialsModal() {
    const modal = document.getElementById('archiveMaterialsModal');
    if (modal) {
        modal.remove();
    }
}