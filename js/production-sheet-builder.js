// ============================================
// PRODUCTION SHEET BUILDER
// Joinery Core by Skylon Development LTD
// ============================================

// ========== HELPER FUNCTIONS ==========
// Parse project notes from JSON string
function parseProjectNotesPS(notesString) {
    if (!notesString || notesString.trim() === '') {
        return [];
    }
    try {
        const parsed = JSON.parse(notesString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}


// ========== GLOBAL STATE ==========
let currentProject = null;
let currentSheet = null;
let checklistItems = [];
let checklistStatus = {};
let scopeDescription = ''; // Production manager's description
let sprayDescription = ''; // Spray instructions
let sprayColourType = 'single'; // 'single' or 'dual'
let sprayColours = []; // Array of colour names
let spraySheenLevel = ''; // Sheen level for project
let dispatchItems = []; // Dispatch list items
let editedNotes = {}; // Edited copies of important notes (key = note index)
let hiddenNotes = {}; // Hidden notes (key = note index, value = true)
let originalImportantNotes = []; // Cache of original important notes for edit modal
let selectedPhotos = []; // Selected photos for PS (multi-select)
let selectedDrawings = []; // Selected drawings for PS (multi-select)
let filesDirty = false; // Flag for unsaved photos/drawings selection
let projectData = {
    project: null,
    client: null,
    phases: [],
    materials: [],
    elements: [],
    blockers: [],
    files: [],
    attachments: []
};

// Helper function for full element ID with project prefix
function getFullId(el) {
    const projectPrefix = (projectData.project?.project_number || '').split('/')[0] || '';
    const elId = el.element_id || '-';
    return projectPrefix ? `${projectPrefix}-${elId}` : elId;
}


// URL params
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('project_id');
const projectStage = urlParams.get('stage') || 'production';

// ========== CHECKLIST DEFINITION ==========
const CHECKLIST_SECTIONS = [
    {
        key: 'CORE',
        title: 'Core Info',
        icon: '📋',
        items: [
            { key: 'CORE_PROJECT_NUMBER', label: 'Project Number', source: 'AUTO', required: true },
            { key: 'CORE_PROJECT_NAME', label: 'Project Name', source: 'AUTO', required: true },
            { key: 'CORE_CLIENT', label: 'Client', source: 'AUTO', required: true },
            { key: 'CORE_DEADLINE', label: 'Production Deadline', source: 'AUTO', required: true }
        ]
    },
    {
        key: 'SCOPE',
        title: 'Scope & Notes',
        icon: '📝',
        items: [
            { key: 'SCOPE_TYPE', label: 'Project Type', source: 'AUTO', required: true },
            { key: 'SCOPE_DESCRIPTION', label: 'Production Description', source: 'MANUAL', required: false, isTextArea: true },
            { key: 'SCOPE_URGENT_NOTES', label: 'Important Notes (from project)', source: 'AUTO', required: false, showContent: true }
        ]
    },
    {
        key: 'BOM',
        title: 'Elements List',
        icon: '🪟',
        items: [
            { key: 'BOM_HAS_ELEMENTS', label: 'At least 1 element defined', source: 'AUTO', required: true, goTo: 'elements' }
        ]
    },
    {
        key: 'DRAWINGS',
        title: 'Drawings',
        icon: '📐',
        items: [
            { key: 'ATT_DRAWINGS_MAIN', label: 'Main Drawings (PDF)', source: 'SELECT_FILE', required: true, fileFolder: 'drawings' }
        ]
    },
    {
        key: 'MATERIALS',
        title: 'Materials',
        icon: '🪵',
        items: [
            { key: 'MAT_LIST', label: 'Materials List', source: 'AUTO', required: true }
        ]
    },
    {
        key: 'DATA_SHEETS',
        title: 'Material Docs & Manuals',
        icon: '📄',
        items: [
            { key: 'DATA_SHEETS_DOCS', label: 'Fitting Instructions & Manuals', source: 'DATA_SHEETS', required: false }
        ]
    },
    {
        key: 'SPRAY',
        title: 'Spray Pack',
        icon: '🎨',
        conditional: true, // tylko jeśli projekt ma fazę spray
        items: [
            { key: 'SPRAY_DESCRIPTION', label: 'Spray Instructions', source: 'MANUAL', required: false, isSprayText: true }
        ]
    },
    {
        key: 'ROUTING',
        title: 'Phases / Timeline',
        icon: '📅',
        items: [
            { key: 'ROUTING_HAS_PHASES', label: 'At least 1 phase defined', source: 'AUTO', required: true, goTo: 'phases' },
            { key: 'ROUTING_DEADLINES', label: 'Phase deadlines set', source: 'AUTO', required: false },
            { key: 'ROUTING_ASSIGNED', label: 'Workers assigned', source: 'AUTO', required: false }
        ]
    },
    {
        key: 'PHOTOS',
        title: 'Photos',
        icon: '📷',
        items: [
            { key: 'ATT_PHOTOS', label: 'Reference Photos', source: 'SELECT_FILE', required: false, fileFolder: 'photos' }
        ]
    },
    {
        key: 'DISPATCH',
        title: 'Dispatch List',
        icon: '🚚',
        items: [
            { key: 'DISPATCH_LIST', label: 'Dispatch List', source: 'MANUAL', required: false, isDispatchList: true }
        ]
    },
    {
        key: 'QC',
        title: 'QC Checklist',
        icon: '✅',
        items: [
            { key: 'QC_TEMPLATE', label: 'QC Template included', source: 'AUTO', required: true }
        ]
    }
];

// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', async () => {
    if (!projectId) {
        showToast('No project ID provided!', 'error');
        setTimeout(() => window.history.back(), 2000);
        return;
    }
    
    await loadAllData();
    buildChecklist();
    updateDescriptionUI(); // Update description button if text exists
    updateSprayUI(); // Update spray button if text exists
    updateDispatchUI(); // Update dispatch button if items exist
    await checkAllItems();
    updateProgress();
    generatePreview();
});

// ========== DATA LOADING ==========
async function loadAllData() {
    try {
        // 1. Load project
        const { data: project, error: projectError } = await supabaseClient
            .from(projectStage === 'pipeline' ? 'pipeline_projects' : 'projects')
            .select('*')
            .eq('id', projectId)
            .single();
        
        if (projectError) throw projectError;
        projectData.project = project;
        currentProject = project;
        
        // Update header
        document.getElementById('psProjectTitle').textContent = 
            `${project.project_number || 'N/A'} - ${project.name || 'Untitled'}`;
        document.getElementById('psProjectSubtitle').textContent = 
            project.type || 'Project';
        
        // 2. Load client
        if (project.client_id) {
            const { data: client } = await supabaseClient
                .from('clients')
                .select('*')
                .eq('id', project.client_id)
                .single();
            projectData.client = client;
        }
        
        // 3. Load phases
        const phasesTable = projectStage === 'pipeline' ? 'pipeline_phases' : 'project_phases';
        const phasesFK = projectStage === 'pipeline' ? 'pipeline_project_id' : 'project_id';
        
        const { data: phases, error: phasesError } = await supabaseClient
            .from(phasesTable)
            .select('*')
            .eq(phasesFK, projectId)
            .order('order_position', { ascending: true });
        
        if (phasesError) console.error('[PS] phasesError:', phasesError);
        
        const safePhases = phases || [];
        const assignedIds = [...new Set(safePhases.map(p => p.assigned_to).filter(Boolean))];
        
        let memberMap = {};
        if (assignedIds.length > 0) {
            const { data: members, error: membersError } = await supabaseClient
                .from('team_members')
                .select('id, name')
                .in('id', assignedIds);
            
            if (membersError) console.error('[PS] membersError:', membersError);
            
            (members || []).forEach(m => memberMap[m.id] = m.name);
        }
        
        projectData.phases = safePhases.map(p => ({
            ...p,
            phase_label: p.phase_name || p.phase_key || 'N/A',
            assigned_name: memberMap[p.assigned_to] || ''
        }));
        
        
        // 4. Load materials
        const { data: materials, error: materialsError } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items(name, item_number, size, thickness, image_url, current_quantity, reserved_quantity, unit)
            `)
            .eq('project_id', projectId)
            .order('used_in_stage')
            .order('created_at');
        
        if (materialsError) {
            console.error('Materials load error:', materialsError);
        }
        projectData.materials = materials || [];
        
        // 5. Load elements (BOM)
        const { data: elements, error: elementsError } = await supabaseClient
            .from('project_elements')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order');
        projectData.elements = elements || [];
        
        // 5b. Load spray items
        const { data: sprayItems, error: sprayItemsError } = await supabaseClient
            .from('project_spray_items')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order');
        if (sprayItemsError) console.error('Spray items load error:', sprayItemsError);
        projectData.sprayItems = sprayItems || [];
        
        // 5c. Load spray settings
        await loadSpraySettings();
        
        // 5d. Load dispatch items
        await loadDispatchItems();
        
        // 6. Load blockers
        const { data: blockers } = await supabaseClient
            .from('project_blockers')
            .select('*, team_members(name)')
            .eq('project_id', projectId)
            .eq('status', 'active');
        projectData.blockers = blockers || [];
        
        // 7. Load project files (drawings, photos from project_files)
        const filesFK = projectStage === 'pipeline' ? 'pipeline_project_id' : 'production_project_id';
        const { data: files } = await supabaseClient
            .from('project_files')
            .select('*')
            .eq(filesFK, projectId);
        projectData.files = files || [];
        
        // 8. Check for existing production sheet (prefer final, then draft - newest first)
        const { data: existingSheet, error: sheetError } = await supabaseClient
            .from('production_sheets')
            .select('*')
            .eq('project_id', projectId)
            .order('status', { ascending: false }) // 'final' before 'draft'
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (existingSheet) {
            currentSheet = existingSheet;
            
            // Load attachments separately
            const { data: attachments } = await supabaseClient
                .from('production_sheet_attachments')
                .select('*')
                .eq('sheet_id', existingSheet.id);
            
            projectData.attachments = attachments || [];
            
            // Load scopeDescription from snapshot if exists
            if (existingSheet.snapshot_json?.scopeDescription) {
                scopeDescription = existingSheet.snapshot_json.scopeDescription;
            }
            // Load sprayDescription from snapshot if exists
            if (existingSheet.snapshot_json?.sprayDescription) {
                sprayDescription = existingSheet.snapshot_json.sprayDescription;
            }
            // Load editedNotes from snapshot if exists
            if (existingSheet.snapshot_json?.editedNotes) {
                editedNotes = existingSheet.snapshot_json.editedNotes;
            }
            // Load hiddenNotes from snapshot if exists
            if (existingSheet.snapshot_json?.hiddenNotes) {
                hiddenNotes = existingSheet.snapshot_json.hiddenNotes;
            }
            
            // Load selected photos from snapshot - validate against existing files
            if (existingSheet.snapshot_json?.selectedPhotoIds?.length > 0) {
                const savedPhotoIds = existingSheet.snapshot_json.selectedPhotoIds;
                const validFiles = projectData.files.filter(f => savedPhotoIds.includes(f.id));
                const missingCount = savedPhotoIds.length - validFiles.length;
                
                // Map to format expected by preview (name, url)
                selectedPhotos = validFiles.map(f => {
                    const { data: urlData } = supabaseClient.storage.from('project-documents').getPublicUrl(f.file_path);
                    return {
                        id: f.id,
                        name: f.file_name,
                        url: urlData.publicUrl,
                        path: f.file_path,
                        type: f.file_type
                    };
                });
                
                if (missingCount > 0) {
                    console.warn(`${missingCount} photo(s) no longer available`);
                    showToast(`${missingCount} photo(s) no longer available`, 'warning');
                }
            }
            
            // Load selected drawings from snapshot - validate against existing files
            if (existingSheet.snapshot_json?.selectedDrawingIds?.length > 0) {
                const savedDrawingIds = existingSheet.snapshot_json.selectedDrawingIds;
                const validFiles = projectData.files.filter(f => savedDrawingIds.includes(f.id));
                const missingCount = savedDrawingIds.length - validFiles.length;
                
                // Map to format expected by preview (name, url)
                selectedDrawings = validFiles.map(f => {
                    const { data: urlData } = supabaseClient.storage.from('project-documents').getPublicUrl(f.file_path);
                    return {
                        id: f.id,
                        name: f.file_name,
                        url: urlData.publicUrl,
                        path: f.file_path,
                        type: f.file_type
                    };
                });
                
                if (missingCount > 0) {
                    console.warn(`${missingCount} drawing(s) no longer available`);
                    showToast(`${missingCount} drawing(s) no longer available`, 'warning');
                }
            }
        }
        
    } catch (err) {
        console.error('Error loading data:', err);
        showToast('Error loading project data: ' + err.message, 'error');
    }
}


// ========== CHECKLIST BUILDING ==========
function buildChecklist() {
    const container = document.getElementById('psChecklist');
    container.innerHTML = '';
    
    // Czyścimy listę - zapobiega duplikatom
    checklistItems = [];
    
    // Check if spray section should be visible (check both phase_key and phase_name)
    const hasSprayPhase = projectData.phases.some(p => 
        (p.phase_key && p.phase_key.toLowerCase().includes('spray')) ||
        (p.phase_name && p.phase_name.toLowerCase().includes('spray'))
    );
    
    CHECKLIST_SECTIONS.forEach(section => {
        // Skip conditional sections if condition not met
        if (section.conditional && section.key === 'SPRAY' && !hasSprayPhase) {
            return;
        }
        
        const sectionEl = document.createElement('div');
        sectionEl.className = 'ps-section collapsed';
        sectionEl.id = `section-${section.key}`;
        
        // Section header
        const headerEl = document.createElement('div');
        headerEl.className = 'ps-section-header';
        headerEl.dataset.section = section.key;
        headerEl.innerHTML = `
            <div class="ps-section-title">
                <span class="ps-section-arrow">▶</span>
                <span>${section.icon}</span>
                <span>${section.title}</span>
            </div>
            <span class="ps-section-badge" id="badge-${section.key}">...</span>
        `;
        sectionEl.appendChild(headerEl);
        
        // Section items
        const itemsEl = document.createElement('div');
        itemsEl.className = 'ps-section-items';
        
        section.items.forEach(item => {
            const itemEl = createChecklistItem(item, section.key);
            itemsEl.appendChild(itemEl);
            checklistItems.push({ ...item, sectionKey: section.key });
        });
        
        sectionEl.appendChild(itemsEl);
        container.appendChild(sectionEl);
    });
    
    // Initialize collapse behavior
    initSidebarCollapse();
}


// Mapowanie sekcji menu -> strony preview
const SECTION_PAGE_MAP = {
    'CORE': 'cover',
    'SCOPE': 'scope',
    'BOM': 'elements',
    'DRAWINGS': 'drawings',
    'MATERIALS': 'materials',
    'DATA_SHEETS': 'datasheets',
    'SPRAY': 'spraying',
    'ROUTING': 'phases',
    'PHOTOS': 'photos',
    'DISPATCH': 'dispatch',
    'QC': 'qc'
};

function initSidebarCollapse() {
    document.querySelectorAll('.ps-section').forEach(section => {
        const header = section.querySelector('.ps-section-header');
        
        header?.addEventListener('click', () => {
            const isCollapsed = section.classList.contains('collapsed');
            
            // Toggle collapse
            section.classList.toggle('collapsed', !isCollapsed);
            section.classList.toggle('open', isCollapsed);
            
            // Scroll preview to corresponding page
            const sectionKey = header.dataset.section;
            const pageId = SECTION_PAGE_MAP[sectionKey];
            if (pageId) {
                const targetPage = document.querySelector(`.ps-page[data-section="${pageId}"]`);
                targetPage?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}


function createChecklistItem(item, sectionKey) {
    const div = document.createElement('div');
    div.className = 'ps-item';
    div.id = `item-${item.key}`;
    
    // Special handling for textarea items (opens modal)
    if (item.isTextArea) {
        div.innerHTML = `
            <div class="ps-item-icon" id="icon-${item.key}">✏️</div>
            <div class="ps-item-content">
                <div class="ps-item-label">${item.label}</div>
                <div class="ps-item-meta" id="meta-${item.key}">Click to add${!item.required ? ' • Optional' : ''}</div>
            </div>
            <button class="ps-item-action go" id="btn-${item.key}" onclick="openDescriptionModal()">+ Add</button>
        `;
        return div;
    }
    
    // Special handling for showing content (Important Notes)
    if (item.showContent) {
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div class="ps-item-icon" id="icon-${item.key}">⏳</div>
                <div class="ps-item-content">
                    <div class="ps-item-label">${item.label}</div>
                    <div class="ps-item-meta" id="meta-${item.key}">${item.source}${!item.required ? ' • Optional' : ''}</div>
                </div>
            </div>
            <div id="content-${item.key}" style="background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 6px; padding: 10px; font-size: 11px; color: #888; max-height: 150px; overflow-y: auto;">
                <em>Loading notes...</em>
            </div>
            <div style="font-size: 10px; color: #666; margin-top: 5px; font-style: italic;">
                📌 Notes added during project preparation
            </div>
        `;
        return div;
    }
    
    // Special handling for Spray Instructions (opens modal)
    if (item.isSprayText) {
        div.innerHTML = `
            <div class="ps-item-icon" id="icon-${item.key}">✏️</div>
            <div class="ps-item-content">
                <div class="ps-item-label">${item.label}</div>
                <div class="ps-item-meta" id="meta-${item.key}">Click to add • Optional</div>
            </div>
            <button class="ps-item-action go" id="btn-${item.key}" onclick="openSprayModal()">+ Add</button>
        `;
        return div;
    }
    
    // Special handling for Dispatch List (opens modal)
    if (item.isDispatchList) {
        div.innerHTML = `
            <div class="ps-item-icon" id="icon-${item.key}">📦</div>
            <div class="ps-item-content">
                <div class="ps-item-label">${item.label}</div>
                <div class="ps-item-meta" id="meta-${item.key}">Click to configure • Optional</div>
            </div>
            <button class="ps-item-action go" id="btn-${item.key}" onclick="openDispatchModal()">+ Create</button>
        `;
        return div;
    }
    
    // Special handling for Disclaimer
    if (item.isDisclaimer) {
        div.style.background = '#2d2d30';
        div.style.borderLeft = '3px solid #f59e0b';
        div.innerHTML = `
            <div class="ps-item-icon" id="icon-${item.key}">⚠️</div>
            <div class="ps-item-content">
                <div class="ps-item-label" style="color: #f59e0b;">${item.label}</div>
                <div class="ps-item-meta" style="color: #888; font-size: 11px; line-height: 1.4; margin-top: 5px;">
                    Please review ALL project documentation - there may be important information for spraying in other sections.
                </div>
            </div>
        `;
        return div;
    }
    
    // Determine action button (standard items)
    let actionBtn = '';
    if (item.source === 'UPLOAD') {
        actionBtn = `<button class="ps-item-action upload" onclick="openUploadModal('${item.key}', '${item.uploadType}', '${item.accept || ''}')">📁 Upload</button>`;
    } else if (item.source === 'SELECT_FILE') {
        // Special handling for photos - use multi-select modal
        if (item.fileFolder === 'photos') {
            actionBtn = `<button class="ps-item-action upload" id="btn-${item.key}" onclick="openPhotosSelectModal()">📷 Select</button>`;
        } else if (item.fileFolder === 'drawings') {
            actionBtn = `<button class="ps-item-action upload" id="btn-${item.key}" onclick="openDrawingsSelectModal()">📐 Select</button>`;
        } else {
            actionBtn = `<button class="ps-item-action upload" id="btn-${item.key}" onclick="openSelectFilesModal('${item.key}', '${item.fileFolder}')">📁 Select</button>`;
        }
    } else if (item.goTo) {
        actionBtn = `<button class="ps-item-action go" onclick="goToSection('${item.goTo}')">→ Go</button>`;
    } else if (item.source === 'DATA_SHEETS') {
        actionBtn = `<button class="ps-item-action upload" id="btn-${item.key}" onclick="openDataSheetsModal()">📄 Select</button>`;
    }
    
    div.innerHTML = `
        <div class="ps-item-icon" id="icon-${item.key}">⏳</div>
        <div class="ps-item-content">
            <div class="ps-item-label">${item.label}</div>
            <div class="ps-item-meta" id="meta-${item.key}">${item.source}${!item.required ? ' • Optional' : ''}</div>
        </div>
        ${actionBtn}
    `;
    
    if (!item.required) {
        div.classList.add('optional');
    }
    
    return div;
}


// ========== DESCRIPTION MODAL (WYSIWYG) ==========
function openDescriptionModal() {
    const editor = document.getElementById('descriptionEditor');
    editor.innerHTML = scopeDescription || '';
    document.getElementById('psDescriptionModal').classList.add('active');
    editor.focus();
}


function closeDescriptionModal() {
    document.getElementById('psDescriptionModal').classList.remove('active');
}


function execAndFocus(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('descriptionEditor').focus();
}


function formatText(command, value = null) {
    execAndFocus(command, value);
}


function applyColor(color) {
    if (color) execAndFocus('foreColor', color);
}


function applyHighlight() {
    execAndFocus('hiliteColor', '#fde047');
}


function applyFontSize(size) {
    if (size) execAndFocus('fontSize', size);
}


// ========== EDIT NOTE MODAL ==========
let currentEditNoteIndex = null;
let currentEditNoteOriginal = '';

function openEditNoteModal(idx) {
    const note = originalImportantNotes[idx];
    if (!note) {
        showToast('Note not found', 'error');
        return;
    }
    
    currentEditNoteIndex = idx;
    currentEditNoteOriginal = note.text || '';
    
    document.getElementById('editNoteIndex').value = idx;
    document.getElementById('editNoteAuthor').textContent = `Original by: ${note.author || 'Unknown'}`;
    document.getElementById('editNoteText').value = editedNotes[idx] !== undefined ? editedNotes[idx] : currentEditNoteOriginal;
    document.getElementById('psEditNoteModal').classList.add('active');
}


function closeEditNoteModal() {
    document.getElementById('psEditNoteModal').classList.remove('active');
    currentEditNoteIndex = null;
    currentEditNoteOriginal = '';
}


async function saveEditedNote() {
    const idx = parseInt(document.getElementById('editNoteIndex').value);
    const newText = document.getElementById('editNoteText').value.trim();
    
    if (newText === currentEditNoteOriginal) {
        // Same as original - remove edit
        delete editedNotes[idx];
    } else {
        editedNotes[idx] = newText;
    }
    
    closeEditNoteModal();
    checkAllItems();
    generatePreview();
    
    // Auto-save to database
    await autoSaveSnapshot();
    
    showToast('Note updated for PS', 'success');
}


async function resetEditedNote() {
    const idx = parseInt(document.getElementById('editNoteIndex').value);
    delete editedNotes[idx];
    document.getElementById('editNoteText').value = currentEditNoteOriginal;
    
    // Auto-save to database
    await autoSaveSnapshot();
    
    showToast('Reset to original', 'info');
}


async function hideNote(idx) {
    hiddenNotes[idx] = true;
    checkAllItems();
    generatePreview();
    await autoSaveSnapshot();
    showToast('Note hidden from PS', 'info');
}


async function restoreNote(idx) {
    delete hiddenNotes[idx];
    checkAllItems();
    generatePreview();
    await autoSaveSnapshot();
    showToast('Note restored', 'success');
}


// ========== PHOTOS MULTI-SELECT ==========
function openFilesSelectModal(folder, selectedArray, setSelected, label) {
    openFilesModalForSelection(
        currentProject.id,
        currentProject.project_number,
        currentProject.name,
        'production',
        folder,
        selectedArray,
        async (files) => {
            setSelected(files);
            filesDirty = true;
            updateFilesDirtyBadge();
            checkAllItems();
            updateProgress();
            generatePreview();
            await autoSaveSnapshot();
            showToast(`${files.length} ${label} selected for PS`, 'success');
        }
    );
}


function openPhotosSelectModal() {
    openFilesSelectModal('photos', selectedPhotos, (f) => { selectedPhotos = f; }, 'photos');
}


// ========== DRAWINGS MULTI-SELECT ==========
function openDrawingsSelectModal() {
    openFilesSelectModal('drawings', selectedDrawings, (f) => { selectedDrawings = f; }, 'drawings');
}


// ========== SELECT FILES MODAL ==========
let currentSelectKey = null;
let currentSelectFolder = null;

function openSelectFilesModal(key, folder) {
    currentSelectKey = key;
    currentSelectFolder = folder;
    
    // Set callback for file selection
    window.psFileSelectCallback = (file) => {
        selectProjectFile(file.file_path, file.public_url, file.file_name);
    };
    window.psFileSelectFolder = folder;
    
    // Open Project Files modal directly with project data
    openProjectFilesModalDirect(
        currentProject.id,
        currentProject.project_number,
        currentProject.name,
        'production'
    );
}


function closeSelectDrawingsModal() {
    // Legacy - now handled by closeProjectFilesModal
    window.psFileSelectCallback = null;
    window.psFileSelectFolder = null;
    currentSelectKey = null;
    currentSelectFolder = null;
}


async function selectProjectFile(filePath, fileUrl, fileName) {
    showToast('Linking file...', 'info');
    
    try {
        // Ensure we have a sheet with valid id
        if (!currentSheet?.id) {
            await createDraftSheet();
        }
        
        const attachmentType = currentSelectFolder === 'drawings' ? 'DRAWINGS_MAIN' : 
                              currentSelectFolder === 'photos' ? 'PHOTOS' : 'DRAWINGS_MAIN';
        
        // Remove old attachment of this type (for single types)
        if (['DRAWINGS_MAIN'].includes(attachmentType)) {
            const oldAttachments = projectData.attachments.filter(a => a.attachment_type === attachmentType);
            for (const old of oldAttachments) {
                await supabaseClient
                    .from('production_sheet_attachments')
                    .delete()
                    .eq('id', old.id);
            }
            projectData.attachments = projectData.attachments.filter(a => a.attachment_type !== attachmentType);
        }
        
        // Create new attachment record (linking to existing file)
        const { data: attachment, error } = await supabaseClient
            .from('production_sheet_attachments')
            .insert({
                sheet_id: currentSheet.id,
                attachment_type: attachmentType,
                file_name: fileName,
                file_url: fileUrl,
                file_size: 0,
                file_type: 'linked'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        projectData.attachments.push(attachment);
        
        showToast('File linked!', 'success');
        
        // Update UI
        await checkAllItems();
        updateProgress();
        generatePreview();
        
    } catch (err) {
        console.error('Error linking file:', err);
        showToast('Error: ' + err.message, 'error');
    }
}


// File upload is now handled by project-files.js

async function saveDescription() {
    scopeDescription = document.getElementById('descriptionEditor').innerHTML;
    closeDescriptionModal();
    
    // Update UI
    updateDescriptionUI();
    checkAllItems();
    updateProgress();
    generatePreview();
    
    // Auto-save to database
    await autoSaveSnapshot();
    
    showToast('Description saved!', 'success');
}


// Auto-save function for immediate persistence
async function autoSaveSnapshot() {
    try {
        // Ensure we have a sheet with valid id (create draft if not exists)
        if (!currentSheet?.id) {
            await createDraftSheet();
        }
        
        // FULL snapshot - include all data to prevent overwriting
        const fullSnapshot = {
            scopeDescription: scopeDescription,
            sprayDescription: sprayDescription,
            editedNotes: editedNotes,
            hiddenNotes: hiddenNotes,
            selectedPhotoIds: selectedPhotos.map(f => f.id),
            selectedDrawingIds: selectedDrawings.map(f => f.id)
        };
        
        const { error } = await supabaseClient
            .from('production_sheets')
            .update({
                snapshot_json: fullSnapshot,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentSheet.id);
        
        if (error) {
            console.error('Auto-save error:', error);
            showToast('⚠ Autosave failed - changes may not be saved', 'warning');
        }
    } catch (err) {
        console.error('Auto-save failed:', err);
        showToast('⚠ Autosave failed - changes may not be saved', 'warning');
    }
}


// ========== SPRAY SETTINGS MODAL ==========
function openSprayModal() {
    document.getElementById('sprayColourType').value = sprayColourType || 'single';
    document.getElementById('spraySheenLevel').value = spraySheenLevel || '';
    document.getElementById('sprayModalText').value = sprayDescription || '';
    renderSprayColoursList();
    document.getElementById('psSprayModal').classList.add('active');
}


function closeSprayModal() {
    document.getElementById('psSprayModal').classList.remove('active');
}


function renderSprayColoursList() {
    const container = document.getElementById('sprayColoursList');
    if (sprayColours.length === 0) {
        container.innerHTML = '<span style="color: #666; font-size: 12px; font-style: italic;">No colours added yet</span>';
        return;
    }
    container.innerHTML = sprayColours.map((colour, idx) => `
        <div style="display: flex; align-items: center; gap: 6px; background: #3e3e42; padding: 6px 10px; border-radius: 4px;">
            <span style="color: #e8e2d5; font-size: 12px;">${colour}</span>
            <button onclick="removeSprayColour(${idx})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 0;">&times;</button>
        </div>
    `).join('');
}


function addSprayColour() {
    const input = document.getElementById('sprayNewColour');
    const colour = input.value.trim();
    if (!colour) return;
    if (sprayColours.includes(colour)) {
        showToast('This colour already exists', 'error');
        return;
    }
    sprayColours.push(colour);
    input.value = '';
    renderSprayColoursList();
}


function removeSprayColour(idx) {
    sprayColours.splice(idx, 1);
    renderSprayColoursList();
}


async function saveSpraySettings() {
    sprayColourType = document.getElementById('sprayColourType').value;
    spraySheenLevel = document.getElementById('spraySheenLevel').value;
    sprayDescription = document.getElementById('sprayModalText').value;
    
    closeSprayModal();
    
    // Save to database
    try {
        const { data: existing } = await supabaseClient
            .from('project_spray_settings')
            .select('id')
            .eq('project_id', projectId)
            .single();
        
        const settingsData = {
            project_id: projectId,
            colour_type: sprayColourType,
            colours: sprayColours,
            sheen_level: spraySheenLevel,
            description: sprayDescription,
            updated_at: new Date().toISOString()
        };
        
        if (existing) {
            await supabaseClient
                .from('project_spray_settings')
                .update(settingsData)
                .eq('project_id', projectId);
        } else {
            await supabaseClient
                .from('project_spray_settings')
                .insert(settingsData);
        }
        
        showToast('Spray settings saved!', 'success');
    } catch (err) {
        console.error('Error saving spray settings:', err);
        showToast('Error saving spray settings', 'error');
    }
    
    // Update UI
    updateSprayUI();
    checkAllItems();
    updateProgress();
    generatePreview();
    
    // Auto-save to snapshot
    await autoSaveSnapshot();
}


async function loadSpraySettings() {
    try {
        const { data, error } = await supabaseClient
            .from('project_spray_settings')
            .select('*')
            .eq('project_id', projectId)
            .single();
        
        if (data) {
            sprayColourType = data.colour_type || 'single';
            sprayColours = data.colours || [];
            spraySheenLevel = data.sheen_level || '';
            sprayDescription = data.description || '';
        }
    } catch (err) {
        // No settings yet - that's OK
        console.log('No spray settings found');
    }
}


function updateSprayUI() {
    const metaEl = document.getElementById('meta-SPRAY_DESCRIPTION');
    const btnEl = document.getElementById('btn-SPRAY_DESCRIPTION');
    const iconEl = document.getElementById('icon-SPRAY_DESCRIPTION');
    
    if (!metaEl || !btnEl || !iconEl) return; // May not exist if no spray phase
    
    const hasColours = sprayColours.length > 0;
    const hasSettings = hasColours || spraySheenLevel || sprayDescription.trim();
    
    if (hasSettings) {
        let metaText = [];
        if (hasColours) metaText.push(`${sprayColours.length} colour(s)`);
        if (spraySheenLevel) metaText.push(spraySheenLevel);
        if (sprayColourType === 'dual') metaText.push('Dual');
        metaEl.textContent = metaText.join(' • ') || 'Configured';
        btnEl.textContent = '✎ Edit';
        iconEl.textContent = '✅';
    } else {
        metaEl.textContent = 'Click to configure • Required';
        btnEl.textContent = '+ Add';
        iconEl.textContent = '✏️';
    }
}


// ========== DISPATCH LIST MODAL ==========
let tempDispatchItems = []; // Temporary copy for modal editing

function openDispatchModal() {
    // Initialize temp items from all sources if no dispatch items exist
    if (dispatchItems.length === 0) {
        tempDispatchItems = buildDispatchItemsFromProject();
    } else {
        tempDispatchItems = JSON.parse(JSON.stringify(dispatchItems));
    }
    renderDispatchModal();
    document.getElementById('psDispatchModal').classList.add('active');
}


function closeDispatchModal() {
    document.getElementById('psDispatchModal').classList.remove('active');
}


function buildDispatchItemsFromProject() {
    const items = [];
    const projectPrefix = (projectData.project?.project_number || '').split('/')[0] || '';
    
    // 1. Elements from BOM
    (projectData.elements || []).forEach((el, idx) => {
        const elId = el.element_id || `EL${idx + 1}`;
        const fullId = projectPrefix ? `${projectPrefix}-${elId}` : elId;
        items.push({
            item_type: 'element',
            source_id: el.id,
            name: `${fullId} ${el.element_name || el.name || el.element_type || 'Element'}`,
            quantity: Math.round(parseFloat(el.qty) || 1),
            selected: true,
            notes: '',
            image_url: null
        });
    });
    
    // 2. Spray Items
    (projectData.sprayItems || []).forEach((item, idx) => {
        items.push({
            item_type: 'spray',
            source_id: item.id,
            name: item.name || `Spray Item ${idx + 1}`,
            quantity: 1,
            selected: true,
            notes: item.colour || '',
            image_url: null
        });
    });
    
    // 3. Materials (with images)
    (projectData.materials || []).forEach((mat, idx) => {
        const itemName = mat.stock_items?.name || mat.item_name || mat.bespoke_description || 'Material';
        const imageUrl = mat.stock_items?.image_url || mat.image_url || null;
        const price = mat.stock_items?.price || mat.price || null;
        items.push({
            item_type: 'material',
            source_id: mat.id,
            name: itemName,
            quantity: Math.round(parseFloat(mat.quantity_needed) || 1),
            selected: false, // Materials not selected by default
            notes: mat.unit || '',
            image_url: imageUrl,
            price: price
        });
    });
    
    return items;
}


function renderDispatchModal() {
    const container = document.getElementById('dispatchItemsContainer');
    if (!container) return;
    
    // Group items by type
    const elements = tempDispatchItems.filter(i => i.item_type === 'element');
    const sprayItems = tempDispatchItems.filter(i => i.item_type === 'spray');
    const materials = tempDispatchItems.filter(i => i.item_type === 'material');
    const customItems = tempDispatchItems.filter(i => i.item_type === 'custom');
    
    // Simple section for elements/spray (without images)
    const renderSimpleSection = (title, icon, color, items, type) => {
        if (items.length === 0 && type !== 'custom') return '';
        return `
            <div style="margin-bottom: 15px;">
                <div style="background: ${color}; padding: 8px 12px; font-weight: 600; font-size: 12px; color: white; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <span>${icon} ${title} (${items.filter(i => i.selected).length}/${items.length})</span>
                    <div>
                        <button onclick="toggleAllDispatch('${type}', false)" style="background: rgba(0,0,0,0.3); color: white; border: none; padding: 3px 10px; border-radius: 3px; cursor: pointer; font-size: 10px; margin-right: 5px;">None</button>
                        <button onclick="toggleAllDispatch('${type}', true)" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 3px 10px; border-radius: 3px; cursor: pointer; font-size: 10px;">All</button>
                    </div>
                </div>
                <div id="dispatch-scroll-${type}" class="dispatch-scroll-section" style="background: #1e1e1e; border: 1px solid #3e3e42; border-top: none; max-height: 400px; overflow-y: auto;">
                    ${items.length > 0 ? items.map((item) => {
                        const globalIdx = tempDispatchItems.indexOf(item);
                        return `
                            <div style="display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid #2d2d30; ${item.selected ? 'background: rgba(74, 158, 255, 0.1);' : ''}">
                                <input type="checkbox" ${item.selected ? 'checked' : ''} 
                                    onchange="toggleDispatchItem(${globalIdx})"
                                    style="width: 20px; height: 20px; margin-right: 12px; cursor: pointer; accent-color: #4a9eff;">
                                <div style="flex: 1;">
                                    <div style="color: #e8e2d5; font-size: 13px; font-weight: 500;">${item.name}</div>
                                    ${item.notes ? `<div style="color: #888; font-size: 11px; margin-top: 2px;">${item.notes}</div>` : ''}
                                </div>
                                <div style="color: #4a9eff; font-size: 12px; font-weight: 600; min-width: 60px; text-align: right;">× ${item.quantity}</div>
                                ${type === 'custom' ? `<button onclick="removeCustomDispatchItem(${globalIdx})" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; margin-left: 10px;">✕</button>` : ''}
                            </div>
                        `;
                    }).join('') : `<div style="padding: 15px; color: #666; text-align: center; font-style: italic;">No items</div>`}
                </div>
            </div>
        `;
    };
    
    // Materials section with images
    const renderMaterialsSection = () => {
        if (materials.length === 0) return '';
        return `
            <div style="margin-bottom: 15px;">
                <div style="background: #22c55e; padding: 8px 12px; font-weight: 600; font-size: 12px; color: white; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <span>🧱 Materials & Hardware (${materials.filter(i => i.selected).length}/${materials.length})</span>
                    <div>
                        <button onclick="toggleAllDispatch('material', false)" style="background: rgba(0,0,0,0.3); color: white; border: none; padding: 3px 10px; border-radius: 3px; cursor: pointer; font-size: 10px; margin-right: 5px;">None</button>
                        <button onclick="toggleAllDispatch('material', true)" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 3px 10px; border-radius: 3px; cursor: pointer; font-size: 10px;">All</button>
                    </div>
                </div>
                <div id="dispatch-scroll-material" class="dispatch-scroll-section" style="background: #1e1e1e; border: 1px solid #3e3e42; border-top: none; max-height: 500px; overflow-y: auto;">
                    ${materials.map((item) => {
                        const globalIdx = tempDispatchItems.indexOf(item);
                        const imgStyle = 'width: 50px; height: 50px; object-fit: cover; border-radius: 4px; background: #2d2d30;';
                        return `
                            <div style="display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid #2d2d30; ${item.selected ? 'background: rgba(34, 197, 94, 0.1);' : ''}">
                                <input type="checkbox" ${item.selected ? 'checked' : ''} 
                                    onchange="toggleDispatchItem(${globalIdx})"
                                    style="width: 20px; height: 20px; margin-right: 12px; cursor: pointer; accent-color: #22c55e;">
                                ${item.image_url 
                                    ? `<img src="${item.image_url}" style="${imgStyle}" onerror="this.style.display='none'">`
                                    : `<div style="${imgStyle} display: flex; align-items: center; justify-content: center; color: #666; font-size: 20px;">📦</div>`
                                }
                                <div style="flex: 1; margin-left: 12px;">
                                    <div style="color: #e8e2d5; font-size: 13px; font-weight: 500;">${item.name}</div>
                                    <div style="color: #888; font-size: 11px; margin-top: 2px;">
                                        ${item.price ? `£${item.price}` : ''}
                                        ${item.notes ? ` • ${item.notes}` : ''}
                                    </div>
                                </div>
                                <div style="color: #22c55e; font-size: 12px; font-weight: 600; min-width: 60px; text-align: right;">× ${item.quantity}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div>
                ${renderSimpleSection('Elements / Units', '📦', '#3b82f6', elements, 'element')}
            </div>
            <div>
                ${renderSimpleSection('Spray Items', '🎨', '#e99f62', sprayItems, 'spray')}
                ${renderSimpleSection('Custom Items', '➕', '#8b5cf6', customItems, 'custom')}
            </div>
            <div>
                ${renderMaterialsSection()}
            </div>
        </div>
        
        <div style="margin-top: 15px; padding: 15px; background: #2d2d30; border-radius: 6px;">
            <div style="font-size: 12px; color: #888; margin-bottom: 8px;">➕ Add Custom Item (screws, beading, etc.):</div>
            <div style="display: flex; gap: 10px;">
                <input type="text" id="dispatchCustomName" placeholder="Item name" 
                    style="flex: 2; padding: 10px; background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; color: #e8e2d5; font-size: 13px;">
                <input type="number" id="dispatchCustomQty" placeholder="Qty" value="1"
                    style="width: 80px; padding: 10px; background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; color: #e8e2d5; font-size: 13px; text-align: center;">
                <button onclick="addCustomDispatchItem()" style="padding: 10px 20px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">+ Add</button>
            </div>
        </div>
    `;
}


function toggleDispatchItem(idx) {
    if (tempDispatchItems[idx]) {
        tempDispatchItems[idx].selected = !tempDispatchItems[idx].selected;
    }
    
    // Save scroll positions by section ID
    const scrollPositions = {};
    ['element', 'spray', 'material', 'custom'].forEach(type => {
        const section = document.getElementById(`dispatch-scroll-${type}`);
        if (section) {
            scrollPositions[type] = section.scrollTop;
        }
    });
    
    renderDispatchModal();
    
    // Restore scroll positions
    requestAnimationFrame(() => {
        ['element', 'spray', 'material', 'custom'].forEach(type => {
            const section = document.getElementById(`dispatch-scroll-${type}`);
            if (section && scrollPositions[type] !== undefined) {
                section.scrollTop = scrollPositions[type];
            }
        });
    });
}


function updateDispatchCounters() {
    // Not used anymore - kept for compatibility
}


function toggleAllDispatch(type, selected) {
    tempDispatchItems.forEach(item => {
        if (item.item_type === type) {
            item.selected = selected;
        }
    });
    renderDispatchModal();
}


function addCustomDispatchItem() {
    const nameInput = document.getElementById('dispatchCustomName');
    const qtyInput = document.getElementById('dispatchCustomQty');
    const name = nameInput.value.trim();
    const qty = parseInt(qtyInput.value) || 1;
    
    if (!name) {
        showToast('Enter item name', 'error');
        return;
    }
    
    tempDispatchItems.push({
        item_type: 'custom',
        source_id: null,
        name: name,
        quantity: qty,
        selected: true,
        notes: ''
    });
    
    nameInput.value = '';
    qtyInput.value = '1';
    renderDispatchModal();
}


function removeCustomDispatchItem(idx) {
    if (tempDispatchItems[idx]?.item_type === 'custom') {
        tempDispatchItems.splice(idx, 1);
        renderDispatchModal();
    }
}


async function saveDispatchList() {
    dispatchItems = JSON.parse(JSON.stringify(tempDispatchItems));
    closeDispatchModal();
    
    // Save to database
    try {
        // Delete old items
        await supabaseClient
            .from('project_dispatch_items')
            .delete()
            .eq('project_id', projectId);
        
        // Insert new items
        if (dispatchItems.length > 0) {
            const itemsToSave = dispatchItems.map((item, idx) => ({
                project_id: projectId,
                item_type: item.item_type,
                source_id: item.source_id,
                name: item.name,
                quantity: Math.round(parseFloat(item.quantity) || 1),
                selected: item.selected,
                notes: item.notes || '',
                sort_order: idx
            }));
            
            const { error } = await supabaseClient
                .from('project_dispatch_items')
                .insert(itemsToSave);
            
            if (error) throw error;
        }
        
        showToast('Dispatch list saved!', 'success');
    } catch (err) {
        console.error('Error saving dispatch list:', err);
        showToast('Error saving dispatch list', 'error');
    }
    
    // Update UI
    updateDispatchUI();
    checkAllItems();
    updateProgress();
    generatePreview();
}


async function loadDispatchItems() {
    try {
        const { data, error } = await supabaseClient
            .from('project_dispatch_items')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order');
        
        if (data && data.length > 0) {
            dispatchItems = data;
        }
    } catch (err) {
        console.log('No dispatch items found');
    }
}


function updateDispatchUI() {
    const metaEl = document.getElementById('meta-DISPATCH_LIST');
    const btnEl = document.getElementById('btn-DISPATCH_LIST');
    const iconEl = document.getElementById('icon-DISPATCH_LIST');
    
    if (!metaEl || !btnEl || !iconEl) return;
    
    const selectedCount = dispatchItems.filter(i => i.selected).length;
    
    if (selectedCount > 0) {
        metaEl.textContent = `${selectedCount} items selected`;
        btnEl.textContent = '✎ Edit';
        iconEl.textContent = '✅';
    } else {
        metaEl.textContent = 'Click to configure • Optional';
        btnEl.textContent = '+ Create';
        iconEl.textContent = '📦';
    }
}


function updateDescriptionUI() {
    const metaEl = document.getElementById('meta-SCOPE_DESCRIPTION');
    const btnEl = document.getElementById('btn-SCOPE_DESCRIPTION');
    const iconEl = document.getElementById('icon-SCOPE_DESCRIPTION');
    
    // Extract text from HTML for display
    const textContent = getTextFromHtml(scopeDescription);
    
    if (textContent.trim()) {
        metaEl.textContent = `${textContent.trim().length} characters`;
        btnEl.textContent = '✎ Edit';
        btnEl.classList.remove('upload');
        iconEl.textContent = '✅';
    } else {
        metaEl.textContent = 'Click to add • Optional';
        btnEl.textContent = '+ Add';
        iconEl.textContent = '✏️';
    }
}


// Helper to get plain text from HTML
function getTextFromHtml(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
}


// Handle scope description change (legacy - keeping for compatibility)
function handleScopeDescriptionChange(value) {
    scopeDescription = value;
    const textContent = getTextFromHtml(value);
    checklistStatus['SCOPE_DESCRIPTION'] = {
        done: textContent.trim().length > 0,
        meta: textContent.trim().length > 0 ? `${textContent.trim().length} characters` : 'Optional'
    };
    updateProgress();
}


// ========== CHECKLIST VALIDATION ==========
async function checkAllItems() {
    checklistStatus = {};
    
    for (const item of checklistItems) {
        const status = await checkItem(item);
        checklistStatus[item.key] = status;
        updateItemUI(item.key, status);
    }
    
    // Update section badges
    updateSectionBadges();
}


async function checkItem(item) {
    const result = { done: false, meta: '', blocked: false };
    
    switch (item.key) {
        // CORE
        case 'CORE_PROJECT_NUMBER':
            result.done = !!projectData.project?.project_number;
            result.meta = projectData.project?.project_number || 'Not set';
            break;
            
        case 'CORE_PROJECT_NAME':
            result.done = !!projectData.project?.name;
            result.meta = projectData.project?.name || 'Not set';
            break;
            
        case 'CORE_CLIENT':
            result.done = !!projectData.client;
            result.meta = projectData.client?.company_name || 'Not assigned';
            break;
            
        case 'CORE_DEADLINE':
            result.done = !!projectData.project?.deadline;
            result.meta = projectData.project?.deadline 
                ? new Date(projectData.project.deadline).toLocaleDateString('en-GB')
                : 'Not set';
            break;
            
        // SCOPE
        case 'SCOPE_TYPE':
            result.done = !!projectData.project?.type;
            result.meta = projectData.project?.type || 'Not set';
            break;
        
        case 'SCOPE_DESCRIPTION':
            const descText = getTextFromHtml(scopeDescription);
            result.done = descText.trim().length > 0;
            result.meta = descText.trim().length > 0 ? `${descText.trim().length} characters` : 'Optional';
            break;
            
        case 'SCOPE_URGENT_NOTES':
            const notesRaw = projectData.project?.notes || '';
            const allNotes = parseProjectNotesPS(notesRaw);
            const importantNotes = allNotes.filter(n => n.important === true);
            
            // Cache for edit modal
            originalImportantNotes = importantNotes;
            
            result.done = true; // Always done, just informational
            result.meta = importantNotes.length > 0 ? `${importantNotes.length} important note(s)` : 'No urgent notes';
            
            // Update content display
            const contentEl = document.getElementById('content-SCOPE_URGENT_NOTES');
            if (contentEl) {
                if (importantNotes.length > 0) {
                    contentEl.innerHTML = importantNotes.map((note, idx) => {
                        const isEdited = editedNotes[idx] !== undefined;
                        const isHidden = hiddenNotes[idx] === true;
                        const displayText = isEdited ? editedNotes[idx] : (note.text || '');
                        
                        if (isHidden) {
                            return `<div style="margin-bottom: 8px; padding: 10px; background: #1e1e1e; border-left: 3px solid #555; color: #666;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 11px; color: #666;">🚫 ${note.author || 'Unknown'} • Hidden from PS</span>
                                    <button onclick="restoreNote(${idx})" style="background: #3e3e42; border: none; color: #22c55e; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">↩️ Restore</button>
                                </div>
                            </div>`;
                        }
                        
                        return `<div style="margin-bottom: 8px; padding: 10px; background: #2d2d30; border-left: 3px solid ${isEdited ? '#22c55e' : '#f59e0b'}; color: #e8e2d5;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 11px; color: ${isEdited ? '#22c55e' : '#f59e0b'};">⚠️ ${note.author || 'Unknown'} • ${note.date || ''} ${isEdited ? '(edited for PS)' : ''}</span>
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="openEditNoteModal(${idx})" style="background: #3e3e42; border: none; color: #888; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">✏️ Edit</button>
                                    <button onclick="hideNote(${idx})" style="background: #3e3e42; border: none; color: #ef4444; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">🗑️</button>
                                </div>
                            </div>
                            <div style="white-space: pre-wrap;">${displayText}</div>
                        </div>`;
                    }).join('');
                } else {
                    contentEl.innerHTML = '<em style="color: #666;">No important notes flagged. Notes with "IMPORTANT", "URGENT" or ⚠️ will appear here.</em>';
                }
            }
            break;
            
        // BOM
        case 'BOM_HAS_ELEMENTS':
            result.done = projectData.elements.length > 0;
            result.meta = `${projectData.elements.length} element(s)`;
            break;
            
        // DRAWINGS
        case 'ATT_DRAWINGS_MAIN':
            const availableDrawings = projectData.files.filter(f => f.folder_name?.toLowerCase().startsWith('drawings')).length;
            result.done = selectedDrawings.length > 0;
            result.meta = selectedDrawings.length > 0 
                ? `${selectedDrawings.length} selected (${availableDrawings} available)` 
                : availableDrawings > 0 ? `${availableDrawings} available • Required` : 'Required';
            break;
            
        // PHOTOS
        case 'ATT_PHOTOS':
            const availablePhotos = projectData.files.filter(f => f.folder_name?.toLowerCase().startsWith('photos')).length;
            result.done = selectedPhotos.length > 0;
            result.meta = selectedPhotos.length > 0 
                ? `${selectedPhotos.length} selected (${availablePhotos} available)` 
                : `${availablePhotos} available • Optional`;
            break;
            
        // MATERIALS
        case 'MAT_LIST':
            const totalMats = projectData.materials.length;
            const prodMats = projectData.materials.filter(m => m.used_in_stage === 'Production').length;
            const sprayMats = projectData.materials.filter(m => m.used_in_stage === 'Spraying').length;
            const instMats = projectData.materials.filter(m => m.used_in_stage === 'Installation').length;
            result.done = totalMats > 0;
            result.meta = `${totalMats} total (Prod: ${prodMats}, Spray: ${sprayMats}, Install: ${instMats})`;
            break;
        
        // DATA SHEETS
        case 'DATA_SHEETS_DOCS':
            const dataSheetAttachments = projectData.attachments.filter(a => a.attachment_type === 'DATA_SHEET');
            result.done = dataSheetAttachments.length > 0;
            result.meta = dataSheetAttachments.length > 0 
                ? `${dataSheetAttachments.length} document(s) linked` 
                : 'Optional - select from Stock';
            break;
            
        // SPRAY
        case 'SPRAY_DESCRIPTION':
            result.done = sprayDescription.trim().length > 0;
            result.meta = sprayDescription.trim().length > 0 ? `${sprayDescription.trim().length} characters` : 'Optional';
            break;
            
        // ROUTING
        case 'ROUTING_HAS_PHASES':
            result.done = projectData.phases.length > 0;
            result.meta = `${projectData.phases.length} phase(s)`;
            break;
            
        case 'ROUTING_DEADLINES':
            const phasesWithDeadlines = projectData.phases.filter(p => p.end_date);
            const lastPhase = projectData.phases[projectData.phases.length - 1];
            // OK jeśli ostatnia faza ma deadline LUB minimum 50% faz ma deadline
            result.done = projectData.phases.length > 0 && 
                (lastPhase?.end_date || phasesWithDeadlines.length >= projectData.phases.length * 0.5);
            result.meta = `${phasesWithDeadlines.length}/${projectData.phases.length} set`;
            break;
            
        case 'ROUTING_ASSIGNED':
            const phasesAssigned = projectData.phases.filter(p => p.assigned_to);
            // OK jeśli minimum 50% faz jest przypisanych
            result.done = projectData.phases.length > 0 && 
                phasesAssigned.length >= projectData.phases.length * 0.5;
            result.meta = `${phasesAssigned.length}/${projectData.phases.length} assigned`;
            break;
        
        // Dispatch
        case 'DISPATCH_LIST':
            const hasDispatchItems = dispatchItems.filter(i => i.selected).length > 0;
            result.done = hasDispatchItems;
            result.meta = hasDispatchItems ? `${dispatchItems.filter(i => i.selected).length} items` : 'Click to configure';
            break;
            
        // QC
        case 'QC_TEMPLATE':
            result.done = true; // Always included
            result.meta = 'Will be included';
            break;
            
        default:
            result.done = false;
            result.meta = 'Unknown item';
    }
    
    return result;
}


function updateItemUI(key, status) {
    const itemEl = document.getElementById(`item-${key}`);
    const iconEl = document.getElementById(`icon-${key}`);
    const metaEl = document.getElementById(`meta-${key}`);
    
    if (!itemEl) return;
    
    // Update classes
    itemEl.classList.remove('done', 'missing', 'blocked');
    
    if (status.blocked) {
        itemEl.classList.add('blocked');
        if (iconEl) iconEl.textContent = '⚠️';
    } else if (status.done) {
        itemEl.classList.add('done');
        if (iconEl) iconEl.textContent = '✅';
    } else {
        itemEl.classList.add('missing');
        if (iconEl) iconEl.textContent = '⏳';
    }
    
    // Update meta
    if (metaEl && status.meta) {
        const item = checklistItems.find(i => i.key === key);
        // Only add "Optional" if not already present and item is optional
        const needsOptional = item && !item.required && !status.meta.includes('Optional');
        metaEl.textContent = status.meta + (needsOptional ? ' • Optional' : '');
    }
}


function updateSectionBadges() {
    CHECKLIST_SECTIONS.forEach(section => {
        const sectionItems = checklistItems.filter(i => i.sectionKey === section.key);
        const requiredItems = sectionItems.filter(i => i.required);
        
        let doneCount = 0;
        let blockedCount = 0;
        
        requiredItems.forEach(item => {
            const status = checklistStatus[item.key];
            if (status?.done) doneCount++;
            if (status?.blocked) blockedCount++;
        });
        
        const badgeEl = document.getElementById(`badge-${section.key}`);
        if (!badgeEl) return;
        
        if (blockedCount > 0) {
            badgeEl.textContent = 'BLOCKED';
            badgeEl.className = 'ps-section-badge blocked';
        } else if (doneCount === requiredItems.length) {
            badgeEl.textContent = 'DONE';
            badgeEl.className = 'ps-section-badge done';
        } else {
            badgeEl.textContent = `${doneCount}/${requiredItems.length}`;
            badgeEl.className = 'ps-section-badge missing';
        }
    });
}


// ========== PROGRESS ==========
function updateProgress() {
    const requiredItems = checklistItems.filter(i => i.required);
    const doneCount = requiredItems.filter(i => checklistStatus[i.key]?.done).length;
    const percent = Math.round((doneCount / requiredItems.length) * 100);
    
    document.getElementById('psProgressPercent').textContent = `${percent}%`;
    
    const fillEl = document.getElementById('psProgressFill');
    fillEl.style.width = `${percent}%`;
    fillEl.classList.toggle('incomplete', percent < 100);
}


// ========== UPLOAD MODAL ==========
let currentUploadType = '';
let currentUploadAccept = '';
let selectedFile = null;

function openUploadModal(key, uploadType, accept) {
    currentUploadType = uploadType;
    currentUploadAccept = accept;
    selectedFile = null;
    
    document.getElementById('psUploadTitle').textContent = `Upload ${uploadType.replace('_', ' ')}`;
    document.getElementById('psUploadHint').textContent = accept ? `Accepted: ${accept}` : 'Any file type';
    document.getElementById('psFileInput').accept = accept;
    document.getElementById('psUploadPreview').style.display = 'none';
    document.getElementById('psUploadConfirm').disabled = true;
    document.getElementById('psUploadModal').classList.add('active');
}


function closeUploadModal() {
    document.getElementById('psUploadModal').classList.remove('active');
    selectedFile = null;
}


function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        showToast('File too large. Max 10MB allowed.', 'error');
        return;
    }
    
    selectedFile = file;
    document.getElementById('psFileName').textContent = file.name;
    document.getElementById('psFileSize').textContent = formatFileSize(file.size);
    document.getElementById('psUploadPreview').style.display = 'block';
    document.getElementById('psUploadConfirm').disabled = false;
}


function clearFileSelection() {
    selectedFile = null;
    document.getElementById('psFileInput').value = '';
    document.getElementById('psUploadPreview').style.display = 'none';
    document.getElementById('psUploadConfirm').disabled = true;
}


async function confirmUpload() {
    if (!selectedFile) return;
    
    showToast('Uploading file...', 'info');
    
    try {
        // Ensure we have a sheet with valid id
        if (!currentSheet?.id) {
            await createDraftSheet();
        }
        
        // Single attachment types - usuń stare przed dodaniem nowego
        const singleTypes = ['DRAWINGS_MAIN', 'FINISH_SPECS'];
        if (singleTypes.includes(currentUploadType)) {
            // Znajdź i usuń stare załączniki tego typu
            const oldAttachments = projectData.attachments.filter(a => a.attachment_type === currentUploadType);
            for (const old of oldAttachments) {
                await supabaseClient
                    .from('production_sheet_attachments')
                    .delete()
                    .eq('id', old.id);
            }
            // Usuń z lokalnej tablicy
            projectData.attachments = projectData.attachments.filter(a => a.attachment_type !== currentUploadType);
        }
        
        // Upload to Supabase Storage
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${currentUploadType}_${Date.now()}.${fileExt}`;
        const filePath = `production-sheets/${currentSheet.id}/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('project-documents')
            .upload(filePath, selectedFile);
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(filePath);
        
        // Save attachment record
        const { data: attachment, error: attachError } = await supabaseClient
            .from('production_sheet_attachments')
            .insert({
                sheet_id: currentSheet.id,
                attachment_type: currentUploadType,
                file_name: selectedFile.name,
                file_url: urlData.publicUrl,
                file_size: selectedFile.size,
                file_type: selectedFile.type
            })
            .select()
            .single();
        
        if (attachError) throw attachError;
        
        projectData.attachments.push(attachment);
        
        showToast('File uploaded successfully!', 'success');
        closeUploadModal();
        
        // Re-check items
        await checkAllItems();
        updateProgress();
        
    } catch (err) {
        console.error('Upload error:', err);
        showToast('Upload failed: ' + err.message, 'error');
    }
}


async function createDraftSheet() {
    // Check if draft already exists
    const { data: existingDraft } = await supabaseClient
        .from('production_sheets')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'draft')
        .maybeSingle();
    
    if (existingDraft) {
        // Use existing draft
        currentSheet = existingDraft;
        return existingDraft;
    }
    
    // No draft exists - create new one (version 1 or 2 max)
    const { data: existingFinal } = await supabaseClient
        .from('production_sheets')
        .select('version')
        .eq('project_id', projectId)
        .eq('status', 'final')
        .maybeSingle();
    
    const nextVersion = existingFinal ? 2 : 1;
    
    const { data: newSheet, error } = await supabaseClient
        .from('production_sheets')
        .insert({
            project_id: projectId,
            version: nextVersion,
            status: 'draft'
        })
        .select()
        .single();
    
    if (error) throw error;
    
    currentSheet = newSheet;
    return newSheet;
}


// ========== SAVE & CLOSE ==========
async function saveAndClose() {
    showToast('Refreshing data...', 'info');
    
    try {
        // Refresh all data before saving to get latest changes
        await loadAllData();
        
        showToast('Saving draft...', 'info');
        // Ensure we have a sheet with valid id (create draft if not exists)
        if (!currentSheet?.id) {
            await createDraftSheet();
        }
        
        // Update checklist progress
        const requiredItems = checklistItems.filter(i => i.required);
        const doneCount = requiredItems.filter(i => checklistStatus[i.key]?.done).length;
        const progress = Math.round((doneCount / requiredItems.length) * 100);
        
        // Build partial snapshot with editable fields
        const partialSnapshot = {
            scopeDescription: scopeDescription,
            sprayDescription: sprayDescription,
            editedNotes: editedNotes,
            hiddenNotes: hiddenNotes,
            selectedPhotoIds: selectedPhotos.map(f => f.id),
            selectedDrawingIds: selectedDrawings.map(f => f.id)
        };
        
        // Save current state to sheet
        const { error } = await supabaseClient
            .from('production_sheets')
            .update({
                checklist_total: requiredItems.length,
                checklist_done: doneCount,
                checklist_progress: progress,
                snapshot_json: partialSnapshot,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentSheet.id);
        
        if (error) throw error;
        
        // Reset dirty flag after successful save
        filesDirty = false;
        updateFilesDirtyBadge();
        
        showToast('Draft saved!', 'success');
        
        // Navigate back after short delay
        setTimeout(() => {
            window.history.back();
        }, 500);
        
    } catch (err) {
        console.error('Error saving draft:', err);
        showToast('Error saving: ' + err.message, 'error');
    }
}


// ========== FILES DIRTY BADGE ==========
function updateFilesDirtyBadge() {
    let badge = document.getElementById('filesDirtyBadge');
    
    if (filesDirty) {
        if (!badge) {
            // Create badge next to Save & Close button
            const saveBtn = document.querySelector('button[onclick="saveAndClose()"]');
            if (saveBtn) {
                badge = document.createElement('span');
                badge.id = 'filesDirtyBadge';
                badge.style.cssText = 'background: #f59e0b; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 10px;';
                badge.textContent = '⚠ Not saved';
                saveBtn.parentNode.insertBefore(badge, saveBtn.nextSibling);
            }
        }
        if (badge) badge.style.display = 'inline';
    } else {
        if (badge) badge.style.display = 'none';
    }
}


// ========== BEFOREUNLOAD WARNING ==========
window.addEventListener('beforeunload', (e) => {
    if (filesDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in Photos/Drawings. Are you sure you want to leave?';
        return e.returnValue;
    }
});

// ========== NAVIGATION ==========
function goToSection(section) {
    switch (section) {
        case 'elements':
            openBomModal();
            break;
        case 'materials':
            showToast('Go to main project view to edit materials', 'info');
            break;
        case 'phases':
            showToast('Go to main project view to edit phases', 'info');
            break;
    }
}


// ========== BOM EDITOR ==========
// BOM functions moved to js/bom-editor.js

// ========== PREVIEW GENERATION ==========
let pdfSectionNumber = 0; // Global section counter for PDF

async function generatePreview() {
    const container = document.getElementById('psPdfPreview');
    pdfSectionNumber = 0; // Reset counter
    
    // Load company logo
    let logoUrl = null;
    try {
        const { data: settings } = await supabaseClient
            .from('company_settings')
            .select('logo_url')
            .single();
        logoUrl = settings?.logo_url || null;
    } catch (err) {
        console.log('No company logo found');
    }
    
    let pages = [];
    
    // PAGE 1: Cover + Contents
    pages.push({ section: 'cover', content: generateCoverPageNew(logoUrl) });
    
    // PAGE 2+: Scope & Notes (may be multiple pages)
    const scopePages = generateScopePages();
    scopePages.forEach((content, i) => {
        pages.push({ section: i === 0 ? 'scope' : `scope-${i+1}`, content });
    });
    
    // PAGE: Elements List (may be multiple pages)
    const bomPages = generateBOMPages();
    bomPages.forEach((content, i) => {
        pages.push({ section: i === 0 ? 'elements' : `elements-${i+1}`, content });
    });
    
    // PAGE 4+: Drawings (may be multiple pages)
    const drawingPages = await generateDrawingPages();
    drawingPages.forEach((content, i) => {
        pages.push({ section: i === 0 ? 'drawings' : `drawings-${i+1}`, content });
    });
    
    // PAGE: Materials (may be multiple pages)
    const materialPages = generateMaterialsPages();
    materialPages.forEach((content, i) => {
        pages.push({ section: i === 0 ? 'materials' : `materials-${i+1}`, content });
    });
    
    // PAGE: Material Docs & Manuals (if any)
    const dataSheetPages = await generateDataSheetsPages();
    dataSheetPages.forEach((content, i) => {
        pages.push({ section: i === 0 ? 'datasheets' : `datasheets-${i+1}`, content });
    });
    
    // PAGE: Spraying (may be multiple pages)
    const hasSprayPhase = projectData.phases.some(p => 
        (p.phase_key && p.phase_key.toLowerCase().includes('spray')) ||
        (p.phase_name && p.phase_name.toLowerCase().includes('spray'))
    );
    if (hasSprayPhase) {
        const sprayPages = generateSprayingPages();
        sprayPages.forEach((content, i) => {
            pages.push({ section: i === 0 ? 'spraying' : `spraying-${i+1}`, content });
        });
    }
    
    // PAGE: Phases / Timeline
    pages.push({ section: 'phases', content: generatePhasesPage() });
    
    // PAGE: Reference Photos (if any)
    const photoPages = await generatePhotoPages();
    photoPages.forEach((content, i) => {
        pages.push({ section: i === 0 ? 'photos' : `photos-${i+1}`, content });
    });
    
    // PAGE: Dispatch Check List
    generateDispatchPages().forEach(content => pages.push({ section: 'dispatch', content }));
    
    // PAGE: QC & Sign-off
    pages.push({ section: 'qc', content: generateQCPage() });
    
    // Build HTML with all pages
    const totalPages = pages.length;
    let html = pages.map((page, idx) => `
        <div class="ps-page" data-page="${idx + 1}" data-section="${page.section}">
            <div class="ps-page-header">Page ${idx + 1} of ${totalPages}</div>
            ${page.content}
        </div>
    `).join('');
    
    container.innerHTML = html;
}


// ========== PAGE 1: COVER + CONTENTS ==========
function generateCoverPageNew(logoUrl) {
    const project = projectData.project;
    const client = projectData.client;
    const isIncomplete = !checklistItems.filter(i => i.required).every(i => checklistStatus[i.key]?.done);
    
    // Build contents list - nowa kolejność
    const sections = [
        'Scope & Notes',
        'Elements List',
        'Drawings',
        'Materials',
        'Material Docs & Manuals',
        'Spray Pack',
        'Phases / Timeline',
        'Photos',
        'Dispatch List',
        'QC Checklist'
    ];
    
    // Pre-construction checklist items
    const preConstructionItems = [
        'Drawings & Design accepted by Client',
        'Drawings & sizes checked by Joiner',
        'Bespoke tools ordered by Joiner (if needed)',
        'Timeline agreed with Client',
        'Spray colour & sheen confirmed',
        'All materials checked & ordered',
        'Production timeline agreed with Team',
        'Deposit received'
    ];
    
    return `
        ${isIncomplete ? '<div class="ps-incomplete-banner">⚠️ INCOMPLETE - Some required items are missing</div>' : ''}
        
        <div style="height: 45%; display: flex; padding: 15px; border-bottom: 3px solid #333;">
            <div class="ps-cover-logo">
                ${logoUrl ? `<img src="${logoUrl}" alt="Company Logo" crossorigin="anonymous" />` : '<div style="width:150px;height:150px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;border:2px dashed #ccc;">No Logo</div>'}
            </div>
            <div class="ps-cover-info">
                <div class="ps-cover-title">PRODUCTION SHEET</div>
                <div class="ps-cover-project">${project?.project_number || 'N/A'}</div>
                <div class="ps-cover-name">${project?.name || 'Untitled Project'}</div>
                
                <div class="ps-cover-details">
                    <div class="ps-cover-detail"><strong>Client:</strong> ${client?.company_name || 'N/A'}</div>
                    <div class="ps-cover-detail"><strong>Contact:</strong> ${project?.project_contact || client?.contact_person || 'N/A'}</div>
                    <div class="ps-cover-detail"><strong>Type:</strong> ${project?.type || 'N/A'}</div>
                    <div class="ps-cover-detail"><strong>Deadline:</strong> ${project?.deadline ? new Date(project.deadline).toLocaleDateString('en-GB') : 'N/A'}</div>
                    <div class="ps-cover-detail"><strong>Version:</strong> PS v${currentSheet?.version || 1}</div>
                    <div class="ps-cover-detail"><strong>Status:</strong> ${isIncomplete ? '<span style="color:#ef4444;">Incomplete</span>' : '<span style="color:#22c55e;">Complete</span>'}</div>
                </div>
                
                ${project?.site_address ? `
                <div style="margin-top: 15px; padding: 10px; background: #f0f9ff; border-left: 3px solid #0ea5e9; font-size: 12px;">
                    <strong style="color: #0369a1;">📍 Site Address:</strong><br>
                    <span style="white-space: pre-wrap;">${project.site_address}</span>
                </div>
                ` : ''}
                
                <div style="margin-top: 20px; font-size: 11px; color: #666;">
                    Generated: ${new Date().toLocaleString('en-GB')}<br>
                    Joinery Core by Skylon Development LTD
                </div>
            </div>
        </div>
        
        <div style="height: 55%; display: grid; grid-template-columns: 180px 1fr; gap: 0; padding: 15px;">
            <div style="padding-right: 25px;">
                <h2 style="font-size: 16px; color: #333; margin-bottom: 12px; border-bottom: 2px solid #4a9eff; padding-bottom: 6px;">Contents</h2>
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px;">
                    ${sections.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('')}
                </div>
            </div>
            
            <div style="border-left: 2px solid #ddd; padding-left: 25px;">
                <h2 style="font-size: 16px; color: #333; margin-bottom: 12px; border-bottom: 2px solid #f59e0b; padding-bottom: 6px;">Pre-Construction Checklist</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: center; width: 35px;">✓</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Item</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: center; width: 120px;">Checked by</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 200px;">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${preConstructionItems.map(item => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">
                                    <div style="width: 20px; height: 20px; border: 2px solid #333; margin: 0 auto;"></div>
                                </td>
                                <td style="border: 1px solid #ddd; padding: 10px;">${item}</td>
                                <td style="border: 1px solid #ddd; padding: 10px;"></td>
                                <td style="border: 1px solid #ddd; padding: 10px;"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


// ========== PAGE 2: SCOPE & NOTES ==========
// ========== SCOPE & NOTES (MULTI-PAGE) ==========
function generateScopePages() {
    const pages = [];
    const project = projectData.project;
    const notesRaw = project?.notes || '';
    const allNotes = parseProjectNotesPS(notesRaw);
    const importantNotes = allNotes.filter(n => n.important === true);
    
    // Filter out hidden notes for PDF
    const visibleNotes = importantNotes.filter((note, idx) => !hiddenNotes[idx]);
    
    // Prepare visible notes with their original indices
    const notesWithIndex = importantNotes.map((note, idx) => ({ note, idx }))
        .filter(item => !hiddenNotes[item.idx]);
    
    const hasDescription = getTextFromHtml(scopeDescription).trim().length > 0;
    const descriptionLength = getTextFromHtml(scopeDescription).length;
    const totalNotes = notesWithIndex.length;
    
    // Estimate if description is long (needs its own page)
    // ~1500 chars fills roughly half the page with our font size
    const descriptionIsLong = descriptionLength > 1200;
    const descriptionIsMedium = descriptionLength > 600;
    
    // Adjust notes per page based on description length
    let NOTES_FIRST_PAGE;
    if (!hasDescription) {
        NOTES_FIRST_PAGE = 5;
    } else if (descriptionIsLong) {
        NOTES_FIRST_PAGE = 0; // Description gets its own page
    } else if (descriptionIsMedium) {
        NOTES_FIRST_PAGE = 1;
    } else {
        NOTES_FIRST_PAGE = 3;
    }
    const NOTES_PER_PAGE = 5;
    
    // Generate note HTML
    function renderNote(item) {
        const { note, idx } = item;
        const isEdited = editedNotes[idx] !== undefined;
        const displayText = isEdited ? editedNotes[idx] : (note.text || '');
        return `<div style="margin-bottom: 15px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; overflow: hidden;">
            <div style="font-size: 12px; color: #856404; margin-bottom: 8px;">⚠️ ${note.author || 'Unknown'} • ${note.date || ''} ${isEdited ? '<span style="color: #22c55e;">(edited for PS)</span>' : ''}</div>
            <div style="white-space: pre-wrap; font-size: 14px; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${displayText}</div>
        </div>`;
    }
    
    // Check if everything fits on one page
    const fitsOnOnePage = totalNotes <= NOTES_FIRST_PAGE && !descriptionIsLong;
    
    if (fitsOnOnePage) {
        // Single page - use original logic
        const importantNotesHtml = notesWithIndex.length > 0 
            ? notesWithIndex.map(item => renderNote(item)).join('')
            : '<div style="color: #666; font-style: italic; font-size: 14px;">No important notes flagged.</div>';
        
        pages.push(`
            <h1 class="ps-section-title">1. Scope & Notes</h1>
            
            <div style="display: flex; flex-direction: column; gap: 25px; overflow: hidden;">
                ${hasDescription ? `
                    <div style="overflow: hidden;">
                        <h3 style="color: #333; margin-bottom: 12px; font-size: 16px;">Production Description</h3>
                        <div style="padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; overflow: hidden;">
                            <div style="font-size: 16px; line-height: 1.6;">${scopeDescription}</div>
                        </div>
                    </div>
                ` : ''}
                
                <div style="border-top: 2px solid #ddd; padding-top: 20px; overflow: hidden;">
                    <h3 style="color: #333; margin-bottom: 8px; font-size: 16px;">Important Notes</h3>
                    <div style="font-size: 11px; color: #888; margin-bottom: 15px; font-style: italic;">📌 Notes added during project preparation</div>
                    ${importantNotesHtml}
                </div>
            </div>
        `);
    } else {
        // Multiple pages needed
        const notesPages = totalNotes > 0 ? Math.ceil((totalNotes - NOTES_FIRST_PAGE) / NOTES_PER_PAGE) + (NOTES_FIRST_PAGE > 0 ? 0 : 0) : 0;
        const totalPages = 1 + (totalNotes > NOTES_FIRST_PAGE ? Math.ceil((totalNotes - NOTES_FIRST_PAGE) / NOTES_PER_PAGE) : 0);
        let noteIndex = 0;
        
        // First page - with description (and maybe some notes)
        const firstPageNotes = notesWithIndex.slice(0, NOTES_FIRST_PAGE);
        const firstPageNotesHtml = firstPageNotes.length > 0 ? firstPageNotes.map(item => renderNote(item)).join('') : '';
        noteIndex = NOTES_FIRST_PAGE;
        
        pages.push(`
            <h1 class="ps-section-title">1. Scope & Notes ${totalPages > 1 ? `(1/${totalPages})` : ''}</h1>
            
            <div style="display: flex; flex-direction: column; gap: 25px; overflow: hidden;">
                ${hasDescription ? `
                    <div style="overflow: hidden;">
                        <h3 style="color: #333; margin-bottom: 12px; font-size: 16px;">Production Description</h3>
                        <div style="padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; overflow: hidden;">
                            <div style="font-size: 16px; line-height: 1.6;">${scopeDescription}</div>
                        </div>
                    </div>
                ` : ''}
                
                ${firstPageNotesHtml || totalNotes === 0 ? `
                    <div style="border-top: 2px solid #ddd; padding-top: 20px; overflow: hidden;">
                        <h3 style="color: #333; margin-bottom: 8px; font-size: 16px;">Important Notes</h3>
                        <div style="font-size: 11px; color: #888; margin-bottom: 15px; font-style: italic;">📌 Notes added during project preparation</div>
                        ${firstPageNotesHtml || '<div style="color: #666; font-style: italic; font-size: 14px;">No important notes flagged.</div>'}
                    </div>
                ` : `
                    <div style="border-top: 2px solid #ddd; padding-top: 20px; overflow: hidden;">
                        <div style="font-size: 11px; color: #888; font-style: italic;">📌 Important Notes continue on next page...</div>
                    </div>
                `}
            </div>
        `);
        
        // Subsequent pages - only notes
        let pageNum = 2;
        while (noteIndex < totalNotes) {
            const pageNotes = notesWithIndex.slice(noteIndex, noteIndex + NOTES_PER_PAGE);
            const pageNotesHtml = pageNotes.map(item => renderNote(item)).join('');
            noteIndex += NOTES_PER_PAGE;
            
            pages.push(`
                <h1 class="ps-section-title">1. Scope & Notes (${pageNum}/${totalPages})</h1>
                
                <div style="overflow: hidden;">
                    <h3 style="color: #333; margin-bottom: 8px; font-size: 16px;">Important Notes ${pageNum > 2 ? '(continued)' : ''}</h3>
                    ${pageNotesHtml}
                </div>
            `);
            pageNum++;
        }
    }
    
    return pages;
}


// Keep old function for compatibility
function generateScopePage() {
    const pages = generateScopePages();
    return pages[0] || '';
}



// Helper function to get readable type label
function getTypeLabel(type) {
    const labels = {
        'sash': 'Sash Window',
        'casement': 'Casement Window',
        'internalDoors': 'Internal Door',
        'externalDoors': 'External Door',
        'kitchen': 'Kitchen',
        'wardrobe': 'Wardrobe',
        'partition': 'Partition',
        'externalSpray': 'External Spray',
        'other': 'Other'
    };
    return labels[type] || type || 'Other';
}


// ========== PAGE 3: BOM (MULTI-PAGE) ==========
function generateBOMPages() {
    const pages = [];
    const elements = projectData.elements;
    const ITEMS_PER_PAGE = 30;
    
    if (elements.length === 0) {
        pages.push(`
            <h1 class="ps-section-title">2. Elements List</h1>
            <div style="padding: 40px; text-align: center; color: #666;">
                No elements defined. Add elements in the checklist.
            </div>
        `);
        return pages;
    }
    
    // Pełne kolumny per typ elementu
    const typeColumns = {
        sash: {
            label: 'Sash Windows',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Box', 'Opening', 'Bars', 'Glass', 'Thick.', 'Trickle', 'Ironmongery', 'Notes', '✓'],
            render: (el, idx) => `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.sash_box || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.opening_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.bars || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.glass_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.glass_thickness || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.trickle_vent || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.ironmongery || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
            `
        },
        casement: {
            label: 'Casement Windows',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Opening', 'Bars', 'Glass', 'Thick.', 'Trickle', 'Ironmongery', 'Notes', '✓'],
            render: (el, idx) => `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.opening_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.bars || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.glass_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.glass_thickness || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.trickle_vent || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.ironmongery || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
            `
        },
        internalDoors: {
            label: 'Internal Doors',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'D', 'Type', 'Open Way', 'Fire Rating', 'Intumescent Set', 'Self Closer', 'Glazed', 'Glass', 'Locks', 'Hinges', 'Notes', '✓'],
            render: (el, idx) => {
                const locks = [el.lock_1, el.lock_2, el.lock_3].filter(Boolean).join(', ') || '-';
                const openDir = el.door_handing === 'Left' ? 'LH' : (el.door_handing === 'Right' ? 'RH' : (el.door_handing || '-'));
                const isFire = el.fire_rating === 'FD30' || el.fire_rating === 'FD60';
                return `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.depth || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.door_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${openDir}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.fire_rating || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${isFire ? (el.intumescent_set || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${isFire ? (el.self_closer || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.glazed || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.glazed === 'Yes' ? (el.glass_type || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 100px;">${locks}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.ironmongery_hinges || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
                `;
            }
        },
        externalDoors: {
            label: 'External Doors',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Type', 'Open Way', 'Threshold', 'Glazed', 'Glass', 'Thick.', 'Locks', 'Hinges', 'Notes', '✓'],
            render: (el, idx) => {
                const openDir = el.door_handing === 'Left' ? 'LH' : (el.door_handing === 'Right' ? 'RH' : (el.door_handing || '-'));
                return `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.external_door_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${openDir}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.threshold || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.glazed || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.glazed === 'Yes' ? (el.glass_type || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.glazed === 'Yes' ? (el.glass_thickness || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.locks || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.ironmongery_hinges || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
                `;
            }
        },
        kitchen: {
            label: 'Kitchen Units',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'D', 'Unit', 'Style', 'Front', 'Carcass', 'Handle', 'Soft', 'Worktop', 'Notes', '✓'],
            render: (el, idx) => `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.depth || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.unit_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.front_style || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.front_material || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${el.carcass_material || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.handle_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.soft_close || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${el.worktop || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
            `
        },
        wardrobe: {
            label: 'Wardrobes',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'D', 'Shape', 'Door', 'Style', 'Front', 'Carcass', 'Handle', 'Layout', 'Mirror', 'Notes', '✓'],
            render: (el, idx) => `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.depth || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.wardrobe_shape || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.door_style || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.front_style || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.front_material || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${el.carcass_material || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.handle_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${el.internal_layout || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.mirror || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
            `
        },
        partition: {
            label: 'Partitions',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Panel', 'Frame', 'Glass', 'Thick.', 'Door', 'Hand', 'Lock', 'Acoustic', 'Notes', '✓'],
            render: (el, idx) => {
                const isGlazed = el.panel_type === 'Glazed' || el.panel_type === 'Mixed';
                const hasDoor = el.door_included === 'Yes';
                return `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.panel_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.frame_material || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${isGlazed ? (el.glass_type || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${isGlazed ? (el.glass_thickness || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.door_included || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${hasDoor ? (el.door_handing || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${hasDoor ? (el.door_lock || '-') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.acoustic_rating || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
            `;
            }
        },
        externalSpray: {
            label: 'External Spray',
            cols: ['#', 'ID', 'Name', 'Qty', 'Item', 'Substrate', 'Paint', 'Sheen', 'Coats', 'Notes', '✓'],
            render: (el, idx) => `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.qty || 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.item_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.substrate || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.paint_system || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.sheen_level || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.num_coats || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
            `
        },
        additionalProject: {
            label: 'Additional Project Items',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'D', 'Qty', 'Item Type', 'Material', 'Description', '✓'],
            render: (el, idx) => `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.depth || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.qty || 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.item_type || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.material || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
            `
        },
        other: {
            label: 'Other Items',
            cols: ['#', 'ID', 'Name', 'Qty', 'W', 'H', 'D', 'Material', 'Custom 1', 'Custom 2', 'Custom 3', 'Notes', '✓'],
            render: (el, idx) => `
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; color: #4a9eff;">${getFullId(el)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.qty || 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.width || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.height || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${el.depth || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.material || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.custom_field_1 || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.custom_field_2 || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${el.custom_field_3 || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; word-wrap: break-word; max-width: 150px;">${el.description || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div></td>
            `
        }
    };
    
    // Group elements by type
    const grouped = {};
    elements.forEach(el => {
        const type = el.element_type || 'other';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(el);
    });
    
    // Helper: build table HTML for a type
    function buildTypeTable(type, items, startIdx = 0) {
        const config = typeColumns[type] || typeColumns.other;
        let html = `<h3 style="color: #4a9eff; margin: 15px 0 10px 0; font-size: 15px; border-bottom: 2px solid #4a9eff; padding-bottom: 5px;">
            ${config.label} - ${items.length} items
        </h3>`;
        html += `<table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
                <tr style="background: #4a9eff; color: white;">
                    ${config.cols.map(col => `<th style="border: 1px solid #ddd; padding: 6px; text-align: center;">${col}</th>`).join('')}
                </tr>
            </thead>
            <tbody>`;
        items.forEach((el, idx) => {
            html += `<tr>${config.render(el, startIdx + idx)}</tr>`;
        });
        html += `</tbody></table>`;
        return html;
    }
    
    // Nowa logika: zbieraj typy na jednej stronie dopóki suma < ITEMS_PER_PAGE
    const types = Object.keys(grouped);
    let currentPageContent = '';
    let currentPageCount = 0;
    let pageNum = 1;
    const totalPages = Math.ceil(elements.length / ITEMS_PER_PAGE);
    
    types.forEach((type, typeIdx) => {
        const typeElements = grouped[type];
        
        if (currentPageCount + typeElements.length <= ITEMS_PER_PAGE) {
            currentPageContent += buildTypeTable(type, typeElements);
            currentPageCount += typeElements.length;
        } else if (currentPageCount === 0) {
            for (let i = 0; i < typeElements.length; i += ITEMS_PER_PAGE) {
                const chunk = typeElements.slice(i, i + ITEMS_PER_PAGE);
                const isLast = (i + ITEMS_PER_PAGE >= typeElements.length);
                let html = `<h1 class="ps-section-title">2. Elements List${totalPages > 1 ? ` (${pageNum}/${totalPages})` : ''}</h1>`;
                html += buildTypeTable(type, chunk, i);
                if (!isLast) {
                    pages.push(html);
                    pageNum++;
                } else {
                    currentPageContent = html;
                    currentPageCount = chunk.length;
                }
            }
        } else {
            let html = `<h1 class="ps-section-title">2. Elements List${totalPages > 1 ? ` (${pageNum}/${totalPages})` : ''}</h1>`;
            html += currentPageContent;
            pages.push(html);
            pageNum++;
            currentPageContent = buildTypeTable(type, typeElements);
            currentPageCount = typeElements.length;
        }
        
        if (typeIdx === types.length - 1 && currentPageContent) {
            let html = currentPageContent.startsWith('<h1') ? currentPageContent : 
                `<h1 class="ps-section-title">2. Elements List${totalPages > 1 ? ` (${pageNum}/${totalPages})` : ''}</h1>` + currentPageContent;
            pages.push(html);
        }
    });
    
    return pages;
}



// ========== CUT LIST - REMOVED ==========
// Cut List functionality moved to Production Support Documents
// Function generateCutListPage() removed

// ========== PAGE 3: MATERIALS ==========
function generateMaterialsPage() {
    const materials = projectData.materials;
    
    const byStage = {
        'Production': materials.filter(m => m.used_in_stage === 'Production'),
        'Spraying': materials.filter(m => m.used_in_stage === 'Spraying'),
        'Installation': materials.filter(m => m.used_in_stage === 'Installation')
    };
    
    let html = `<h1 class="ps-section-title">3. Materials</h1>`;
    
    if (materials.length === 0) {
        html += '<div style="color: #666; font-style: italic; padding: 20px;">No materials assigned to this project.</div>';
        return html;
    }
    
    // Process each stage
    Object.entries(byStage).forEach(([stage, mats]) => {
        if (mats.length === 0) return;
        
        const stageColor = stage === 'Production' ? '#4a9eff' : stage === 'Spraying' ? '#f59e0b' : '#22c55e';
        
        html += `
            <div style="margin-bottom: 25px;">
                <h3 style="color: #333; font-size: 14px; margin-bottom: 10px; padding: 8px 12px; background: linear-gradient(90deg, ${stageColor}22, transparent); border-left: 4px solid ${stageColor};">
                    ${stage.toUpperCase()} STAGE
                </h3>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 80px;">Photo</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 35%;">Material</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 90px;">Reserved</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 90px;">Stock Left</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Notes</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 45px;">✓</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        mats.forEach(m => {
            // Photo - stock items from stock_items.image_url, bespoke from m.image_url
            const imageUrl = m.is_bespoke ? m.image_url : m.stock_items?.image_url;
            const photoPlaceholder = m.is_bespoke ? 'Bespoke' : '-';
            const photoHtml = imageUrl 
                ? `<img src="${imageUrl}" style="width: 65px; height: 65px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">`
                : `<div style="width: 65px; height: 65px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;">${photoPlaceholder}</div>`;
            
            // Material description
            let materialDesc = m.item_name || m.stock_items?.name || 'Unknown';
            const size = m.stock_items?.size || '';
            const thickness = m.stock_items?.thickness || '';
            const sizeInfo = [size, thickness].filter(x => x).join(' / ');
            if (sizeInfo) {
                materialDesc += `<br><span style="color: #666; font-size: 12px;">${sizeInfo}</span>`;
            }
            if (m.item_notes) {
                materialDesc += `<br><span style="color: #888; font-size: 11px; font-style: italic;">${m.item_notes}</span>`;
            }
            
            // Reserved - quantity_reserved for stock, quantity_needed for bespoke
            const reserved = m.is_bespoke ? (m.quantity_needed || 0) : (m.quantity_reserved || 0);
            const unit = m.unit || m.stock_items?.unit || 'pcs';
            const reservedStr = `${reserved.toFixed(2)} ${unit}`;
            
            // Stock Left - available quantity (current - reserved from whole stock)
            let stockLeftHtml = '-';
            if (!m.is_bespoke && m.stock_items) {
                const stockLeft = (m.stock_items.current_quantity || 0) - (m.stock_items.reserved_quantity || 0);
                stockLeftHtml = `${stockLeft.toFixed(2)} ${unit}`;
                if (stockLeft < 0) {
                    stockLeftHtml += `<br><span style="color: #ef4444; font-size: 10px; font-weight: bold;">✗ NEGATIVE</span>`;
                }
            }
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${photoHtml}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${materialDesc}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${reservedStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${stockLeftHtml}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; vertical-align: bottom;">
                        <div style="border-bottom: 1px solid #999; min-height: 40px;"></div>
                    </td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <div style="width: 22px; height: 22px; border: 2px solid #333; margin: 0 auto;"></div>
                    </td>
                </tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>`;
    });
    
    return html;
}


// ========== PAGE 3: MATERIALS (MULTI-PAGE) ==========
function generateMaterialsPages() {
    const pages = [];
    const materials = projectData.materials;
    const ITEMS_PER_PAGE = 10; // Max items per page
    
    if (materials.length === 0) {
        pages.push(`
            <h1 class="ps-section-title">3. Materials</h1>
            <div style="color: #666; font-style: italic; padding: 20px;">No materials assigned to this project.</div>
        `);
        return pages;
    }
    
    // Flatten all materials with stage info
    const allMaterials = [];
    const stages = ['Production', 'Spraying', 'Installation'];
    stages.forEach(stage => {
        const stageMats = materials.filter(m => m.used_in_stage === stage);
        stageMats.forEach((m, idx) => {
            allMaterials.push({ ...m, stageName: stage, isFirstInStage: idx === 0 });
        });
    });
    
    // Split into pages
    const totalPages = Math.ceil(allMaterials.length / ITEMS_PER_PAGE);
    
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const startIdx = pageNum * ITEMS_PER_PAGE;
        const pageMaterials = allMaterials.slice(startIdx, startIdx + ITEMS_PER_PAGE);
        
        let html = `<h1 class="ps-section-title">3. Materials${totalPages > 1 ? ` (${pageNum + 1}/${totalPages})` : ''}</h1>`;
        
        let currentStage = null;
        
        pageMaterials.forEach((m) => {
            // New stage header
            if (m.stageName !== currentStage) {
                if (currentStage !== null) {
                    html += `</tbody></table></div>`;
                }
                currentStage = m.stageName;
                const stageColor = currentStage === 'Production' ? '#4a9eff' : currentStage === 'Spraying' ? '#f59e0b' : '#22c55e';
                
                html += `
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #333; font-size: 13px; margin-bottom: 8px; padding: 6px 10px; background: linear-gradient(90deg, ${stageColor}22, transparent); border-left: 4px solid ${stageColor};">
                            ${currentStage.toUpperCase()} STAGE
                        </h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="background: #f5f5f5;">
                                    <th style="border: 1px solid #ddd; padding: 5px; text-align: center; width: 80px;">Photo</th>
                                    <th style="border: 1px solid #ddd; padding: 5px; text-align: left; width: 28%;">Material</th>
                                    <th style="border: 1px solid #ddd; padding: 5px; text-align: center; width: 80px;">Reserved</th>
                                    <th style="border: 1px solid #ddd; padding: 5px; text-align: center; width: 80px;">Stock Left</th>
                                    <th style="border: 1px solid #ddd; padding: 5px; text-align: left;">Notes</th>
                                    <th style="border: 1px solid #ddd; padding: 5px; text-align: center; width: 40px;">✓</th>
                                </tr>
                            </thead>
                            <tbody>`;
            }
            
            // Material row
            const imageUrl = m.is_bespoke ? m.image_url : m.stock_items?.image_url;
            const photoPlaceholder = m.is_bespoke ? 'Bespoke' : '-';
            const photoHtml = imageUrl 
                ? `<img src="${imageUrl}" style="width: 65px; height: 65px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">`
                : `<div style="width: 65px; height: 65px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;">${photoPlaceholder}</div>`;
            
            let materialDesc = m.item_name || m.stock_items?.name || 'Unknown';
            const size = m.stock_items?.size || '';
            const thickness = m.stock_items?.thickness || '';
            const sizeInfo = [size, thickness].filter(x => x).join(' / ');
            if (sizeInfo) materialDesc += `<br><span style="color: #666; font-size: 11px;">${sizeInfo}</span>`;
            if (m.item_notes) materialDesc += `<br><span style="color: #888; font-size: 10px; font-style: italic;">${m.item_notes}</span>`;
            
            const reserved = m.is_bespoke ? (m.quantity_needed || 0) : (m.quantity_reserved || 0);
            const unit = m.unit || m.stock_items?.unit || 'pcs';
            
            let stockLeftHtml = '-';
            if (!m.is_bespoke && m.stock_items) {
                const stockLeft = (m.stock_items.current_quantity || 0) - (m.stock_items.reserved_quantity || 0);
                stockLeftHtml = `${stockLeft.toFixed(2)} ${unit}`;
                if (stockLeft < 0) stockLeftHtml += `<br><span style="color: #ef4444; font-size: 9px; font-weight: bold;">✗ LOW</span>`;
            }
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 5px; text-align: center;">${photoHtml}</td>
                    <td style="border: 1px solid #ddd; padding: 5px;">${materialDesc}</td>
                    <td style="border: 1px solid #ddd; padding: 5px; text-align: center;">${reserved.toFixed(2)} ${unit}</td>
                    <td style="border: 1px solid #ddd; padding: 5px; text-align: center;">${stockLeftHtml}</td>
                    <td style="border: 1px solid #ddd; padding: 5px;"></td>
                    <td style="border: 1px solid #ddd; padding: 5px; text-align: center;"><div style="width: 20px; height: 20px; border: 2px solid #333; margin: 0 auto;"></div></td>
                </tr>`;
        });
        
        // Close last table
        html += `</tbody></table></div>`;
        pages.push(html);
    }
    
    return pages;
}


// ========== PAGES: DRAWINGS ==========
async function generateDrawingPages() {
    const pages = [];
    
    // Use only selected drawings
    if (selectedDrawings.length === 0) {
        // No drawings selected - show warning page
        pages.push(`
            <h1 class="ps-section-title">4. Drawings</h1>
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <div style="font-size: 18px;">No drawings selected</div>
                <div style="font-size: 14px; color: #666; margin-top: 10px;">This is a required item. Please select drawings before finalizing.</div>
            </div>
        `);
        return pages;
    }
    
    let drawingPageNum = 0;
    const totalDrawings = selectedDrawings.length;
    
    for (const drawing of selectedDrawings) {
        const fileName = drawing.name.toLowerCase();
        const isPdf = fileName.endsWith('.pdf');
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        if (isImage) {
            drawingPageNum++;
            pages.push(`
                <h1 class="ps-section-title">4. Drawings ${totalDrawings > 1 ? `(${drawingPageNum}/${totalDrawings})` : ''}</h1>
                <div class="ps-drawing-full">
                    <img src="${drawing.url}" crossorigin="anonymous" />
                </div>
            `);
        } else if (isPdf) {
            try {
                const images = await renderPdfToImages(drawing.url);
                if (images.length > 0) {
                    images.forEach((imgData, i) => {
                        drawingPageNum++;
                        pages.push(`
                            <h1 class="ps-section-title">4. Drawings</h1>
                            <div class="ps-drawing-full">
                                <img src="${imgData}" />
                            </div>
                        `);
                    });
                } else {
                    drawingPageNum++;
                    pages.push(`
                        <h1 class="ps-section-title">4. Drawings</h1>
                        <div style="padding: 40px; text-align: center; color: #f59e0b;">
                            <div style="font-size: 18px;">Could not render PDF: ${drawing.name}</div>
                            <div style="margin-top: 15px;"><a href="${drawing.url}" target="_blank" style="color: #4a9eff;">Open PDF in new tab</a></div>
                        </div>
                    `);
                }
            } catch (err) {
                console.error('PDF render error:', err);
                drawingPageNum++;
                pages.push(`
                    <h1 class="ps-section-title">4. Drawings</h1>
                    <div style="padding: 40px; text-align: center; color: #f59e0b;">
                        <div style="font-size: 18px;">Error loading PDF: ${drawing.name}</div>
                        <div style="margin-top: 15px;"><a href="${drawing.url}" target="_blank" style="color: #4a9eff;">Open PDF in new tab</a></div>
                    </div>
                `);
            }
        } else {
            drawingPageNum++;
            pages.push(`
                <h1 class="ps-section-title">4. Drawings</h1>
                <div style="padding: 40px; text-align: center;">
                    <div style="margin-top: 15px;"><a href="${drawing.url}" target="_blank" style="color: #4a9eff;">Download file</a></div>
                </div>
            `);
        }
    }
    
    return pages;
}


// ========== PAGES: PHOTOS ==========
async function generatePhotoPages() {
    const pages = [];
    
    // Use only selected photos
    if (selectedPhotos.length === 0) {
        return pages; // No photos selected - skip section
    }
    
    // Create page with photos (max 8 per page in grid 4x2 for A3)
    const photosPerPage = 8;
    for (let i = 0; i < selectedPhotos.length; i += photosPerPage) {
        const pagePhotos = selectedPhotos.slice(i, i + photosPerPage);
        const pageNum = Math.floor(i / photosPerPage) + 1;
        const totalPhotoPages = Math.ceil(selectedPhotos.length / photosPerPage);
        
        let html = `<h1 class="ps-section-title">8. Reference Photos ${totalPhotoPages > 1 ? `(${pageNum}/${totalPhotoPages})` : ''}</h1>`;
        html += `<div style="display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 1fr); gap: 10px; height: calc(297mm - 80mm);">`;
        
        for (const photo of pagePhotos) {
            const isImage = photo.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i);
            html += `<div style="text-align: center; border: 1px solid #ddd; padding: 8px; display: flex; flex-direction: column; overflow: hidden;">
                <div style="font-size: 9px; color: #666; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📷 ${photo.name}</div>
                ${isImage 
                    ? `<img src="${photo.url}" style="flex: 1; width: 100%; height: 100%; object-fit: contain;" crossorigin="anonymous" />`
                    : `<a href="${photo.url}" target="_blank" style="color: #4a9eff; font-size: 10px;">View file</a>`
                }
            </div>`;
        }
        
        // Fill empty cells if less than 8 photos
        const emptySlots = photosPerPage - pagePhotos.length;
        for (let j = 0; j < emptySlots; j++) {
            html += `<div style="border: 1px dashed #ddd;"></div>`;
        }
        
        html += '</div>';
        pages.push(html);
    }
    
    return pages;
}


// ========== PAGE: SPRAY PACK ==========
function generateSprayingPage() {
    const sprayItems = projectData.sprayItems || [];
    const projectPrefix = (projectData.project?.project_number || '').split('/')[0] || '';
    
    // Build element lookup map for full ID
    const elementMap = {};
    (projectData.elements || []).forEach(el => {
        if (el.id) elementMap[el.id] = el.element_id || '';
    });
    
    // Group by colour
    const colourGroups = {};
    sprayItems.forEach(item => {
        const colour = item.colour || 'No Colour Specified';
        if (!colourGroups[colour]) {
            colourGroups[colour] = [];
        }
        colourGroups[colour].push(item);
    });
    
    const colours = Object.keys(colourGroups);
    const totalItems = sprayItems.length;
    
    // Spray checklist items
    const sprayChecklist = [
        'All items sanded and prepared',
        'Primer applied',
        'First coat applied',
        'Second coat applied',
        'Final inspection completed',
        'Items ready for assembly'
    ];
    
    // Build spray item display name with full number
    const getSprayItemDisplay = (item, idxInGroup) => {
        const elementCode = elementMap[item.element_id] || '';
        const itemName = item.item_type || item.name || 'Item';
        if (projectPrefix && elementCode) {
            return `${projectPrefix}-${elementCode}-${(item.sort_order || 0) + 1} ${itemName}`;
        }
        return item.name || itemName;
    };
    
    // Colour type label
    const colourTypeLabel = sprayColourType === 'dual' ? 'Dual Colour' : 'Single Colour';
    
    return `
        <h1 class="ps-section-title">5. Spraying</h1>
        
        <!-- Disclaimer -->
        <div style="margin-bottom: 15px; padding: 12px 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0;">
            <strong style="color: #92400e;">⚠️ Important:</strong>
            <span style="font-size: 12px; color: #78350f; margin-left: 8px;">
                Please review ALL project documentation. If any information is unclear, contact Production Manager before proceeding.
            </span>
        </div>
        
        <!-- Spray Settings Summary -->
        <div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border: 1px solid #3b82f6; border-radius: 6px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                <div>
                    <strong style="color: #1e40af; font-size: 11px;">Colour Type:</strong>
                    <div style="font-size: 14px; font-weight: 600; color: #333; margin-top: 3px;">${colourTypeLabel}</div>
                </div>
                <div>
                    <strong style="color: #1e40af; font-size: 11px;">Sheen Level:</strong>
                    <div style="font-size: 14px; font-weight: 600; color: #333; margin-top: 3px;">${spraySheenLevel || '___________'}</div>
                </div>
                <div>
                    <strong style="color: #1e40af; font-size: 11px;">Colours Defined:</strong>
                    <div style="font-size: 14px; font-weight: 600; color: #333; margin-top: 3px;">${sprayColours.length > 0 ? sprayColours.join(', ') : 'None'}</div>
                </div>
            </div>
            ${sprayDescription ? `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #3b82f6;">
                    <strong style="color: #1e40af; font-size: 11px;">Instructions:</strong>
                    <div style="font-size: 12px; color: #333; margin-top: 3px; white-space: pre-line;">${sprayDescription}</div>
                </div>
            ` : ''}
        </div>
        
        <!-- Spray Items List -->
        <div style="margin-bottom: 25px;">
            <h3 style="color: #333; margin-bottom: 15px; font-size: 14px;">Spray Items List (${totalItems} items)</h3>
            ${colours.length > 0 ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    ${colours.map(colour => `
                        <div style="margin-bottom: 15px;">
                            <div style="background: #e99f62; color: white; padding: 8px 12px; font-weight: 600; font-size: 12px; border-radius: 4px 4px 0 0;">
                                ${colour} (${colourGroups[colour].length} items)
                            </div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                <thead>
                                    <tr style="background: #f5f5f5;">
                                        <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 30px;">✓</th>
                                        <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Item</th>
                                        <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Size (mm)</th>
                                        <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${colourGroups[colour].map((item, idx) => `
                                        <tr>
                                            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">
                                                <div style="width: 14px; height: 14px; border: 2px solid #333; margin: 0 auto;"></div>
                                            </td>
                                            <td style="border: 1px solid #ddd; padding: 6px;">${getSprayItemDisplay(item, idx)}</td>
                                            <td style="border: 1px solid #ddd; padding: 6px; text-align: center; font-size: 10px;">
                                                ${item.width || '-'} x ${item.height || '-'}${item.depth ? ` x ${item.depth}` : ''}
                                            </td>
                                            <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px; color: #666;">${item.notes || '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `).join('')}
                </div>
            ` : '<div style="color: #666; font-style: italic; padding: 15px; background: #f5f5f5;">No spray items defined. Add spray items in Element List.</div>'}
        </div>
        
        <!-- Spray Checklist - full width below -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
            <div>
                <h3 style="color: #333; margin-bottom: 15px; font-size: 14px;">Spray Checklist</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 30px;">✓</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Task</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 80px;">Date</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 80px;">By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sprayChecklist.map(item => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                    <div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div>
                                </td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${item}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;"></td>
                                <td style="border: 1px solid #ddd; padding: 8px;"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div>
                <h3 style="color: #333; margin-bottom: 15px; font-size: 14px;">Notes:</h3>
                <div style="border: 1px solid #ddd; min-height: 150px; padding: 10px; background: #fafafa;"></div>
            </div>
        </div>
    `;
}


// ========== DATA SHEETS PAGES ==========
async function generateDataSheetsPages() {
    const pages = [];
    const dataSheets = projectData.attachments.filter(a => a.attachment_type === 'DATA_SHEET');
    
    if (dataSheets.length === 0) {
        return pages; // No data sheets - return empty array (no pages)
    }
    
    const sectionNum = ++pdfSectionNumber;
    let pageNum = 0;
    
    for (const ds of dataSheets) {
        const fileName = ds.file_name.toLowerCase();
        const isPdf = fileName.endsWith('.pdf');
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        if (isImage) {
            pageNum++;
            pages.push(`
                <h1 class="ps-section-title">${sectionNum}. Material Docs & Manuals ${dataSheets.length > 1 ? `(${pageNum})` : ''}</h1>
                <div class="ps-drawing-full">
                    <img src="${ds.file_url}" crossorigin="anonymous" />
                </div>
                <div style="text-align: center; margin-top: 10px; font-size: 12px; color: #666;">
                    📄 ${ds.file_name}
                </div>
            `);
        } else if (isPdf) {
            try {
                const images = await renderPdfToImages(ds.file_url);
                if (images.length > 0) {
                    images.forEach((imgData, i) => {
                        pageNum++;
                        pages.push(`
                            <h1 class="ps-section-title">${sectionNum}. Material Docs & Manuals</h1>
                            <div class="ps-drawing-full">
                                <img src="${imgData}" />
                            </div>
                            <div style="text-align: center; margin-top: 10px; font-size: 12px; color: #666;">
                                📄 ${ds.file_name} ${images.length > 1 ? `(page ${i + 1}/${images.length})` : ''}
                            </div>
                        `);
                    });
                } else {
                    pageNum++;
                    pages.push(`
                        <h1 class="ps-section-title">${sectionNum}. Material Docs & Manuals</h1>
                        <div style="padding: 40px; text-align: center; color: #f59e0b;">
                            <div style="font-size: 18px;">Could not render PDF: ${ds.file_name}</div>
                            <div style="margin-top: 15px;"><a href="${ds.file_url}" target="_blank" style="color: #4a9eff;">Open PDF in new tab</a></div>
                        </div>
                    `);
                }
            } catch (err) {
                console.error('PDF render error:', err);
                pageNum++;
                pages.push(`
                    <h1 class="ps-section-title">${sectionNum}. Material Docs & Manuals</h1>
                    <div style="padding: 40px; text-align: center; color: #f59e0b;">
                        <div style="font-size: 18px;">Error loading PDF: ${ds.file_name}</div>
                        <div style="margin-top: 15px;"><a href="${ds.file_url}" target="_blank" style="color: #4a9eff;">Open PDF in new tab</a></div>
                    </div>
                `);
            }
        } else {
            pageNum++;
            pages.push(`
                <h1 class="ps-section-title">${sectionNum}. Material Docs & Manuals</h1>
                <div style="padding: 40px; text-align: center;">
                    <div style="font-size: 18px;">📄 ${ds.file_name}</div>
                    <div style="margin-top: 15px;"><a href="${ds.file_url}" target="_blank" style="color: #4a9eff;">Download file</a></div>
                </div>
            `);
        }
    }
    
    return pages;
}


// ========== PAGE 5: SPRAYING (MULTI-PAGE) ==========
function generateSprayingPages() {
    const pages = [];
    const sprayItemsRaw = projectData.sprayItems || [];
    const projectPrefix = (projectData.project?.project_number || '').split('/')[0] || '';
    const ITEMS_PER_PAGE = 25; // Max items per page (leaving room for headers)
    
    // Build element lookup map
    const elementMap = {};
    (projectData.elements || []).forEach(el => {
        if (el.id) elementMap[el.id] = el.element_id || '';
    });
    
    // Group spray items by colour, then sort within each group by element_id
    const sprayItems = [...sprayItemsRaw].sort((a, b) => {
        const aCode = elementMap[a.element_id] || '';
        const bCode = elementMap[b.element_id] || '';
        
        // Extract number from element code (D001 -> 1, D002 -> 2)
        const aMatch = aCode.match(/[A-Za-z]*(\d+)/);
        const bMatch = bCode.match(/[A-Za-z]*(\d+)/);
        const aNum = aMatch ? parseInt(aMatch[1]) : 99999;
        const bNum = bMatch ? parseInt(bMatch[1]) : 99999;
        
        // First sort by element number
        if (aNum !== bNum) return aNum - bNum;
        
        // Then by sort_order within element
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
    
    // Group items by colour
    const itemsByColour = {};
    sprayItems.forEach(item => {
        const colour = item.colour || 'No Colour';
        if (!itemsByColour[colour]) itemsByColour[colour] = [];
        itemsByColour[colour].push(item);
    });
    const colourGroups = Object.keys(itemsByColour).sort();
    
    const getSprayItemDisplay = (item) => {
        const elementCode = elementMap[item.element_id] || '';
        const itemName = item.item_type || item.name || 'Item';
        if (projectPrefix && elementCode) {
            return `${projectPrefix}-${elementCode}-${(item.sort_order || 0) + 1} ${itemName}`;
        }
        return item.name || itemName;
    };
    
    const totalItems = sprayItems.length;
    
    // Spray settings header (only on first page)
    const colourTypeLabel = sprayColourType === 'dual' ? 'Dual Colour' : 'Single Colour';
    const settingsHtml = `
        <div style="margin-bottom: 15px; padding: 12px 15px; background: #fef3c7; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">⚠️ Important:</strong>
            <span style="font-size: 12px; color: #78350f; margin-left: 8px;">
                Review ALL documentation. Contact Production Manager if unclear.
            </span>
        </div>
        <div style="margin-bottom: 15px; padding: 12px; background: #f0f9ff; border: 1px solid #3b82f6; border-radius: 4px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div><strong style="color: #1e40af; font-size: 10px;">Colour Type:</strong><div style="font-size: 13px; font-weight: 600;">${colourTypeLabel}</div></div>
                <div><strong style="color: #1e40af; font-size: 10px;">Sheen:</strong><div style="font-size: 13px; font-weight: 600;">${spraySheenLevel || '___'}</div></div>
                <div><strong style="color: #1e40af; font-size: 10px;">Colours:</strong><div style="font-size: 13px; font-weight: 600;">${sprayColours.length > 0 ? sprayColours.join(', ') : 'None'}</div></div>
            </div>
            ${sprayDescription ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #3b82f6; font-size: 11px;"><strong>Instructions:</strong> ${sprayDescription}</div>` : ''}
        </div>`;
    
    // Spray checklist (only on last page)
    const sprayChecklist = ['All items sanded', 'Primer applied', '1st coat', '2nd coat', 'Final inspection', 'Ready for assembly'];
    const checklistHtml = `
        <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <h3 style="font-size: 13px; margin-bottom: 10px;">Spray Checklist</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead><tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 6px; width: 25px;">✓</th>
                        <th style="border: 1px solid #ddd; padding: 6px;">Task</th>
                        <th style="border: 1px solid #ddd; padding: 6px; width: 70px;">Date</th>
                        <th style="border: 1px solid #ddd; padding: 6px; width: 70px;">By</th>
                    </tr></thead>
                    <tbody>${sprayChecklist.map(t => `<tr>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;"><div style="width: 14px; height: 14px; border: 2px solid #333; margin: 0 auto;"></div></td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${t}</td>
                        <td style="border: 1px solid #ddd; padding: 6px;"></td>
                        <td style="border: 1px solid #ddd; padding: 6px;"></td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>
            <div>
                <h3 style="font-size: 13px; margin-bottom: 10px;">Notes:</h3>
                <div style="border: 1px solid #ddd; min-height: 120px; background: #fafafa;"></div>
            </div>
        </div>`;
    
    if (totalItems === 0) {
        pages.push(`
            <h1 class="ps-section-title">5. Spraying</h1>
            ${settingsHtml}
            <div style="color: #666; font-style: italic; padding: 15px; background: #f5f5f5;">No spray items defined.</div>
            ${checklistHtml}
        `);
        return pages;
    }
    
    // Helper to render table rows for items
    const renderTableRows = (items, startIdx) => {
        return items.map((item, idx) => `<tr>
            <td style="border: 1px solid #ddd; padding: 5px; text-align: center; font-weight: bold;">${startIdx + idx + 1}</td>
            <td style="border: 1px solid #ddd; padding: 5px;">${getSprayItemDisplay(item)}</td>
            <td style="border: 1px solid #ddd; padding: 5px; text-align: center; font-size: 9px;">${item.width || '-'}x${item.height || '-'}</td>
            <td style="border: 1px solid #ddd; padding: 5px; font-size: 9px;">${item.colour || '-'}</td>
            <td style="border: 1px solid #ddd; padding: 5px; font-size: 9px; color: #666;">${item.notes || ''}</td>
        </tr>`).join('');
    };
    
    // Helper to render colour table header
    const renderColourHeader = (colour, totalInColour, continued = false) => {
        return `
            <div style="margin-bottom: 5px; margin-top: 15px;">
                <h4 style="font-size: 12px; margin-bottom: 8px; padding: 6px 10px; background: #f59e0b; color: white; border-radius: 4px;">
                    ${colour} (${totalInColour} item${totalInColour !== 1 ? 's' : ''})${continued ? ' - continued' : ''}
                </h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <thead><tr style="background: #fef3c7;">
                        <th style="border: 1px solid #d97706; padding: 5px; width: 30px;">No</th>
                        <th style="border: 1px solid #d97706; padding: 5px;">Item</th>
                        <th style="border: 1px solid #d97706; padding: 5px; width: 70px;">Size</th>
                        <th style="border: 1px solid #d97706; padding: 5px; width: 80px;">Colour</th>
                        <th style="border: 1px solid #d97706; padding: 5px;">Notes</th>
                    </tr></thead>
                    <tbody>`;
    };
    
    const renderTableClose = () => `</tbody></table></div>`;
    
    // Build pages with pagination
    let currentPageHtml = '';
    let currentPageItems = 0;
    let pageNum = 0;
    let isFirstPage = true;
    
    const startNewPage = () => {
        if (currentPageHtml) {
            // Close any open content and add to pages
            pages.push(currentPageHtml);
        }
        pageNum++;
        currentPageHtml = `<h1 class="ps-section-title">5. Spraying${pageNum > 1 ? ` (${pageNum})` : ''}</h1>`;
        if (isFirstPage) {
            currentPageHtml += settingsHtml;
            currentPageHtml += `<h3 style="font-size: 13px; margin-bottom: 15px;">Spray Items (${totalItems} items)</h3>`;
            isFirstPage = false;
        }
        currentPageItems = 0;
    };
    
    // Start first page
    startNewPage();
    
    // Iterate through colour groups
    colourGroups.forEach(colour => {
        const colourItems = itemsByColour[colour];
        const totalInColour = colourItems.length;
        let itemsRendered = 0;
        
        while (itemsRendered < totalInColour) {
            const remainingOnPage = ITEMS_PER_PAGE - currentPageItems;
            const itemsToRender = Math.min(remainingOnPage, totalInColour - itemsRendered);
            
            if (itemsToRender <= 0 || remainingOnPage < 3) {
                // Not enough space, start new page
                startNewPage();
                continue;
            }
            
            // Render colour header (with "continued" if not first batch)
            const continued = itemsRendered > 0;
            currentPageHtml += renderColourHeader(colour, totalInColour, continued);
            
            // Render items
            const itemsBatch = colourItems.slice(itemsRendered, itemsRendered + itemsToRender);
            currentPageHtml += renderTableRows(itemsBatch, itemsRendered);
            currentPageHtml += renderTableClose();
            
            currentPageItems += itemsToRender + 2; // +2 for header
            itemsRendered += itemsToRender;
        }
    });
    
    // Add checklist to last page and close it
    currentPageHtml += checklistHtml;
    pages.push(currentPageHtml);
    
    return pages;
}


// ========== PAGE: PHASES / TIMELINE ==========

function formatDateSafe(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
    return dateStr;
}


function getAssignedName(p) {
    return (p?.assigned_name || '').trim() || '-';
}


// UTC-safe day number (days since epoch)
function toUtcDay(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return Date.UTC(y, m - 1, d) / 86400000;
}


function utcDayToDate(dayNum) {
    return new Date(dayNum * 86400000);
}


function daysInclusive(startStr, endStr) {
    const s = toUtcDay(startStr);
    const e = toUtcDay(endStr);
    if (s == null || e == null) return 0;
    const diff = (e - s) + 1;
    return diff > 0 ? diff : 0;
}


// work_days: safe parse (handles string)
function getWorkDays(p) {
    const wd = Number(p?.work_days);
    return Number.isFinite(wd) && wd > 0 ? wd : null;
}


// Working days excluding Sundays (UTC-safe)
function workingDaysBetweenUtc(startStr, endStr) {
    const s = toUtcDay(startStr);
    const e = toUtcDay(endStr);
    if (s == null || e == null || e < s) return 0;

    let count = 0;
    for (let day = s; day <= e; day++) {
        const dt = utcDayToDate(day);
        if (dt.getUTCDay() !== 0) count++; // exclude Sunday
    }
    return count;
}


// Helper: numbering for duplicate labels
function getNumberedLabels(phases) {
    const labelCounts = {};
    const labelIndices = {};

    phases.forEach(p => {
        const base = (p.phase_label || p.phase_key || 'Phase').replace(/#\d+$/, '').trim();
        labelCounts[base] = (labelCounts[base] || 0) + 1;
    });

    return phases.map(p => {
        const base = (p.phase_label || p.phase_key || 'Phase').replace(/#\d+$/, '').trim();
        if (labelCounts[base] > 1) {
            labelIndices[base] = (labelIndices[base] || 0) + 1;
            return `${base} #${labelIndices[base]}`;
        }
        return base;
    });
}


function generatePhasesPage() {
    const phases = Array.isArray(projectData.phases) ? projectData.phases : [];

    if (phases.length === 0) {
        return `
            <h1 class="ps-section-title">6. Phases / Timeline</h1>
            <div style="color: #666; font-style: italic; padding: 20px; font-size: 12px;">No phases defined for this project.</div>
        `;
    }

    // Phase colors
    function getPhaseColor(phaseKey) {
        const key = (phaseKey || '').toLowerCase().replace(/\s+/g, '').replace(/#\d+/g, '');
        const colorMap = {
            'timber': '#547d56',
            'timberproduction': '#547d56',
            'spray': '#e99f62',
            'spraying': '#e99f62',
            'glazing': '#485d68',
            'dispatch': '#02802a',
            'dispatchinstallation': '#02802a',
            'sitesurvey': '#5e4e81',
            'md': '#5a2cdb',
            'manufacturingdrawings': '#5a2cdb',
            'order': '#af72ba',
            'ordermaterials': '#af72ba',
            'orderglazing': '#79a4cf',
            'orderspray': '#eb86d8',
            'orderspraymaterials': '#eb86d8',
            'qc': '#63a3ab',
            'qcpacking': '#63a3ab'
        };
        return colorMap[key] || '#64748b';
    }

    const numberedLabels = getNumberedLabels(phases);

    // Only phases with valid dates for gantt - SORTED BY START DATE
    const phasesWithDates = phases.filter(p => {
        const s = toUtcDay(p.start_date);
        const e = toUtcDay(p.end_date);
        return Number.isFinite(s) && Number.isFinite(e) && e >= s;
    }).sort((a, b) => toUtcDay(a.start_date) - toUtcDay(b.start_date));

    if (phasesWithDates.length === 0) {
        return `
            <h1 class="ps-section-title">6. Phases / Timeline</h1>
            <div style="color: #666; font-style: italic; padding: 20px; font-size: 12px;">No valid phase dates defined.</div>
        `;
    }

    const minDay = Math.min(...phasesWithDates.map(p => toUtcDay(p.start_date)));
    const maxDay = Math.max(...phasesWithDates.map(p => toUtcDay(p.end_date)));
    const totalDays = (maxDay - minDay) + 1;

    const barH = 28;
    const gap = 4;
    const barsH = phasesWithDates.length * (barH + gap) + 8;

    // Date axis
    const dateAxisCells = [];
    for (let i = 0; i < totalDays; i++) {
        const date = utcDayToDate(minDay + i);
        const dayNum = date.getUTCDate();
        const monthShort = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
        const isSunday = date.getUTCDay() === 0;
        const isFirst = i === 0 || dayNum === 1;
        const widthPercent = 100 / totalDays;

        dateAxisCells.push(`
            <div style="
                width: ${widthPercent}%;
                flex-shrink: 0;
                text-align: center;
                border-right: 1px solid ${isSunday ? '#ef4444' : '#ddd'};
                padding: 2px 0;
                background: ${isSunday ? '#fef2f2' : '#fff'};
                font-size: 11px;
                box-sizing: border-box;
            ">
                <div style="font-weight: ${isSunday ? 'bold' : 'normal'}; color: ${isSunday ? '#ef4444' : '#333'};">${dayNum}</div>
                ${isFirst ? `<div style="font-size: 9px; color: #666;">${monthShort}</div>` : ''}
            </div>
        `);
    }

    // Gantt bars - WIDTH based on work_days (like main Gantt uses computeEnd)
    let barIndex = 0;
    const ganttBars = phasesWithDates.map(p => {
        const startDay = toUtcDay(p.start_date);
        const workDays = getWorkDays(p) ?? workingDaysBetweenUtc(p.start_date, p.end_date);
        
        // Width = work_days (same as main Gantt which uses computeEnd)
        const startOffset = startDay - minDay;

        const color = getPhaseColor(p.phase_key || p.phase_label);
        const origIdx = phases.indexOf(p);
        const label = numberedLabels[origIdx] || (p.phase_label || p.phase_key || 'Phase');
        const assigned = getAssignedName(p);

        const top = 4 + barIndex * (barH + gap);
        barIndex++;

        const leftPercent = (startOffset / totalDays) * 100;
        const widthPercent = (workDays / totalDays) * 100;

        return `
            <div style="
                position: absolute;
                top: ${top}px;
                left: ${leftPercent}%;
                width: ${widthPercent}%;
                min-width: 30px;
                height: ${barH}px;
                background: ${color};
                border-radius: 4px;
                color: #fff;
                font-size: 11px;
                padding: 2px 6px;
                box-sizing: border-box;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                display: flex;
                flex-direction: column;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.2);
            ">
                <div style="font-weight: 600; font-size: 11px; overflow: hidden; text-overflow: ellipsis;">${label}</div>
                <div style="font-size: 10px; opacity: 0.9;">(${workDays}d) ${assigned}</div>
            </div>
        `;
    }).join('');

    // Table bar scaling: use workDays
    const maxDays = Math.max(
        1,
        ...phases.map(ph => getWorkDays(ph) ?? workingDaysBetweenUtc(ph.start_date, ph.end_date) ?? 1)
    );

    // Table rows (all phases)
    const rows = phases.map((p, idx) => {
        const color = getPhaseColor(p.phase_key || p.phase_label || '');
        const workDays = getWorkDays(p) ?? workingDaysBetweenUtc(p.start_date, p.end_date);
        const daysDisplay = workDays > 0 ? `${workDays}` : '-';

        const barWidthPercent = workDays > 0 ? Math.max(10, (workDays / maxDays) * 100) : 0;

        const assigned = getAssignedName(p);
        const label = numberedLabels[idx];

        return `
            <tr>
                <td style="border: 1px solid #ccc; padding: 6px; font-weight: 600; width: 90px; max-width: 90px; vertical-align: middle; font-size: 12px; white-space: normal; word-break: break-word;">
                    ${label}
                </td>

                <td style="border: 1px solid #ccc; padding: 8px; width: 180px; vertical-align: middle;">
                    <div style="
                        background: ${color};
                        color: #fff;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 500;
                        height: 22px;
                        line-height: 14px;
                        overflow: hidden;
                        white-space: nowrap;
                        text-overflow: ellipsis;
                        margin-bottom: 6px;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                        width: ${barWidthPercent}%;
                        min-width: 60px;
                    ">
                        ${daysDisplay}d • ${assigned}
                    </div>
                    <div style="
                        background: #e5e5e5;
                        border: 1px dashed #999;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        color: #666;
                        height: 22px;
                        line-height: 14px;
                        width: ${barWidthPercent}%;
                        min-width: 60px;
                    ">
                        Actual: ___d
                    </div>
                </td>

                <td style="border: 1px solid #ccc; padding: 6px; width: 120px; font-size: 12px; vertical-align: middle;">
                    <div><strong>Start:</strong> ${formatDateSafe(p.start_date)}</div>
                    <div><strong>End:</strong> ${formatDateSafe(p.end_date)}</div>
                    <div><strong>Days:</strong> ${daysDisplay}</div>
                </td>

                <td style="border: 1px solid #ccc; padding: 6px; width: 130px; font-size: 12px; vertical-align: middle; background: #fafafa;">
                    <div style="margin-bottom: 2px;">Start: __/__/____</div>
                    <div style="margin-bottom: 2px;">End: __/__/____</div>
                    <div>Days: ____</div>
                </td>

                <td style="border: 1px solid #ccc; padding: 6px; width: 80px; text-align: center; vertical-align: middle;">
                    <div style="display: flex; justify-content: center; gap: 8px;">
                        <div style="text-align: center;">
                            <div style="font-size: 12px; font-weight: 600; color: #22c55e;">−</div>
                            <div style="width: 26px; height: 18px; border: 1.5px solid #333; background: #fff;"></div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 12px; font-weight: 600; color: #ef4444;">+</div>
                            <div style="width: 26px; height: 18px; border: 1.5px solid #333; background: #fff;"></div>
                        </div>
                    </div>
                </td>

                <td style="border: 1px solid #ccc; padding: 6px; width: 100px; vertical-align: middle; background: #fafafa; font-size: 12px;">
                    <div style="margin-bottom: 4px; font-size: 11px;">Who: _________</div>
                    <div style="border-bottom: 1px solid #333; height: 18px;"></div>
                    <div style="font-size: 10px; color: #666; margin-top: 2px;">Sign</div>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <h1 class="ps-section-title">6. Phases / Timeline</h1>

        <div style="margin-bottom: 20px; border: 1px solid #ccc; border-radius: 6px; overflow: hidden;">
            <div style="background: #2d3748; color: #fff; padding: 8px 12px; font-size: 12px; font-weight: 600;">
                📊 Project Timeline (Gantt View)
            </div>

            <div style="display: flex; border-bottom: 1px solid #ccc; background: #f9f9f9; width: 100%;">
                ${dateAxisCells.join('')}
            </div>

            <div style="position: relative; height: ${barsH}px; background: #fafafa; width: 100%;">
                ${ganttBars}
            </div>
        </div>

        <div style="margin-bottom: 12px;">
            <div style="display: flex; gap: 20px; font-size: 11px; color: #666; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <div style="width: 14px; height: 14px; background: #547d56; border-radius: 3px;"></div>
                    <span>Planned</span>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <div style="width: 14px; height: 14px; background: #e5e5e5; border: 1px dashed #999; border-radius: 3px;"></div>
                    <span>Actual (fill)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="color: #22c55e; font-weight: bold;">−</span>
                    <span>Ahead</span>
                    <span style="color: #ef4444; font-weight: bold; margin-left: 5px;">+</span>
                    <span>Behind schedule</span>
                </div>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
                <tr style="background: #2d3748; color: white;">
                    <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Phase</th>
                    <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Timeline</th>
                    <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Planned</th>
                    <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Actual</th>
                    <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Δ Days</th>
                    <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Who / Sign</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>

        <div style="margin-top: 15px; padding: 12px; background: #f0f9ff; border-left: 4px solid #3b82f6; font-size: 11px;">
            <strong>📝 Instructions:</strong> Fill Actual dates after each phase. Write days difference in − (ahead) or + (behind) box. Sign off each phase.
        </div>
    `;
}


// ========== PAGE: DISPATCH CHECK LIST (MULTI-PAGE) ==========
function generateDispatchPages() {
    const pages = [];
    const ITEMS_PER_PAGE = 20; // Max items per column per page
    
    // If no dispatch items configured, use all project items
    let items = dispatchItems.length > 0 ? dispatchItems.filter(i => i.selected) : [];
    
    // If still empty, fall back to building from project data
    if (items.length === 0) {
        const projectPrefix = (projectData.project?.project_number || '').split('/')[0] || '';
        
        // Elements
        (projectData.elements || []).forEach((el, idx) => {
            const elId = el.element_id || `EL${idx + 1}`;
            const fullId = projectPrefix ? `${projectPrefix}-${elId}` : elId;
            items.push({
                item_type: 'element',
                name: `${fullId} ${el.element_name || el.name || el.element_type || 'Element'}`,
                quantity: el.qty || 1,
                notes: ''
            });
        });
        
        // Spray items
        (projectData.sprayItems || []).forEach((item, idx) => {
            items.push({
                item_type: 'spray',
                name: item.name || `Spray Item ${idx + 1}`,
                quantity: 1,
                notes: item.colour || ''
            });
        });
    }
    
    // Group by type
    const elements = items.filter(i => i.item_type === 'element');
    const sprayItems = items.filter(i => i.item_type === 'spray');
    const materials = items.filter(i => i.item_type === 'material');
    const customItems = items.filter(i => i.item_type === 'custom');
    
    // Helper to render table
    const renderTable = (title, icon, color, tableItems, continued = false) => {
        if (tableItems.length === 0) return '';
        return `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #333; margin-bottom: 10px; font-size: 13px; border-bottom: 2px solid ${color}; padding-bottom: 5px;">${icon} ${title} (${tableItems.length})${continued ? ' - continued' : ''}</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead><tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 30px;">✓</th>
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Item</th>
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 60px;">Qty</th>
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Notes</th>
                    </tr></thead>
                    <tbody>${tableItems.map(item => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 5px; text-align: center;"><div style="width: 14px; height: 14px; border: 2px solid #333; margin: 0 auto;"></div></td>
                            <td style="border: 1px solid #ddd; padding: 5px;">${item.name || '-'}</td>
                            <td style="border: 1px solid #ddd; padding: 5px; text-align: center;">${item.quantity || 1}</td>
                            <td style="border: 1px solid #ddd; padding: 5px; font-size: 10px; color: #666;">${item.notes || '-'}</td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            </div>
        `;
    };
    
    // Sign-off box (only on last page)
    const signOffHtml = `
        <div style="margin-top: 30px; padding: 15px; border: 2px solid #333; background: #fafafa;">
            <h4 style="margin: 0 0 15px 0; font-size: 12px;">Dispatch Sign-off</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div><div style="font-size: 11px; color: #666; margin-bottom: 5px;">Packed by:</div><div style="border-bottom: 1px solid #333; height: 25px;"></div></div>
                <div><div style="font-size: 11px; color: #666; margin-bottom: 5px;">Date:</div><div style="border-bottom: 1px solid #333; height: 25px;"></div></div>
                <div><div style="font-size: 11px; color: #666; margin-bottom: 5px;">Checked by:</div><div style="border-bottom: 1px solid #333; height: 25px;"></div></div>
                <div><div style="font-size: 11px; color: #666; margin-bottom: 5px;">Vehicle Reg:</div><div style="border-bottom: 1px solid #333; height: 25px;"></div></div>
            </div>
            <div style="margin-top: 15px;"><div style="font-size: 11px; color: #666; margin-bottom: 5px;">Notes / Missing Items:</div><div style="border: 1px solid #333; min-height: 50px;"></div></div>
        </div>
    `;
    
    // Header (only on first page)
    const headerHtml = `
        <div style="margin-bottom: 15px; padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b;">
            <strong>📦 Pre-Dispatch Checklist</strong> - Tick off each item before loading for delivery.
        </div>
    `;
    
    // Build pages with pagination
    // Left column: Elements, Sprayed Items
    // Right column: Materials, Additional Items, Sign-off
    
    const leftGroups = [
        { title: 'Elements / Units', icon: '📦', color: '#3b82f6', items: elements, totalCount: elements.length },
        { title: 'Sprayed Items', icon: '🎨', color: '#e99f62', items: sprayItems, totalCount: sprayItems.length }
    ];
    
    const rightGroups = [
        { title: 'Materials & Hardware', icon: '🔩', color: '#22c55e', items: materials, totalCount: materials.length },
        { title: 'Additional Items', icon: '➕', color: '#8b5cf6', items: customItems, totalCount: customItems.length }
    ];
    
    // Track positions for each group
    let leftPositions = leftGroups.map(() => 0);
    let rightPositions = rightGroups.map(() => 0);
    
    const hasMoreLeft = () => leftGroups.some((g, i) => leftPositions[i] < g.items.length);
    const hasMoreRight = () => rightGroups.some((g, i) => rightPositions[i] < g.items.length);
    
    let pageNum = 0;
    
    while (hasMoreLeft() || hasMoreRight()) {
        pageNum++;
        let leftHtml = '';
        let rightHtml = '';
        let leftCount = 0;
        let rightCount = 0;
        
        // Render left column groups
        for (let i = 0; i < leftGroups.length; i++) {
            const group = leftGroups[i];
            const startPos = leftPositions[i];
            if (startPos >= group.items.length) continue;
            
            const remainingSpace = ITEMS_PER_PAGE - leftCount;
            if (remainingSpace <= 0) break;
            
            const itemsToRender = group.items.slice(startPos, startPos + remainingSpace);
            const continued = startPos > 0;
            
            leftHtml += renderTable(group.title, group.icon, group.color, itemsToRender, continued);
            leftPositions[i] += itemsToRender.length;
            leftCount += itemsToRender.length + 2; // +2 for header
        }
        
        // Render right column groups
        for (let i = 0; i < rightGroups.length; i++) {
            const group = rightGroups[i];
            const startPos = rightPositions[i];
            if (startPos >= group.items.length) continue;
            
            const remainingSpace = ITEMS_PER_PAGE - rightCount;
            if (remainingSpace <= 0) break;
            
            const itemsToRender = group.items.slice(startPos, startPos + remainingSpace);
            const continued = startPos > 0;
            
            rightHtml += renderTable(group.title, group.icon, group.color, itemsToRender, continued);
            rightPositions[i] += itemsToRender.length;
            rightCount += itemsToRender.length + 2; // +2 for header
        }
        
        // Check if this is the last page
        const isLastPage = !hasMoreLeft() && !hasMoreRight();
        
        // Add sign-off to right column on last page
        if (isLastPage) {
            rightHtml += signOffHtml;
        }
        
        let pageHtml = `<h1 class="ps-section-title">8. Dispatch List${pageNum > 1 ? ` (${pageNum})` : ''}</h1>`;
        if (pageNum === 1) pageHtml += headerHtml;
        
        pageHtml += `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <div>${leftHtml}</div>
                <div>${rightHtml}</div>
            </div>
        `;
        
        pages.push(pageHtml);
    }
    
    // If no items at all, return single empty page
    if (pages.length === 0) {
        pages.push(`
            <h1 class="ps-section-title">8. Dispatch List</h1>
            ${headerHtml}
            <div style="color: #666; font-style: italic; padding: 15px; background: #f5f5f5;">No dispatch items defined.</div>
            ${signOffHtml}
        `);
    }
    
    return pages;
}


// ========== PAGE: QC & SIGN-OFF ==========
function generateQCPage() {
    return `
        <h1 class="ps-section-title">10. QC Checklist & Sign-off</h1>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                <h3 style="color: #333; margin-bottom: 15px;">Quality Checks</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    ${['Dimensions verified', 'Glass spec correct', 'No damage', 'Finish quality OK', 'Hardware complete', 'Packaging ready'].map(item => `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0;">
                            <div style="width: 20px; height: 20px; border: 2px solid #333; flex-shrink: 0;"></div>
                            <span>${item}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-top: 30px;">
                    <h3 style="color: #333; margin-bottom: 15px;">Additional Notes</h3>
                    <div style="border: 1px solid #ddd; min-height: 80px; padding: 10px;"></div>
                </div>
            </div>
            
            <div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="border: 2px solid #333; padding: 20px;">
                        <h4 style="margin: 0 0 20px 0; color: #333;">Production Sign-off</h4>
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Name:</div>
                            <div style="border-bottom: 1px solid #333; height: 25px;"></div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Date:</div>
                            <div style="border-bottom: 1px solid #333; height: 25px;"></div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Signature:</div>
                            <div style="border-bottom: 1px solid #333; height: 40px;"></div>
                        </div>
                    </div>
                    
                    <div style="border: 2px solid #333; padding: 20px;">
                        <h4 style="margin: 0 0 20px 0; color: #333;">QC Sign-off</h4>
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Name:</div>
                            <div style="border-bottom: 1px solid #333; height: 25px;"></div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Date:</div>
                            <div style="border-bottom: 1px solid #333; height: 25px;"></div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Signature:</div>
                            <div style="border-bottom: 1px solid #333; height: 40px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}


function generateCoverPage() {
    const project = projectData.project;
    const client = projectData.client;
    const isIncomplete = !checklistItems.filter(i => i.required).every(i => checklistStatus[i.key]?.done);
    
    let html = `
        <div style="text-align: center; padding: 40px 0; border-bottom: 3px solid #333; margin-bottom: 30px; position: relative;">
            ${isIncomplete ? '<div style="position: absolute; top: 0; left: 0; right: 0; background: #ef4444; color: white; padding: 5px; font-weight: bold;">⚠️ INCOMPLETE</div>' : ''}
            
            <h1 style="font-size: 28px; margin: 0 0 10px 0; color: #333;">PRODUCTION SHEET</h1>
            <div style="font-size: 24px; font-weight: bold; color: #4a9eff; margin-bottom: 20px;">
                ${project?.project_number || 'N/A'}
            </div>
            <div style="font-size: 18px; color: #666; margin-bottom: 30px;">
                ${project?.name || 'Untitled Project'}
            </div>
            
            <div style="display: inline-block; text-align: left; background: #f5f5f5; padding: 20px 30px; border-radius: 8px;">
                <div style="margin-bottom: 8px;"><strong>Client:</strong> ${client?.company_name || 'N/A'}</div>
                <div style="margin-bottom: 8px;"><strong>Type:</strong> ${project?.type || 'N/A'}</div>
                <div style="margin-bottom: 8px;"><strong>Deadline:</strong> ${project?.deadline ? new Date(project.deadline).toLocaleDateString('en-GB') : 'N/A'}</div>
                <div><strong>Version:</strong> PS v${currentSheet?.version || 1}</div>
            </div>
            
            <div style="margin-top: 30px; font-size: 10px; color: #999;">
                Generated: ${new Date().toLocaleString('en-GB')}<br>
                Joinery Core by Skylon Development LTD
            </div>
        </div>
    `;
    
    return html;
}


function generateTOC() {
    const hasSprayPhase = projectData.phases.some(p => 
        (p.phase_key && p.phase_key.toLowerCase().includes('spray')) ||
        (p.phase_name && p.phase_name.toLowerCase().includes('spray'))
    );
    
    const hasPhotos = projectData.attachments.some(a => a.attachment_type === 'PHOTOS') ||
                     projectData.files.some(f => f.folder_name?.toLowerCase().startsWith('photos'));
    
    // Budujemy TOC zgodnie z kolejnością sekcji
    const sections = [
        'Scope & Notes',
        'Elements List',
        'Cut List',
        'Materials',
        'Drawings'
    ];
    
    if (hasPhotos) {
        sections.push('Reference Photos');
    }
    
    if (hasSprayPhase) {
        sections.push('Spray / Finish Pack');
    }
    
    sections.push('Phases / Timeline');
    sections.push('QC Checklist & Sign-off');
    
    return `
        <div style="margin-bottom: 30px; page-break-after: always;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">Contents</h2>
            <div style="padding-left: 20px; line-height: 2;">
                ${sections.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('')}
            </div>
        </div>
    `;
}


function generateScopeSection() {
    const project = projectData.project;
    const notesRaw = project?.notes || '';
    const sectionNum = ++pdfSectionNumber;
    
    // Extract important notes (parse JSON)
    const allNotes = parseProjectNotesPS(notesRaw);
    const importantNotes = allNotes.filter(n => n.important === true);
    
    const importantNotesHtml = importantNotes.length > 0 
        ? importantNotes.map((note, idx) => {
            const isEdited = editedNotes[idx] !== undefined;
            const displayText = isEdited ? editedNotes[idx] : (note.text || '');
            return `<div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e0c36a;">
                <div style="font-size: 11px; color: #856404; margin-bottom: 4px;">⚠️ ${note.author || 'Unknown'} • ${note.date || ''} ${isEdited ? '<span style="color: #22c55e;">(edited for PS)</span>' : ''}</div>
                <div style="white-space: pre-wrap;">${displayText}</div>
            </div>`;
        }).join('')
        : '';
    
    return `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Scope & Notes</h2>
            
            <div style="margin-bottom: 15px;">
                <strong>Project Type:</strong> ${project?.type || 'N/A'}
            </div>
            
            ${getTextFromHtml(scopeDescription).trim() ? `
                <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin-bottom: 15px;">
                    <strong style="color: #1565c0;">📋 Production Description:</strong>
                    <div style="margin-top: 10px; line-height: 1.6;">${scopeDescription}</div>
                </div>
            ` : ''}
            
            ${importantNotesHtml ? `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px;">
                    <strong style="color: #856404;">⚠️ Important Notes (from project preparation):</strong>
                    <div style="margin-top: 10px;">${importantNotesHtml}</div>
                </div>
            ` : '<div style="color: #666;">No important notes flagged.</div>'}
        </div>
    `;
}


function generateBOMSection() {
    const elements = projectData.elements;
    const sectionNum = ++pdfSectionNumber;
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Elements List</h2>
    `;
    
    if (elements.length === 0) {
        html += `<div style="color: #666; font-style: italic;">No elements defined. Add elements in the project settings.</div>`;
    } else {
        html += `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">ID</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Name</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Dimensions</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Finish</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">✓</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        elements.forEach(el => {
            const dims = el.width && el.height 
                ? `${el.width}x${el.height}${el.thickness ? 'x'+el.thickness : ''} ${el.dimensions_unit || 'mm'}`
                : '-';
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${getFullId(el)}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.qty}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${dims}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.finish_name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    }
    
    html += `</div>`;
    return html;
}


function generateCutListSection() {
    const elements = projectData.elements;
    const sectionNum = ++pdfSectionNumber;
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Cut List</h2>
    `;
    
    // Jeśli mamy elementy z wymiarami - generujemy cut list
    const elementsWithDims = elements.filter(el => el.width && el.height);
    
    if (elementsWithDims.length > 0) {
        html += `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Element</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Width (mm)</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Height (mm)</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Thickness</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Cut ✓</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        elementsWithDims.forEach(el => {
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.element_id ? ((projectData.project?.project_number || '').split('/')[0] || '') + '-' + el.element_id : ''} ${el.name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.qty}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${el.width}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${el.height}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.thickness || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    } else {
        // Placeholder - puste linie do ręcznego dopisania
        html += `
            <div style="color: #666; font-style: italic; margin-bottom: 15px;">
                Cut list not available. Add dimensions to elements or fill in manually below:
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Element</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Width</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Height</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">✓</th>
                    </tr>
                </thead>
                <tbody>
                    ${[1,2,3,4,5].map(() => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 12px; background: #ffffcc;"></td>
                            <td style="border: 1px solid #ddd; padding: 12px; background: #ffffcc;"></td>
                            <td style="border: 1px solid #ddd; padding: 12px; background: #ffffcc;"></td>
                            <td style="border: 1px solid #ddd; padding: 12px; background: #ffffcc;"></td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                <div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    html += `</div>`;
    return html;
}


function generateSprayPackSection() {
    // Sprawdź czy projekt ma fazę spray (check both phase_key and phase_name)
    const hasSprayPhase = projectData.phases.some(p => 
        (p.phase_key && p.phase_key.toLowerCase().includes('spray')) ||
        (p.phase_name && p.phase_name.toLowerCase().includes('spray'))
    );
    
    if (!hasSprayPhase) {
        return ''; // Nie pokazuj sekcji jeśli brak fazy spray
    }
    
    const sectionNum = ++pdfSectionNumber;
    const sprayMaterials = projectData.materials.filter(m => m.used_in_stage === 'Spraying');
    
    // Zbierz kolory z elementów
    const colours = [...new Set(projectData.elements
        .filter(el => el.finish_name)
        .map(el => el.finish_name))];
    
    let html = `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h2 style="color: #333; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px;">${sectionNum}. 🎨 Spray / Finish Pack</h2>
            
            <!-- DISCLAIMER -->
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <strong style="color: #856404;">⚠️ Important:</strong>
                <span style="color: #856404; font-size: 12px; margin-left: 8px;">
                    Please review ALL project documentation. If any information is unclear, contact Production Manager before proceeding.
                </span>
            </div>
            
            ${sprayDescription.trim() ? `
                <div style="background: #e8f5e9; border-left: 4px solid #22c55e; padding: 15px; margin-bottom: 20px;">
                    <strong style="color: #1b5e20;">📋 Spray Instructions:</strong>
                    <div style="white-space: pre-wrap; margin-top: 10px; color: #333;">${sprayDescription}</div>
                </div>
            ` : ''}
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <!-- Colour Codes -->
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Colour Codes (from BOM)</h3>
                    ${colours.length > 0 ? `
                        <ul style="margin: 0; padding-left: 20px;">
                            ${colours.map(c => `<li style="margin-bottom: 5px;"><strong>${c}</strong></li>`).join('')}
                        </ul>
                    ` : `<div style="color: #666; font-style: italic;">No colours specified in elements</div>`}
                </div>
                
                <!-- Manual Notes Area -->
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Additional Notes</h3>
                    <div style="background: #ffffcc; padding: 10px; border-radius: 4px; min-height: 60px;">
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                    </div>
                </div>
            </div>
            
            ${sprayMaterials.length > 0 ? `
                <h3 style="font-size: 14px; color: #333; margin-bottom: 10px;">Spray Materials</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Material</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Needed</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Used</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">✓</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sprayMaterials.map(m => {
                            const itemName = m.stock_items?.name || m.item_name || 'Unknown';
                            const unit = m.unit || m.stock_items?.unit || '';
                            return `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px;">${itemName}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${m.quantity_needed} ${unit}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #ffffcc;">
                                    <div style="border-bottom: 1px solid #999; width: 40px; height: 16px; margin: 0 auto;"></div>
                                </td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                    <div style="width: 14px; height: 14px; border: 2px solid #333; margin: 0 auto;"></div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            ` : ''}
        </div>
    `;
    
    return html;
}


function generateMaterialsSection() {
    const materials = projectData.materials;
    const sectionNum = ++pdfSectionNumber;
    
    const byStage = {
        'Production': materials.filter(m => m.used_in_stage === 'Production'),
        'Spraying': materials.filter(m => m.used_in_stage === 'Spraying'),
        'Installation': materials.filter(m => m.used_in_stage === 'Installation')
    };
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Materials</h2>
    `;
    
    Object.entries(byStage).forEach(([stage, mats]) => {
        if (mats.length === 0) return;
        
        html += `
            <h3 style="color: #666; margin: 20px 0 10px 0;">${stage}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Needed</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Reserved</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Used</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">✓</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        mats.forEach(m => {
            // Helper: nazwa materiału z różnych źródeł
            const itemName = m.stock_items?.name || m.item_name || 'Unknown';
            const unit = m.unit || m.stock_items?.unit || '';
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${itemName}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${m.quantity_needed} ${unit}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${m.quantity_reserved || 0}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #ffffcc;">
                        <div style="border-bottom: 1px solid #999; width: 40px; height: 16px; margin: 0 auto;"></div>
                    </td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <div style="width: 14px; height: 14px; border: 2px solid #333; margin: 0 auto;"></div>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    });
    
    if (materials.length === 0) {
        html += `<div style="color: #666; font-style: italic;">No materials assigned.</div>`;
    }
    
    html += `</div>`;
    return html;
}


async function generateDrawingsSection() {
    const sectionNum = ++pdfSectionNumber;
    
    // Find drawings attachment
    const drawingsAttachment = projectData.attachments.find(a => a.attachment_type === 'DRAWINGS_MAIN');
    const drawingsFromFiles = projectData.files.filter(f => f.folder_name?.toLowerCase().startsWith('drawings'));
    
    let html = `
        <div style="margin-bottom: 30px; page-break-before: always;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Drawings</h2>
    `;
    
    // Get file to embed
    let fileToEmbed = null;
    if (drawingsAttachment) {
        fileToEmbed = {
            url: drawingsAttachment.file_url,
            name: drawingsAttachment.file_name || 'drawing'
        };
    } else if (drawingsFromFiles.length > 0) {
        // Get public URL for first drawing file
        const firstFile = drawingsFromFiles[0];
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(firstFile.file_path);
        fileToEmbed = {
            url: urlData.publicUrl,
            name: firstFile.file_name
        };
    }
    
    if (fileToEmbed) {
        const fileName = fileToEmbed.name.toLowerCase();
        const isPdf = fileName.endsWith('.pdf');
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        html += `<div style="text-align: center; margin: 15px 0;">
            <div style="font-size: 11px; color: #666; margin-bottom: 10px;">📄 ${fileToEmbed.name}</div>`;
        
        if (isImage) {
            // Embed image directly
            html += `<img src="${fileToEmbed.url}" style="max-width: 100%; max-height: 800px; border: 1px solid #ddd;" crossorigin="anonymous" />`;
        } else if (isPdf) {
            // Render PDF pages as images
            try {
                const images = await renderPdfToImages(fileToEmbed.url);
                if (images.length > 0) {
                    html += images.map((imgData, i) => `
                        <div style="margin-bottom: 20px; ${i > 0 ? 'page-break-before: always;' : ''}">
                            <div style="font-size: 10px; color: #999; margin-bottom: 5px;">Page ${i + 1} of ${images.length}</div>
                            <img src="${imgData}" style="max-width: 100%; border: 1px solid #ddd;" />
                        </div>
                    `).join('');
                } else {
                    html += `<div style="color: #f59e0b;">⚠️ Could not render PDF. <a href="${fileToEmbed.url}" target="_blank">Open PDF</a></div>`;
                }
            } catch (err) {
                console.error('PDF render error:', err);
                html += `<div style="color: #f59e0b;">⚠️ Could not render PDF. <a href="${fileToEmbed.url}" target="_blank">Open PDF</a></div>`;
            }
        } else {
            // Unknown format - show link
            html += `<a href="${fileToEmbed.url}" target="_blank" style="color: #1976d2;">Download ${fileToEmbed.name}</a>`;
        }
        
        html += `</div>`;
        
        // Show additional files if more than one
        if (drawingsFromFiles.length > 1) {
            html += `
                <div style="background: #f5f5f5; padding: 10px; margin-top: 15px; font-size: 11px;">
                    <strong>Additional drawings in project:</strong>
                    <ul style="margin: 5px 0 0 20px;">
                        ${drawingsFromFiles.slice(1).map(f => `<li>${f.file_name}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    } else {
        html += `<div style="color: #ef4444; font-style: italic;">⚠️ No drawings attached - required!</div>`;
    }
    
    html += `</div>`;
    return html;
}


// Render PDF to array of base64 images
// Scale 4 = good quality for A3 print (~200 DPI)
async function renderPdfToImages(url, scale = 4) {
    const images = [];
    
    try {
        // Load PDF
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        
        // Render each page
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Render page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Convert to base64 image
            images.push(canvas.toDataURL('image/jpeg', 0.95));
        }
    } catch (err) {
        console.error('Error rendering PDF:', err);
    }
    
    return images;
}


async function generatePhotosSection() {
    const sectionNum = ++pdfSectionNumber;
    
    // Find photos attachment
    const photosAttachment = projectData.attachments.find(a => a.attachment_type === 'PHOTOS');
    const photosFromFiles = projectData.files.filter(f => f.folder_name?.toLowerCase().startsWith('photos'));
    
    // Photos are optional - if none, don't show section
    if (!photosAttachment && photosFromFiles.length === 0) {
        return ''; // No photos section if nothing uploaded
    }
    
    let html = `
        <div style="margin-bottom: 30px; page-break-before: always;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Reference Photos</h2>
    `;
    
    // Collect all photos to embed
    let photosToEmbed = [];
    
    if (photosAttachment) {
        photosToEmbed.push({
            url: photosAttachment.file_url,
            name: photosAttachment.file_name || 'photo'
        });
    }
    
    // Add photos from project files
    for (const file of photosFromFiles) {
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(file.file_path);
        photosToEmbed.push({
            url: urlData.publicUrl,
            name: file.file_name
        });
    }
    
    // Embed each photo
    for (const photo of photosToEmbed) {
        const fileName = photo.name.toLowerCase();
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        html += `<div style="margin-bottom: 20px; text-align: center;">
            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">📷 ${photo.name}</div>`;
        
        if (isImage) {
            html += `<img src="${photo.url}" style="max-width: 100%; max-height: 600px; border: 1px solid #ddd;" crossorigin="anonymous" />`;
        } else {
            html += `<a href="${photo.url}" target="_blank" style="color: #1976d2;">View ${photo.name}</a>`;
        }
        
        html += `</div>`;
    }
    
    html += `</div>`;
    return html;
}


function generateRoutingSection() {
    const phases = projectData.phases;
    const sectionNum = ++pdfSectionNumber;
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Phases / Timeline</h2>
    `;
    
    if (phases.length === 0) {
        html += `<div style="color: #666; font-style: italic;">No phases defined.</div>`;
    } else {
        html += `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Phase</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Start</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">End</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Assigned To</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        phases.forEach(p => {
            const statusColor = p.status === 'completed' ? '#22c55e' : 
                               p.status === 'inProgress' || p.status === 'in_progress' ? '#f59e0b' : '#666';
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${p.phase_label}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        ${formatDateSafe(p.start_date)}
                    </td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        ${formatDateSafe(p.end_date)}
                    </td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${p.assigned_name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <span style="color: ${statusColor}; font-weight: bold;">${p.status || 'notStarted'}</span>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    }
    
    html += `</div>`;
    return html;
}


function generateQCSection() {
    const sectionNum = ++pdfSectionNumber;
    
    return `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. QC Checklist & Sign-off</h2>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #666; font-size: 14px; margin-bottom: 10px;">Quality Checks</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    ${['Dimensions verified', 'Finish quality OK', 'Glass spec correct', 'Hardware complete', 'No damage', 'Packaging ready'].map(check => `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 16px; height: 16px; border: 2px solid #333;"></div>
                            <span>${check}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px;">
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <strong>Production Sign-off</strong>
                    <div style="margin-top: 15px;">
                        <div style="margin-bottom: 10px;">Name: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                        <div style="margin-bottom: 10px;">Date: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                        <div>Signature: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                    </div>
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <strong>QC Sign-off</strong>
                    <div style="margin-top: 15px;">
                        <div style="margin-bottom: 10px;">Name: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                        <div style="margin-bottom: 10px;">Date: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                        <div>Signature: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}



// ========== PDF GENERATION ==========

// Cache for base64 images - prevents re-downloading
const imageBase64Cache = new Map();

// Fetch image and convert to base64 WITHOUT touching DOM
async function getImageAsBase64(url) {
    // Return from cache if available
    if (imageBase64Cache.has(url)) {
        return imageBase64Cache.get(url);
    }
    
    // Skip if already base64
    if (url.startsWith('data:')) {
        return url;
    }
    
    try {
        // Fetch image as blob
        const response = await fetch(url, { 
            credentials: 'include',
            cache: 'force-cache'
        });
        
        if (!response.ok) {
            console.warn(`Failed to fetch image: ${url}`);
            return url; // Return original URL as fallback
        }
        
        const blob = await response.blob();
        
        // Convert blob to base64
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        
        // Cache it
        imageBase64Cache.set(url, base64);
        return base64;
        
    } catch (err) {
        console.warn(`Error converting image to base64: ${url}`, err);
        return url; // Return original URL as fallback
    }
}


// Pre-cache all images in page (call before PDF generation)
async function precachePageImages(page) {
    const images = page.querySelectorAll('img');
    const promises = [];
    
    for (const img of images) {
        if (img.src && !img.src.startsWith('data:') && !imageBase64Cache.has(img.src)) {
            promises.push(getImageAsBase64(img.src));
        }
    }
    
    await Promise.all(promises);
}


// Clone page and replace image URLs with base64 (WITHOUT touching original DOM)
async function clonePageWithBase64Images(page) {
    // Clone the page
    const clone = page.cloneNode(true);
    
    // Replace all image sources with cached base64
    const images = clone.querySelectorAll('img');
    for (const img of images) {
        if (img.src && !img.src.startsWith('data:')) {
            const base64 = imageBase64Cache.get(img.src);
            if (base64) {
                img.src = base64;
            }
        }
    }
    
    return clone;
}


async function generatePDF(progressCallback) {
    const pages = document.querySelectorAll('.ps-page');
    
    if (pages.length === 0) {
        throw new Error('No pages to export');
    }
    
    const totalPages = pages.length;
    
    // Phase 1: Pre-cache ALL images first (parallel loading)
    if (progressCallback) progressCallback('Caching images...', 0, totalPages);
    
    const cachePromises = [];
    for (const page of pages) {
        cachePromises.push(precachePageImages(page));
    }
    await Promise.all(cachePromises);
    
    const { jsPDF } = window.jspdf;
    // A3 landscape: 420mm x 297mm
    const pdf = new jsPDF('l', 'mm', 'a3');
    const pdfWidth = 420;
    const pdfHeight = 297;
    
    // Phase 2: Render pages one by one
    for (let i = 0; i < pages.length; i++) {
        // Show progress
        if (progressCallback) progressCallback(`Rendering page ${i + 1}/${totalPages}...`, i + 1, totalPages);
        
        // Yield to main thread - prevents UI freeze
        await new Promise(r => setTimeout(r, 0));
        
        const page = pages[i];
        
        // Clone page with base64 images (original DOM untouched!)
        const clonedPage = await clonePageWithBase64Images(page);
        
        // Temporarily add clone to DOM for html2canvas (hidden)
        clonedPage.style.position = 'absolute';
        clonedPage.style.left = '-9999px';
        clonedPage.style.top = '0';
        clonedPage.style.transform = 'none';
        clonedPage.style.marginBottom = '0';
        document.body.appendChild(clonedPage);
        
        try {
            // Render cloned page (with base64 images)
            const canvas = await html2canvas(clonedPage, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false
            });
            
            // Validate canvas dimensions
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            if (!canvasWidth || !canvasHeight || canvasWidth <= 0 || canvasHeight <= 0) {
                console.warn(`Page ${i} has invalid canvas dimensions: ${canvasWidth}x${canvasHeight}, skipping`);
                continue;
            }
            
            // Add page (not for first page)
            if (i > 0) {
                pdf.addPage();
            }
            
            // Calculate dimensions to fit A3 while maintaining aspect ratio
            const canvasRatio = canvasWidth / canvasHeight;
            const pdfRatio = pdfWidth / pdfHeight;
            
            let imgWidth, imgHeight, offsetX = 0, offsetY = 0;
            
            if (canvasRatio > pdfRatio) {
                // Canvas is wider - fit to width
                imgWidth = pdfWidth;
                imgHeight = pdfWidth / canvasRatio;
                offsetY = (pdfHeight - imgHeight) / 2;
            } else {
                // Canvas is taller - fit to height
                imgHeight = pdfHeight;
                imgWidth = pdfHeight * canvasRatio;
                offsetX = (pdfWidth - imgWidth) / 2;
            }
            
            pdf.addImage(
                canvas.toDataURL('image/jpeg', 0.95), 
                'JPEG', 
                offsetX, 
                offsetY, 
                imgWidth, 
                imgHeight
            );
            
        } finally {
            // Always remove clone from DOM
            document.body.removeChild(clonedPage);
        }
    }
    
    return pdf;
}


async function downloadPDF() {
    const totalPages = document.querySelectorAll('.ps-page').length;
    
    // Show progress in toast
    const updateProgress = (message, current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        showToast(`${message} (${percent}%)`, 'info');
    };
    
    updateProgress('Starting PDF generation', 0, totalPages);
    showLoading();
    
    try {
        const pdf = await generatePDF(updateProgress);
        
        // Generate filename from project number
        const projectNumber = projectData.project?.project_number || 'PS';
        const cleanNumber = projectNumber.replace(/\//g, '-');
        const fileName = `Production-Sheet-${cleanNumber}.pdf`;
        
        // Download
        pdf.save(fileName);
        
        showToast('PDF downloaded!', 'success');
    } catch (err) {
        console.error('PDF generation error:', err);
        showToast('Error generating PDF: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

// ========== UTILITIES ==========
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}


// ========== DATA SHEETS MODAL ==========
let selectedDataSheets = [];

async function openDataSheetsModal() {
    document.getElementById('psDataSheetsModal').classList.add('active');
    
    const container = document.getElementById('dataSheetsContent');
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #888;">Loading materials with documents...</div>';
    
    try {
        // Get materials for this project with their stock_item_id
        const materialsWithDocs = [];
        
        for (const mat of projectData.materials) {
            if (!mat.stock_item_id) continue;
            
            // Get stock item with documents
            const { data: stockItem, error } = await supabaseClient
                .from('stock_items')
                .select('id, name, documents')
                .eq('id', mat.stock_item_id)
                .single();
            
            if (error || !stockItem) continue;
            
            const docs = stockItem.documents || [];
            if (docs.length > 0) {
                materialsWithDocs.push({
                    materialName: mat.item_name,
                    stockItemId: stockItem.id,
                    stockItemName: stockItem.name,
                    documents: docs
                });
            }
        }
        
        // Load already selected data sheets
        const existingDataSheets = projectData.attachments.filter(a => a.attachment_type === 'DATA_SHEET');
        selectedDataSheets = existingDataSheets.map(a => a.file_url);
        
        if (materialsWithDocs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #888;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📄</div>
                    <div style="margin-bottom: 10px;">No materials with documents found.</div>
                    <div style="font-size: 12px;">Upload data sheets and fitting instructions in Stock Management first.</div>
                </div>
            `;
            return;
        }
        
        // Render materials with their documents
        container.innerHTML = materialsWithDocs.map(item => `
            <div style="background: #2d2d30; border-radius: 6px; padding: 15px; margin-bottom: 12px;">
                <div style="font-weight: 600; color: #4a9eff; margin-bottom: 10px; font-size: 14px;">
                    🪵 ${item.materialName}
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${item.documents.map((doc, idx) => `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #3e3e42; border-radius: 4px; cursor: pointer; transition: background 0.2s;"
                               onmouseover="this.style.background='#4a4a4e'" onmouseout="this.style.background='#3e3e42'">
                            <input type="checkbox" 
                                   value="${doc.url}" 
                                   data-name="${doc.name}"
                                   data-type="${doc.type || 'Document'}"
                                   ${selectedDataSheets.includes(doc.url) ? 'checked' : ''}
                                   onchange="toggleDataSheet(this)"
                                   style="width: 18px; height: 18px; cursor: pointer;">
                            <div style="flex: 1;">
                                <div style="color: #e8e2d5; font-size: 13px;">${doc.name}</div>
                                <div style="color: #888; font-size: 11px;">${doc.type || 'Document'}</div>
                            </div>
                            <a href="${doc.url}" target="_blank" onclick="event.stopPropagation()" 
                               style="color: #4a9eff; font-size: 12px; text-decoration: none;">
                                Preview ↗
                            </a>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
    } catch (err) {
        console.error('Error loading data sheets:', err);
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444;">Error loading materials: ${err.message}</div>`;
    }
}


function closeDataSheetsModal() {
    document.getElementById('psDataSheetsModal').classList.remove('active');
}


function toggleDataSheet(checkbox) {
    const url = checkbox.value;
    if (checkbox.checked) {
        if (!selectedDataSheets.includes(url)) {
            selectedDataSheets.push(url);
        }
    } else {
        selectedDataSheets = selectedDataSheets.filter(u => u !== url);
    }
}


async function saveSelectedDataSheets() {
    showToast('Saving data sheets...', 'info');
    
    try {
        // Ensure we have a sheet
        if (!currentSheet?.id) {
            await createDraftSheet();
        }
        
        // Remove old DATA_SHEET attachments
        const oldDataSheets = projectData.attachments.filter(a => a.attachment_type === 'DATA_SHEET');
        for (const old of oldDataSheets) {
            await supabaseClient
                .from('production_sheet_attachments')
                .delete()
                .eq('id', old.id);
        }
        projectData.attachments = projectData.attachments.filter(a => a.attachment_type !== 'DATA_SHEET');
        
        // Add new selected data sheets
        const checkboxes = document.querySelectorAll('#dataSheetsContent input[type="checkbox"]:checked');
        
        for (const cb of checkboxes) {
            const { data: attachment, error } = await supabaseClient
                .from('production_sheet_attachments')
                .insert({
                    sheet_id: currentSheet.id,
                    attachment_type: 'DATA_SHEET',
                    file_name: cb.dataset.name,
                    file_url: cb.value,
                    file_size: 0,
                    file_type: cb.dataset.type || 'Document'
                })
                .select()
                .single();
            
            if (error) throw error;
            projectData.attachments.push(attachment);
        }
        
        closeDataSheetsModal();
        showToast(`${checkboxes.length} data sheet(s) linked!`, 'success');
        
        // Update UI
        await checkAllItems();
        updateProgress();
        generatePreview();
        
    } catch (err) {
        console.error('Error saving data sheets:', err);
        showToast('Error: ' + err.message, 'error');
    }
}


// Drag and drop
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('psUploadZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                document.getElementById('psFileInput').files = e.dataTransfer.files;
                handleFileSelect({ target: { files: [file] } });
            }
        });
    }
});