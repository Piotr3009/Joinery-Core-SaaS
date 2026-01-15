// ========== DRAG & RESIZE - NAPRAWIONA WERSJA ==========

// Office phases - nie można przesuwać z Production
const OFFICE_DRAG_BLOCKED = ['siteSurvey', 'order', 'orderGlazing', 'orderSpray', 'dispatch', 'installation'];

// Helper
function daysInclusive(startStr, endStr){const s=new Date(startStr+'T00:00:00');const e=new Date(endStr+'T00:00:00');return Math.max(1,Math.round((e-s)/(1000*60*60*24))+1);}
let dragOriginalDurationDays=null;

// Funkcja do przesuwania kolejnych faz (BEZ pomijania niedziel)
function shiftSuccessors(projectIndex, phaseIndex, deltaDays) {
    if (deltaDays <= 0) return;
    
    const project = projects[projectIndex];
    const phases = project.phases;
    
    // Przesuwamy wszystkie kolejne fazy
    for (let i = phaseIndex + 1; i < phases.length; i++) {
        const phase = phases[i];
        
        // Proste przesunięcie o deltaDays
        const newStart = new Date(phase.start);
        newStart.setDate(newStart.getDate() + deltaDays);
        
        const newEnd = new Date(phase.end);
        newEnd.setDate(newEnd.getDate() + deltaDays);
        
        phase.start = formatDate(newStart);
        phase.end = formatDate(newEnd);
        
        // Jeśli faza ma adjustedEnd (dni wolne pracownika), też przesuwamy
        if (phase.adjustedEnd) {
            const newAdjustedEnd = new Date(phase.adjustedEnd);
            newAdjustedEnd.setDate(newAdjustedEnd.getDate() + deltaDays);
            phase.adjustedEnd = formatDate(newAdjustedEnd);
        }
    }
    
    // NIE POTRZEBUJEMY markAsChanged() - fazy zapisują się przez savePhasesToSupabase w stopDrag
}

// NOWA FUNKCJA - pozwala na maksymalnie 2 nakładające się fazy
function autoArrangeFromPhase(projectIndex, startPhaseIndex) {
    const project = projects[projectIndex];
    const phases = project.phases;
    
    // Sortuj fazy według kolejności
    phases.sort((a, b) => phaseOrder.indexOf(a.key) - phaseOrder.indexOf(b.key));
    
    // Nakładanie faz jest dozwolone bez limitu
}

function startDrag(e, bar, phase, projectIndex, phaseIndex) {
    // PRODUCTION GANTT: Blokuj drag dla office phases (po kluczu, nie kategorii)
    if (OFFICE_DRAG_BLOCKED.includes(phase.key)) {
        return;
    }
    
    // FREEZE CHECK: Blokuj drag jeśli projekt zamrożony
    const project = projects[projectIndex];
    if (project.plan_frozen) {
        showToast('🔒 Plan is frozen. Unfreeze to make changes.', 'info');
        return;
    }
    
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
    // PRODUCTION GANTT: Blokuj resize dla office phases (po kluczu, nie kategorii)
    if (OFFICE_DRAG_BLOCKED.includes(phase.key)) {
        return;
    }
    
    // FREEZE CHECK: Blokuj resize jeśli projekt zamrożony
    const projectIndex = parseInt(bar.dataset.projectIndex);
    const project = projects[projectIndex];
    if (project.plan_frozen) {
        showToast('🔒 Plan is frozen. Unfreeze to make changes.', 'info');
        return;
    }
    
    const phaseOriginalEnd = phase.adjustedEnd || phase.end;
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
        const dayIndex = getDayIndexForXPosition(newLeft);
        const snappedLeft = getXPositionForDayIndex(dayIndex);
        draggedElement.style.left = snappedLeft + 'px';
    } else if (dragMode === 'resize-left') {
        const newLeft = Math.max(0, originalLeft + deltaX);
        const dayIndex = getDayIndexForXPosition(newLeft);
        const snappedLeft = getXPositionForDayIndex(dayIndex);
        draggedElement.style.left = snappedLeft + 'px';
        draggedElement.style.width = (originalWidth + originalLeft - snappedLeft) + 'px';
    } else if (dragMode === 'resize-right') {
        const newRight = originalLeft + Math.max(dayWidth, originalWidth + deltaX);
        const endDayIndex = getDayIndexForXPosition(newRight);
        const snappedRight = getXPositionForDayIndex(endDayIndex + 1);
        const snappedWidth = Math.max(dayWidth, snappedRight - originalLeft);
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
        const project = projects[projectIndex];
        const phase = project.phases[phaseIndex];
        
        // Zapisz WSZYSTKIE stare fazy przed jakimikolwiek zmianami
        const oldPhases = JSON.parse(JSON.stringify(project.phases));
        const oldStart = phase.start;
        const oldWorkDays = phase.workDays;
        
        const left = parseInt(draggedElement.style.left);
        const width = parseInt(draggedElement.style.width);
        
        if (dragMode === 'move') {
            // PRZESUWANIE - zmienia tylko start, workDays zostaje
            const startDays = getDayIndexForXPosition(left);
            const newStart = new Date(visibleStartDate);
            newStart.setDate(newStart.getDate() + startDays);
            
            // Snap do poniedziałku jeśli weekend
            while (isWeekend(newStart)) {
                newStart.setDate(newStart.getDate() + 1);
            }
            
            phase.start = formatDate(newStart);
            // NIE zmieniamy workDays!
            
        } else if (dragMode === 'resize-left' || dragMode === 'resize-right') {
            // ROZCIĄGANIE - zmienia workDays
            const startDays = getDayIndexForXPosition(left);
            const endX = left + width;
            const endDayIndex = getDayIndexForXPosition(endX - 1); // -1 bo endX to koniec paska
            const calendarDays = Math.max(1, endDayIndex - startDays + 1);
            
            const newStart = new Date(visibleStartDate);
            newStart.setDate(newStart.getDate() + startDays);
            
            const tentativeEnd = new Date(newStart);
            tentativeEnd.setDate(tentativeEnd.getDate() + calendarDays - 1);
            
            // Wylicz nowe workDays
            const newWorkDays = workingDaysBetween(newStart, tentativeEnd);
            
            phase.start = formatDate(newStart);
            phase.workDays = Math.max(1, newWorkDays);
        }
        
        // Usuń stare adjustedEnd
        delete phase.adjustedEnd;
        
        // KROK 1: Układaj wszystkie fazy żeby nie było nakładania
        autoArrangeFromPhase(projectIndex, 0);
        
        // KROK 2: Sprawdź czy cokolwiek przekracza deadline
        let exceedsDeadline = false;
        if (project.deadline) {
            const deadlineDate = new Date(project.deadline);
            
            project.phases.forEach(p => {
                const pEnd = computeEnd(p);
                if (pEnd > deadlineDate) {
                    exceedsDeadline = true;
                }
            });
        }
        
        // KROK 3: Jeśli przekracza deadline, cofnij WSZYSTKO
        if (exceedsDeadline) {
            // Różne komunikaty dla różnych sytuacji
            const phaseEnd = computeEnd(phase);
            const deadlineDate = new Date(project.deadline);
            
            if (phaseEnd > deadlineDate) {
                showToast('Cannot move/resize phase beyond project deadline!', 'error');
            } else {
                showToast('This change would push other phases beyond the deadline!', 'info');
            }
            
            // Przywróć WSZYSTKIE oryginalne fazy
            project.phases = oldPhases;
            
            // Czyść handlery
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            draggedElement = null;
            draggedPhase = null;
            dragMode = null;
            
            // Odśwież
            render();
            return;
        }
        
        // KROK 4: Jeśli wszystko OK, oznacz jako zmienione
        // OPTIMISTIC UI: Zapis do DB przez przycisk Save lub auto-save
        if (typeof markAsChanged === 'function') {
            markAsChanged({ id: project.id, projectNumber: project.projectNumber, isProduction: true });
        }
        
        render();
    }
    
    // Czyść handlery na końcu
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
    draggedElement = null;
    draggedPhase = null;
    dragMode = null;
}