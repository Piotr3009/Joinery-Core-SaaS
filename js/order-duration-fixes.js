// ========== ORDER DURATION FIXES WITH STRICT DEADLINE CHECKING ==========

// Helper function - must be available globally
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

// Helper to validate phase duration against deadline
function validatePhaseDuration(project, phaseIndex, newDuration) {
    const phase = project.phases[phaseIndex];
    const start = new Date(phase.start);
    
    if (!project.deadline) return { valid: true };
    
    const deadlineDate = new Date(project.deadline);
    
    // Calculate where this phase would end
    const phaseEnd = newDuration <= 1 ? start : addWorkingDays(start, newDuration - 1);
    
    // If phase itself exceeds deadline
    if (phaseEnd > deadlineDate) {
        const maxDays = workingDaysBetween(start, deadlineDate);
        return { 
            valid: false, 
            reason: 'phase_exceeds',
            maxAllowed: Math.max(1, maxDays)
        };
    }
    
    // Calculate space needed for remaining phases
    let currentEnd = phaseEnd;
    for (let i = phaseIndex + 1; i < project.phases.length; i++) {
        const nextPhase = project.phases[i];
        const nextDuration = nextPhase.workDays || 4;
        
        // Start next phase day after current ends
        let nextStart = new Date(currentEnd);
        nextStart.setDate(nextStart.getDate() + 1);
        while (nextStart.getDay() === 0) { // skip Sunday
            nextStart.setDate(nextStart.getDate() + 1);
        }
        
        // Calculate next phase end
        currentEnd = nextDuration <= 1 ? nextStart : addWorkingDays(nextStart, nextDuration - 1);
        
        // Check if it exceeds deadline
        if (currentEnd > deadlineDate) {
            // Calculate max allowed for original phase
            let daysForOthers = 0;
            for (let j = phaseIndex + 1; j < project.phases.length; j++) {
                daysForOthers += project.phases[j].workDays || 4;
            }
            
            const totalAvailable = workingDaysBetween(start, deadlineDate);
            const maxAllowed = Math.max(1, totalAvailable - daysForOthers);
            
            return { 
                valid: false, 
                reason: 'pushes_others',
                maxAllowed: maxAllowed,
                totalDays: totalAvailable,
                daysForOthers: daysForOthers
            };
        }
    }
    
    return { valid: true };
}

// FIXED: Save Order Materials duration with strict validation
function saveOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const input = document.getElementById('orderDuration');
    const newDuration = parseInt(input.value);
    
    if (newDuration < 1) {
        showToast('Duration must be at least 1 day', 'warning');
        input.value = phase.workDays || 4;
        return;
    }
    
    // Validate against deadline
    const validation = validatePhaseDuration(project, phaseIndex, newDuration);
    
    if (!validation.valid) {
        if (validation.reason === 'phase_exceeds') {
            showToast(`This phase would exceed the project deadline!\n\nMaximum allowed: ${validation.maxAllowed} days`, 'info');
        } else {
            showToast(`Phases would exceed deadline! Max: ${validation.maxAllowed} days`, 'warning');
        }
        
        // Revert to old value
        input.value = phase.workDays || 4;
        return;
    }
    
    // Save changes
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = newDuration <= 1 ? start : addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    saveDataQueued();
        renderUniversal();
}

// FIXED: Save Spray Order duration with strict validation
function saveSprayOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const input = document.getElementById('sprayOrderDuration');
    const newDuration = parseInt(input.value);
    
    if (newDuration < 1) {
        showToast('Duration must be at least 1 day', 'warning');
        input.value = phase.workDays || 4;
        return;
    }
    
    // Validate against deadline
    const validation = validatePhaseDuration(project, phaseIndex, newDuration);
    
    if (!validation.valid) {
        if (validation.reason === 'phase_exceeds') {
            showToast(`This phase would exceed the project deadline!\n\nMaximum allowed: ${validation.maxAllowed} days`, 'info');
        } else {
            showToast(`Phases would exceed deadline! Max: ${validation.maxAllowed} days`, 'warning');
        }
        
        // Revert to old value
        input.value = phase.workDays || 4;
        return;
    }
    
    // Save changes
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = newDuration <= 1 ? start : addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    saveDataQueued();
        renderUniversal();
}

// FIXED: Save Glazing Order duration with strict validation  
function saveGlazingOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const input = document.getElementById('glazingOrderDuration');
    const newDuration = parseInt(input.value);
    
    if (newDuration < 1) {
        showToast('Duration must be at least 1 day', 'warning');
        input.value = phase.workDays || 4;
        return;
    }
    
    // Validate against deadline
    const validation = validatePhaseDuration(project, phaseIndex, newDuration);
    
    if (!validation.valid) {
        if (validation.reason === 'phase_exceeds') {
            showToast(`This phase would exceed the project deadline!\n\nMaximum allowed: ${validation.maxAllowed} days`, 'info');
        } else {
            showToast(`Phases would exceed deadline! Max: ${validation.maxAllowed} days`, 'warning');
        }
        
        // Revert to old value
        input.value = phase.workDays || 4;
        return;
    }
    
    // Save changes
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = newDuration <= 1 ? start : addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    saveDataQueued();
        renderUniversal();
}

// IMPORTANT: Add this to the end of modals.js or as separate include
// This replaces the existing functions with stricter versions