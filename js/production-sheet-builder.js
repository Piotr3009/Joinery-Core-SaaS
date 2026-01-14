// ============================================
// PRODUCTION SHEET BUILDER - MAIN ORCHESTRATOR
// ============================================
// Load order: 
//   1. production-sheet-builder.js (this file)
//   2. psb-preview.js
//   3. psb-export.js

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
    if (typeof initPreviewGate === 'function') initPreviewGate();
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
    schedulePreview();
    
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
    schedulePreview();
    await autoSaveSnapshot();
    showToast('Note hidden from PS', 'info');
}

async function restoreNote(idx) {
    delete hiddenNotes[idx];
    checkAllItems();
    schedulePreview();
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
            schedulePreview();
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
        schedulePreview();
        
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
    schedulePreview();
    
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
    schedulePreview();
    
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
    
    const elements = tempDispatchItems.filter(i => i.item_type === 'element');
    const sprayItems = tempDispatchItems.filter(i => i.item_type === 'spray');
    const materials = tempDispatchItems.filter(i => i.item_type === 'material');
    const customItems = tempDispatchItems.filter(i => i.item_type === 'custom');
    
    const renderSimpleSection = (title, icon, color, items, type) => {
        if (items.length === 0 && type !== 'custom') return '';
        return `
            <div style="margin-bottom: 15px;">
                <div style="background: ${color}; padding: 8px 12px; font-weight: 600; font-size: 12px; color: white; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <span>${icon} ${title} (<span id="dispatch-count-${type}">${items.filter(i => i.selected).length}</span>/${items.length})</span>
                    <div>
                        <button onclick="toggleAllDispatch('${type}', false)" style="background: rgba(0,0,0,0.3); color: white; border: none; padding: 3px 10px; border-radius: 3px; cursor: pointer; font-size: 10px; margin-right: 5px;">None</button>
                        <button onclick="toggleAllDispatch('${type}', true)" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 3px 10px; border-radius: 3px; cursor: pointer; font-size: 10px;">All</button>
                    </div>
                </div>
                <div id="dispatch-scroll-${type}" class="dispatch-scroll-section" style="background: #1e1e1e; border: 1px solid #3e3e42; border-top: none; max-height: 400px; overflow-y: auto;">
                    ${items.length > 0 ? items.map((item) => {
                        const globalIdx = tempDispatchItems.indexOf(item);
                        return `
                            <div data-dispatch-idx="${globalIdx}" data-dispatch-type="${type}" style="display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid #2d2d30; ${item.selected ? 'background: rgba(74, 158, 255, 0.1);' : ''}">
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
    
    const renderMaterialsSection = () => {
        if (materials.length === 0) return '';
        return `
            <div style="margin-bottom: 15px;">
                <div style="background: #22c55e; padding: 8px 12px; font-weight: 600; font-size: 12px; color: white; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <span>🧱 Materials & Hardware (<span id="dispatch-count-material">${materials.filter(i => i.selected).length}</span>/${materials.length})</span>
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
                            <div data-dispatch-idx="${globalIdx}" data-dispatch-type="material" style="display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid #2d2d30; ${item.selected ? 'background: rgba(34, 197, 94, 0.1);' : ''}">
                                <input type="checkbox" ${item.selected ? 'checked' : ''} 
                                    onchange="toggleDispatchItem(${globalIdx})"
                                    style="width: 20px; height: 20px; margin-right: 12px; cursor: pointer; accent-color: #22c55e;">
                                ${item.image_url 
                                    ? `<img src="${item.image_url}" loading="lazy" width="50" height="50" style="${imgStyle}" onerror="this.style.display='none'">`
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
            <div>${renderSimpleSection('Elements / Units', '📦', '#3b82f6', elements, 'element')}</div>
            <div>
                ${renderSimpleSection('Spray Items', '🎨', '#e99f62', sprayItems, 'spray')}
                ${renderSimpleSection('Custom Items', '➕', '#8b5cf6', customItems, 'custom')}
            </div>
            <div>${renderMaterialsSection()}</div>
        </div>
        <div style="margin-top: 15px; padding: 15px; background: #2d2d30; border-radius: 6px;">
            <div style="font-size: 12px; color: #888; margin-bottom: 8px;">➕ Add Custom Item:</div>
            <div style="display: flex; gap: 10px;">
                <input type="text" id="dispatchCustomName" placeholder="Item name" style="flex: 2; padding: 10px; background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; color: #e8e2d5; font-size: 13px;">
                <input type="number" id="dispatchCustomQty" placeholder="Qty" value="1" style="width: 80px; padding: 10px; background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; color: #e8e2d5; font-size: 13px; text-align: center;">
                <button onclick="addCustomDispatchItem()" style="padding: 10px 20px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">+ Add</button>
            </div>
        </div>
    `;
}

function toggleDispatchItem(idx) {
    if (!tempDispatchItems[idx]) return;
    tempDispatchItems[idx].selected = !tempDispatchItems[idx].selected;
    const isSelected = tempDispatchItems[idx].selected;
    const itemType = tempDispatchItems[idx].item_type;
    const row = document.querySelector(`[data-dispatch-idx="${idx}"]`);
    if (row) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = isSelected;
        row.style.background = isSelected ? (itemType === 'material' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(74, 158, 255, 0.1)') : '';
    }
    updateDispatchCounter(itemType);
}

function updateDispatchCounter(type) {
    const countEl = document.getElementById(`dispatch-count-${type}`);
    if (countEl) {
        countEl.textContent = tempDispatchItems.filter(i => i.item_type === type && i.selected).length;
    }
}

function toggleAllDispatch(type, selected) {
    tempDispatchItems.forEach((item, idx) => {
        if (item.item_type === type && item.selected !== selected) {
            item.selected = selected;
            const row = document.querySelector(`[data-dispatch-idx="${idx}"]`);
            if (row) {
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = selected;
                row.style.background = selected ? (type === 'material' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(74, 158, 255, 0.1)') : '';
            }
        }
    });
    updateDispatchCounter(type);
}

function addCustomDispatchItem() {
    const nameInput = document.getElementById('dispatchCustomName');
    const qtyInput = document.getElementById('dispatchCustomQty');
    const name = nameInput.value.trim();
    const qty = parseInt(qtyInput.value) || 1;
    if (!name) { showToast('Enter item name', 'error'); return; }
    tempDispatchItems.push({ item_type: 'custom', source_id: null, name, quantity: qty, selected: true, notes: '' });
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
    schedulePreview();
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
        schedulePreview();
        
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