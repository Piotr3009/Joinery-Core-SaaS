// ========== DRAG & RESIZE - PIPELINE VERSION ==========
// Specjalna wersja TYLKO dla Pipeline - nie rusza Production!

// Helper functions
function daysInclusive(startStr, endStr) {
    const s = new Date(startStr + 'T00:00:00');
    const e = new Date(endStr + 'T00:00:00');
    return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
}

let dragOriginalDurationDays = null;

function startDrag(e, bar, phase, projectIndex, phaseIndex) {
    e.preventDefault();
    draggedElement = bar;
    draggedPhase = phase;
    draggedProject = projectIndex;
    dragMode = 'move';
    startX = e.clientX;
    originalLeft = parseInt(bar.style.left);
    
    bar.classList.add('dragging');
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
}

function startResize(e, bar, phase, side) {
    e.preventDefault();
    e.stopPropagation();
    draggedElement = bar;
    draggedPhase = phase;
    dragMode = side === 'left' ? 'resize-left' : 'resize-right';
    startX = e.clientX;
    originalLeft = parseInt(bar.style.left);
    originalWidth = parseInt(bar.style.width);
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
}

function handleDrag(e) {
    if (!draggedElement) return;
    
    const deltaX = e.clientX - startX;
    
    if (dragMode === 'move') {
        const newLeft = Math.max(0, originalLeft + deltaX);
        const snappedLeft = Math.round(newLeft / dayWidth) * dayWidth;
        draggedElement.style.left = snappedLeft + 'px';
    } else if (dragMode === 'resize-left') {
        const newLeft = Math.max(0, originalLeft + deltaX);
        const newWidth = Math.max(dayWidth, originalWidth - deltaX);
        const snappedLeft = Math.round(newLeft / dayWidth) * dayWidth;
        draggedElement.style.left = snappedLeft + 'px';
        draggedElement.style.width = (originalWidth + originalLeft - snappedLeft) + 'px';
    } else if (dragMode === 'resize-right') {
        const newWidth = Math.max(dayWidth, originalWidth + deltaX);
        const snappedWidth = Math.round(newWidth / dayWidth) * dayWidth;
        draggedElement.style.width = snappedWidth + 'px';
    }
}

async function stopDrag(e) {
    if (!draggedElement) return;
    
    const deltaX = e.clientX - startX;
    const hasMovedOrResized = Math.abs(deltaX) > 5; // Tolerance 5px
    
    draggedElement.classList.remove('dragging');
    
    if (hasMovedOrResized) {
        const projectIndex = parseInt(draggedElement.dataset.projectIndex);
        const phaseIndex = parseInt(draggedElement.dataset.phaseIndex);
        const project = pipelineProjects[projectIndex]; // PIPELINE projects
        const phase = project.phases[phaseIndex];
        
        // Save old values for potential revert
        const oldStart = phase.start;
        const oldWorkDays = phase.workDays;
        
        const left = parseInt(draggedElement.style.left);
        const width = parseInt(draggedElement.style.width);
        
        if (dragMode === 'move') {
            // MOVING - changes only start
            const startDays = Math.round(left / dayWidth);
            const newStart = new Date(visibleStartDate);
            newStart.setDate(newStart.getDate() + startDays);
            
            // Snap to Monday if Sunday
            while (isWeekend(newStart)) {
                newStart.setDate(newStart.getDate() + 1);
            }
            
            phase.start = formatDate(newStart);
            
        } else if (dragMode === 'resize-left' || dragMode === 'resize-right') {
            // RESIZING - changes workDays
            const startDays = Math.round(left / dayWidth);
            const calendarDays = Math.round(width / dayWidth);
            
            const newStart = new Date(visibleStartDate);
            newStart.setDate(newStart.getDate() + startDays);
            
            const tentativeEnd = new Date(newStart);
            tentativeEnd.setDate(tentativeEnd.getDate() + calendarDays - 1);
            
            // Calculate new workDays
            const newWorkDays = workingDaysBetween(newStart, tentativeEnd);
            
            phase.start = formatDate(newStart);
            phase.workDays = Math.max(1, newWorkDays);
        }
        
        // NO DEADLINE CHECK IN PIPELINE!
        
        // Remove old adjustedEnd
        delete phase.adjustedEnd;
        
        // OPTIMISTIC UI: Zapis do DB przez przycisk Save lub auto-save
        if (typeof markAsChanged === 'function') {
            markAsChanged({ id: project.id, projectNumber: project.projectNumber, isProduction: false });
        }
        
        renderPipeline(); // Use pipeline render
    }
    
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
    draggedElement = null;
    draggedPhase = null;
    dragMode = null;
}