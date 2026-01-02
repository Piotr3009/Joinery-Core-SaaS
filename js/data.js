// ========== DATA ==========
let projects = [];
let pipelineProjects = [];
let failedArchive = [];
let completedArchive = [];

// Production phases only (removed deliveryGlazing)
let productionPhases = {
    siteSurvey: { name: "Site Survey", color: "#5e4e81" },
    md: { name: "Manufacturing Drawings", color: "#5a2cdb" },
    order: { name: "Order Materials", color: "#af72ba" },
    timber: { name: "Timber Production", color: "#547d56" },
    orderGlazing: { name: "Order Glazing", color: "#79a4cf" },
    orderSpray: { name: "Order Spray Materials", color: "#eb86d8" },
    spray: { name: "Spraying", color: "#e99f62" },
    glazing: { name: "Glazing", color: "#485d68" },
    qc: { name: "QC & Packing", color: "#63a3ab" },
    dispatch: { name: "Dispatch/Installation", color: "#02802a" }
};

// Separate pipeline phases  
let pipelinePhases = {
    initialContact: { name: "Initial Contact", color: "#8b5a3c" },
    quote: { name: "Quote", color: "#4a90e2" },
    depositReceived: { name: "Deposit Received", color: "#1a5d1a" }
};

// Keep old phases for backward compatibility
let phases = { ...pipelinePhases, ...productionPhases };

// Fixed phase orders
const pipelinePhaseOrder = [
    'initialContact', 'quote', 'depositReceived'
];

// Updated production order WITHOUT deliveryGlazing
const productionPhaseOrder = [
    'siteSurvey', 'md', 'order', 'timber', 'orderGlazing', 'orderSpray', 'spray', 'glazing', 'qc', 'dispatch'
];

// Legacy phase order for backward compatibility
const phaseOrder = [...pipelinePhaseOrder, ...productionPhaseOrder];

// Phase statuses
const phaseStatuses = {
    notStarted: { name: "Not Started", icon: "⏸️" },
    inProgress: { name: "In Progress", icon: "▶️" },
    completed: { name: "Completed", icon: "✅" },
    problem: { name: "Problem/Delayed", icon: "⚠️" }
};

// Project types configuration
const projectTypes = {
    sash: { name: "Sash Window" },
    casement: { name: "Casement Window" },
    kitchen: { name: "Kitchen" },
    wardrobe: { name: "Wardrobe" },
    partition: { name: "Partition Wall" },
    externalSpray: { name: "External Spraying" },
    internalDoors: { name: "Internal Doors" },
    other: { name: "Other" }
};

// Material lists per project type
const materialLists = {
    sash: [
        { item: "Sash cords", required: true },
        { item: "Pulleys", required: true },
        { item: "Sash weights", required: true },
        { item: "Staff beads", required: true },
        { item: "Parting beads", required: true },
        { item: "Window locks", required: true },
        { item: "Glazing putty", required: false },
        { item: "Glass panes", required: true },
        { item: "Weather stripping", required: false }
    ],
    casement: [
        { item: "Hinges", required: true },
        { item: "Casement stays", required: true },
        { item: "Window handles", required: true },
        { item: "Multi-point locks", required: false },
        { item: "Glass units", required: true },
        { item: "Glazing beads", required: true },
        { item: "Weather seals", required: true }
    ],
    kitchen: [
        { item: "Hinges (soft close)", required: true },
        { item: "Drawer runners", required: true },
        { item: "Door handles", required: true },
        { item: "Worktop", required: true },
        { item: "Worktop brackets", required: true },
        { item: "Shelf pins", required: false },
        { item: "Plinth legs", required: true },
        { item: "Cornice/Pelmet", required: false },
        { item: "End panels", required: false }
    ],
    wardrobe: [
        { item: "Hinges", required: true },
        { item: "Hanging rails", required: true },
        { item: "Shelf pins", required: true },
        { item: "Door handles", required: true },
        { item: "Drawer runners", required: false },
        { item: "Soft close mechanisms", required: false },
        { item: "LED lighting", required: false },
        { item: "Mirrors", required: false }
    ],
    partition: [
        { item: "Metal studs", required: true },
        { item: "Track systems", required: true },
        { item: "Glass panels", required: true },
        { item: "Door hardware", required: true },
        { item: "Floor/ceiling channels", required: true },
        { item: "Acoustic seals", required: false },
        { item: "Manifestation tape", required: true }
    ],
    externalSpray: [
        { item: "Masking tape", required: true },
        { item: "Protective sheets", required: true },
        { item: "Sandpaper", required: true },
        { item: "Primer", required: false },
        { item: "Paint/Varnish", required: true }
    ],
    internalDoors: [
        { item: "Door hinges", required: true },
        { item: "Door handles", required: true },
        { item: "Door locks/latches", required: true },
        { item: "Door frames", required: true },
        { item: "Door stops", required: true },
        { item: "Architraves", required: true },
        { item: "Skirting boards", required: false },
        { item: "Door seals", required: false },
        { item: "Glass panels", required: false },
        { item: "Wood stain/finish", required: true }
    ],
    other: [
        { item: "Hinges", required: false },
        { item: "Handles", required: false },
        { item: "Locks", required: false },
        { item: "Glass", required: false },
        { item: "Fixings", required: true },
        { item: "Adhesive/Sealant", required: false }
    ]
};

// Glazing materials list
const glazingMaterialsList = [
    { item: "Double glazed units", required: false, hasSize: true },
    { item: "Single glazed panes", required: false, hasSize: true },
    { item: "Toughened glass", required: false, hasSize: true },
    { item: "Laminated glass", required: false, hasSize: true },
    { item: "Obscure glass", required: false, hasSize: true },
    { item: "Glazing silicone", required: true },
    { item: "Glazing tape", required: true },
    { item: "Setting blocks", required: true },
    { item: "Glazing packers", required: true }
];

// Spray materials list
const sprayMaterialsList = [
    { item: "Varnish", required: false, hasColor: false },
    { item: "Paint", required: false, hasColor: true },
    { item: "Primer", required: true, hasColor: false },
    { item: "Thinner", required: true, hasColor: false },
    { item: "Masking tape", required: true, hasColor: false },
    { item: "Sandpaper", required: true, hasColor: false }
];

let teamMembers = [];

let visibleStartDate = new Date();
visibleStartDate.setDate(visibleStartDate.getDate() - 7); // Start tydzień wcześniej
let daysToShow = 300;
let dayWidth = 36;
let currentEditProject = null;
let currentAssignPhase = null;
let draggedElement = null;
let draggedPhase = null;
let draggedProject = null;
let dragMode = null;
let startX = 0;
let originalLeft = 0;
let originalWidth = 0;
let lastProjectNumber = 0;
let lastPipelineNumber = 0;
let currentView = 'production';
let currentSortMode = 'number'; // NOWA LINIA - sortowanie domyślnie po numerze

// Auto-save variables
let hasUnsavedChanges = false;
let autoSaveInterval = null;

// ========== DATA MANAGEMENT ==========

// Load projects from Supabase + merge with localStorage phases
async function loadProjectsFromSupabase() {
    try {
        // NAJPIERW ZAŁADUJ ZESPÓŁ
        const { data: teamData, error: teamError } = await supabaseClient
            .from('team_members')
            .select('*')
            .eq('active', true);
            
        if (!teamError && teamData) {
            teamMembers = teamData;
            console.log('👥 TeamMembers loaded:', teamMembers.length, teamMembers.map(m => ({id: m.id, name: m.name})));
        }
        
        // TERAZ PROJEKTY
        const { data, error } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading from Supabase:', error);
            return false;
        }
        
        if (data && data.length > 0) {
            data.forEach(p => {
            });
            
            // Load phases from Supabase
            const projectIds = data.map(p => p.id);
            console.log('📋 Loading phases for project IDs:', projectIds);
            
            const { data: phasesData, error: phasesError } = await supabaseClient
                .from('project_phases')
                .select('*')
                .in('project_id', projectIds)
                .order('order_position');
            
            console.log('📋 Phases loaded:', phasesData?.length || 0, 'Error:', phasesError);
            if (phasesData && phasesData.length > 0) {
                console.log('📋 First phase:', phasesData[0]);
            }
            
            if (phasesError) {
                console.error('❌ Error loading phases:', phasesError);
            }
            
            if (phasesData && phasesData.length > 0) {
            }
            
            // Merge projects with phases
            projects = data.map(dbProject => {
                const projectPhases = phasesData?.filter(p => p.project_id === dbProject.id) || [];
                
                if (projectPhases.length === 0) {
                    console.warn(`⚠️ Projekt "${dbProject.name}" (ID: ${dbProject.id}) nie ma faz!`);
                    // Sprawdź czy może fazy mają błędne project_id
                    const podobne = phasesData?.filter(p => p.project_id && p.project_id.startsWith(dbProject.id.substring(0,8)));
                    if (podobne?.length > 0) {
                    }
                }
                
                return {
                    id: dbProject.id,
                    projectNumber: dbProject.project_number,
                    type: dbProject.type,
                    name: dbProject.name,
                    client_id: dbProject.client_id,
                    deadline: dbProject.deadline,
                    contract_value: dbProject.contract_value || 0,
                    project_cost: dbProject.project_cost || 0,
                    google_drive_url: dbProject.google_drive_url,
                    google_drive_folder_id: dbProject.google_drive_folder_id,
                    notes: dbProject.notes,
                    source_pipeline_number: dbProject.source_pipeline_number || null,

                    phases: projectPhases.map(phase => {
                        
                        // Napraw format daty DD/MM/YYYY na YYYY-MM-DD
                        const fixDate = (dateStr) => {
                            if (!dateStr) return null;
                            if (dateStr.includes('/')) {
                                const [day, month, year] = dateStr.split('/');
                                return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
                            }
                            return dateStr;
                        };
                        
                        return {
                        id: phase.id,
                        segmentNo: phase.segment_no || 1,
                        key: phase.phase_key,
                        start: fixDate(phase.start_date),
                        end: fixDate(phase.end_date),
                        workDays: phase.work_days,
                        status: phase.status,
                        assignedTo: phase.assigned_to,
                        // Dodaj dane pracownika jeśli jest przypisany
                        assignedToName: phase.assigned_to ? 
                            teamMembers.find(m => m.id === phase.assigned_to)?.name : null,
                        assignedToColor: phase.assigned_to ? 
                            (teamMembers.find(m => m.id === phase.assigned_to)?.color || 
                             teamMembers.find(m => m.id === phase.assigned_to)?.color_code) : null,
                        notes: phase.notes,
                        materials: phase.materials,
                        orderConfirmed: phase.order_confirmed
                        };
                    })
                };
            });
            
            // DEBUG: Sprawdź fazy z assigned
            const phasesWithAssigned = projects.flatMap(p => p.phases).filter(ph => ph.assignedTo);
            if (phasesWithAssigned.length > 0) {
                console.log('👷 Phases with assignedTo:', phasesWithAssigned.map(ph => ({
                    key: ph.key,
                    assignedTo: ph.assignedTo,
                    assignedToName: ph.assignedToName
                })));
            }
            
            return true;
        }
        
        // DB jest pusta ale to OK - nie używaj localStorage
        projects = [];
        return true;
    } catch (err) {
        console.error('Failed to load from Supabase:', err);
        return false;
    }
}

async function loadPipelineFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('pipeline_projects')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading pipeline:', error);
            return false;
        }
        
        if (data && data.length > 0) {
            
            // Load phases from Supabase
            const projectIds = data.map(p => p.id);
            const { data: phasesData } = await supabaseClient
                .from('pipeline_phases')
                .select('*')
                .in('pipeline_project_id', projectIds)
                .order('order_position');
            
            
            // Merge projects with phases
            pipelineProjects = data.map(dbProject => {
                const projectPhases = phasesData?.filter(p => p.pipeline_project_id === dbProject.id) || [];
                
                return {
                    id: dbProject.id,
                    projectNumber: dbProject.project_number,
                    type: dbProject.type,
                    name: dbProject.name,
                    client_id: dbProject.client_id,
                    estimated_value: dbProject.estimated_value || 0,
                    site_address: dbProject.site_address || '',
                    project_contact: dbProject.project_contact || '',
                    notes: dbProject.notes || null,
                    pdf_url: dbProject.pdf_url || null,
                    google_drive_url: dbProject.google_drive_url || null,
                    google_drive_folder_id: dbProject.google_drive_folder_id || null,
                    created_at: dbProject.created_at,
                    phases: projectPhases.map(phase => {
                        // Napraw format daty DD/MM/YYYY na YYYY-MM-DD
                        const fixDate = (dateStr) => {
                            if (!dateStr) return null;
                            if (dateStr.includes('/')) {
                                const [day, month, year] = dateStr.split('/');
                                return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
                            }
                            return dateStr;
                        };
                        
                        return {
                            key: phase.phase_key,
                            start: fixDate(phase.start_date),
                            end: fixDate(phase.end_date),
                            workDays: phase.work_days,
                            status: phase.status,
                            notes: phase.notes
                        };
                    })
                };
            });
            
            return true;
        }
        
        // DB jest pusta ale to OK - nie używaj localStorage
        pipelineProjects = [];
        return true;
    } catch (err) {
        console.error('Failed to load pipeline:', err);
        return false;
    }
}

// Load custom phases from database
async function loadCustomPhases() {
    if (typeof supabaseClient === 'undefined') return;
    
    try {
        const { data, error } = await supabaseClient
            .from('custom_phases')
            .select('*')
            .order('created_at');
        
        if (error) {
            console.error('Error loading custom phases:', error);
            return;
        }
        
        if (data && data.length > 0) {
            data.forEach(cp => {
                const targetPhases = cp.phase_type === 'pipeline' ? pipelinePhases : productionPhases;
                
                // Dodaj tylko jeśli nie istnieje
                if (!targetPhases[cp.phase_key]) {
                    targetPhases[cp.phase_key] = {
                        name: cp.name,
                        color: cp.color
                    };
                    phases[cp.phase_key] = {
                        name: cp.name,
                        color: cp.color
                    };
                }
            });
        }
    } catch (err) {
        console.error('Failed to load custom phases:', err);
    }
}

// Save custom phase to database
async function saveCustomPhaseToDb(key, name, color, phaseType) {
    if (typeof supabaseClient === 'undefined') return;
    
    try {
        const { error } = await supabaseClient
            .from('custom_phases')
            .insert([{
                phase_key: key,
                name: name,
                color: color,
                phase_type: phaseType
            }]);
        
        if (error) {
            console.error('Error saving custom phase:', error);
        } else {
        }
    } catch (err) {
        console.error('Failed to save custom phase:', err);
    }
}

// Delete custom phase from database
async function deleteCustomPhaseFromDb(key) {
    if (typeof supabaseClient === 'undefined') return;
    
    try {
        const { error } = await supabaseClient
            .from('custom_phases')
            .delete()
            .eq('phase_key', key);
        
        if (error) {
            console.error('Error deleting custom phase:', error);
        } else {
        }
    } catch (err) {
        console.error('Failed to delete custom phase:', err);
    }
}

// NAPRAWIONA funkcja loadData bez duplikowania render()
async function loadData() {
    // Wait for client to be ready if it's not yet
    if (typeof window.supabaseClient === 'undefined') {
        console.warn('Waiting for API Client...');
        await new Promise(r => setTimeout(r, 500));
    }

    // Najpierw próbuj z Supabase
    if (typeof window.supabaseClient !== 'undefined') {
        try {
            // Załaduj custom fazy najpierw
            await loadCustomPhases();
            
            const [prodLoaded, pipeLoaded] = await Promise.all([
                loadProjectsFromSupabase(),
                loadPipelineFromSupabase()
            ]);
            
            // Jeśli Supabase pusty, użyj localStorage
            if (!prodLoaded) {
                const saved = localStorage.getItem('joineryProjects');
                if (saved) {
                    projects = JSON.parse(saved);
                    projects.forEach(project => {
                        if (project.phases) {
                            project.phases.forEach(phase => {
                                if (!phase.status) {
                                    phase.status = 'notStarted';
                                }
                                if (!phase.workDays && phase.start && phase.end) {
                                    phase.workDays = workingDaysBetween(
                                        new Date(phase.start), 
                                        new Date(phase.end)
                                    );
                                }
                            });
                        }
                    });
                }
            }
            
            if (!pipeLoaded) {
                const savedPipeline = localStorage.getItem('joineryPipelineProjects');
                if (savedPipeline) {
                    pipelineProjects = JSON.parse(savedPipeline);
                }
            }
            
        } catch (error) {
            console.error('Supabase error, using localStorage:', error);
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }
    
    // Załaduj resztę danych (always from localStorage)
    const savedFailedArchive = localStorage.getItem('joineryFailedArchive');
    if (savedFailedArchive) {
        failedArchive = JSON.parse(savedFailedArchive);
    }
    
    const savedCompletedArchive = localStorage.getItem('joineryCompletedArchive');
    if (savedCompletedArchive) {
        completedArchive = JSON.parse(savedCompletedArchive);
    }
    
    // DEDUPLIKACJA - usuń duplikaty faz po załadowaniu
    projects = Array.isArray(projects) ? projects : [];
    projects.forEach(p => {
        if (p.phases) {
            p.phases = dedupeProjectPhases(p.phases);
        }
    });
    
    pipelineProjects = Array.isArray(pipelineProjects) ? pipelineProjects : [];
    pipelineProjects.forEach(p => {
        if (p.phases) {
            p.phases = dedupeProjectPhases(p.phases);
        }
    });
    
    const savedPhases = localStorage.getItem('joineryPhases');
    if (savedPhases) {
        const loadedPhases = JSON.parse(savedPhases);
        phases = { ...phases, ...loadedPhases };
    }

    // FIX: Nie nadpisuj teamMembers jeśli Supabase już załadował
    const savedTeam = localStorage.getItem('joineryTeam');
    if (savedTeam && teamMembers.length === 0) teamMembers = JSON.parse(savedTeam);

    
    const savedLastNumber = localStorage.getItem('joineryLastProjectNumber');
    if (savedLastNumber) lastProjectNumber = parseInt(savedLastNumber);
    
    const savedLastPipelineNumber = localStorage.getItem('joineryLastPipelineNumber');
    if (savedLastPipelineNumber) lastPipelineNumber = parseInt(savedLastPipelineNumber);
    
    const savedCurrentView = localStorage.getItem('joineryCurrentView');
    if (savedCurrentView) currentView = savedCurrentView;

    const today = new Date();
    visibleStartDate = new Date(today);
    visibleStartDate.setDate(today.getDate() - 7);
    visibleStartDate.setHours(0,0,0,0);
    
    // Start auto-save
    startAutoSave();
    
    // NIE RENDERUJ TUTAJ! Pozwól app.js to zrobić
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('joineryProjects');
    if (saved) {
        projects = JSON.parse(saved);
        projects.forEach(project => {
            if (project.phases) {
                project.phases.forEach(phase => {
                    if (!phase.status) {
                        phase.status = 'notStarted';
                    }
                    if (!phase.workDays && phase.start && phase.end) {
                        phase.workDays = workingDaysBetween(
                            new Date(phase.start), 
                            new Date(phase.end)
                        );
                    }
                });
            }
        });
    }
    
    const savedPipeline = localStorage.getItem('joineryPipelineProjects');
    if (savedPipeline) {
        pipelineProjects = JSON.parse(savedPipeline);
    }
    
    const savedFailedArchive = localStorage.getItem('joineryFailedArchive');
    if (savedFailedArchive) {
        failedArchive = JSON.parse(savedFailedArchive);
    }
    
    const savedCompletedArchive = localStorage.getItem('joineryCompletedArchive');
    if (savedCompletedArchive) {
        completedArchive = JSON.parse(savedCompletedArchive);
    }
    
    const savedPhases = localStorage.getItem('joineryPhases');
    if (savedPhases) {
        const loadedPhases = JSON.parse(savedPhases);
        phases = { ...phases, ...loadedPhases };
    }

    const savedTeam = localStorage.getItem('joineryTeam');
    if (savedTeam) teamMembers = JSON.parse(savedTeam);

    
    const savedLastNumber = localStorage.getItem('joineryLastProjectNumber');
    if (savedLastNumber) lastProjectNumber = parseInt(savedLastNumber);
    
    const savedLastPipelineNumber = localStorage.getItem('joineryLastPipelineNumber');
    if (savedLastPipelineNumber) lastPipelineNumber = parseInt(savedLastPipelineNumber);
    
    const savedCurrentView = localStorage.getItem('joineryCurrentView');
    if (savedCurrentView) currentView = savedCurrentView;

    const today = new Date();
    visibleStartDate = new Date(today);
    visibleStartDate.setDate(today.getDate() - 7);
    visibleStartDate.setHours(0,0,0,0);
}

// ========== ZAPISYWANIE FAZ DO SUPABASE - NAPRAWIONE ==========

// Update pojedynczej fazy - bez tworzenia logów
async function updateSinglePhase(projectId, phase, isProduction = true) {
    try {
        const tableName = isProduction ? 'project_phases' : 'pipeline_phases';
        
        
        // Oblicz end_date jeśli trzeba
        let endDate = phase.end;
        if (!endDate && phase.start && phase.workDays) {
            try {
                const computedEnd = computeEnd(phase);
                endDate = formatDate(computedEnd);
            } catch (err) {
                console.error('Error computing phase end:', err);
            }
        }
        
        // Przygotuj dane do update
        const updateData = {
            start_date: phase.start,
            end_date: endDate || null,
            work_days: phase.workDays || (isProduction ? 4 : 3),
            status: phase.status || 'notStarted',
            notes: phase.notes || null
        };
        
        // Dodaj pola tylko dla production
        if (isProduction) {
            updateData.assigned_to = phase.assignedTo || null;
            updateData.materials = phase.materials || null;
            updateData.order_confirmed = phase.orderConfirmed || false;
        }
        
        // Update po ID jeśli dostępne (dla segmentów)
        const idField = isProduction ? 'project_id' : 'pipeline_project_id';
        let query = supabaseClient.from(tableName).update(updateData);
        
        if (phase.id) {
            // Update po unikalnym ID - bezpieczne dla segmentów
            query = query.eq('id', phase.id);
        } else {
            // Fallback: update po project_id + phase_key (+ segment_no tylko dla production)
            query = query
                .eq(idField, projectId)
                .eq('phase_key', phase.key);
            
            // segment_no tylko dla production (pipeline nie ma tej kolumny)
            if (isProduction) {
                query = query.eq('segment_no', phase.segmentNo || 1);
            }
        }
        
        const { error } = await query;
        
        if (error) {
            console.error('❌ Error updating single phase:', error);
            showToast('Error: ' + error.message, 'error');
            return false;
        }
        
        return true;
        
    } catch (err) {
        console.error('❌ Failed to update phase:', err);
        showToast('Error: ' + err.message, 'error');
        return false;
    }
}

async function savePhasesToSupabase(projectId, phases, isProduction = true, fullReplace = true) {
    try {
        const functionName = isProduction ? 
            'safe_upsert_project_phases' : 
            'safe_upsert_pipeline_phases';
        
        const projectIdParam = isProduction ? 'p_project_id' : 'p_pipeline_project_id';

        if (!phases || !Array.isArray(phases)) {
            console.error('❌ CRITICAL: phases is not an array!', phases);
            return false;
        }


        // Helper: sprawdź czy data jest valid
        const isValidDate = (dateStr) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return !isNaN(d.getTime());
        };

        // Helper: dzisiejsza data w formacie YYYY-MM-DD
        const getTodayStr = () => {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // Przygotuj dane dla RPC
        const phasesForRPC = phases.map((phase, index) => {
            // WALIDACJA: Napraw invalid start_date
            let startDate = phase.start;
            if (!isValidDate(startDate)) {
                startDate = getTodayStr();
            }

            // Oblicz end_date jeśli trzeba
            let endDate = phase.end;
            
            // WALIDACJA: Napraw invalid end_date
            if (!isValidDate(endDate)) {
                endDate = null; // wymusi przeliczenie poniżej
            }
            
            // Jeśli end < start, też napraw
            if (endDate && new Date(endDate) < new Date(startDate)) {
                endDate = null;
            }

            if (!endDate && startDate) {
                try {
                    // Użyj computeEnd jeśli dostępne, inaczej prosta matematyka
                    if (typeof computeEnd === 'function') {
                        const tempPhase = { ...phase, start: startDate };
                        const computedEnd = computeEnd(tempPhase);
                        endDate = formatDate(computedEnd);
                    } else {
                        const workDays = phase.workDays || 4;
                        const start = new Date(startDate);
                        const end = new Date(start);
                        end.setDate(end.getDate() + workDays - 1);
                        const year = end.getFullYear();
                        const month = String(end.getMonth() + 1).padStart(2, '0');
                        const day = String(end.getDate()).padStart(2, '0');
                        endDate = `${year}-${month}-${day}`;
                    }
                } catch (err) {
                    console.error('Error computing phase end:', err);
                    endDate = startDate; // fallback: end = start
                }
            }

            const phaseData = {
                phase_key: phase.key,
                segment_no: phase.segmentNo || 1,
                start_date: startDate,
                end_date: endDate || startDate,
                work_days: phase.workDays || (isProduction ? 4 : 3),
                status: phase.status || 'notStarted',
                notes: phase.notes || null,
                order_position: index
            };

            // Dodaj id jeśli istnieje (dla update istniejącego segmentu)
            if (phase.id) {
                phaseData.id = phase.id;
            }

            // Dodaj pola tylko dla production
            if (isProduction) {
                phaseData.assigned_to = phase.assignedTo || null;
                phaseData.materials = phase.materials || null;
                phaseData.order_confirmed = phase.orderConfirmed || false;
            }

            return phaseData;
        });

        console.log('🔄 Calling RPC:', functionName);
        console.log('🔄 Project ID:', projectId);
        console.log('🔄 Phases count:', phasesForRPC.length);

        // Wywołaj funkcję RPC - WSZYSTKO W JEDNEJ TRANSAKCJI!
        const { data, error } = await supabaseClient.rpc(functionName, {
            phases: phasesForRPC,
            [projectIdParam]: projectId,
            p_full_replace: fullReplace
        });

        console.log('🔄 RPC Response:', { data, error });

        if (error) {
            console.error('❌ Error saving phases via RPC:', error);
            console.error('Function:', functionName);
            console.error('Project ID:', projectId);
            console.error('Phases data:', phasesForRPC);
            
            showToast('Failed to save phases: ' + error.message, 'error');
            return false;
        }

        console.log('✅ Phases saved successfully');
        return true;

    } catch (err) {
        console.error('❌ Failed to save phases:', err);
        showToast('Error: ' + err.message, 'error');
        return false;
    }
}

// ========== NAPRAWIONY saveData z czekaniem na fazy ==========

async function saveData() {
    try {
        // PRODUCTION PROJECTS - save individually by ID
        if (projects.length > 0 && typeof supabaseClient !== 'undefined') {
            for (const p of projects) {
                if (!p.projectNumber) continue;
                
                const projectForDB = {
                    project_number: p.projectNumber,
                    type: p.type,
                    name: p.name,
                    deadline: p.deadline || null,
                    status: 'active',
                    notes: p.notes || null,
                    contract_value: p.contract_value || 0,
                    project_cost: p.project_cost || 0,
                    client_id: p.client_id || null,
                    google_drive_url: p.google_drive_url || null,
                    google_drive_folder_id: p.google_drive_folder_id || null
                };
                
                if (p.id) {
                    // UPDATE existing project by ID
                    const { error } = await supabaseClient
                        .from('projects')
                        .update(projectForDB)
                        .eq('id', p.id);
                    
                    if (error && error.code !== '23505') {
                        console.error('Error updating project:', error);
                    }
                } else {
                    // INSERT new - ignore duplicates
                    const { error } = await supabaseClient
                        .from('projects')
                        .insert(projectForDB);
                    
                    if (error && error.code !== '23505') {
                        console.error('Error inserting project:', error);
                    }
                }
            }
        }
        
        // PIPELINE PROJECTS
        if (pipelineProjects.length > 0 && typeof supabaseClient !== 'undefined') {
            // Save each project individually to handle conflicts properly
            for (const p of pipelineProjects) {
                if (!p.projectNumber) continue;
                
                const pipelineForDB = {
                    project_number: p.projectNumber,
                    type: p.type,
                    name: p.name,
                    client_id: p.client_id || null,
                    estimated_value: p.estimated_value || 0,
                    status: 'active',
                    notes: p.notes || null,
                    pdf_url: p.pdf_url || null,
                    google_drive_url: p.google_drive_url || null,
                    google_drive_folder_id: p.google_drive_folder_id || null
                };
                
                // Try to update first if we have an ID
                if (p.id) {
                    const { error } = await supabaseClient
                        .from('pipeline_projects')
                        .update(pipelineForDB)
                        .eq('id', p.id);
                    
                    if (error && error.code !== '23505') {
                        console.error('Error updating pipeline:', error);
                    }
                } else {
                    // Insert new - ignore duplicates
                    const { error } = await supabaseClient
                        .from('pipeline_projects')
                        .insert(pipelineForDB);
                    
                    if (error && error.code !== '23505') {
                        console.error('Error inserting pipeline:', error);
                    }
                }
            }
            // FAZY PIPELINE zapisują się bezpośrednio przez:
            // - updateSinglePhase() przy edycji w modalu
            // - savePhasesToSupabase() przy przesuwaniu/usuwaniu
            // NIE zapisujemy ich tutaj żeby uniknąć lawiny logów!
        }
        
    } catch (err) {
        console.error('General save error:', err);
    }
    
    // ZAWSZE zapisz lokalnie jako backup
    localStorage.setItem('joineryProjects', JSON.stringify(projects));
    localStorage.setItem('joineryPipelineProjects', JSON.stringify(pipelineProjects));
    localStorage.setItem('joineryFailedArchive', JSON.stringify(failedArchive));
    localStorage.setItem('joineryCompletedArchive', JSON.stringify(completedArchive));
    localStorage.setItem('joineryPhases', JSON.stringify(phases));
    localStorage.setItem('joineryTeam', JSON.stringify(teamMembers));
    localStorage.setItem('joineryLastProjectNumber', lastProjectNumber);
    localStorage.setItem('joineryLastPipelineNumber', lastPipelineNumber);
    localStorage.setItem('joineryCurrentView', currentView);
}

// ========== AUTO-SAVE FUNCTIONS ==========

let saveInProgress = false;
let pendingSave = false;

async function saveDataQueued() {
    if (saveInProgress) {
        pendingSave = true;
        return;
    }
    
    saveInProgress = true;
    await saveData();
    saveInProgress = false;
    
    if (pendingSave) {
        pendingSave = false;
        await saveDataQueued();
    }
}

function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    
    autoSaveInterval = setInterval(() => {
        if (hasUnsavedChanges) {
            saveDataQueued();
            hasUnsavedChanges = false;
            document.title = "Joinery Core - Operational System - Production Manager";
        }
    }, 2000);
}

function markAsChanged() {
    hasUnsavedChanges = true;
    document.title = "* Joinery Core - Operational System - Unsaved Changes";
}

// Save on page close
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        saveDataQueued();
        e.returnValue = 'You have unsaved changes!';
    }
});

function getNextProjectNumber() {
    const year = new Date().getFullYear();
    
    // Znajdź najwyższy numer w bieżącym roku
    let maxNumber = 0;
    projects.forEach(p => {
        if (p.projectNumber && p.projectNumber.includes('/' + year)) {
            const numPart = parseInt(p.projectNumber.split('/')[0]);
            if (!isNaN(numPart) && numPart > maxNumber) {
                maxNumber = numPart;
            }
        }
    });
    
    const nextNumber = maxNumber + 1;
    return `${String(nextNumber).padStart(3, '0')}/${year}`;
}

function getNextPipelineNumber() {
    const year = new Date().getFullYear();
    
    // Znajdź najwyższy numer w bieżącym roku
    let maxNumber = 0;
    pipelineProjects.forEach(p => {
        if (p.projectNumber && p.projectNumber.includes('/' + year)) {
            // Usuń 'PL' prefix i weź numer
            const numPart = parseInt(p.projectNumber.replace('PL', '').split('/')[0]);
            if (!isNaN(numPart) && numPart > maxNumber) {
                maxNumber = numPart;
            }
        }
    });
    
    const nextNumber = maxNumber + 1;
    return `PL${String(nextNumber).padStart(3, '0')}/${year}`;
}

function getMaterialList(projectType) {
    return materialLists[projectType] || materialLists.other;
}

function getSprayMaterialsList() {
    return sprayMaterialsList;
}

function getGlazingMaterialsList() {
    return glazingMaterialsList;
}

// ========== EXPORT/IMPORT ==========
function exportJSON() {
    const data = {
        version: '1.8',
        projects,
        phases,
        teamMembers,
        lastProjectNumber,
        exportDate: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `joinery-projects-${formatDate(new Date())}.json`;
    a.click();
}

function exportCSV() {
    const data = [['No.', 'Type', 'Project', 'Phase', 'Status', 'Start', 'End', 'Days', 'Assigned To']];
    
    projects.forEach(project => {
        if (project.phases) {
            project.phases.forEach(phase => {
                const phaseConfig = phases[phase.key];
                const start = new Date(phase.start);
                const end = new Date(phase.adjustedEnd || phase.end);
                const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
                
                let assignedTo = '';
                if (phase.assignedTo) {
                    const member = teamMembers.find(m => m.id === phase.assignedTo);
                    assignedTo = member ? member.name : '';
                }
                
                const projectType = projectTypes[project.type] || projectTypes.other;
                const status = phaseStatuses[phase.status] || phaseStatuses.notStarted;
                
                data.push([
                    project.projectNumber || '',
                    projectType.name,
                    project.name,
                    phaseConfig ? phaseConfig.name : phase.key,
                    status.name,
                    phase.start,
                    phase.adjustedEnd || phase.end,
                    days,
                    assignedTo
                ]);
            });
        }
    });
    
    const csv = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `joinery-projects-${formatDate(new Date())}.csv`;
    a.click();
}

function importJSON() {
    const input = document.getElementById('fileInput');
    input.click();
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                projects = data.projects || [];
                phases = data.phases || phases;
                teamMembers = data.teamMembers || [];
                lastProjectNumber = data.lastProjectNumber || 0;
                
                projects.forEach(project => {
                    if (!project.type) project.type = 'other';
                    if (!project.projectNumber) project.projectNumber = getNextProjectNumber();
                    if (project.phases) {
                        project.phases.sort((a, b) => {
                            return phaseOrder.indexOf(a.key) - phaseOrder.indexOf(b.key);
                        });
                        project.phases.forEach(phase => {
                            if (!phase.status) phase.status = 'notStarted';
                        });
                    }
                });
                
                saveDataQueued();
                updatePhasesLegend();
                render();
                showToast('Data imported successfully', 'success');
            } catch (err) {
                showToast('Error importing: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };
}

// ========== GOOGLE DRIVE HELPER ==========
// Function to update Google Drive info for a project (called from google-drive-picker.js)
window.updateProjectGoogleDrive = function(projectNumber, folderUrl, folderId, folderName) {
    const projectIndex = projects.findIndex(p => p.projectNumber === projectNumber);
    if (projectIndex !== -1) {
        projects[projectIndex].google_drive_url = folderUrl;
        projects[projectIndex].google_drive_folder_id = folderId;
        projects[projectIndex].google_drive_folder_name = folderName;
        return true;
    }
    console.error('❌ Project not found in projects[]:', projectNumber);
    return false;
};