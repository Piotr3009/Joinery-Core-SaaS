// ========== PHASE MANAGEMENT ==========
function updatePhasesLegend() {
    const legend = document.getElementById('phasesLegend');
    if (!legend) return; // Element nie istnieje - wyjdź bez błędu
    
    legend.innerHTML = '';
    
    // ZMIANA 2 - Pokazuj tylko production phases w widoku production
    const phasesToShow = window.location.pathname.includes('pipeline') ? pipelinePhases : productionPhases;
    const orderToUse = window.location.pathname.includes('pipeline') ? pipelinePhaseOrder : productionPhaseOrder;
    
    // Sortuj fazy według odpowiedniej kolejności
    const sortedPhases = Object.entries(phasesToShow).sort((a, b) => {
        return orderToUse.indexOf(a[0]) - orderToUse.indexOf(b[0]);
    });
    
    sortedPhases.forEach(([key, phase]) => {
        const item = document.createElement('div');
        item.className = 'phase-item';
        item.innerHTML = `
            <div class="phase-color" style="background: ${phase.color}"></div>
            <span>${phase.name}</span>
        `;
        legend.appendChild(item);
    });
}

function openPhaseManager() {
    updateAvailablePhases();
    openModal('phaseModal');
}

function updateAvailablePhases() {
    const container = document.getElementById('availablePhases');
    container.innerHTML = '';
    
    // Kategorie faz
    const OFFICE_PHASES = ['md', 'siteSurvey', 'order', 'orderGlazing', 'orderSpray', 'dispatch', 'installation'];
    const PRODUCTION_PHASES = ['timber', 'spray', 'glazing', 'qc'];
    
    // ZMIANA 2 - Pokazuj tylko odpowiednie fazy w managerze
    const phasesToShow = window.location.pathname.includes('pipeline') ? pipelinePhases : productionPhases;
    const orderToUse = window.location.pathname.includes('pipeline') ? pipelinePhaseOrder : productionPhaseOrder;
    
    // Sortuj domyślne według kolejności
    const defaultPhases = [];
    const customPhases = [];
    
    Object.entries(phasesToShow).forEach(([key, phase]) => {
        if (orderToUse.includes(key)) {
            defaultPhases.push([key, phase]);
        } else {
            customPhases.push([key, phase]);
        }
    });
    
    // Sortuj domyślne według kolejności
    defaultPhases.sort((a, b) => {
        return orderToUse.indexOf(a[0]) - orderToUse.indexOf(b[0]);
    });
    
    // Połącz listy
    const allPhases = [...defaultPhases, ...customPhases];
    
    allPhases.forEach(([key, phase]) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 5px; border-bottom: 1px solid #3e3e42;';
        
        // Lista domyślnych faz
        const isDefault = orderToUse.includes(key);
        
        // Określ kategorię
        let category = 'custom';
        if (OFFICE_PHASES.includes(key)) {
            category = 'office';
        } else if (PRODUCTION_PHASES.includes(key)) {
            category = 'production';
        }
        
        const categoryLabel = category !== 'custom' 
            ? `<span style="font-size: 10px; color: #888; margin-left: auto; padding: 2px 6px; background: #2d2d30; border-radius: 3px;">${category}</span>`
            : `<span style="font-size: 10px; color: #666; margin-left: auto; padding: 2px 6px; background: #2d2d30; border-radius: 3px;">custom</span>`;
        
        div.innerHTML = `
            <div class="phase-color" style="background: ${phase.color}; width: 30px; height: 20px; border-radius: 2px;"></div>
            <span style="flex: 1;">${phase.name}</span>
            ${categoryLabel}
            ${isDefault ? `<button class="action-btn" onclick="editPhaseName('${key}')" title="Edit display name" style="padding: 2px 6px; font-size: 12px;">✏️</button>` : ''}
            ${!isDefault ? `<button class="action-btn delete" onclick="removePhase('${key}')" style="padding: 2px 6px;">✕</button>` : ''}
        `;
        
        container.appendChild(div);
    });
}

async function addCustomPhase() {
    const name = document.getElementById('newPhaseName').value.trim();
    const color = document.getElementById('newPhaseColor').value;
    
    if (!name) {
        showToast('Please enter a phase name', 'warning');
        return;
    }
    
    const key = name.toLowerCase().replace(/\s+/g, '_');
    
    // ZMIANA 2 - Dodaj do odpowiednich faz
    const isPipeline = window.location.pathname.includes('pipeline');
    const phasesToUpdate = isPipeline ? pipelinePhases : productionPhases;
    
    if (phasesToUpdate[key]) {
        showToast('Phase already exists', 'info');
        return;
    }
    
    phasesToUpdate[key] = { name, color };
    phases[key] = { name, color }; // Also add to global phases for compatibility
    
    // Zapisz do DB
    const phaseType = isPipeline ? 'pipeline' : 'production';
    await saveCustomPhaseToDb(key, name, color, phaseType);
    
    saveDataQueued();
    updatePhasesLegend();
    updateAvailablePhases();
    
    document.getElementById('newPhaseName').value = '';
}

async function removePhase(key) {
    // 🔍 DIAGNOSTYKA: Loguj każde usunięcie fazy
    console.warn(`⚠️ removePhase called with key: "${key}"`);
    console.trace('removePhase stack trace:');
    
    const phasesToUpdate = window.location.pathname.includes('pipeline') ? pipelinePhases : productionPhases;
    
    // 🛡️ ZABEZPIECZENIE: Nie pozwól usunąć domyślnych faz produkcyjnych
    const defaultProductionPhases = ['siteSurvey', 'md', 'order', 'timber', 'orderGlazing', 'orderSpray', 'spray', 'glazing', 'qc', 'dispatch'];
    if (!window.location.pathname.includes('pipeline') && defaultProductionPhases.includes(key)) {
        showToast(`Cannot remove default production phase "${phasesToUpdate[key]?.name || key}"!`, 'error');
        console.error(`❌ BLOCKED: Attempt to remove default phase "${key}"`);
        return;
    }
    
    if (confirm('Remove phase "' + phasesToUpdate[key].name + '"?')) {
        delete phasesToUpdate[key];
        delete phases[key];
        
        // Remove from appropriate projects
        const projectsToUpdate = window.location.pathname.includes('pipeline') ? pipelineProjects : projects;
        
        projectsToUpdate.forEach(project => {
            if (project.phases) {
                project.phases = project.phases.filter(p => p.key !== key);
            }
        });
        
        // Usuń z DB
        await deleteCustomPhaseFromDb(key);
        
        saveDataQueued();
        updatePhasesLegend();
        updateAvailablePhases();
        
        // Renderuj odpowiedni widok
        if (window.location.pathname.includes('pipeline')) {
            renderPipeline();
        } else {
            renderUniversal();
        }
    }
}

// Edycja wyświetlanej nazwy fazy (phase_key pozostaje bez zmian)
async function editPhaseName(key) {
    const isPipeline = window.location.pathname.includes('pipeline');
    const phasesToUpdate = isPipeline ? pipelinePhases : productionPhases;
    
    const currentName = phasesToUpdate[key]?.name || key;
    const newName = prompt('Edit display name for phase:', currentName);
    
    if (newName && newName.trim() && newName !== currentName) {
        // Zaktualizuj tylko wyświetlaną nazwę
        phasesToUpdate[key].name = newName.trim();
        phases[key].name = newName.trim();
        
        // Zapisz do DB (custom_phases)
        const phaseType = isPipeline ? 'pipeline' : 'production';
        await saveCustomPhaseToDb(key, newName.trim(), phasesToUpdate[key].color, phaseType);
        
        // Odśwież UI
        updatePhasesLegend();
        updateAvailablePhases();
        
        // Renderuj widok
        if (isPipeline) {
            renderPipeline();
        } else {
            renderUniversal();
        }
        
        showToast('Phase name updated', 'success');
    }
}