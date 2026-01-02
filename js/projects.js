// ========== PROJECT MANAGEMENT ==========

// Convert URLs in text to clickable links
function linkifyText(text) {
    if (!text) return '';
    // Match URLs starting with http://, https://, or www.
    const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    return text.replace(urlRegex, (url) => {
        const href = url.startsWith('www.') ? 'https://' + url : url;
        return `<a href="${href}" target="_blank" style="color: #4CAF50; text-decoration: underline;">${url}</a>`;
    });
}

// Load clients for dropdown - TYLKO JEDNA DEFINICJA
async function loadClientsDropdown() {
    try {
        if (!supabaseClient) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('clients')
            .select('id, client_number, company_name, contact_person')
            .order('company_name');
        
        if (error) {
            console.error('Error loading clients:', error);
            return;
        }
        
        const select = document.getElementById('projectClient');
        if (!select) {
            console.error('Client select not found');
            return;
        }
        
        select.innerHTML = '<option value="">-- Select from database --</option>';
        
        if (data && data.length > 0) {
            data.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = `${client.client_number} - ${client.company_name || client.contact_person}`;
                select.appendChild(option);
            });
        } else {
        }
    } catch (err) {
        console.error('Error loading clients:', err);
    }
}

// NAPRAWIONA funkcja addProject z async/await
async function addProject() {
    currentEditProject = null;
    document.getElementById('projectModalTitle').textContent = 'Add Project';
    document.getElementById('projectName').value = '';
    document.getElementById('projectStartDate').value = formatDate(new Date());
    document.getElementById('projectDeadline').value = '';
    
    // POBIERZ NUMERACJĘ Z BAZY DANYCH
    if (typeof supabaseClient !== 'undefined') {
        try {
            // Check both projects AND archived_projects for highest number
            const { data: lastProject, error: err1 } = await supabaseClient
                .from('projects')
                .select('project_number')
                .order('project_number', { ascending: false })
                .limit(1);
            
            const { data: lastArchived, error: err2 } = await supabaseClient
                .from('archived_projects')
                .select('project_number')
                .order('project_number', { ascending: false })
                .limit(1);
            
            let maxNumber = 0;
            const currentYear = new Date().getFullYear();
            
            // Check projects table
            if (lastProject && lastProject.length > 0) {
                const match = lastProject[0].project_number.match(/^(\d{3})\/(\d{4})/);
                if (match && match[2] === String(currentYear)) {
                    const num = parseInt(match[1]);
                    if (!isNaN(num) && num > maxNumber) maxNumber = num;
                }
            }
            
            // Check archived_projects table
            if (lastArchived && lastArchived.length > 0) {
                const match = lastArchived[0].project_number.match(/^(\d{3})\/(\d{4})/);
                if (match && match[2] === String(currentYear)) {
                    const num = parseInt(match[1]);
                    if (!isNaN(num) && num > maxNumber) maxNumber = num;
                }
            }
            
            const nextNumber = maxNumber + 1;
            const generatedNumber = `${String(nextNumber).padStart(3, '0')}/${currentYear}`;
            document.getElementById('projectNumber').value = generatedNumber;
            
        } catch (err) {
            console.error('Error getting numbering:', err);
            // Fallback - użyj domyślnego
            const currentYear = new Date().getFullYear();
            document.getElementById('projectNumber').value = `001/${currentYear}`;
        }
    } else {
        // Jeśli nie ma Supabase - użyj domyślnego  
        const currentYear = new Date().getFullYear();
        document.getElementById('projectNumber').value = `001/${currentYear}`;
    }
    
    // Reset type selection
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.type-option[data-type="other"]').classList.add('selected');
    
    // For new project all phases are checked by default
    updatePhasesList(null, true);
    
    // WAŻNE: Najpierw otwórz modal
    openModal('projectModal');
    
    // WAŻNE: Potem załaduj klientów
    await loadClientsDropdown();
}

// NAPRAWIONA funkcja editProject z await
async function editProject(index) {
    currentEditProject = index;
    const project = projects[index];
    
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectStartDate').value = project.phases[0]?.start || formatDate(new Date());
    document.getElementById('projectNumber').value = project.projectNumber || '';
    document.getElementById('projectDeadline').value = project.deadline || '';
    document.getElementById('projectContractValue').value = project.contract_value || '';
    document.getElementById('projectCost').value = project.project_cost || '';
    
    // Set selected type
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    const selectedType = project.type || 'other';
    document.querySelector(`.type-option[data-type="${selectedType}"]`).classList.add('selected');
    
    updatePhasesList(project.phases, false);
    
    // WAŻNE: Najpierw otwórz modal
    openModal('projectModal');
    
    // WAŻNE: Potem załaduj klientów i ustaw aktualnego (ASYNC FIX)
    try {
        await loadClientsDropdown();
        // Ustaw aktualnego klienta PO załadowaniu listy
        if (project.client_id) {
            const clientSelect = document.getElementById('projectClient');
            clientSelect.value = project.client_id;
            
            // Visual warning if client ID exists but not in list (e.g. deleted client)
            if (!clientSelect.value && project.client_id) {
                console.warn('Client ID not found in active list:', project.client_id);
            }
        }
    } catch (err) {
        console.error('Error loading clients:', err);
    }
}

async function saveProject() {
    const name = document.getElementById('projectName').value.trim();
    const clientId = document.getElementById('projectClient').value;
    const startDate = document.getElementById('projectStartDate').value;
    const projectNumber = document.getElementById('projectNumber').value.trim();
    const deadline = document.getElementById('projectDeadline').value;
    const contractValue = parseFloat(document.getElementById('projectContractValue').value) || 0;
    const projectCost = parseFloat(document.getElementById('projectCost').value) || 0;
    
    // Get selected type
    const selectedTypeElement = document.querySelector('.type-option.selected');
    const projectType = selectedTypeElement ? selectedTypeElement.dataset.type : 'other';
    
    if (!name) {
        showToast('Please enter a project name', 'warning');
        return;
    }
    
    if (!projectNumber) {
        showToast('Please enter a project number', 'warning');
        return;
    }
    
    if (!clientId) {
        showToast('Please select a client from database!', 'warning');
        return;
    }
    
    const selectedPhases = [];
    const checkboxes = document.querySelectorAll('#phasesList input[type="checkbox"]:checked');
    
    // WALIDACJA: Jeśli są zaznaczone fazy, wymagaj Start Date lub ustaw dzisiejszą
    let effectiveStartDate = startDate;
    if (checkboxes.length > 0 && !startDate) {
        // Ustaw dzisiejszą datę jeśli brak
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        effectiveStartDate = `${year}-${month}-${day}`;
        console.warn('⚠️ No start date provided, using today:', effectiveStartDate);
    }
    
    let currentDate = new Date(effectiveStartDate);
    
    // Sort phases according to productionPhaseOrder
    const sortedCheckboxes = Array.from(checkboxes).sort((a, b) => {
        return productionPhaseOrder.indexOf(a.value) - productionPhaseOrder.indexOf(b.value);
    });
    
    sortedCheckboxes.forEach(cb => {
        const phaseKey = cb.value;
        const phaseDuration = parseInt(cb.dataset.duration) || 4; // Default 4 working days

        // NOWA LOGIKA: Przy edycji zachowaj stare daty
        let newPhase;

        if (currentEditProject !== null) {
            const existingPhase = projects[currentEditProject].phases?.find(p => p.key === phaseKey);
            if (existingPhase) {
                // ZACHOWAJ WSZYSTKO ze starej fazy
                newPhase = { ...existingPhase };
                
                // WALIDACJA: Napraw invalid dates w istniejących fazach
                const isValidDate = (dateStr) => {
                    if (!dateStr) return false;
                    const d = new Date(dateStr);
                    return !isNaN(d.getTime());
                };
                
                if (!isValidDate(newPhase.start)) {
                    console.warn(`⚠️ Fixing invalid start date for phase ${phaseKey}`);
                    newPhase.start = formatDate(currentDate);
                }
                
                if (!isValidDate(newPhase.end) || new Date(newPhase.end) < new Date(newPhase.start)) {
                    console.warn(`⚠️ Fixing invalid end date for phase ${phaseKey}`);
                    const start = new Date(newPhase.start);
                    const workDays = newPhase.workDays || 4;
                    const end = workDays <= 1 ? new Date(start) : addWorkingDays(start, workDays - 1);
                    newPhase.end = formatDate(end);
                }
            } else {
                // Nowa faza dodana przy edycji - oblicz daty
                const phaseStart = new Date(currentDate);
                while (isWeekend(phaseStart)) {
                    phaseStart.setDate(phaseStart.getDate() + 1);
                }
                const phaseEnd = phaseDuration <= 1 ?
                    new Date(phaseStart) :
                    addWorkingDays(phaseStart, phaseDuration - 1);

                // NAPRAWA PROBLEM #1: Ustaw category dla nowej fazy
                const PRODUCTION_PHASES = ['timber', 'spray', 'glazing', 'qc'];
                const OFFICE_PHASES = ['md', 'siteSurvey', 'order', 'orderGlazing', 'orderSpray', 'dispatch', 'installation'];
                
                let phaseCategory = 'production'; // default
                if (PRODUCTION_PHASES.includes(phaseKey)) {
                    phaseCategory = 'production';
                } else if (OFFICE_PHASES.includes(phaseKey)) {
                    phaseCategory = 'office';
                }

                newPhase = {
                    key: phaseKey,
                    start: formatDate(phaseStart),
                    end: formatDate(phaseEnd),
                    workDays: phaseDuration,
                    status: 'notStarted',
                    category: phaseCategory
                };

                // NAPRAWA: Aktualizuj currentDate RÓWNIEŻ dla edycji nowych faz
                currentDate = new Date(newPhase.end);
                currentDate.setDate(currentDate.getDate() + 1);
                while (isWeekend(currentDate)) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        } else {
            // NOWY PROJEKT - oblicz daty normalnie
            const phaseStart = new Date(currentDate);
            while (isWeekend(phaseStart)) {
                phaseStart.setDate(phaseStart.getDate() + 1);
            }
            const phaseEnd = phaseDuration <= 1 ?
                new Date(phaseStart) :
                addWorkingDays(phaseStart, phaseDuration - 1);

            // NAPRAWA PROBLEM #1: Ustaw category dla nowej fazy
            const PRODUCTION_PHASES = ['timber', 'spray', 'glazing', 'qc'];
            const OFFICE_PHASES = ['md', 'siteSurvey', 'order', 'orderGlazing', 'orderSpray', 'dispatch', 'installation'];
            
            let phaseCategory = 'production'; // default
            if (PRODUCTION_PHASES.includes(phaseKey)) {
                phaseCategory = 'production';
            } else if (OFFICE_PHASES.includes(phaseKey)) {
                phaseCategory = 'office';
            }

            newPhase = {
                key: phaseKey,
                start: formatDate(phaseStart),
                end: formatDate(phaseEnd),
                workDays: phaseDuration,
                status: 'notStarted',
                category: phaseCategory
            };

            // Aktualizuj currentDate dla nowych projektów
            currentDate = new Date(newPhase.end);
            currentDate.setDate(currentDate.getDate() + 1);
            while (isWeekend(currentDate)) {
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        selectedPhases.push(newPhase);
    });
    

    const projectData = {
    projectNumber,
    type: projectType,
    name,
    client_id: clientId,
    deadline: deadline || null,
    contract_value: contractValue,
    project_cost: projectCost,
    phases: selectedPhases
};


// PRESERVE id and google_drive fields when editing
if (currentEditProject !== null && projects[currentEditProject]) {
    if (projects[currentEditProject].id) {
        projectData.id = projects[currentEditProject].id;
    }
    if (projects[currentEditProject].google_drive_url) {
        projectData.google_drive_url = projects[currentEditProject].google_drive_url;
    }
    if (projects[currentEditProject].google_drive_folder_id) {
        projectData.google_drive_folder_id = projects[currentEditProject].google_drive_folder_id;
    }
    if (projects[currentEditProject].google_drive_folder_name) {
        projectData.google_drive_folder_name = projects[currentEditProject].google_drive_folder_name;
    }
}
    
    // WYŁĄCZONE - automatyczne ustawianie faz przy deadline
    // if (deadline && selectedPhases.length > 0) {
    //     const today = new Date();
    //     today.setHours(0,0,0,0);
    //     const deadlineDate = new Date(deadline);
    //     
    //     // Sprawdź czy deadline jest wystarczający
    //     const availableWorkDays = workingDaysBetween(today, deadlineDate);
    //     
    //     if (availableWorkDays < selectedPhases.length) {
    //         showToast(`Deadline too short! Need at least ${selectedPhases.length} working days for ${selectedPhases.length} phases.`, 'info');
    //         return;
    //     }
    //     
    //     // Auto-dopasuj fazy do deadline
    //     autoAdjustPhasesToDeadline(projectData, today, deadlineDate);
    // }
    
    // Save to Supabase FIRST (source of truth)
    if (typeof supabaseClient !== 'undefined') {
        try {
            const projectForDB = {
                project_number: projectData.projectNumber,
                type: projectData.type,
                name: projectData.name,
                client_id: projectData.client_id,
                deadline: projectData.deadline,
                status: 'active',
                notes: null,
                contract_value: projectData.contract_value ? projectData.contract_value.toString() : '0',
                project_cost: projectData.project_cost ? projectData.project_cost.toString() : '0',
                google_drive_url: projectData.google_drive_url || null,
                google_drive_folder_id: projectData.google_drive_folder_id || null
            };
            
            let savedProject;
            let error;
            
            if (currentEditProject !== null && projectData.id) {
                // UPDATE existing project by ID
                const result = await supabaseClient
                    .from('projects')
                    .update(projectForDB)
                    .eq('id', projectData.id)
                    .select()
                    .single();
                savedProject = result.data;
                error = result.error;
            } else {
                // INSERT new project
                const result = await supabaseClient
                    .from('projects')
                    .insert(projectForDB)
                    .select()
                    .single();
                savedProject = result.data;
                error = result.error;
            }
            
            if (error) {
                console.error('❌ Error saving project:', error);
                showToast(`Error saving project: ${error.message}`, 'error');
                return; // Stop execution on DB error
            }
                
            // SUCCESS: Update local state with DB data (especially ID)
            if (savedProject) {
                projectData.id = savedProject.id; // CRITICAL: Update local ID
                
                // ZAPISZ FAZY DO TABELI project_phases
                if (projectData.phases && projectData.phases.length > 0) {
                    const phaseSaveResult = await savePhasesToSupabase(
                        savedProject.id,
                        projectData.phases,
                        true  // true = production
                    );
                    
                    if (!phaseSaveResult) {
                        console.error('❌ Failed to save phases');
                        showToast('Project saved, but phases failed to save', 'warning');
                    }
                }
                
                // Update client project count
                await updateClientProjectCount(clientId);
            }
            
        } catch (err) {
            console.error('Exception saving project:', err);
            showToast('Unexpected error saving project', 'error');
            return;
        }
    }
    
    // Update local array AFTER successful DB save
    if (currentEditProject !== null) {
        projects[currentEditProject] = projectData;
    } else {
        projects.push(projectData);
    }
    
    saveDataQueued();
    render();
    closeModal('projectModal');
    showToast('Project saved successfully', 'success');
}

// Update client project count
async function updateClientProjectCount(clientId) {
    if (!clientId) return;
    
    try {
        // Count all projects for this client
        const { count: productionCount } = await supabaseClient
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);
            
        const { count: pipelineCount } = await supabaseClient
            .from('pipeline_projects')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);
        
        const totalProjects = (productionCount || 0) + (pipelineCount || 0);
        
        // Update client record
        await supabaseClient
            .from('clients')
            .update({ total_projects: totalProjects })
            .eq('id', clientId);
            
    } catch (err) {
        console.error('Error updating client stats:', err);
    }
}

// deleteProject function removed - use "Move to Archive" instead (toolbar button)

function updatePhasesList(projectPhases = [], checkAll = false) {
    const list = document.getElementById('phasesList');
    list.innerHTML = '';
    
    const projectPhaseKeys = projectPhases ? projectPhases.map(p => p.key) : [];
    
    // Sort phases according to productionPhaseOrder
    const sortedPhases = Object.entries(productionPhases).sort((a, b) => {
        return productionPhaseOrder.indexOf(a[0]) - productionPhaseOrder.indexOf(b[0]);
    });
    
    sortedPhases.forEach(([key, phase]) => {
        const div = document.createElement('div');
        div.className = 'phase-checkbox';
        
        // For new project (checkAll = true) all are checked
        // For edit check which phases project has
        const isChecked = checkAll || projectPhaseKeys.includes(key);
        
        // ALL PHASES DEFAULT 4 DAYS
        let duration = 4; // Default 4 days for all phases
        
        div.innerHTML = `
            <input type="checkbox" id="phase_${key}" value="${key}" 
                   data-duration="${duration}" ${isChecked ? 'checked' : ''}>
            <div class="phase-color" style="background: ${phase.color}; width: 20px; height: 15px; border-radius: 2px;"></div>
            <label for="phase_${key}">${phase.name} (${duration} days)</label>
        `;
        
        list.appendChild(div);
    });
}

// Handle type selection
function selectProjectType(type) {
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

// Auto-arrange all phases in project (remove overlaps)
function autoArrangePhases(projectIndex) {
    const project = projects[projectIndex];
    if (!project.phases || project.phases.length === 0) return;
    
    // Sort phases by order
    project.phases.sort((a, b) => {
        return productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
    });
    
    // Start from first phase
    let currentDate = new Date(project.phases[0].start);
    
    project.phases.forEach((phase, index) => {
        if (index === 0) {
            // First phase stays where it is
            currentDate = new Date(phase.end);
            currentDate.setDate(currentDate.getDate() + 1);
        } else {
            // Calculate duration in days
            const start = new Date(phase.start);
            const end = new Date(phase.end);
            const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
            
            // Set new start
            phase.start = formatDate(currentDate);
            
            // Calculate new end
            const newEnd = new Date(currentDate);
            newEnd.setDate(newEnd.getDate() + days - 1);
            phase.end = formatDate(newEnd);
            
            // Reset adjustedEnd
            delete phase.adjustedEnd;
            
            // Next phase starts after this one ends
            currentDate = new Date(newEnd);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    saveDataQueued();
    render();
}

// Auto-adjust phases to fit deadline
function autoAdjustPhasesToDeadline(project, startDate, deadlineDate) {
    if (!project.phases || project.phases.length === 0) return;
    
    // Oblicz dostępne dni robocze
    const availableWorkDays = workingDaysBetween(startDate, deadlineDate);
    const phasesCount = project.phases.length;
    
    // Rozłóż dni równomiernie
    const baseDaysPerPhase = Math.floor(availableWorkDays / phasesCount);
    const extraDays = availableWorkDays % phasesCount;
    
    // Sortuj fazy według kolejności
    project.phases.sort((a, b) => {
        return productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
    });
    
    let currentStart = new Date(startDate);
    
    // Pomiń niedzielę jeśli startujemy w niedzielę
    while (isWeekend(currentStart)) {
        currentStart.setDate(currentStart.getDate() + 1);
    }
    
    // Przypisz dni każdej fazie
    project.phases.forEach((phase, index) => {
        // Oblicz dni dla tej fazy (niektóre dostaną +1 dzień)
        const phaseDays = baseDaysPerPhase + (index < extraDays ? 1 : 0);
        
        // Ustaw start fazy
        phase.start = formatDate(currentStart);
        
        // Ustaw workDays
        phase.workDays = Math.max(1, phaseDays);
        
        // Oblicz koniec fazy
        const phaseEnd = phaseDays <= 1 ? 
            new Date(currentStart) : 
            addWorkingDays(currentStart, phaseDays - 1);
        
        // Następna faza zaczyna się dzień po końcu tej
        currentStart = new Date(phaseEnd);
        currentStart.setDate(currentStart.getDate() + 1);
        
        // Pomiń niedziele
        while (isWeekend(currentStart)) {
            currentStart.setDate(currentStart.getDate() + 1);
        }
    });
}

// ========== MOVE TO ARCHIVE ==========
function openMoveToArchiveModal() {
    updateCompletedProjectSelect();
    openModal('moveToArchiveModal');
}

function updateCompletedProjectSelect() {
    const select = document.getElementById('completedProjectSelect');
    select.innerHTML = '<option value="">Select project...</option>';
    
    projects.forEach((project, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${project.projectNumber} - ${project.name}`;
        select.appendChild(option);
    });
}

async function confirmMoveToArchive() {
    const selectedIndex = document.getElementById('completedProjectSelect').value;
    const reason = document.getElementById('archiveReason').value;
    const notes = document.getElementById('archiveNotes').value.trim();
    const budgetSameAsQuote = document.getElementById('budgetSameAsQuote').checked;
    const actualFinalValue = parseFloat(document.getElementById('actualFinalValue').value) || null;
    
    if (!selectedIndex) {
        showToast('Please select a project to archive', 'warning');
        return;
    }
    
    const projectIndex = parseInt(selectedIndex);
    if (!projects[projectIndex]) {
        showToast('Project not found', 'info');
        return;
    }
    
    const project = projects[projectIndex];
    
    // NOWE: Sprawdź czy wszystkie materiały mają usage_recorded = true
    if (project.id) {
        try {
            const { data: uncheckedMaterials, error } = await supabaseClient
                .from('project_materials')
                .select('item_name, quantity_needed, unit')
                .eq('project_id', project.id)
                .eq('usage_recorded', false);
            
            if (error) throw error;
            
            if (uncheckedMaterials && uncheckedMaterials.length > 0) {
                const materialsList = uncheckedMaterials.map(m => 
                    `- ${m.item_name} (${m.quantity_needed} ${m.unit})`
                ).join('\n');
                
                showToast('Cannot archive! Some materials not confirmed as used. Check Materials List.', 'error');
                return;
            }
        } catch (err) {
            console.error('Error checking materials:', err);
            showToast('Error checking materials status. Please try again.', 'error');
            return;
        }
    }
    
    // Walidacja: jeśli completed i nie zaznaczono "same as quote", musi być actual value
    if (reason === 'completed' && !budgetSameAsQuote && !actualFinalValue) {
        showToast('Please enter the actual final value or confirm that budget was same as quote', 'warning');
        return;
    }
    
    // Znajdź workers przypisanych do faz timber i spray (główny segment)
    let timberWorkerId = null;
    let sprayWorkerId = null;
    
    if (project.phases) {
        // Znajdź pierwszy segment (segment_no = 1) lub najwcześniejszy
        const timberPhase = project.phases.find(p => p.key === 'timber' && (p.segmentNo || 1) === 1)
                         || project.phases.find(p => p.key === 'timber');
        const sprayPhase = project.phases.find(p => p.key === 'spray' && (p.segmentNo || 1) === 1)
                        || project.phases.find(p => p.key === 'spray');
        
        if (timberPhase && timberPhase.assignedTo) timberWorkerId = timberPhase.assignedTo;
        if (sprayPhase && sprayPhase.assignedTo) sprayWorkerId = sprayPhase.assignedTo;
    }
    
    // Określ actual_value
    let finalActualValue = null;
    if (reason === 'completed') {
        if (budgetSameAsQuote) {
            finalActualValue = project.contract_value || 0;
        } else {
            finalActualValue = actualFinalValue;
        }
    }
    
    // Przygotuj dane do archiwum
    const archivedProject = {
        project_number: project.projectNumber,
        name: project.name,
        type: project.type,
        client_id: project.client_id,
        google_drive_url: project.google_drive_url || null,
        google_drive_folder_id: project.google_drive_folder_id || null,
        timber_worker_id: timberWorkerId,
        spray_worker_id: sprayWorkerId,
        admin_id: null, // na przyszłość
        sales_person_id: null, // na przyszłość
        contract_value: project.contract_value || 0,
        actual_value: finalActualValue,
        project_cost: project.project_cost || 0,
        deadline: project.deadline || null,
        created_at: project.created_at || new Date().toISOString(),
        archived_date: new Date().toISOString(),
        archive_reason: reason,
        archive_notes: notes || null,
        source: 'production',
        // NAPRAWA PROBLEM #3: Dodaj completed_date
        completed_date: reason === 'completed' ? new Date().toISOString() : null
    };
    
    // Zapisz do bazy
    if (typeof supabaseClient !== 'undefined') {
        try {
            // Check if project number already exists in archive
            const { data: existing } = await supabaseClient
                .from('archived_projects')
                .select('project_number')
                .eq('project_number', project.projectNumber)
                .limit(1);
            
            if (existing && existing.length > 0) {
                showToast(`Cannot archive! Project number ${project.projectNumber} already exists in archive. Please change the project number first.`, 'error');
                return;
            }
            
            const { data, error } = await supabaseClient
                .from('archived_projects')
                .insert([archivedProject]);
            
            if (error) {
                console.error('Error archiving project:', error);
                showToast('Error saving to archive. Please try again.', 'error');
                return;
            }
            
            
            // Skopiuj pliki z project_files do archived_project_files
            const { data: projectFiles, error: fetchFilesError } = await supabaseClient
                .from('project_files')
                .select('*')
                .eq('production_project_id', project.id);
            
            if (fetchFilesError) {
                console.error('Error fetching project files:', fetchFilesError);
            } else if (projectFiles && projectFiles.length > 0) {
                // Przygotuj pliki do zapisu w archived_project_files
                const archivedFiles = projectFiles.map(file => ({
                    project_number: project.projectNumber,
                    file_name: file.file_name,
                    file_path: file.file_path,
                    file_size: file.file_size,
                    file_type: file.file_type,
                    folder_name: file.folder_name,
                    uploaded_at: file.uploaded_at,
                    uploaded_by: file.uploaded_by
                }));
                
                // Zapisz do archived_project_files
                const { error: archiveFilesError } = await supabaseClient
                    .from('archived_project_files')
                    .insert(archivedFiles);
                
                if (archiveFilesError) {
                    console.error('Error archiving project files:', archiveFilesError);
                } else {
                }
                
                // Usuń pliki z project_files
                const { error: deleteFilesError } = await supabaseClient
                    .from('project_files')
                    .delete()
                    .eq('production_project_id', project.id);
                
                if (deleteFilesError) {
                    console.error('Error deleting project files:', deleteFilesError);
                }
            }
            
            // KROK 1: Pobierz ID zarchiwizowanego projektu (potrzebne do materiałów)
            const { data: archivedProjectData, error: fetchArchivedError } = await supabaseClient
                .from('archived_projects')
                .select('id')
                .eq('project_number', project.projectNumber)
                .single();
            
            if (fetchArchivedError || !archivedProjectData) {
                console.error('❌ Error fetching archived project:', fetchArchivedError);
                showToast('ERROR: Could not find archived project. Cannot continue.', 'error');
                return;
            }
            
            const archivedProjectId = archivedProjectData.id;
            
            // KROK 2: Skopiuj materiały do archived_project_materials
            const { data: projectMaterials, error: fetchMaterialsError } = await supabaseClient
                .from('project_materials')
                .select('*')
                .eq('project_id', project.id);
            
            if (fetchMaterialsError) {
                console.error('⚠️ Warning: Error fetching project materials:', fetchMaterialsError);
            } else if (projectMaterials && projectMaterials.length > 0) {
                // Przygotuj materiały do zapisu w archived_project_materials
                const archivedMaterials = projectMaterials.map(mat => ({
                    archived_project_id: archivedProjectId,
                    project_number: project.projectNumber,
                    stock_item_id: mat.stock_item_id,
                    category_id: mat.category_id,
                    subcategory_id: mat.subcategory_id,
                    item_name: mat.item_name,
                    quantity_needed: mat.quantity_needed,
                    quantity_reserved: mat.quantity_reserved,
                    quantity_used: mat.quantity_used,
                    quantity_wasted: mat.quantity_wasted,
                    waste_reason: mat.waste_reason,
                    unit: mat.unit,
                    unit_cost: mat.unit_cost,
                    used_in_stage: mat.used_in_stage,
                    is_bespoke: mat.is_bespoke,
                    bespoke_description: mat.bespoke_description,
                    purchase_link: mat.purchase_link,
                    item_notes: mat.item_notes,
                    supplier_id: mat.supplier_id,
                    usage_recorded: mat.usage_recorded,
                    created_by: mat.created_by
                }));
                
                // Zapisz do archived_project_materials
                const { error: archiveMaterialsError } = await supabaseClient
                    .from('archived_project_materials')
                    .insert(archivedMaterials);
                
                if (archiveMaterialsError) {
                    console.error('❌ CRITICAL: Error archiving project materials:', archiveMaterialsError);
                    showToast('Could not archive project materials: ' + archiveMaterialsError.message, 'error');
                    return;
                } else {
                }
            } else {
            }
            
            // KROK 3: Teraz można bezpiecznie usuwać powiązane rekordy
            
            // 3a. Usuń alerty projektu (project_alerts)
            const { error: deleteAlertsError } = await supabaseClient
                .from('project_alerts')
                .delete()
                .eq('project_id', project.id);
            
            if (deleteAlertsError) {
                console.error('⚠️ Warning: Error deleting project alerts:', deleteAlertsError);
            } else {
            }
            
            // 3b. Usuń statusy przeczytania notatek (project_important_notes_reads)
            const { error: deleteNotesReadsError } = await supabaseClient
                .from('project_important_notes_reads')
                .delete()
                .eq('project_id', project.id);
            
            if (deleteNotesReadsError) {
                console.error('⚠️ Warning: Error deleting notes read status:', deleteNotesReadsError);
            } else {
            }
            
            // 3c. Usuń stock_transactions związane z materiałami projektu
            // Musimy to zrobić PRZED usunięciem project_materials (foreign key)
            const { data: projectMaterialIds } = await supabaseClient
                .from('project_materials')
                .select('id')
                .eq('project_id', project.id);
            
            if (projectMaterialIds && projectMaterialIds.length > 0) {
                const materialIds = projectMaterialIds.map(m => m.id);
                
                const { error: deleteTransactionsError } = await supabaseClient
                    .from('stock_transactions')
                    .delete()
                    .in('project_material_id', materialIds);
                
                if (deleteTransactionsError) {
                    console.error('⚠️ Warning: Error deleting stock transactions:', deleteTransactionsError);
                } else {
                }
            }
            
            // 3d. Usuń materiały projektu (project_materials) - teraz już są w archiwum
            const { error: deleteMaterialsError } = await supabaseClient
                .from('project_materials')
                .delete()
                .eq('project_id', project.id);
            
            if (deleteMaterialsError) {
                console.error('⚠️ Warning: Error deleting project materials:', deleteMaterialsError);
            } else {
            }
            
            // 3e. NAJPIERW skopiuj fazy do archived_project_phases (dla kalkulacji labour)
            const { data: projectPhases, error: fetchPhasesError } = await supabaseClient
                .from('project_phases')
                .select('*')
                .eq('project_id', project.id);
            
            if (fetchPhasesError) {
                console.error('⚠️ Warning: Error fetching project phases:', fetchPhasesError);
            } else if (projectPhases && projectPhases.length > 0) {
                const archivedPhases = projectPhases.map(ph => ({
                    archived_project_id: archivedProjectId,
                    project_number: project.projectNumber,
                    phase_key: ph.phase_key,
                    segment_no: ph.segment_no || 1,
                    start_date: ph.start_date,
                    end_date: ph.end_date,
                    work_days: ph.work_days,
                    status: ph.status,
                    assigned_to: ph.assigned_to,
                    notes: ph.notes,
                    order_position: ph.order_position
                }));
                
                const { error: archivePhasesError } = await supabaseClient
                    .from('archived_project_phases')
                    .insert(archivedPhases);
                
                if (archivePhasesError) {
                    console.error('⚠️ Warning: Error archiving project phases:', archivePhasesError);
                } else {
                }
            } else {
            }
            
            // 3f. Usuń fazy projektu (project_phases)
            const { error: deletePhasesError } = await supabaseClient
                .from('project_phases')
                .delete()
                .eq('project_id', project.id);
            
            if (deletePhasesError) {
                console.error('⚠️ Warning: Error deleting project phases:', deletePhasesError);
            } else {
            }
            
            // KROK 4: Na końcu usuń główny projekt z tabeli projects - KRYTYCZNE!
            // Pobierz świeże ID z bazy na podstawie project_number (lokalne ID może być nieaktualne)
            const { data: freshProject, error: fetchError } = await supabaseClient
                .from('projects')
                .select('id')
                .eq('project_number', project.projectNumber)
                .single();
            
            if (fetchError || !freshProject) {
                showToast('Error: Could not find project in database. It may have been already deleted.', 'warning');
                // Usuń z lokalnej tablicy mimo wszystko
                projects.splice(projectIndex, 1);
                saveDataQueued();
                render();
                closeModal('moveToArchiveModal');
                return;
            }
            
            const { error: deleteError } = await supabaseClient
                .from('projects')
                .delete()
                .eq('id', freshProject.id);
            
            if (deleteError) {
                showToast('Critical Error: Cannot delete project from production. ' + deleteError.message, 'error');
                return; // STOP - nie usuwaj z lokalnej tablicy!
            }
            
            
            // Update client project count
            if (project.client_id) {
                await updateClientProjectCount(project.client_id);
            }
            
        } catch (err) {
            console.error('Database error:', err);
            showToast('Error connecting to database.', 'error');
            return;
        }
    }
    
    // Usuń z lokalnej tablicy - TYLKO jeśli usunięcie z bazy się powiodło
    projects.splice(projectIndex, 1);
    
    saveDataQueued();
    render();
    closeModal('moveToArchiveModal');
    
    const reasonText = document.querySelector(`#archiveReason option[value="${reason}"]`)?.textContent || reason;
    showToast(`Project ${project.projectNumber} archived and removed from production`, 'success');
}

// ========== PROJECT NOTES ==========
function openProductionProjectNotes(index) {
    const project = projects[index];
    if (!project) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'productionProjectNotesModal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px; width: 90%;">
            <div class="modal-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div id="logoPlaceholder" style="width: 60px; height: 60px; border: 2px dashed #555; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #777; font-size: 10px; text-align: center;">
                        LOGO
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: bold;">Project Notes</div>
                        <div style="font-size: 14px; color: #999;">${project.projectNumber} - ${project.name}</div>
                    </div>
                </div>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Notes History</label>
                    <div id="productionProjectNotesHistory" style="min-height: 300px; max-height: 400px; overflow-y: auto; font-size: 14px; background: #2a2a2e; color: #e8e2d5; padding: 10px; border: 1px solid #3e3e42; border-radius: 3px;">
                        ${renderNotesHistoryHTML(project)}
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 15px;">
                    <label>Add New Note</label>
                    <textarea id="productionProjectNewNote" placeholder="Type your note here..." style="min-height: 80px; font-size: 14px;"></textarea>
                    <div style="margin-top: 8px; display: flex; gap: 10px; align-items: center;">
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 13px;">
                            <input type="checkbox" id="productionNoteImportant" style="cursor: pointer;">
                            <span>⚠️ Mark as important</span>
                        </label>
                        <button class="modal-btn" onclick="addProductionProjectNote(${index})" style="background: #4a90e2;">➕ Add Note</button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="closeProductionProjectNotes()">Cancel</button>
                ${project.pdf_url ? 
                    `<button class="modal-btn" onclick="window.open('${project.pdf_url}', '_blank')" style="background: #4a90e2;">📄 Open PDF</button>` : ''
                }
                <button class="modal-btn success" onclick="exportProductionProjectNotesPDF(${index})">📥 Export PDF</button>
                <button class="modal-btn primary" onclick="closeProductionProjectNotes()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Mark important notes as read
    markProductionNotesAsRead(project.id);
}

function closeProductionProjectNotes() {
    const modal = document.getElementById('productionProjectNotesModal');
    if (modal) modal.remove();
}

function parseProjectNotes(notesString) {
    // Parse notes - handle both JSON and legacy TEXT format
    if (!notesString || notesString.trim() === '') {
        return [];
    }
    
    try {
        // Try to parse as JSON
        const parsed = JSON.parse(notesString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        // Legacy TEXT format - return empty (we're starting fresh)
        return [];
    }
}

function renderNotesHistoryHTML(project) {
    const notes = parseProjectNotes(project.notes);
    
    if (notes.length === 0) {
        return '<div style="color: #999; font-style: italic;">No notes yet...</div>';
    }
    
    let html = '';
    
    // Notes are already sorted newest first when added
    notes.forEach(note => {
        html += '<div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #3e3e42;">';
        
        // Author line with optional important icon
        html += '<div style="font-size: 11px; color: #999; margin-bottom: 5px;">';
        if (note.important) {
            html += '<span style="color: #ffa500; font-size: 14px; margin-right: 5px;">⚠️</span>';
        }
        html += `${note.author} : ${note.timestamp}`;
        html += '</div>';
        
        // Note text - bigger and bold, with clickable links
        html += `<div style="font-size: 15px; font-weight: bold; line-height: 1.4; white-space: pre-wrap;">${linkifyText(note.text)}</div>`;
        
        html += '</div>';
    });
    
    return html;
}

function addProductionProjectNote(index) {
    const project = projects[index];
    if (!project) {
        console.error('❌ Project not found at index:', index);
        return;
    }
    
    const newNoteText = document.getElementById('productionProjectNewNote').value.trim();
    
    if (!newNoteText) {
        showToast('Please enter a note before adding.', 'warning');
        return;
    }
    
    const isImportant = document.getElementById('productionNoteImportant').checked;
    const author = window.currentUser?.full_name || window.currentUser?.email || 'Unknown User';
    
    // Format timestamp
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${day}/${month}/${year} ${hours}:${minutes}`;
    
    // Parse existing notes
    const notes = parseProjectNotes(project.notes);
    
    // Create new note object
    const newNote = {
        id: crypto.randomUUID(),
        author: author,
        timestamp: timestamp,
        text: newNoteText,
        important: isImportant
    };
    
    // Add to beginning (newest first)
    notes.unshift(newNote);
    
    // Convert back to JSON string
    const notesJSON = JSON.stringify(notes);
    
    // Update project
    project.notes = notesJSON;
    
    // Save to database
    saveProductionProjectNotesToDB(project, notesJSON);
    
    // Clear inputs
    document.getElementById('productionProjectNewNote').value = '';
    document.getElementById('productionNoteImportant').checked = false;
    
    // Update display
    document.getElementById('productionProjectNotesHistory').innerHTML = renderNotesHistoryHTML(project);
}

async function saveProductionProjectNotesToDB(project, notesJSON) {
    if (typeof supabaseClient !== 'undefined') {
        try {
            const { error } = await supabaseClient
                .from('projects')
                .update({ notes: notesJSON })
                .eq('project_number', project.projectNumber);
            
            if (error) {
                console.error('❌ Error saving notes:', error);
                showToast('Error saving note to database', 'error');
                return;
            }
            
            render();
            
            // Update pulse indicators
            setTimeout(updateImportantNotesPulse, 200);
            
        } catch (err) {
            console.error('❌ Error:', err);
            showToast('Error saving note', 'error');
        }
    } else {
        render();
        
        // Update pulse indicators
        setTimeout(updateImportantNotesPulse, 200);
    }
}

async function exportProductionProjectNotesPDF(index) {
    const project = projects[index];
    if (!project) return;
    
    const notes = parseProjectNotes(project.notes);
    
    if (notes.length === 0) {
        showToast('No notes to export. Please add some notes first.', 'warning');
        return;
    }
    
    // Access jsPDF from global scope
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // PDF Settings
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    
    // Get branding and add logo
    const branding = await getPdfBranding();
    if (branding.logoBase64) {
        try {
            doc.addImage(branding.logoBase64, 'PNG', margin, margin, 30, 30);
        } catch (e) {
            // Fallback - logo placeholder
            doc.setDrawColor(150);
            doc.setLineWidth(1);
            doc.rect(margin, margin, 30, 30);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('LOGO', margin + 15, margin + 17, { align: 'center' });
        }
    } else {
        // No logo - show placeholder
        doc.setDrawColor(150);
        doc.setLineWidth(1);
        doc.rect(margin, margin, 30, 30);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('LOGO', margin + 15, margin + 17, { align: 'center' });
    }
    
    // Header - Project Info
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.setFont(undefined, 'bold');
    doc.text('Project Notes', margin + 40, margin + 10);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`${project.projectNumber} - ${project.name}`, margin + 40, margin + 20);
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, margin + 40, margin + 28);
    
    // Line separator
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 35, pageWidth - margin, margin + 35);
    
    // Notes content
    let yPosition = margin + 45;
    
    notes.forEach((note, idx) => {
        // Check if need new page
        if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = margin;
        }
        
        // Important icon
        if (note.important) {
            doc.setFontSize(12);
            doc.setTextColor(255, 165, 0); // Orange
            doc.text('⚠️', margin, yPosition);
        }
        
        // Author and timestamp - small grey
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.setFont(undefined, 'normal');
        const authorText = `${note.author} : ${note.timestamp}`;
        doc.text(authorText, margin + (note.important ? 8 : 0), yPosition);
        yPosition += 6;
        
        // Note text - larger and bold
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        const splitText = doc.splitTextToSize(note.text, contentWidth);
        splitText.forEach((line) => {
            if (yPosition > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
            }
            doc.text(line, margin, yPosition);
            yPosition += 7;
        });
        
        // Spacing between notes
        yPosition += 8;
        
        // Separator line
        if (idx < notes.length - 1) {
            doc.setDrawColor(200);
            doc.setLineWidth(0.3);
            doc.line(margin, yPosition - 4, pageWidth - margin, yPosition - 4);
        }
    });
    
    // Generate PDF as blob
    const pdfBlob = doc.output('blob');
    
    // Generate filename
    const filename = `${project.projectNumber.replace(/\//g, '-')}-notes.pdf`;
    
    // Helper function for local download
    function downloadLocally() {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('PDF downloaded locally!', 'info');
    }
    
    // Upload to Supabase Storage
    if (typeof supabaseClient !== 'undefined') {
        try {
            const filePath = `production/${filename}`;
            
            
            // Upload file
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('project-documents')
                .upload(filePath, pdfBlob, {
                    contentType: 'application/pdf',
                    upsert: true
                });
            
            if (uploadError) {
                console.error('Upload error:', uploadError);
                showToast('Error uploading PDF. Downloading locally instead.', 'error');
                downloadLocally();
                return;
            }
            
            
            // Get public URL
            const { data: urlData } = supabaseClient.storage
                .from('project-documents')
                .getPublicUrl(filePath);
            
            const pdfUrl = urlData.publicUrl;
            
            // Save URL to database
            const { error: updateError } = await supabaseClient
                .from('projects')
                .update({ pdf_url: pdfUrl })
                .eq('project_number', project.projectNumber);
            
            if (updateError) {
                console.error('Error updating PDF URL:', updateError);
            }
            
            project.pdf_url = pdfUrl;
            
            
            // Re-render to show "Open PDF" button
            render();
            
            showToast('PDF generated and saved successfully!\n\nYou can now access it anytime using the "Open PDF" button.', 'success');
            
            // Refresh modal to show Open PDF button
            closeProductionProjectNotes();
            openProductionProjectNotes(index);
            
        } catch (err) {
            console.error('Storage error:', err);
            showToast('Error uploading to storage. Downloading locally instead.', 'error');
            downloadLocally();
        }
    } else {
        // No Supabase - download locally
        downloadLocally();
    }
}

// ========== IMPORTANT NOTES TRACKING ==========

async function markProductionNotesAsRead(projectId) {
    if (!window.currentUser || typeof supabaseClient === 'undefined') return;
    
    try {
        // First check if record exists
        const { data: existing } = await supabaseClient
            .from('project_important_notes_reads')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', window.currentUser.id)
            .eq('source_table', 'projects')
            .maybeSingle();
        
        if (existing) {
            // Update existing record
            const { error } = await supabaseClient
                .from('project_important_notes_reads')
                .update({ read_at: new Date().toISOString() })
                .eq('id', existing.id);
            
            if (error) {
                console.error('❌ Error updating read status:', error);
            } else {
                render();
                
                // Update pulse indicators
                setTimeout(updateImportantNotesPulse, 200);
            }
        } else {
            // Insert new record
            const { error } = await supabaseClient
                .from('project_important_notes_reads')
                .insert({
                    project_id: projectId,
                    user_id: window.currentUser.id,
                    source_table: 'projects',
                    read_at: new Date().toISOString()
                });
            
            if (error) {
                console.error('❌ Error marking notes as read:', error);
            } else {
                render();
                
                // Update pulse indicators
                setTimeout(updateImportantNotesPulse, 200);
            }
        }
    } catch (err) {
        console.error('❌ Error:', err);
    }
}

async function checkUnreadImportantNotes(project) {
    const notes = parseProjectNotes(project.notes);
    
    // Check if any notes are marked important
    const hasImportantNotes = notes.some(note => note.important);
    
    if (!hasImportantNotes) {
        return false;
    }
    
    if (!window.currentUser || typeof supabaseClient === 'undefined') {
        return true; // Show pulse if can't check
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('project_important_notes_reads')
            .select('read_at')
            .eq('project_id', project.id)
            .eq('user_id', window.currentUser.id)
            .eq('source_table', 'projects')
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error checking read status:', error);
            return false;
        }
        
        // If no record found, notes are unread
        return !data;
        
    } catch (err) {
        console.error('Error:', err);
        return false;
    }
}

// Check all projects and add pulse class to buttons with unread important notes
async function updateImportantNotesPulse() {
    if (!projects || !window.currentUser) return;
    
    for (const project of projects) {
        const hasUnread = await checkUnreadImportantNotes(project);
        const btn = document.getElementById(`notes-btn-${project.id}`);
        
        if (btn) {
            if (hasUnread) {
                btn.classList.add('pulse-important');
            } else {
                btn.classList.remove('pulse-important');
            }
        }
    }
}

// Call this after render
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateImportantNotesPulse, 1000);
});

// ========== OPEN PRODUCTION SHEET ==========
function openProductionSheet(index) {
    const project = projects[index];
    if (!project || !project.id) {
        showToast('Project not found', 'info');
        return;
    }
    
    // Navigate to production-sheet.html with project ID
    window.location.href = `production-sheet.html?project_id=${project.id}&stage=production`;
}