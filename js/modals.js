// ========== MODAL MANAGEMENT ==========
let currentEditPhase = null;

// Helper function - emoji dla job_type
function getJobTypeIcon(jobType) {
    const icons = {
        'joiner': '🪚',
        'sprayer': '🎨',
        'prep': '🖌️',
        'glazing': '🪟',
        'labour': '🧹',
        'driver': '🚐',
        'office': '📊',
        'other': '🔧'
    };
    return icons[jobType] || '👤';
}

// Pobieranie pracowników z cache (DataStore) - ZERO zapytań do DB!
async function loadTeamMembersForPhase(phaseKey) {
    try {
        // Użyj DataStore - filtruje lokalnie, nie robi zapytania do DB
        if (typeof DataStore !== 'undefined' && DataStore.getTeamMembersForPhase) {
            const members = await DataStore.getTeamMembersForPhase(phaseKey);
            console.log(`DataStore: ${members.length} members for phase "${phaseKey}"`);
            return members;
        }
        
        // Fallback: użyj globalnej zmiennej teamMembers jeśli DataStore niedostępny
        if (typeof teamMembers !== 'undefined' && teamMembers.length > 0) {
            console.log('Using global teamMembers fallback');
            return filterTeamMembersByPhase(teamMembers, phaseKey);
        }
        
        // Last resort: zapytanie do DB (nie powinno się zdarzyć)
        console.warn('DataStore unavailable - falling back to DB query');
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('id, name, employee_number, color, color_code, job_type, department')
            .eq('active', true)
            .order('name');
        
        if (error) throw error;
        return filterTeamMembersByPhase(data || [], phaseKey);
        
    } catch (err) {
        console.error('Error loading team:', err);
        return [];
    }
}

// Helper: filtruj pracowników lokalnie według fazy
function filterTeamMembersByPhase(members, phaseKey) {
    const departmentMap = {
        'timber': ['production'],
        'glazing': ['production'],
        'spray': ['spray'],
        'dispatch': ['drivers', 'installation'],
        'siteSurvey': ['management', 'admin', 'installation'],
        'md': ['production', 'management', 'admin'],
        'order': ['admin', 'management'],
        'orderGlazing': ['admin', 'management'],
        'orderSpray': ['admin', 'management'],
        'qc': ['production', 'spray']
    };
    
    const allowedDepartments = departmentMap[phaseKey];
    
    if (!allowedDepartments) {
        return members; // Wszystkie dla nieznanych faz
    }
    
    return members.filter(m => 
        allowedDepartments.includes(m.department?.toLowerCase())
    );
}

// Open phase edit modal (double-click on any phase)
function openPhaseEditModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const phaseConfig = phases[phase.key];
    
    // Special handling for Order Materials phase
    if (phase.key === 'order') {
        openOrderMaterialsModal(projectIndex, phaseIndex);
        return;
    }
    
    // Special handling for Order Glazing phase
    if (phase.key === 'orderGlazing') {
        openOrderGlazingModal(projectIndex, phaseIndex);
        return;
    }
    
    // Special handling for Order Spray Materials phase
    if (phase.key === 'orderSpray') {
        openOrderSprayModal(projectIndex, phaseIndex);
        return;
    }
    
    // Calculate work days - USE phase.workDays if available
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Policz segmenty tej fazy
    const segmentCount = project.phases.filter(p => p.key === phase.key).length;
    const segmentLabel = segmentCount > 1 ? ` #${phase.segmentNo || 1}` : '';
    
    // Set modal title z numerem segmentu
    document.getElementById('phaseEditTitle').textContent = `Edit ${phaseConfig.name}${segmentLabel}`;
    
    // Fill fields
    document.getElementById('phaseDuration').value = workDays;
    document.getElementById('phaseNotes').value = phase.notes || '';
    
    // Set phase status
    const statusSelect = document.getElementById('phaseStatus');
    statusSelect.value = phase.status || 'notStarted';
    
    // Show/hide team assignment section - ZMIENIONA SEKCJA
    const assignSection = document.getElementById('assignSection');
    // Pokaż assign dla WSZYSTKICH faz
    assignSection.style.display = 'block';
    
    // NOWE - Pobierz pracowników z bazy
    loadTeamMembersForPhase(phase.key).then(employees => {
            const select = document.getElementById('phaseAssignSelect');
            select.innerHTML = '<option value="">Select employee...</option>';
            
            employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = `${getJobTypeIcon(emp.job_type)} ${emp.name} (${emp.employee_number || '-'})`;
                option.dataset.color = emp.color_code || emp.color || '#999999';
                
                if (phase.assignedTo === emp.id) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            // Jeśli brak pracowników
            if (employees.length === 0) {
                select.innerHTML = '<option value="">No team members available</option>';
            }
        });
    
    // Pokaż/ukryj przyciski segmentów
    const deleteBtn = document.getElementById('deletePhaseBtn');
    const addSegmentBtn = document.getElementById('addSegmentBtn');
    
    if (deleteBtn) {
        // Zmień tekst przycisku w zależności od liczby segmentów
        if (segmentCount > 1) {
            deleteBtn.textContent = `Delete Segment #${phase.segmentNo || 1}`;
        } else {
            deleteBtn.textContent = 'Delete Phase';
        }
        deleteBtn.style.display = 'inline-block';
    }
    
    // Pokaż przycisk Add Segment (tylko dla faz produkcyjnych)
    if (addSegmentBtn) {
        const canHaveSegments = ['timber', 'spray', 'glazing', 'qc'].includes(phase.key);
        addSegmentBtn.style.display = canHaveSegments ? 'inline-block' : 'none';
        addSegmentBtn.dataset.phaseKey = phase.key;
    }
    
    openModal('phaseEditModal');
}

// Add new segment of the same phase
async function addPhaseSegment() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const currentPhase = project.phases[phaseIndex];
    
    // Znajdź najwyższy segment_no dla tej fazy
    const sameKeyPhases = project.phases.filter(p => p.key === currentPhase.key);
    const maxSegmentNo = Math.max(...sameKeyPhases.map(p => p.segmentNo || 1));
    const newSegmentNo = maxSegmentNo + 1;
    
    // Oblicz datę startu nowego segmentu (dzień po końcu ostatniego segmentu tej fazy)
    const lastSegment = sameKeyPhases.reduce((latest, p) => {
        if (!latest) return p;
        const latestEnd = new Date(computeEnd(latest));
        const pEnd = new Date(computeEnd(p));
        return pEnd > latestEnd ? p : latest;
    }, null);
    
    const lastEnd = new Date(computeEnd(lastSegment));
    const newStart = new Date(lastEnd);
    newStart.setDate(newStart.getDate() + 1);
    
    // Pomiń niedziele
    while (newStart.getDay() === 0) {
        newStart.setDate(newStart.getDate() + 1);
    }
    
    // Stwórz nowy segment
    const newSegment = {
        key: currentPhase.key,
        segmentNo: newSegmentNo,
        start: formatDate(newStart),
        workDays: 3, // domyślnie 3 dni
        status: 'notStarted',
        assignedTo: null,
        notes: null
    };
    
    // Dodaj do projektu
    project.phases.push(newSegment);
    
    // Zapisz do bazy
    try {
        const { data: projectData } = await supabaseClient
            .from('projects')
            .select('id')
            .eq('project_number', project.projectNumber)
            .single();
        
        if (projectData) {
            await savePhasesToSupabase(projectData.id, project.phases, true);
            
            // WAŻNE: Pobierz fazy z bazy żeby mieć id nowego segmentu
            const { data: phasesData } = await supabaseClient
                .from('project_phases')
                .select('*')
                .eq('project_id', projectData.id);
            
            if (phasesData) {
                // Zaktualizuj lokalne fazy z id z bazy
                project.phases = phasesData.map(phase => ({
                    id: phase.id,
                    key: phase.phase_key,
                    segmentNo: phase.segment_no || 1,
                    start: phase.start_date,
                    end: phase.end_date,
                    workDays: phase.work_days,
                    status: phase.status,
                    assignedTo: phase.assigned_to,
                    notes: phase.notes,
                    materials: phase.materials,
                    orderConfirmed: phase.order_confirmed
                }));
            }
        }
    } catch (err) {
        console.error('Error saving new segment:', err);
        showToast('Error: ' + err.message, 'error');
        // Cofnij dodanie
        project.phases.pop();
        return;
    }
    
    // Zamknij modal i odśwież
    closeModal('phaseEditModal');
    render();
    
    // Pokaż potwierdzenie
}

// PUNKT 5 - Open Delivery Glazing modal

// Delete Phase
async function deleteCurrentPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    
    // WAŻNE: Sprawdź czy jesteśmy w Pipeline czy normalnym Gantt
    const isPipeline = window.location.pathname.includes('pipeline');
    const project = isPipeline ? pipelineProjects[projectIndex] : projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const phaseConfig = isPipeline ? pipelinePhases[phase.key] : phases[phase.key];
    
    // Sprawdź ile segmentów ma ta faza
    const segmentCount = project.phases.filter(p => p.key === phase.key).length;
    const segmentLabel = segmentCount > 1 ? ` #${phase.segmentNo || 1}` : '';
    const deleteType = segmentCount > 1 ? 'segment' : 'phase';
    
    if (confirm(`Delete ${deleteType} "${phaseConfig.name}${segmentLabel}" from this project?`)) {
        try {
            // Usuń fazę
            project.phases.splice(phaseIndex, 1);

            // Automatycznie układaj pozostałe fazy
            if (typeof autoArrangeFromPhase === 'function') {
                autoArrangeFromPhase(projectIndex, phaseIndex);
            }

            // NIE POTRZEBUJEMY markAsChanged() - savePhasesToSupabase zapisuje bezpośrednio
            // markAsChanged() uruchomiłby auto-save który zapisuje WSZYSTKIE projekty

            // NAPRAWA: Zapisz fazy do bazy danych dla production projects
            if (!isPipeline && typeof supabaseClient !== 'undefined' && project.projectNumber) {
                try {
                    const { data: projectData, error: fetchError } = await supabaseClient
                        .from('projects')
                        .select('id')
                        .eq('project_number', project.projectNumber)
                        .single();

                    if (!fetchError && projectData) {
                        await savePhasesToSupabase(projectData.id, project.phases, true);
                    }
                } catch (err) {
                    console.error('Error saving phases after delete:', err);
                }
            }

            // NATYCHMIAST zamknij modal - NIE CZEKAJ na zapis!
            closeModal('phaseEditModal');
            currentEditPhase = null;

            // Renderuj widok OD RAZU
            if (window.location.pathname.includes('pipeline')) {
                renderPipeline();
            } else {
                renderUniversal();
            }

            // Fazy już zapisane przez savePhasesToSupabase powyżej
            // NIE POTRZEBUJEMY saveDataQueued() - zapisywałoby WSZYSTKIE projekty

        } catch (error) {
            console.error('Error deleting phase:', error);
            showToast('Error deleting phase. Please try again.', 'error');
            closeModal('phaseEditModal');
            currentEditPhase = null;
        }
    }
}

// Delete Order Phase
async function deleteOrderPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    if (confirm(`Delete "Order Materials" phase from this project?`)) {
        project.phases.splice(phaseIndex, 1);

        if (typeof autoArrangeFromPhase === 'function') {
            autoArrangeFromPhase(projectIndex, phaseIndex);
        }

        // NIE POTRZEBUJEMY markAsChanged() - savePhasesToSupabase zapisuje bezpośrednio

        // NAPRAWA: Zapisz fazy do bazy danych dla production projects
        if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
            supabaseClient
                .from('projects')
                .select('id')
                .eq('project_number', project.projectNumber)
                .single()
                .then(({ data: projectData, error: fetchError }) => {
                    if (!fetchError && projectData) {
                        savePhasesToSupabase(projectData.id, project.phases, true);
                    }
                })
                .catch(err => console.error('Error saving phases after delete:', err));
        }

        

        // Renderuj odpowiedni widok
        if (window.location.pathname.includes('pipeline')) {
            renderPipeline();
        } else {
        renderUniversal();
        }

        closeModal('orderMaterialsModal');
        currentEditPhase = null;
    }
}

// Delete Order Spray Phase
async function deleteOrderSprayPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    
    if (confirm(`Delete "Order Spray Materials" phase from this project?`)) {
        project.phases.splice(phaseIndex, 1);

        if (typeof autoArrangeFromPhase === 'function') {
            autoArrangeFromPhase(projectIndex, phaseIndex);
        }

        // NIE POTRZEBUJEMY markAsChanged() - savePhasesToSupabase zapisuje bezpośrednio

        // NAPRAWA: Zapisz fazy do bazy danych dla production projects
        if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
            supabaseClient
                .from('projects')
                .select('id')
                .eq('project_number', project.projectNumber)
                .single()
                .then(({ data: projectData, error: fetchError }) => {
                    if (!fetchError && projectData) {
                        savePhasesToSupabase(projectData.id, project.phases, true);
                    }
                })
                .catch(err => console.error('Error saving phases after delete:', err));
        }

        

        // Renderuj odpowiedni widok
        if (window.location.pathname.includes('pipeline')) {
            renderPipeline();
        } else {
        renderUniversal();
        }

        closeModal('orderSprayModal');
        currentEditPhase = null;
    }
}

// Delete Order Glazing Phase
async function deleteOrderGlazingPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    
    if (confirm(`Delete "Order Glazing" phase from this project?`)) {
        project.phases.splice(phaseIndex, 1);

        if (typeof autoArrangeFromPhase === 'function') {
            autoArrangeFromPhase(projectIndex, phaseIndex);
        }

        // NIE POTRZEBUJEMY markAsChanged() - savePhasesToSupabase zapisuje bezpośrednio

        // NAPRAWA: Zapisz fazy do bazy danych dla production projects
        if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
            try {
                const { data: projectData, error: fetchError } = await supabaseClient
                    .from('projects')
                    .select('id')
                    .eq('project_number', project.projectNumber)
                    .single();
                
                if (!fetchError && projectData) {
                    await savePhasesToSupabase(projectData.id, project.phases, true);
                }
            } catch (err) {
                console.error('Error saving phases after delete:', err);
            }
        }

        // Renderuj odpowiedni widok
        if (window.location.pathname.includes('pipeline')) {
            renderPipeline();
        } else {
            renderUniversal();
        }

        closeModal('orderGlazingModal');
        currentEditPhase = null;
    }
}

// Save phase changes - FIXED WITH workDays
async function savePhaseChanges() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    
    // WAŻNE: Sprawdź czy jesteśmy w Pipeline czy normalnym Gantt
    const isPipeline = window.location.pathname.includes('pipeline');
    const project = isPipeline ? pipelineProjects[projectIndex] : projects[projectIndex];
    
    // DIAGNOSTYKA
    
    const phase = project.phases[phaseIndex];
    const phasesConfig = isPipeline ? pipelinePhases : phases;
    
    // Get new duration
    const newDuration = parseInt(document.getElementById('phaseDuration').value);
    const notes = document.getElementById('phaseNotes').value.trim();
    const status = document.getElementById('phaseStatus').value;
    
    if (newDuration < 1) {
        showToast('Duration must be at least 1 day', 'warning');
        return;
    }
    
    // SAVE NEW WORKDAYS - CRITICAL!
    phase.workDays = newDuration;
    
    // Calculate new end date with work days
    const start = new Date(phase.start);
    const newEnd = addWorkingDays(start, newDuration - 1);
    
    // CHECK DEADLINE BEFORE SAVING!
    if (project.deadline) {
        const deadlineDate = new Date(project.deadline);
        const phaseEnd = newDuration <= 1 ? start : addWorkingDays(start, newDuration - 1);
        
        if (phaseEnd > deadlineDate) {
            const maxAllowed = workingDaysBetween(start, deadlineDate);
            showToast(`This phase would exceed the project deadline!\n\nMaximum allowed: ${maxAllowed} days`, 'info');
            return;
        }
    }
    
    // Check if we're extending the phase
    const oldEnd = new Date(phase.end || computeEnd(phase));
    const deltaDays = calculateWorkDays(oldEnd, newEnd) - 1;
    
    phase.end = formatDate(newEnd);
    
    // Save notes
    if (notes) {
        phase.notes = notes;
    } else {
        delete phase.notes;
    }
    
    // Save status
    phase.status = status;
    
    // NAPRAWIONA SEKCJA - Assign team member dla WSZYSTKICH faz
    const assignedId = document.getElementById('phaseAssignSelect').value;
    if (assignedId) {
        const selectedOption = document.getElementById('phaseAssignSelect').selectedOptions[0];
        phase.assignedTo = assignedId;
        phase.assignedToName = selectedOption.textContent.split(' (')[0];
        phase.assignedToColor = selectedOption.dataset.color || '#999999';
    } else {
        delete phase.assignedTo;
        delete phase.assignedToName;
        delete phase.assignedToColor;
    }
    
    // Automatycznie układaj fazy po zmianie  
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, phaseIndex); // ZMIENIONE z 0 na phaseIndex
        
        // DIAGNOSTYKA
        
        // CHECK IF AUTO-ARRANGE EXCEEDS DEADLINE
        if (project.deadline) {
            const deadlineDate = new Date(project.deadline);
            let anyPhaseExceedsDeadline = false;
            
            project.phases.forEach(p => {
                const pEnd = computeEnd(p);
                if (pEnd > deadlineDate) {
                    anyPhaseExceedsDeadline = true;
                }
            });
            
            if (anyPhaseExceedsDeadline) {
                showToast('Auto-arrange pushed some phases beyond deadline! Please adjust manually.', 'warning');
            }
        }
    }
    
    // OPTIMISTIC UI: Tylko oznacz jako zmienione, zapis do DB przez przycisk Save
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    // NATYCHMIAST zamknij modal
    closeModal('phaseEditModal');
    currentEditPhase = null;
    
    // DIAGNOSTYKA
    
    // Renderuj odpowiedni widok - Pipeline lub normalny Gantt
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
    
    // Zapis do DB będzie przez przycisk Save lub auto-save co 60s
}

// Open Order Glazing modal
function openOrderGlazingModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Calculate work days for duration field
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Set fields
    document.getElementById('glazingOrderDuration').value = workDays;
    document.getElementById('orderGlazingStatus').value = phase.status || 'notStarted';
    document.getElementById('orderGlazingNotes').value = phase.notes || '';
    
    openModal('orderGlazingModal');
}

// Save Order Glazing phase
async function saveOrderGlazingPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('glazingOrderDuration').value) || 2;
    const newStatus = document.getElementById('orderGlazingStatus').value;
    const newNotes = document.getElementById('orderGlazingNotes').value.trim();
    
    // Update phase
    phase.workDays = newDuration;
    phase.status = newStatus;
    phase.notes = newNotes;
    
    // Recalculate end date
    const startDate = new Date(phase.start);
    phase.end = addWorkDays(startDate, newDuration).toISOString().split('T')[0];
    
    // Save to database
    try {
        const { data: projectData, error } = await supabaseClient
            .from('projects')
            .select('id')
            .eq('project_number', project.projectNumber)
            .single();
        
        if (!error && projectData) {
            await savePhasesToSupabase(projectData.id, project.phases, true);
        }
    } catch (err) {
        console.error('Error saving order glazing phase:', err);
    }
    
    closeModal('orderGlazingModal');
    renderGantt();
}

// Save Glazing Order duration - FIXED
async function saveGlazingOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('glazingOrderDuration').value);
    
    if (newDuration < 1) {
        showToast('Duration must be at least 1 day', 'warning');
        return;
    }
    
    // SAVE WORKDAYS!
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    // Automatycznie układaj kolejne fazy
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, phaseIndex);
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
        renderUniversal();
}

// Update glazing material status
function updateGlazingStatus(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const checkbox = document.getElementById(`glazing_${materialIndex}`);
    
    phase.glazingMaterials[materialIndex].ordered = checkbox.checked;
    updateGlazingOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
}

// Update glazing material size
function updateGlazingSize(projectIndex, phaseIndex, materialIndex, size) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.glazingMaterials[materialIndex].size = size;
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
}

// Update glazing order status display
function updateGlazingOrderStatus(projectIndex, phaseIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const allMaterials = phase.glazingMaterials || [];
    const requiredMaterials = allMaterials.filter(m => m.required);
    const orderedRequired = requiredMaterials.filter(m => m.ordered);
    const allOrdered = allMaterials.filter(m => m.ordered);
    
    const statusText = document.getElementById('glazingOrderStatusText');
    const isComplete = requiredMaterials.length === orderedRequired.length && requiredMaterials.length > 0;
    
    // Check if any glass needs size
    const glassNeedsSize = allMaterials.some(m => m.hasSize && m.ordered && !m.size);
    
    let statusHtml = `<strong>Status:</strong> `;
    if (glassNeedsSize) {
        statusHtml += '⚠️ Glass dimensions required';
    } else if (isComplete) {
        statusHtml += '✅ Complete';
    } else {
        statusHtml += '⚠️ Incomplete';
    }
    
    statusHtml += `<br><small>Required: ${orderedRequired.length}/${requiredMaterials.length} | 
        Total: ${allOrdered.length}/${allMaterials.length}</small>`;
    
    statusText.innerHTML = statusHtml;
    
    // Update phase order status
    phase.orderComplete = isComplete && !glassNeedsSize;
}

// Confirm glazing order completion
function confirmGlazingOrderComplete() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Check if glass needs dimensions
    const glassNeedsSize = (phase.glazingMaterials || []).some(m => m.hasSize && m.ordered && !m.size);
    if (glassNeedsSize) {
        showToast('Please specify dimensions for all selected glass', 'warning');
        return;
    }
    
    phase.orderConfirmed = true;
    phase.status = 'completed';
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
    
    // Renderuj odpowiedni widok
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
    
    closeModal('orderGlazingModal');
}

// Open Order Materials modal
function openOrderMaterialsModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Calculate work days for duration field
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Set fields
    document.getElementById('orderDuration').value = workDays;
    document.getElementById('orderMaterialsStatus').value = phase.status || 'notStarted';
    document.getElementById('orderMaterialsNotes').value = phase.notes || '';
    
    openModal('orderMaterialsModal');
}

// Save Order Materials phase
async function saveOrderMaterialsPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('orderDuration').value) || 3;
    const newStatus = document.getElementById('orderMaterialsStatus').value;
    const newNotes = document.getElementById('orderMaterialsNotes').value.trim();
    
    // Update phase
    phase.workDays = newDuration;
    phase.status = newStatus;
    phase.notes = newNotes;
    
    // Recalculate end date
    const startDate = new Date(phase.start);
    phase.end = addWorkDays(startDate, newDuration).toISOString().split('T')[0];
    
    // Save to database
    try {
        const { data: projectData, error } = await supabaseClient
            .from('projects')
            .select('id')
            .eq('project_number', project.projectNumber)
            .single();
        
        if (!error && projectData) {
            await savePhasesToSupabase(projectData.id, project.phases, true);
        }
    } catch (err) {
        console.error('Error saving order materials phase:', err);
    }
    
    closeModal('orderMaterialsModal');
    renderGantt();
}

// Save Order duration - FIXED
async function saveOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('orderDuration').value);
    
    if (newDuration < 1) {
        showToast('Duration must be at least 1 day', 'warning');
        return;
    }
    
    // SAVE WORKDAYS!
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    // Automatycznie układaj kolejne fazy
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, phaseIndex);
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
        renderUniversal();
}

// Open Order Spray Materials modal
function openOrderSprayModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Calculate work days for duration field
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Set fields
    document.getElementById('sprayOrderDuration').value = workDays;
    document.getElementById('orderSprayStatus').value = phase.status || 'notStarted';
    document.getElementById('orderSprayNotes').value = phase.notes || '';
    
    openModal('orderSprayModal');
}

// Save Order Spray phase
async function saveOrderSprayPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('sprayOrderDuration').value) || 2;
    const newStatus = document.getElementById('orderSprayStatus').value;
    const newNotes = document.getElementById('orderSprayNotes').value.trim();
    
    // Update phase
    phase.workDays = newDuration;
    phase.status = newStatus;
    phase.notes = newNotes;
    
    // Recalculate end date
    const startDate = new Date(phase.start);
    phase.end = addWorkDays(startDate, newDuration).toISOString().split('T')[0];
    
    // Save to database
    try {
        const { data: projectData, error } = await supabaseClient
            .from('projects')
            .select('id')
            .eq('project_number', project.projectNumber)
            .single();
        
        if (!error && projectData) {
            await savePhasesToSupabase(projectData.id, project.phases, true);
        }
    } catch (err) {
        console.error('Error saving order spray phase:', err);
    }
    
    closeModal('orderSprayModal');
    renderGantt();
}

// Save Spray Order duration - FIXED  
async function saveSprayOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('sprayOrderDuration').value);
    
    if (newDuration < 1) {
        showToast('Duration must be at least 1 day', 'warning');
        return;
    }
    
    // SAVE WORKDAYS!
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    // Automatycznie układaj kolejne fazy
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, phaseIndex);
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
    
    // Renderuj odpowiedni widok
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
}

// Update spray material status
function updateSprayStatus(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const checkbox = document.getElementById(`spray_${materialIndex}`);
    
    phase.sprayMaterials[materialIndex].ordered = checkbox.checked;
    updateSprayOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
}

// Update spray material color
function updateSprayColor(projectIndex, phaseIndex, materialIndex, color) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.sprayMaterials[materialIndex].color = color;
    updateSprayOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
}

// Update spray order status display
function updateSprayOrderStatus(projectIndex, phaseIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const allMaterials = phase.sprayMaterials || [];
    const requiredMaterials = allMaterials.filter(m => m.required);
    const orderedRequired = requiredMaterials.filter(m => m.ordered);
    const allOrdered = allMaterials.filter(m => m.ordered);
    
    const statusText = document.getElementById('sprayOrderStatusText');
    const isComplete = requiredMaterials.length === orderedRequired.length && requiredMaterials.length > 0;
    
    // Check if paint is selected and has color
    const paintMaterial = allMaterials.find(m => m.item === 'Paint');
    const paintNeedsColor = paintMaterial && paintMaterial.ordered && !paintMaterial.color;
    
    let statusHtml = `<strong>Status:</strong> `;
    if (paintNeedsColor) {
        statusHtml += '⚠️ Paint color required';
    } else if (isComplete) {
        statusHtml += '✅ Complete';
    } else {
        statusHtml += '⚠️ Incomplete';
    }
    
    statusHtml += `<br><small>Required: ${orderedRequired.length}/${requiredMaterials.length} | 
        Total: ${allOrdered.length}/${allMaterials.length}</small>`;
    
    statusText.innerHTML = statusHtml;
    
    // Update phase order status
    phase.orderComplete = isComplete && !paintNeedsColor;
}

// Confirm spray order completion
function confirmSprayOrderComplete() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Check if paint needs color
    const paintMaterial = (phase.sprayMaterials || []).find(m => m.item === 'Paint');
    if (paintMaterial && paintMaterial.ordered && !paintMaterial.color) {
        showToast('Please specify paint color (RAL code)', 'warning');
        return;
    }
    
    phase.orderConfirmed = true;
    phase.status = 'completed';
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
    
    // Renderuj odpowiedni widok
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
    
    closeModal('orderSprayModal');
}

// Update material status
function updateMaterialStatus(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const checkbox = document.getElementById(`mat_${materialIndex}`);
    
    phase.materials[materialIndex].ordered = checkbox.checked;
    updateOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
}

// Update material note
function updateMaterialNote(projectIndex, phaseIndex, materialIndex, note) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.materials[materialIndex].notes = note;
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
}

// Update custom material status
function updateCustomMaterialStatus(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const checkbox = document.getElementById(`custom_${materialIndex}`);
    
    phase.customMaterials[materialIndex].ordered = checkbox.checked;
    updateOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
}

// Add custom material
function addCustomMaterial() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const itemName = document.getElementById('newMaterialName').value.trim();
    if (!itemName) {
        showToast('Please enter material name', 'warning');
        return;
    }
    
    if (!phase.customMaterials) {
        phase.customMaterials = [];
    }
    
    phase.customMaterials.push({
        item: itemName,
        ordered: false,
        required: false
    });
    
    document.getElementById('newMaterialName').value = '';
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
    openOrderMaterialsModal(projectIndex, phaseIndex);
}

// Remove custom material
function removeCustomMaterial(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.customMaterials.splice(materialIndex, 1);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
    openOrderMaterialsModal(projectIndex, phaseIndex);
}

// Update order status display
function updateOrderStatus(projectIndex, phaseIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const allMaterials = [...(phase.materials || []), ...(phase.customMaterials || [])];
    const requiredMaterials = allMaterials.filter(m => m.required);
    const orderedRequired = requiredMaterials.filter(m => m.ordered);
    const allOrdered = allMaterials.filter(m => m.ordered);
    
    const statusText = document.getElementById('orderStatusText');
    const isComplete = requiredMaterials.length === orderedRequired.length && requiredMaterials.length > 0;
    
    statusText.innerHTML = `
        <strong>Status:</strong> ${isComplete ? '✅ Complete' : '⚠️ Incomplete'}<br>
        <small>Required: ${orderedRequired.length}/${requiredMaterials.length} | 
        Total: ${allOrdered.length}/${allMaterials.length}</small>
    `;
    
    // Update phase order status
    phase.orderComplete = isComplete;
}

// Confirm order completion
function confirmOrderComplete() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.orderConfirmed = true;
    phase.status = 'completed';
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    
    
    // Renderuj odpowiedni widok
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
    
    closeModal('orderMaterialsModal');
}

// Open Move to Archive modal
function openMoveToArchiveModal() {
    const select = document.getElementById('completedProjectSelect');
    select.innerHTML = '<option value="">Select project...</option>';
    
    // Show ALL projects (removed filter - user can archive any project)
    projects.forEach((project, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${project.projectNumber} - ${project.name}`;
        select.appendChild(option);
    });
    
    // Reset budget fields
    document.getElementById('budgetSameAsQuote').checked = true;
    document.getElementById('actualFinalValue').value = '';
    document.getElementById('actualValueField').style.display = 'none';
    document.getElementById('budgetConfirmationSection').style.display = 'block';
    
    openModal('moveToArchiveModal');
}

function toggleBudgetConfirmation() {
    const reason = document.getElementById('archiveReason').value;
    const budgetSection = document.getElementById('budgetConfirmationSection');
    
    // Pokazuj sekcję budżetu tylko dla "completed"
    if (reason === 'completed') {
        budgetSection.style.display = 'block';
    } else {
        budgetSection.style.display = 'none';
    }
}

function toggleActualValueField() {
    const checkbox = document.getElementById('budgetSameAsQuote');
    const actualValueField = document.getElementById('actualValueField');
    
    if (checkbox.checked) {
        actualValueField.style.display = 'none';
        document.getElementById('actualFinalValue').value = '';
    } else {
        actualValueField.style.display = 'block';
    }
}

// Helper functions for materials
function getMaterialList(projectType) {
    return materialLists[projectType] || materialLists.other;
}

function getGlazingMaterialsList() {
    return glazingMaterialsList || [];
}

function getSprayMaterialsList() {
    return sprayMaterialsList || [];
}

// Generic modal functions - WAŻNE!
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ========== PASSWORD CONFIRMATION SYSTEM ==========
// Uniwersalny system wymagający hasła do potwierdzenia akcji
// HTML modala musi być dodany do strony gdzie chcesz użyć

let pendingPasswordAction = null;

function confirmWithPassword(title, message, callback) {
    pendingPasswordAction = callback;
    
    const titleEl = document.getElementById('passwordConfirmTitle');
    const messageEl = document.getElementById('passwordConfirmMessage');
    const passwordEl = document.getElementById('confirmPassword');
    const errorEl = document.getElementById('passwordConfirmError');
    const modal = document.getElementById('passwordConfirmModal');
    
    if (!modal) {
        console.error('Password confirm modal not found in HTML. Add the modal HTML to this page.');
        return;
    }
    
    // Usuń emoji z tytułu jeśli jest (SVG ikona jest już w HTML)
    const cleanTitle = (title || 'Confirm with Password').replace(/^🔐\s*/, '');
    if (titleEl) titleEl.textContent = cleanTitle;
    if (messageEl) messageEl.textContent = message || 'Please enter your password to confirm this action.';
    if (passwordEl) passwordEl.value = '';
    if (errorEl) errorEl.style.display = 'none';
    
    modal.classList.add('active');
    if (passwordEl) passwordEl.focus();
}

function closePasswordConfirmModal() {
    const modal = document.getElementById('passwordConfirmModal');
    const passwordEl = document.getElementById('confirmPassword');
    const errorEl = document.getElementById('passwordConfirmError');
    
    if (modal) modal.classList.remove('active');
    if (passwordEl) passwordEl.value = '';
    if (errorEl) errorEl.style.display = 'none';
    pendingPasswordAction = null;
}

async function executePasswordConfirm() {
    const password = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('passwordConfirmError');
    
    
    if (!password) {
        errorEl.textContent = 'Please enter your password';
        errorEl.style.display = 'block';
        return;
    }
    
    try {
        // Get current user email
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user || !user.email) {
            errorEl.textContent = 'Unable to verify user';
            errorEl.style.display = 'block';
            return;
        }
        
        // Verify password by attempting to sign in
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: user.email,
            password: password
        });
        
        
        if (error) {
            errorEl.textContent = 'Incorrect password';
            errorEl.style.display = 'block';
            document.getElementById('confirmPassword').value = '';
            document.getElementById('confirmPassword').focus();
            return;
        }
        
        // Password correct - save callback before closing (closePasswordConfirmModal sets it to null)
        const callbackToExecute = pendingPasswordAction;
        
        closePasswordConfirmModal();
        
        if (callbackToExecute && typeof callbackToExecute === 'function') {
            await callbackToExecute();
        } else {
        }
        
    } catch (err) {
        console.error('Password verification error:', err);
        errorEl.textContent = 'Verification failed: ' + err.message;
        errorEl.style.display = 'block';
    }
}

// Allow Enter key to submit password
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('passwordConfirmModal');
    if (e.key === 'Enter' && modal && modal.classList.contains('active')) {
        executePasswordConfirm();
    }
});