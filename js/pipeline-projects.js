// ========== PIPELINE PROJECT MANAGEMENT ==========

// Convert URLs in text to clickable links
function linkifyTextPipeline(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    return text.replace(urlRegex, (url) => {
        const href = url.startsWith('www.') ? 'https://' + url : url;
        return `<a href="${href}" target="_blank" style="color: #4CAF50; text-decoration: underline;">${url}</a>`;
    });
}

// Sort mode for pipeline
let pipelineSortMode = 'leadtime'; // 'number', 'date', 'leadtime'

// Set pipeline sort mode
function setPipelineSortMode(mode) {
    pipelineSortMode = mode;
    
    // Update active button
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.sort-btn[data-sort="${mode}"]`)?.classList.add('active');
    
    // Re-render pipeline with new sort
    renderPipeline();
}

// Load clients for dropdown
async function loadClientsDropdown() {
    try {
        const { data, error } = await supabaseClient
            .from('clients')
            .select('id, client_number, company_name, contact_person')
            .order('company_name');
        
        const select = document.getElementById('projectClient');
        select.innerHTML = '<option value="">-- Select from database --</option>';
        
        data?.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.client_number} - ${client.company_name || client.contact_person}`;
            select.appendChild(option);
        });
    } catch (err) {
    }
}

// POPRAWIONA FUNKCJA - pobiera numerację z bazy
async function addPipelineProject() {
    currentEditProject = null;
    document.getElementById('projectModalTitle').textContent = 'Add Pipeline Project';
    document.getElementById('projectName').value = '';
    document.getElementById('projectStartDate').value = formatDate(new Date());
    
    // Clear site_address and project_contact
    if (document.getElementById('projectSiteAddress')) {
        document.getElementById('projectSiteAddress').value = '';
    }
    if (document.getElementById('projectContact')) {
        document.getElementById('projectContact').value = '';
    }
    
    // Load clients dropdown
    await loadClientsDropdown();
    
    // POBIERZ NUMERACJĘ Z BAZY DANYCH (sprawdza pipeline_projects, archived_projects, projects.source_pipeline_number)
    if (typeof supabaseClient !== 'undefined') {
        try {
            // Pobierz WSZYSTKIE numery z pipeline_projects
            const { data: allPipeline } = await supabaseClient
                .from('pipeline_projects')
                .select('project_number');
            
            // Pobierz WSZYSTKIE numery z archived_projects (project_number i source_pipeline_number)
            const { data: allArchived } = await supabaseClient
                .from('archived_projects')
                .select('project_number, source_pipeline_number');
            
            // Pobierz source_pipeline_number z projects (skonwertowane pipeline w produkcji)
            const { data: allProjects } = await supabaseClient
                .from('projects')
                .select('source_pipeline_number');
            
            let maxNumber = 0;
            
            // Funkcja pomocnicza do wyciągania numeru PL
            const extractPLNumber = (str) => {
                if (!str) return 0;
                const match = str.match(/PL(\d{3})\//);
                return match ? parseInt(match[1]) : 0;
            };
            
            // Znajdź max numer z pipeline_projects (tylko PL...)
            if (allPipeline) {
                allPipeline.forEach(p => {
                    const num = extractPLNumber(p.project_number);
                    if (num > maxNumber) maxNumber = num;
                });
            }
            
            // Znajdź max numer z archived_projects (project_number i source_pipeline_number)
            if (allArchived) {
                allArchived.forEach(p => {
                    // Sprawdź project_number (dla failed pipeline)
                    const num1 = extractPLNumber(p.project_number);
                    if (num1 > maxNumber) maxNumber = num1;
                    
                    // Sprawdź source_pipeline_number (dla skonwertowanych i zarchiwizowanych)
                    const num2 = extractPLNumber(p.source_pipeline_number);
                    if (num2 > maxNumber) maxNumber = num2;
                });
            }
            
            // Znajdź max numer z projects.source_pipeline_number (skonwertowane, aktywne w produkcji)
            if (allProjects) {
                allProjects.forEach(p => {
                    const num = extractPLNumber(p.source_pipeline_number);
                    if (num > maxNumber) maxNumber = num;
                });
            }
            
            const nextNumber = maxNumber + 1;
            const currentYear = new Date().getFullYear();
            const generatedNumber = `PL${String(nextNumber).padStart(3, '0')}/${currentYear}`;
            document.getElementById('projectNumber').value = generatedNumber;
            
            
        } catch (err) {
            // Fallback - jeśli błąd
            const currentYear = new Date().getFullYear();
            document.getElementById('projectNumber').value = `PL001/${currentYear}`;
        }
    } else {
        // Jeśli nie ma Supabase
        const currentYear = new Date().getFullYear();
        document.getElementById('projectNumber').value = `PL001/${currentYear}`;
    }
    
    // Reset type selection
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    const defaultType = document.querySelector('.type-option[data-type="other"]');
    if (defaultType) {
        defaultType.classList.add('selected');
    }
    
    // For new pipeline project all phases are checked by default
    updatePipelinePhasesList(null, true);
    openModal('projectModal');
}

function editPipelineProject(index) {
    currentEditProject = index;
    const project = pipelineProjects[index];
    
    document.getElementById('projectModalTitle').textContent = 'Edit Pipeline Project';
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectStartDate').value = project.phases[0]?.start || formatDate(new Date());
    document.getElementById('projectNumber').value = project.projectNumber || '';
    document.getElementById('pipelineEstimatedValue').value = project.estimated_value || '';
    
    // Fill site_address and project_contact
    if (document.getElementById('projectSiteAddress')) {
        document.getElementById('projectSiteAddress').value = project.site_address || '';
    }
    if (document.getElementById('projectContact')) {
        document.getElementById('projectContact').value = project.project_contact || '';
    }
    
    // Load clients and select current one
    loadClientsDropdown().then(() => {
        if (project.client_id) {
            document.getElementById('projectClient').value = project.client_id;
        }
    });
    
    // Set selected type
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    const selectedType = project.type || 'other';
    document.querySelector(`.type-option[data-type="${selectedType}"]`).classList.add('selected');
    
    updatePipelinePhasesList(project.phases, false);
    openModal('projectModal');
}

// UPDATED WITH SUPABASE SAVE AND CLIENT_ID + PHASES
async function savePipelineProject() {
    const name = document.getElementById('projectName').value.trim();
    const clientId = document.getElementById('projectClient').value;
    const siteAddress = document.getElementById('projectSiteAddress')?.value?.trim() || '';
    const projectContact = document.getElementById('projectContact')?.value?.trim() || '';
    let startDate = document.getElementById('projectStartDate').value;
    
    // If no date selected, use today
    if (!startDate) {
        startDate = formatDate(new Date());
    }
    
    const projectNumber = document.getElementById('projectNumber').value.trim();
    const estimatedValue = parseFloat(document.getElementById('pipelineEstimatedValue').value) || 0;
    
    // Get selected type
    const selectedTypeElement = document.querySelector('.type-option.selected');
    const projectType = selectedTypeElement ? selectedTypeElement.dataset.type : 'other';
    
    if (!name) {
        showToast('Please enter a project name', 'warning');
        return;
    }
    
    if (!projectNumber) {
        showToast('Please enter a pipeline number', 'warning');
        return;
    }
    
    if (!clientId) {
        showToast('Please select a client from database!', 'warning');
        return;
    }
    
    const selectedPhases = [];
    const checkboxes = document.querySelectorAll('#phasesList input[type="checkbox"]:checked');
    
    let currentDate = new Date(startDate);
    
    // Sort phases according to pipelinePhaseOrder
    const sortedCheckboxes = Array.from(checkboxes).sort((a, b) => {
        return pipelinePhaseOrder.indexOf(a.value) - pipelinePhaseOrder.indexOf(b.value);
    });
    
    sortedCheckboxes.forEach(cb => {
        const phaseKey = cb.value;
        const phaseDuration = parseInt(cb.dataset.duration) || 3;
        
        const phaseStart = new Date(currentDate);
        
        // Snap to Monday if start on Sunday
        while (isWeekend(phaseStart)) {
            phaseStart.setDate(phaseStart.getDate() + 1);
        }
        
        // Calculate end using working days
        const phaseEnd = phaseDuration <= 1 ? 
            new Date(phaseStart) : 
            addWorkingDays(phaseStart, phaseDuration - 1);
        
        const newPhase = {
            key: phaseKey,
            start: formatDate(phaseStart),
            workDays: phaseDuration,
            status: 'notStarted'
        };
        
        // Preserve existing data when editing
        if (currentEditProject !== null) {
            const existingPhase = pipelineProjects[currentEditProject].phases?.find(p => p.key === phaseKey);
            if (existingPhase) {
                if (existingPhase.notes) newPhase.notes = existingPhase.notes;
                if (existingPhase.status) newPhase.status = existingPhase.status;
            }
        }
        
        selectedPhases.push(newPhase);
        
        // Next phase starts day after previous ends
        currentDate = new Date(phaseEnd);
        currentDate.setDate(currentDate.getDate() + 1);
        
        // Skip Sundays for next phase
        while (isWeekend(currentDate)) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    const projectData = {
        projectNumber,
        type: projectType,
        name,
        client_id: clientId,
        estimated_value: estimatedValue,
        site_address: siteAddress,
        project_contact: projectContact,
        phases: selectedPhases
    };
    
    // PRESERVE id when editing
    if (currentEditProject !== null && pipelineProjects[currentEditProject]) {
        if (pipelineProjects[currentEditProject].id) {
            projectData.id = pipelineProjects[currentEditProject].id;
        }
    }
    
    if (currentEditProject !== null) {
        pipelineProjects[currentEditProject] = projectData;
    } else {
        pipelineProjects.push(projectData);
    }
    
    // ========== SAVE TO SUPABASE WITH PHASES ==========
    if (typeof supabaseClient !== 'undefined') {
        try {
            const pipelineForDB = {
                project_number: projectData.projectNumber,
                name: projectData.name,
                type: projectData.type,
                client_id: projectData.client_id,
                estimated_value: projectData.estimated_value || 0,
                site_address: projectData.site_address || '',
                project_contact: projectData.project_contact || '',
                status: 'active',
                notes: null
            };
            
            let savedProject;
            let error;
            
            if (currentEditProject !== null && pipelineProjects[currentEditProject]?.id) {
                // UPDATE existing project
                const existingId = pipelineProjects[currentEditProject].id;
                const result = await supabaseClient
                    .from('pipeline_projects')
                    .update(pipelineForDB)
                    .eq('id', existingId)
                    .select()
                    .single();
                savedProject = result.data;
                error = result.error;
            } else {
                // INSERT new project
                const result = await supabaseClient
                    .from('pipeline_projects')
                    .insert(pipelineForDB)
                    .select()
                    .single();
                savedProject = result.data;
                error = result.error;
                
                // Handle duplicate - try next number
                if (error && error.code === '23505') {
                    // Get new number and retry
                    const newNumber = await getNextPipelineNumberFromDB();
                    pipelineForDB.project_number = newNumber;
                    projectData.projectNumber = newNumber;
                    document.getElementById('projectNumber').value = newNumber;
                    
                    const retryResult = await supabaseClient
                        .from('pipeline_projects')
                        .insert(pipelineForDB)
                        .select()
                        .single();
                    savedProject = retryResult.data;
                    error = retryResult.error;
                }
            }
                
            if (!error && savedProject) {
                
                // IMPORTANT: Update project in array with ID from DB
                projectData.id = savedProject.id;
                if (currentEditProject !== null) {
                    pipelineProjects[currentEditProject].id = savedProject.id;
                } else {
                    pipelineProjects[pipelineProjects.length - 1].id = savedProject.id;
                }
                
                // SAVE PHASES TO DATABASE
                if (projectData.phases && projectData.phases.length > 0) {
                    const phasesResult = await savePhasesToSupabase(
                        savedProject.id,
                        projectData.phases,
                        false  // false = pipeline
                    );
                } else {
                }
                
                // CREATE FOLDER STRUCTURE IN STORAGE (only for NEW projects)
                if (currentEditProject === null) {
                    await createProjectFolders('pipeline', projectData.projectNumber);
                }
                
                // Update client's project count
                await updateClientProjectCount(clientId);
            } else {
            }
        } catch (err) {
        }
    }
    
    // Mark as changed for auto-save
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveDataQueued();
    renderPipeline();
    closeModal('projectModal');
}

// Update client project count
async function updateClientProjectCount(clientId) {
    if (!clientId) return;
    
    try {
        // Count all projects for this client (pipeline + production)
        const { data: pipelineData } = await supabaseClient
            .from('pipeline_projects')
            .select('id')
            .eq('client_id', clientId);
            
        const { data: productionData } = await supabaseClient
            .from('projects')
            .select('id')
            .eq('client_id', clientId);
        
        const totalProjects = (pipelineData?.length || 0) + (productionData?.length || 0);
        
        // Update client record
        await supabaseClient
            .from('clients')
            .update({ total_projects: totalProjects })
            .eq('id', clientId);
            
    } catch (err) {
    }
}

// UPDATED WITH SUPABASE DELETE
async function deletePipelineProject(index) {
    if (confirm('Delete pipeline project "' + pipelineProjects[index].name + '"?')) {
        const projectNumber = pipelineProjects[index].projectNumber;
        const clientId = pipelineProjects[index].client_id;
        
        // Delete from Supabase if connected
        if (projectNumber && typeof supabaseClient !== 'undefined') {
            try {
                const { data: project } = await supabaseClient
                    .from('pipeline_projects')
                    .select('id')
                    .eq('project_number', projectNumber)
                    .single();
                
                if (project) {
                    // Delete phases first
                    await supabaseClient
                        .from('pipeline_phases')
                        .delete()
                        .eq('pipeline_project_id', project.id);
                    
                    // Delete project
                    const { error } = await supabaseClient
                        .from('pipeline_projects')
                        .delete()
                        .eq('project_number', projectNumber);
                        
                    if (error) {
                    } else {
                        
                        // Update client project count
                        await updateClientProjectCount(clientId);
                    }
                }
            } catch (err) {
            }
        }
        
        // Delete locally
        pipelineProjects.splice(index, 1);
        
        // Mark as changed for auto-save
        if (typeof markAsChanged === 'function') {
            markAsChanged();
        }
        
        saveDataQueued();
        renderPipeline();
    }
}

function updatePipelinePhasesList(projectPhases = [], checkAll = false) {
    const list = document.getElementById('phasesList');
    list.innerHTML = '';
    
    const projectPhaseKeys = projectPhases ? projectPhases.map(p => p.key) : [];
    
    // Sort phases according to pipelinePhaseOrder
    const sortedPhases = Object.entries(pipelinePhases).sort((a, b) => {
        return pipelinePhaseOrder.indexOf(a[0]) - pipelinePhaseOrder.indexOf(b[0]);
    });
    
    sortedPhases.forEach(([key, phase]) => {
        const div = document.createElement('div');
        div.className = 'phase-checkbox';
        
        // For new project (checkAll = true) all are checked
        // For edit check which phases project has
        const isChecked = checkAll || projectPhaseKeys.includes(key);
        
        // Default 3 days for pipeline phases
        let duration = 3;
        
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

// ========== PIPELINE FINISHED MODAL ==========
function openPipelineFinishedModal() {
    updatePipelineProjectSelect();
    openModal('pipelineFinishedModal');
}

function updatePipelineProjectSelect() {
    const select = document.getElementById('pipelineProjectSelect');
    select.innerHTML = '<option value="">Select project...</option>';
    
    pipelineProjects.forEach((project, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${project.projectNumber} - ${project.name}`;
        select.appendChild(option);
    });
}

// Convert pipeline to production with CLIENT_ID and PHASES
async function convertToProduction() {
    const selectedIndex = document.getElementById('pipelineProjectSelect').value;
    const deadline = document.getElementById('productionDeadline').value;
    
    if (!selectedIndex) {
        showToast('Please select a pipeline project', 'warning');
        return;
    }
    
    if (!deadline) {
        showToast('Please set production deadline from contract!', 'warning');
        return;
    }
    
    const pipelineProject = pipelineProjects[parseInt(selectedIndex)];
    
    // Check if deadline is not in past
    const today = new Date();
    today.setHours(0,0,0,0);
    const deadlineDate = new Date(deadline);
    
    if (deadlineDate < today) {
        showToast('Deadline cannot be in the past!', 'info');
        return;
    }
    
    // Get next production number from Supabase
    let productionProjectNumber;
    
    if (typeof supabaseClient !== 'undefined') {
        try {
            // Sprawdź ostatni numer w projects
            const { data: allProjects } = await supabaseClient
                .from('projects')
                .select('project_number');
            
            // Sprawdź numery w archived_projects (production - bez PL prefix)
            const { data: allArchived } = await supabaseClient
                .from('archived_projects')
                .select('project_number');
            
            let maxNumber = 0;
            
            // Znajdź max numer z projects
            if (allProjects) {
                allProjects.forEach(p => {
                    const match = p.project_number?.match(/^(\d{3})\//);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (num > maxNumber) maxNumber = num;
                    }
                });
            }
            
            // Znajdź max numer z archived_projects (bez PL)
            if (allArchived) {
                allArchived.forEach(p => {
                    // Pomiń numery zaczynające się od PL
                    if (p.project_number?.startsWith('PL')) return;
                    const match = p.project_number?.match(/^(\d{3})\//);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (num > maxNumber) maxNumber = num;
                    }
                });
            }
            
            const nextNumber = maxNumber + 1;
            const year = new Date().getFullYear();
            productionProjectNumber = `${String(nextNumber).padStart(3, '0')}/${year}`;
            
            
        } catch (err) {
            const year = new Date().getFullYear();
            productionProjectNumber = `001/${year}`;
        }
    } else {
        // Fallback to localStorage
        let currentLastNumber = parseInt(localStorage.getItem('joineryLastProjectNumber') || '0');
        currentLastNumber++;
        localStorage.setItem('joineryLastProjectNumber', currentLastNumber);
        
        const year = new Date().getFullYear();
        const number = String(currentLastNumber).padStart(3, '0');
        productionProjectNumber = `${number}/${year}`;
    }
    
    // Create phases
    const phases = createProductionPhases(new Date());
    
    // Check if we have enough days for all phases
    const availableWorkDays = workingDaysBetween(today, deadlineDate);
    if (availableWorkDays < phases.length) {
        showToast(`Deadline too short! Need at least ${phases.length} working days for ${phases.length} phases.`, 'info');
        return;
    }
    
    const productionProject = {
        projectNumber: productionProjectNumber,
        type: pipelineProject.type,
        name: pipelineProject.name,
        client_id: pipelineProject.client_id,
        site_address: pipelineProject.site_address || '',
        project_contact: pipelineProject.project_contact || '',
        deadline: deadline,
        phases: phases
    };
    
    // Auto-adjust phases to deadline - WŁĄCZONE!
    autoAdjustPhasesToDeadline(productionProject, today, deadlineDate);
    
    // Add to production projects (cross-page save)
    let productionProjects = JSON.parse(localStorage.getItem('joineryProjects') || '[]');
    productionProjects.push(productionProject);
    localStorage.setItem('joineryProjects', JSON.stringify(productionProjects));
    
    // Save to production DB with client_id and phases
    if (typeof supabaseClient !== 'undefined') {
        try {
            // SPRAWDŹ CZY PROJEKT JUŻ ISTNIEJE
            const { data: existingProject } = await supabaseClient
                .from('projects')
                .select('id, project_number')
                .eq('project_number', productionProject.projectNumber)
                .maybeSingle();
            
            let projectToSave;
            
            if (existingProject) {
                projectToSave = existingProject;
            } else {
                // Projekt nie istnieje - utwórz nowy
                const { data: savedProject, error } = await supabaseClient
                    .from('projects')
                    .insert([{
                        project_number: productionProject.projectNumber,
                        type: productionProject.type,
                        name: productionProject.name,
                        client_id: productionProject.client_id,
                        site_address: productionProject.site_address || '',
                        project_contact: productionProject.project_contact || '',
                        deadline: productionProject.deadline,
                        status: 'active',
                        notes: pipelineProject.notes || null,
                        contract_value: pipelineProject.estimated_value || 0,
                        source_pipeline_number: pipelineProject.projectNumber // Zachowaj oryginalny numer PL
                    }])
                    .select()
                    .single();
                
                if (error) {
                    showToast(`Error saving project: ${error.message}`, 'error');
                    return;
                }
                
                projectToSave = savedProject;
            }
            
            // ZAPISZ FAZY - zawsze, niezależnie czy projekt był nowy czy istniejący
            
            const phaseSaveResult = await savePhasesToSupabase(
                projectToSave.id,
                productionProject.phases,
                true  // true = production
            );
            
            
            if (phaseSaveResult) {
            } else {
                showToast('Warning: Project saved but phases failed to save!', 'error');
            }
            
            await updateClientProjectCount(productionProject.client_id);
            
            // PRZENIEŚ PLIKI Z PIPELINE DO PRODUCTION
            const { data: pipelineDbProject } = await supabaseClient
                .from('pipeline_projects')
                .select('id')
                .eq('project_number', pipelineProject.projectNumber)
                .single();
            
            if (pipelineDbProject && projectToSave) {
                await moveProjectFiles(
                    pipelineDbProject.id,           // pipeline project ID
                    projectToSave.id,               // production project ID
                    pipelineProject.projectNumber,  // PL001-2025
                    productionProjectNumber         // 001/2025
                );
            }
            
        } catch (err) {
        }
    }
    
    // Remove from pipeline
    pipelineProjects.splice(parseInt(selectedIndex), 1);
    localStorage.setItem('joineryPipelineProjects', JSON.stringify(pipelineProjects));
    
    // Delete from pipeline DB
    if (typeof supabaseClient !== 'undefined') {
        const { data: project } = await supabaseClient
            .from('pipeline_projects')
            .select('id')
            .eq('project_number', pipelineProject.projectNumber)
            .single();
        
        if (project) {
            // Delete pipeline phases
            await supabaseClient
                .from('pipeline_phases')
                .delete()
                .eq('pipeline_project_id', project.id);
            
            // Delete pipeline project
            await supabaseClient
                .from('pipeline_projects')
                .delete()
                .eq('project_number', pipelineProject.projectNumber);
                
        }
    }
    
    renderPipeline();
    closeModal('pipelineFinishedModal');
    
    showToast(`Project converted to production: ${productionProject.projectNumber}\nDeadline: ${deadline}\nClient transferred.\nPlease go to Production page to see it.`, 'warning');
}

// Archive as failed
async function archiveAsFailed() {
    const selectedIndex = document.getElementById('pipelineProjectSelect').value;
    const failedReason = document.getElementById('failedReason').value.trim();
    
    if (!selectedIndex) {
        showToast('Please select a pipeline project', 'warning');
        return;
    }
    
    const pipelineProject = pipelineProjects[parseInt(selectedIndex)];
    
    // Przygotuj dane do archiwum
    const archivedProject = {
        project_number: pipelineProject.projectNumber,
        name: pipelineProject.name,
        type: pipelineProject.type,
        client_id: pipelineProject.client_id,
        google_drive_url: pipelineProject.google_drive_url || null,
        google_drive_folder_id: pipelineProject.google_drive_folder_id || null,
        timber_worker_id: null,
        spray_worker_id: null,
        admin_id: null,
        sales_person_id: null,
        contract_value: pipelineProject.estimated_value || 0,
        deadline: null,
        created_at: pipelineProject.created_at || new Date().toISOString(),
        archived_date: new Date().toISOString(),
        archive_reason: 'failed',
        archive_notes: failedReason || 'Pipeline failed',
        source: 'pipeline',
        // NAPRAWA PROBLEM #3: completed_date = null dla failed projects
        completed_date: null
    };
    
    // Zapisz do bazy
    if (typeof supabaseClient !== 'undefined') {
        try {
            const { data, error } = await supabaseClient
                .from('archived_projects')
                .insert([archivedProject]);
            
            if (error) {
                showToast('Error saving to archive. Please try again.', 'error');
                return;
            }
            
            
            // Skopiuj pliki z project_files do archived_project_files
            const { data: projectFiles, error: fetchFilesError } = await supabaseClient
                .from('project_files')
                .select('*')
                .eq('pipeline_project_id', pipelineProject.id);
            
            if (fetchFilesError) {
            } else if (projectFiles && projectFiles.length > 0) {
                // Przygotuj pliki do zapisu w archived_project_files
                const archivedFiles = projectFiles.map(file => ({
                    project_number: pipelineProject.projectNumber,
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
                } else {
                }
                
                // Usuń pliki z project_files
                const { error: deleteFilesError } = await supabaseClient
                    .from('project_files')
                    .delete()
                    .eq('pipeline_project_id', pipelineProject.id);
                
                if (deleteFilesError) {
                }
            }
            
            // Usuń projekt z tabeli pipeline_projects
            const { error: deleteError } = await supabaseClient
                .from('pipeline_projects')
                .delete()
                .eq('project_number', pipelineProject.projectNumber);
            
            if (deleteError) {
            }
            
            // Update client project count
            if (pipelineProject.client_id) {
                await updateClientProjectCount(pipelineProject.client_id);
            }
            
        } catch (err) {
            showToast('Error connecting to database.', 'error');
            return;
        }
    }
    
    // Usuń z lokalnej tablicy
    pipelineProjects.splice(parseInt(selectedIndex), 1);
    
    // Mark as changed for auto-save
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveDataQueued();
    renderPipeline();
    closeModal('pipelineFinishedModal');
    
    showToast(`Project archived as failed: ${pipelineProject.projectNumber}`, 'error');
}

async function archiveAsCanceled() {
    const selectedIndex = document.getElementById('pipelineProjectSelect').value;
    const cancelledReason = document.getElementById('cancelledReason').value.trim();
    
    if (!selectedIndex) {
        showToast('Please select a pipeline project', 'warning');
        return;
    }
    
    const pipelineProject = pipelineProjects[parseInt(selectedIndex)];
    
    // Przygotuj dane do archiwum
    const archivedProject = {
        project_number: pipelineProject.projectNumber,
        name: pipelineProject.name,
        type: pipelineProject.type,
        client_id: pipelineProject.client_id,
        google_drive_url: pipelineProject.google_drive_url || null,
        google_drive_folder_id: pipelineProject.google_drive_folder_id || null,
        timber_worker_id: null,
        spray_worker_id: null,
        admin_id: null,
        sales_person_id: null,
        contract_value: pipelineProject.estimated_value || 0,
        deadline: null,
        created_at: pipelineProject.created_at || new Date().toISOString(),
        archived_date: new Date().toISOString(),
        archive_reason: 'cancelled',
        archive_notes: cancelledReason || 'Client cancelled',
        source: 'pipeline',
        // NAPRAWA PROBLEM #3: completed_date = null dla cancelled
        completed_date: null
    };
    
    // Zapisz do bazy
    if (typeof supabaseClient !== 'undefined') {
        try {
            const { data, error } = await supabaseClient
                .from('archived_projects')
                .insert([archivedProject]);
            
            if (error) {
                showToast('Error saving to archive. Please try again.', 'error');
                return;
            }
            
            
            // Skopiuj pliki z project_files do archived_project_files
            const { data: projectFiles, error: fetchFilesError } = await supabaseClient
                .from('project_files')
                .select('*')
                .eq('pipeline_project_id', pipelineProject.id);
            
            if (fetchFilesError) {
            } else if (projectFiles && projectFiles.length > 0) {
                // Przygotuj pliki do zapisu w archived_project_files
                const archivedFiles = projectFiles.map(file => ({
                    project_number: pipelineProject.projectNumber,
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
                } else {
                }
                
                // Usuń pliki z project_files
                const { error: deleteFilesError } = await supabaseClient
                    .from('project_files')
                    .delete()
                    .eq('pipeline_project_id', pipelineProject.id);
                
                if (deleteFilesError) {
                }
            }
            
            // Usuń projekt z tabeli pipeline_projects
            const { error: deleteError } = await supabaseClient
                .from('pipeline_projects')
                .delete()
                .eq('project_number', pipelineProject.projectNumber);
            
            if (deleteError) {
            }
            
            // Update client project count
            if (pipelineProject.client_id) {
                await updateClientProjectCount(pipelineProject.client_id);
            }
            
        } catch (err) {
            showToast('Error connecting to database.', 'error');
            return;
        }
    }
    
    // Usuń z lokalnej tablicy
    pipelineProjects.splice(parseInt(selectedIndex), 1);
    
    // Mark as changed
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveDataQueued();
    renderPipeline();
    closeModal('pipelineFinishedModal');
    
    showToast(`Project archived as cancelled: ${pipelineProject.projectNumber}`, 'info');
}

// Create production phases
function createProductionPhases(startDate) {
    const phases = [];
    let currentDate = new Date(startDate);
    
    // Production phases (without deliveryGlazing)
    const productionPhaseKeys = ['siteSurvey', 'md', 'order', 'timber', 'orderGlazing', 'orderSpray', 'spray', 'glazing', 'qc', 'dispatch'];
    
    productionPhaseKeys.forEach(phaseKey => {
        const phaseDuration = 4; // Default 4 days for all phases
        
        const phaseStart = new Date(currentDate);
        
        // Snap to Monday if Sunday
        while (phaseStart.getDay() === 0) {
            phaseStart.setDate(phaseStart.getDate() + 1);
        }
        
        const newPhase = {
            key: phaseKey,
            start: formatDate(phaseStart),
            workDays: phaseDuration,
            status: 'notStarted'
        };
        
        phases.push(newPhase);
        
        // Next phase starts after 4 days
        currentDate = new Date(phaseStart);
        currentDate.setDate(currentDate.getDate() + phaseDuration + 1);
        
        // Skip Sundays
        while (currentDate.getDay() === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    return phases;
}

// Helper functions
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function workingDaysBetween(startDate, endDate) {
    let count = 0;
    let current = new Date(startDate);
    while (current <= endDate) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) { // not Sunday and not Saturday
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function addWorkingDays(startDate, days) {
    let result = new Date(startDate);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay();
        if (day !== 0 && day !== 6) { // not Sunday and not Saturday
            added++;
        }
    }
    return result;
}

function autoAdjustPhasesToDeadline(project, startDate, deadlineDate) {
    if (!project.phases || project.phases.length === 0) return;
    
    const availableWorkDays = workingDaysBetween(startDate, deadlineDate);
    const phasesCount = project.phases.length;
    
    const baseDaysPerPhase = Math.floor(availableWorkDays / phasesCount);
    const extraDays = availableWorkDays % phasesCount;
    
    project.phases.sort((a, b) => {
        return productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
    });
    
    let currentStart = new Date(startDate);
    
    while (currentStart.getDay() === 0) {
        currentStart.setDate(currentStart.getDate() + 1);
    }
    
    project.phases.forEach((phase, index) => {
        const phaseDays = baseDaysPerPhase + (index < extraDays ? 1 : 0);
        
        phase.start = formatDate(currentStart);
        phase.workDays = Math.max(1, phaseDays);
        
        const phaseEnd = phaseDays <= 1 ? 
            new Date(currentStart) : 
            addWorkingDays(currentStart, phaseDays - 1);
        
        currentStart = new Date(phaseEnd);
        currentStart.setDate(currentStart.getDate() + 1);
        
        while (currentStart.getDay() === 0) {
            currentStart.setDate(currentStart.getDate() + 1);
        }
    });
}

// Fallback function for old localStorage method
function getNextPipelineNumber() {
    const currentYear = new Date().getFullYear();
    lastPipelineNumber = parseInt(localStorage.getItem('lastPipelineNumber') || '0');
    lastPipelineNumber++;
    localStorage.setItem('lastPipelineNumber', lastPipelineNumber);
    return `PL${String(lastPipelineNumber).padStart(3, '0')}/${currentYear}`;
}

// Async function to get next pipeline number from database
async function getNextPipelineNumberFromDB() {
    try {
        // Get all numbers from pipeline_projects
        const { data: allPipeline } = await supabaseClient
            .from('pipeline_projects')
            .select('project_number');
        
        // Get all numbers from archived_projects
        const { data: allArchived } = await supabaseClient
            .from('archived_projects')
            .select('project_number');
        
        let maxNumber = 0;
        
        // Find max from pipeline_projects (only PL...)
        if (allPipeline) {
            allPipeline.forEach(p => {
                if (!p.project_number) return;
                const match = p.project_number.match(/PL(\d{3})\//);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num > maxNumber) maxNumber = num;
                }
            });
        }
        
        // Find max from archived_projects (only PL...)
        if (allArchived) {
            allArchived.forEach(p => {
                if (!p.project_number) return;
                if (!p.project_number.startsWith('PL')) return;
                const match = p.project_number.match(/PL(\d{3})\//);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num > maxNumber) maxNumber = num;
                }
            });
        }
        
        const nextNumber = maxNumber + 1;
        const currentYear = new Date().getFullYear();
        return `PL${String(nextNumber).padStart(3, '0')}/${currentYear}`;
        
    } catch (err) {
        return getNextPipelineNumber(); // Fallback to localStorage
    }
}

// Open project notes modal
function openPipelineProjectNotes(index) {
    const project = pipelineProjects[index];
    if (!project) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'pipelineProjectNotesModal';
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
                    <div id="pipelineProjectNotesHistory" style="min-height: 300px; max-height: 400px; overflow-y: auto; font-size: 14px; background: #2a2a2e; color: #e8e2d5; padding: 10px; border: 1px solid #3e3e42; border-radius: 3px; white-space: pre-wrap;">${formatPipelineNotesHistoryHTML(project.notes || '')}</div>
                </div>
                
                <div class="form-group" style="margin-top: 15px;">
                    <label>Add New Note</label>
                    <textarea id="pipelineProjectNewNote" placeholder="Type your note here..." style="min-height: 80px; font-size: 14px;"></textarea>
                    <div style="margin-top: 8px; display: flex; gap: 10px; align-items: center;">
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 13px;">
                            <input type="checkbox" id="pipelineNoteImportant" style="cursor: pointer;">
                            <span>⚠️ Mark as important</span>
                        </label>
                        <button class="modal-btn" onclick="addPipelineProjectNote(${index})" style="background: #4a90e2;">➕ Add Note</button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="closePipelineProjectNotes()">Cancel</button>
                ${project.pdf_url ? 
                    `<button class="modal-btn" onclick="window.open('${project.pdf_url}', '_blank')" style="background: #4a90e2;">📄 Open PDF</button>` : ''
                }
                <button class="modal-btn success" onclick="exportPipelineProjectNotesPDF(${index})">📥 Export PDF</button>
                <button class="modal-btn primary" onclick="savePipelineProjectNotes(${index})">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closePipelineProjectNotes() {
    const modal = document.getElementById('pipelineProjectNotesModal');
    if (modal) modal.remove();
}

async function savePipelineProjectNotes(index) {
    // Notes are now saved immediately when added
    // This function just closes the modal
    closePipelineProjectNotes();
}

async function exportPipelineProjectNotesPDF(index) {
    const project = pipelineProjects[index];
    if (!project) return;
    
    const notes = project.notes ? project.notes.trim() : '';
    
    if (!notes) {
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
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');
    
    const splitNotes = doc.splitTextToSize(notes, contentWidth);
    let yPosition = margin + 45;
    
    splitNotes.forEach((line) => {
        if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += 7;
    });
    
    // Generate PDF as blob
    const pdfBlob = doc.output('blob');
    
    // Generate filename
    const filename = `${project.projectNumber.replace(/\//g, '-')}-notes.pdf`;
    
    // Upload to Supabase Storage
    if (typeof supabaseClient !== 'undefined') {
        try {
            const filePath = `pipeline/${filename}`;
            
            
            // Upload file
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('project-documents')
                .upload(filePath, pdfBlob, {
                    contentType: 'application/pdf',
                    upsert: true
                });
            
            if (uploadError) {
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
                .from('pipeline_projects')
                .update({ pdf_url: pdfUrl })
                .eq('project_number', project.projectNumber);
            
            if (updateError) {
            }
            
            project.pdf_url = pdfUrl;
            
            
            // Re-render to show "Open PDF" button
            renderPipeline();
            
            showToast('PDF generated and saved successfully!\n\nYou can now access it anytime using the "Open PDF" button.', 'success');
            
            // Open PDF in new tab
            window.open(pdfUrl, '_blank');
            
        } catch (err) {
            showToast('Error uploading PDF. Downloading locally instead.', 'error');
            downloadLocally();
        }
    } else {
        downloadLocally();
    }
    
    function downloadLocally() {
        doc.save(filename);
    }
}

// ========== AUTO-CREATE FOLDER STRUCTURE IN STORAGE ==========
async function createProjectFolders(stage, projectNumber) {
    // stage = 'pipeline' | 'production' | 'archive'
    // projectNumber = 'PL001/2025' | '001/2025'
    
    // Convert slash to dash for folder name
    const folderName = projectNumber.replace(/\//g, '-');
    
    const subfolders = ['estimates', 'drawings', 'photos', 'emails', 'notes', 'others'];
    
    
    try {
        for (const subfolder of subfolders) {
            const folderPath = `${stage}/${folderName}/${subfolder}/.keep`;
            
            // Upload empty .keep file to create folder structure
            const { error } = await supabaseClient.storage
                .from('project-documents')
                .upload(folderPath, new Blob([''], { type: 'text/plain' }), {
                    contentType: 'text/plain',
                    upsert: false
                });
            
            if (error && error.message !== 'The resource already exists') {
            }
        }
        
    } catch (err) {
    }
}

// ========== MOVE PROJECT FILES BETWEEN STAGES ==========
async function moveProjectFiles(pipelineProjectId, productionProjectId, oldProjectNumber, newProjectNumber) {
    if (typeof supabaseClient === 'undefined') {
        return;
    }
    
    try {
        // Pipeline używa formatu "PL039-2025" w Storage, ale "PL039/2025" w bazie
        // Musimy przekonwertować slash na myślnik dla ścieżki Storage
        const oldStoragePath = oldProjectNumber.replace('/', '-');
        const newStoragePath = newProjectNumber.replace('/', '-');
        
        
        // 1. Lista wszystkich plików w folderze pipeline
        const { data: filesList, error: listError } = await supabaseClient.storage
            .from('project-documents')
            .list(`pipeline/${oldStoragePath}`, {
                limit: 1000,
                sortBy: { column: 'name', order: 'asc' }
            });
        
        if (listError) {
            return;
        }
        
        if (!filesList || filesList.length === 0) {
            return;
        }
        
        
        // 2. Przenoszenie plików rekursywnie (obsługa 3 poziomów głębokości)
        let movedCount = 0;
        
        // Helper function do przenoszenia pojedynczego pliku
        async function moveFile(oldPath, newPath, fileName) {
            const { error: copyError } = await supabaseClient.storage
                .from('project-documents')
                .copy(oldPath, newPath);
            
            if (copyError) {
                return false;
            } else {
                // Usuń oryginalny plik po skopiowaniu
                await supabaseClient.storage
                    .from('project-documents')
                    .remove([oldPath]);
                return true;
            }
        }
        
        for (const item of filesList) {
            if (item.id === null) {
                // To jest folder (poziom 1: drawings, photos, etc.)
                const subfolderName = item.name;
                const { data: subFiles, error: subError } = await supabaseClient.storage
                    .from('project-documents')
                    .list(`pipeline/${oldStoragePath}/${subfolderName}`, {
                        limit: 1000
                    });
                
                if (subError) {
                    continue;
                }
                
                // Przenieś każdy plik/folder w subfolderze
                for (const file of subFiles) {
                    if (file.id === null) {
                        // To jest podfolder (poziom 2: PDF, DWG wewnątrz drawings/client-drawings)
                        const subSubfolderName = file.name;
                        const { data: subSubFiles, error: subSubError } = await supabaseClient.storage
                            .from('project-documents')
                            .list(`pipeline/${oldStoragePath}/${subfolderName}/${subSubfolderName}`, {
                                limit: 1000
                            });
                        
                        if (subSubError) {
                            continue;
                        }
                        
                        // Przenieś pliki z podfolderu (poziom 3)
                        for (const subSubFile of subSubFiles) {
                            if (subSubFile.id === null) continue; // Skip deeper folders
                            
                            const oldPath = `pipeline/${oldStoragePath}/${subfolderName}/${subSubfolderName}/${subSubFile.name}`;
                            const newPath = `production/${newStoragePath}/${subfolderName}/${subSubfolderName}/${subSubFile.name}`;
                            
                            if (await moveFile(oldPath, newPath, subSubFile.name)) {
                                movedCount++;
                            }
                        }
                    } else {
                        // To jest plik bezpośrednio w subfolderze (poziom 2)
                        const oldPath = `pipeline/${oldStoragePath}/${subfolderName}/${file.name}`;
                        const newPath = `production/${newStoragePath}/${subfolderName}/${file.name}`;
                        
                        if (await moveFile(oldPath, newPath, file.name)) {
                            movedCount++;
                        }
                    }
                }
            } else {
                // To jest plik w głównym folderze (poziom 1)
                const oldPath = `pipeline/${oldStoragePath}/${item.name}`;
                const newPath = `production/${newStoragePath}/${item.name}`;
                
                if (await moveFile(oldPath, newPath, item.name)) {
                    movedCount++;
                }
            }
        }
        
        
        // 3. Aktualizuj rekordy w tabeli project_files
        const { data: fileRecords, error: recordsError } = await supabaseClient
            .from('project_files')
            .select('*')
            .eq('pipeline_project_id', pipelineProjectId);
        
        if (recordsError) {
            return;
        }
        
        if (fileRecords && fileRecords.length > 0) {
            
            for (const record of fileRecords) {
                const newFilePath = record.file_path.replace(
                    `pipeline/${oldStoragePath}`,
                    `production/${newStoragePath}`
                );
                
                const { error: updateError } = await supabaseClient
                    .from('project_files')
                    .update({
                        production_project_id: productionProjectId,
                        pipeline_project_id: null,
                        file_path: newFilePath
                    })
                    .eq('id', record.id);
                
                if (updateError) {
                } else {
                }
            }
            
        }
        
        
    } catch (err) {
    }
}

// ========== NOTES TIMELINE FUNCTIONS ==========

function formatPipelineNotesHistory(notesText) {
    if (!notesText || notesText.trim() === '') {
        return '';
    }
    return notesText.trim();
}

function formatPipelineNotesHistoryHTML(notesText) {
    if (!notesText || notesText.trim() === '') {
        return '<span style="color: #999; font-style: italic;">No notes yet...</span>';
    }
    
    // Split by double newline to get individual notes
    const noteBlocks = notesText.split('\n\n');
    let html = '';
    
    noteBlocks.forEach(block => {
        if (!block.trim()) return;
        
        const lines = block.split('\n');
        html += '<div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #3e3e42;">';
        
        lines.forEach((line, idx) => {
            // First line is author/timestamp
            if (idx === 0 && line.includes(' : ') && /\d{2}\/\d{2}\/\d{4}/.test(line)) {
                html += `<div style="font-size: 11px; color: #999; margin-bottom: 5px;">${line}</div>`;
            } else {
                // Content line with linkify
                html += `<div style="font-size: 15px; font-weight: bold; line-height: 1.4;">${linkifyTextPipeline(line)}</div>`;
            }
        });
        
        html += '</div>';
    });
    
    return html;
}

function addPipelineProjectNote(index) {
    const project = pipelineProjects[index];
    if (!project) {
        return;
    }
    
    const newNoteText = document.getElementById('pipelineProjectNewNote').value.trim();
    
    if (!newNoteText) {
        showToast('Please enter a note before adding.', 'warning');
        return;
    }
    
    const isImportant = document.getElementById('pipelineNoteImportant').checked;
    
    // Get current user
    const author = window.currentUser?.full_name || window.currentUser?.email || 'Unknown User';
    
    // Format timestamp: DD/MM/YYYY HH:MM
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${day}/${month}/${year} ${hours}:${minutes}`;
    
    // Create new note entry with important flag if checked
    const importantPrefix = isImportant ? '⚠️ IMPORTANT: ' : '';
    const newEntry = `${author} : ${timestamp}\n${importantPrefix}${newNoteText}`;
    
    // Prepend to existing notes (newest on top)
    const existingNotes = project.notes || '';
    const updatedNotes = existingNotes ? `${newEntry}\n\n${existingNotes}` : newEntry;
    
    // Update project
    project.notes = updatedNotes;
    
    // Save to database
    savePipelineProjectNotesToDB(index, updatedNotes);
    
    // Clear inputs
    document.getElementById('pipelineProjectNewNote').value = '';
    document.getElementById('pipelineNoteImportant').checked = false;
    
    // Update history display
    document.getElementById('pipelineProjectNotesHistory').innerHTML = formatPipelineNotesHistoryHTML(updatedNotes);
}

async function savePipelineProjectNotesToDB(index, notes) {
    const project = pipelineProjects[index];
    
    if (typeof supabaseClient !== 'undefined') {
        try {
            const { error } = await supabaseClient
                .from('pipeline_projects')
                .update({ notes: notes || null })
                .eq('project_number', project.projectNumber);
            
            if (error) {
                showToast('Error saving note to database', 'error');
                return;
            }
            
            
            // Update render to show note indicator
            renderPipelineProjects();
            
        } catch (err) {
            showToast('Error saving note', 'error');
        }
    } else {
        renderPipelineProjects();
    }
}