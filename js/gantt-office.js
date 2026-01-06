// Minimal CSS injection for dual-overlay
// OFFICE GANTT - Kategorie faz
const PRODUCTION_PHASES = ['md', 'timber', 'spray', 'glazing', 'qc'];
const OFFICE_PHASES = ['siteSurvey', 'order', 'orderGlazing', 'orderSpray', 'dispatch', 'installation'];

// Weekend width ratio (50% of normal day)
const WEEKEND_WIDTH_RATIO = 0.5;

// Helper: Get width for a specific day
function getDayWidthForDate(date) {
    const day = date.getDay();
    if (day === 0 || day === 6) { // Sunday or Saturday
        return dayWidth * WEEKEND_WIDTH_RATIO;
    }
    return dayWidth;
}

// Helper: Calculate X position for day index from visible start
function getXPositionForDayIndex(dayIndex) {
    let x = 0;
    for (let i = 0; i < dayIndex; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        x += getDayWidthForDate(date);
    }
    return x;
}

// Helper: Calculate total width for all visible days
function getTotalVisibleWidth() {
    let total = 0;
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        total += getDayWidthForDate(date);
    }
    return total;
}

// Helper: Calculate width between two dates (calendar days, including weekends at reduced width)
function getWidthForDateRange(startDate, numCalendarDays) {
    let width = 0;
    for (let i = 0; i < numCalendarDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        width += getDayWidthForDate(date);
    }
    return width;
}

// Helper: Get day index from X position (inverse of getXPositionForDayIndex)
function getDayIndexForXPosition(x) {
    let accumulated = 0;
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        const w = getDayWidthForDate(date);
        if (accumulated + w > x) {
            return i;
        }
        accumulated += w;
    }
    return daysToShow - 1;
}

// Helper: znajdź najwcześniejszy segment danej fazy (dla sortowania)
function getEarliestPhaseSegment(phases, phaseKey) {
    const matching = phases?.filter(p => p.key === phaseKey) || [];
    if (matching.length === 0) return null;
    return matching.reduce((earliest, p) => {
        if (!earliest || !earliest.start) return p;
        if (!p.start) return earliest;
        return new Date(p.start) < new Date(earliest.start) ? p : earliest;
    }, null);
}

// Helper: policz ile segmentów ma dana faza
function countPhaseSegments(phases, phaseKey) {
    return phases?.filter(p => p.key === phaseKey).length || 0;
}

(function ensureDualOverlayCSS(){
    if (document.getElementById('dual-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'dual-overlay-style';
    style.textContent = `
        .phase-container{position:absolute}
        .phase-container .dual-overlay{pointer-events:none}
        .timeline-header {
            overflow: visible !important;
            min-width: max-content !important;
        }
    `;
    document.head.appendChild(style);
})();
// ========== UTC HELPERS - stabilne daty bez DST ==========
function dUTC(dateLike) {
    const d = new Date(dateLike);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function addDaysUTC(d, n) {
    const u = dUTC(d);
    u.setUTCDate(u.getUTCDate() + n);
    return u;
}

// ========== SORTOWANIE ========== 
function setSortMode(mode) {
    currentSortMode = mode;
    localStorage.setItem('joinerySortMode', mode);
    
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.sort-btn[data-sort="${mode}"]`)?.classList.add('active');
    
    render();
}

function getSortedProjects() {
    let sortedProjects = [...projects];
    
    if (currentSortMode === 'deadline') {
        sortedProjects.sort((a, b) => {
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        });
    } else if (currentSortMode === 'timber') {
        sortedProjects.sort((a, b) => {
            // Znajdź najwcześniejszy segment timber
            const timberA = getEarliestPhaseSegment(a.phases, 'timber');
            const timberB = getEarliestPhaseSegment(b.phases, 'timber');
            
            if (!timberA || !timberA.start) return 1;
            if (!timberB || !timberB.start) return -1;
            
            return new Date(timberA.start) - new Date(timberB.start);
        });
    } else if (currentSortMode === 'spray') {
        sortedProjects.sort((a, b) => {
            // Znajdź najwcześniejszy segment spray
            const sprayA = getEarliestPhaseSegment(a.phases, 'spray');
            const sprayB = getEarliestPhaseSegment(b.phases, 'spray');
            
            if (!sprayA || !sprayA.start) return 1;
            if (!sprayB || !sprayB.start) return -1;
            
            return new Date(sprayA.start) - new Date(sprayB.start);
        });
    } else {
        // Default: by number
        sortedProjects.sort((a, b) => {
            const numA = parseInt(a.projectNumber.split('/')[0]);
            const numB = parseInt(b.projectNumber.split('/')[0]);
            return numA - numB;
        });
    }
    
    return sortedProjects;
}


// Dynamiczny offset lewej krawędzi
function baseLeftOffset() {
    const firstRow = document.querySelector('#chartBody .project-row');
    const firstProjectCell = firstRow?.querySelector('.project-cell');
    return firstProjectCell ? firstProjectCell.offsetWidth : 400; // fallback 400
}

// ========== RENDERING ==========
function render() {
    renderTimeline();
    renderProjects();
    renderGridPattern();
    renderTodayLine();
}

function renderTimeline() {
    const header = document.getElementById('timelineHeader');
    if (!header) {
        console.error('Timeline header not found!');
        return;
    }
    
    // Clear header
    header.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'timeline-grid';
    const totalWidth = getTotalVisibleWidth();
    grid.style.cssText = `
        display: flex;
        height: 100%;
        position: relative;
        width: ${totalWidth}px;
        min-width: ${totalWidth}px;
    `;
    
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const cellWidth = getDayWidthForDate(date);
        
        if (isWeekend) {
            // Weekend cell - węższy z ukośnym układem
            cell.className += date.getDay() === 0 ? ' day-cell-sunday' : ' day-cell-saturday';
            cell.style.cssText = `
                width: ${cellWidth}px;
                min-width: ${cellWidth}px;
                max-width: ${cellWidth}px;
                height: 100%;
                position: relative;
                border-right: 1px solid rgba(0, 100, 0, 0.4);
                border-left: 1px solid rgba(0, 100, 0, 0.4);
                box-sizing: border-box;
                flex-shrink: 0;
                background: rgba(255, 255, 255, 0.03);
            `;
            
            // Ukośny układ - liczba w rogu
            const dayNumber = document.createElement('div');
            if (date.getDay() === 6) {
                // Sobota - góra lewa
                dayNumber.style.cssText = `
                    position: absolute;
                    top: 8px;
                    left: 4px;
                    font-size: 11px;
                    color: #aaa;
                `;
            } else {
                // Niedziela - dół prawa
                dayNumber.style.cssText = `
                    position: absolute;
                    bottom: 8px;
                    right: 4px;
                    font-size: 11px;
                    color: #aaa;
                `;
            }
            dayNumber.textContent = date.getDate();
            cell.appendChild(dayNumber);
        } else {
            // Normal weekday cell
            cell.style.cssText = `
                width: ${cellWidth}px;
                min-width: ${cellWidth}px;
                max-width: ${cellWidth}px;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border-right: 1px solid #3e3e42;
                box-sizing: border-box;
                flex-shrink: 0;
            `;
            
            // Day number
            const dayNumber = document.createElement('div');
            dayNumber.style.cssText = `
                font-size: 14px;
                font-weight: normal;
            `;
            dayNumber.textContent = date.getDate();
            
            // Month
            const dayMonth = document.createElement('div');
            dayMonth.style.cssText = `
                font-size: 10px;
                color: #9e9e9e;
            `;
            dayMonth.textContent = date.toLocaleDateString('en', {month: 'short'});
            
            cell.appendChild(dayNumber);
            cell.appendChild(dayMonth);
        }
        
        grid.appendChild(cell);
    }
    
    header.appendChild(grid);
    
    // Sync width with timeline cells
    const totalW = getTotalVisibleWidth();
    const timelineCells = document.querySelectorAll('.timeline-cell');
    timelineCells.forEach(cell => {
        cell.style.width = totalW + 'px';
        cell.style.minWidth = totalW + 'px';
    });
}

// Grid pattern and green stripes for Sundays
function renderGridPattern() {
    document.querySelectorAll('.grid-line').forEach(el => el.remove());
    document.querySelectorAll('.sunday-stripe').forEach(el => el.remove());
    document.querySelectorAll('.saturday-stripe').forEach(el => el.remove());
    
    const baseLeft = baseLeftOffset();
    const gridHeight = Math.max(2000, projects.length * 60 + 500);
    const totalWidth = getTotalVisibleWidth();
    const gridWidth = baseLeft + totalWidth;
    const chartBody = document.getElementById('chartBody');
    if (!chartBody) return;
    
    // Ustaw minimalną wielkość chartBody
    chartBody.style.minWidth = gridWidth + 'px';
    chartBody.style.minHeight = gridHeight + 'px';
    
    // Remove CSS gradient - draw lines manually for variable widths
    chartBody.style.backgroundImage = 'none';
    
    // Draw stripes for each day
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        
        const xPos = getXPositionForDayIndex(i);
        const cellWidth = getDayWidthForDate(date);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        
        // Grid line at end of each day
        const line = document.createElement('div');
        line.className = 'grid-line';
        line.style.cssText = `
            position: absolute;
            left: ${baseLeft + xPos + cellWidth}px;
            top: 0;
            bottom: 0;
            width: 1px;
            background: ${isWeekend ? 'rgba(0, 100, 0, 0.4)' : 'rgba(255,255,255,0.03)'};
            pointer-events: none;
            z-index: 0;
        `;
        chartBody.appendChild(line);
        
        // Weekend stripe
        if (isWeekend) {
            const stripe = document.createElement('div');
            stripe.className = date.getDay() === 6 ? 'saturday-stripe' : 'sunday-stripe';
            stripe.style.cssText = `
                position: absolute;
                left: ${baseLeft + xPos}px;
                top: 0;
                bottom: 0;
                width: ${cellWidth}px;
                background: rgba(255, 255, 255, 0.025);
                pointer-events: none;
                z-index: 1;
                border-left: 1px solid rgba(0, 100, 0, 0.4);
            `;
            chartBody.appendChild(stripe);
        }
    }
}

function renderProjects() {
    const body = document.getElementById('chartBody');
    
    // DIAGNOSTYKA - monitoruj liczbę faz
    const totalPhases = projects.reduce((sum, p) => sum + (p.phases?.length || 0), 0);
    
    body.innerHTML = '';
    
    // NOWE - sortowanie
    const sortedProjects = getSortedProjects();
    
    sortedProjects.forEach((project, sortIndex) => {
        // DIAGNOSTYKA - sprawdź czy są duplikaty faz (uwzględniając segmenty)
        if (project.phases) {
            const phaseIds = project.phases.map(p => `${p.key}#${p.segmentNo || 1}`);
            const uniqueIds = [...new Set(phaseIds)];
            if (phaseIds.length !== uniqueIds.length) {
                console.error(`DUPLIKATY FAZ w projekcie ${project.name}:`, phaseIds);
            }
        }
        
        // WAŻNE - znajdź oryginalny indeks
        const index = projects.indexOf(project);
        const row = document.createElement('div');
        row.className = 'project-row';
        
        const projectCell = document.createElement('div');
        projectCell.className = 'project-cell';
        
        const projectType = projectTypes[project.type] || projectTypes.other;
        
        // ZMIANA: Dodałem przycisk Google Drive
        projectCell.innerHTML = `
            <div class="project-column project-number">
                ${project.projectNumber || '---'}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-type" title="${projectType.name}" style="color: ${getProjectTypeColor(project.type)}">
                ${getProjectTypeIcon(project.type, 20)}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-name" title="${project.name}">
                ${project.name}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-deadline" onclick="editProjectDeadline(${index})" title="Click to edit deadline">
                ${project.deadline ? formatDateShort(project.deadline) : '---'}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-actions">
                <button class="action-btn" onclick="editProject(${index})" title="Edit">✏️</button>
                <button class="action-btn" onclick="openProjectFilesModal(${index}, 'production')" title="Project Files">📁</button>
                <button class="action-btn ${project.notes ? 'has-notes' : 'no-notes'}" id="notes-btn-${project.id}" onclick="openProductionProjectNotes(${index})" title="Project Notes">${project.notes ? '📝' : '📋'}</button>
                <button class="action-btn mat-btn" onclick="openMaterialsList(${index})" title="Materials List">
                    <span class="mat-text">MAT</span>
                </button>
                <button class="action-btn ps-btn" onclick="openProductionSheet(${index})" title="Production Sheet">
                    <span class="ps-text">PS</span>
                </button>
            </div>
        `;
        
        const timelineCell = document.createElement('div');
        timelineCell.className = 'timeline-cell';
        const totalW = getTotalVisibleWidth();
        timelineCell.style.width = totalW + 'px';
        timelineCell.style.minWidth = totalW + 'px';
        timelineCell.style.overflow = 'hidden';
        
        if (project.phases) {
            // OFFICE GANTT: Rozdziel fazy na production i office
            const productionPhases = project.phases.filter(p => 
                PRODUCTION_PHASES.includes(p.key) || p.category === 'production'
            );
            const officePhases = project.phases.filter(p => 
                OFFICE_PHASES.includes(p.key) || p.category === 'office'
            );
            
            // 1. Renderuj PRODUCTION jako przezroczyste tło (read-only)
            const sortedProduction = [...productionPhases].sort((a, b) => {
                const keyOrder = productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
                if (keyOrder !== 0) return keyOrder;
                // Drugorzędnie sortuj po segmentNo
                return (a.segmentNo || 1) - (b.segmentNo || 1);
            });
            
            sortedProduction.forEach(phase => {
                const start = dUTC(phase.start);
                const rawEnd = dUTC(computeEnd(phase));
                phase.adjustedEnd = formatDate(rawEnd);
            });
            
            sortedProduction.forEach((phase) => {
                const originalIndex = project.phases.findIndex(p => p === phase);
                const phaseBar = createPhaseBar(phase, project, index, originalIndex, [], true);
                if (phaseBar) {
                    timelineCell.appendChild(phaseBar);
                }
            });
            
            // 2. Renderuj OFFICE jako normalne (edytowalne)
            const sortedOffice = [...officePhases].sort((a, b) => {
                const keyOrder = productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
                if (keyOrder !== 0) return keyOrder;
                // Drugorzędnie sortuj po segmentNo
                return (a.segmentNo || 1) - (b.segmentNo || 1);
            });
            
            sortedOffice.forEach(phase => {
                const start = dUTC(phase.start);
                const rawEnd = dUTC(computeEnd(phase));
                phase.adjustedEnd = formatDate(rawEnd);
            });
            
            const overlaps = detectPhaseOverlaps(sortedOffice);
            
            sortedOffice.forEach((phase) => {
                const originalIndex = project.phases.findIndex(p => p === phase);
                const phaseBar = createPhaseBar(phase, project, index, originalIndex, overlaps, false);
                if (phaseBar) {
                    timelineCell.appendChild(phaseBar);
                }
            });
        }
        
        // Renderuj deadline
        if (project.deadline) {
            renderDeadlineCell(project, timelineCell);
        }

        row.appendChild(projectCell);
        row.appendChild(timelineCell);
        body.appendChild(row);
    });
}

// Overlap detection - UTC, ekskluzywny koniec [start, end)
function detectPhaseOverlaps(phases) {
    const overlaps = [];
    if (!phases || phases.length < 2) return overlaps;
    
    // Normalizuj fazy do UTC z ekskluzywnym końcem
    const normalized = phases.map((p, idx) => {
        const startUTC = dUTC(p.start);
        const endUTC = dUTC(p.adjustedEnd || computeEnd(p));
        const endExUTC = addDaysUTC(endUTC, 1);
        return { key: p.key, startUTC, endExUTC, idx };
    });
    
    // Sprawdź overlaps na [start, end)
    for (let i = 0; i < normalized.length; i++) {
        for (let j = i + 1; j < normalized.length; j++) {
            const a = normalized[i];
            const b = normalized[j];
            
            // Przecięcie: start1 < end2 AND start2 < end1 (ekskluzywne końce)
            if (a.startUTC < b.endExUTC && b.startUTC < a.endExUTC) {
                overlaps.push({
                    phase1Key: a.key,
                    phase2Key: b.key,
                    phase1Idx: a.idx,
                    phase2Idx: b.idx,
                    overlapStart: new Date(Math.max(a.startUTC.getTime(), b.startUTC.getTime())),
                    overlapEnd: addDaysUTC(new Date(Math.min(a.endExUTC.getTime(), b.endExUTC.getTime())), -1)
                });
            }
        }
    }
    
    return overlaps;
}

function createPhaseBar(phase, project, projectIndex, phaseIndex, overlaps, isReadOnly = false) {
    const container = document.createElement('div');
    let phaseConfig = productionPhases[phase.key];
    
    if (!phaseConfig) {
        console.warn(`⚠️ Nieznana faza "${phase.key}" w projekcie ${project.name}. Używam domyślnej konfiguracji.`);
        // Fallback dla nieznanych faz
        phaseConfig = {
            name: phase.key.replace(/([A-Z])/g, ' $1').trim(), // camelCase na spacje
            color: '#808080' // szary kolor dla nieznanych
        };
    }
    
   // Zawsze szukaj w teamMembers po ID
   const teamMember = phase.assignedTo ? 
       teamMembers.find(m => m.id === phase.assignedTo) : null;
    
    container.className = 'phase-container';
    
    // Check if should flash
    if ((phase.key === 'order' || phase.key === 'orderSpray' || phase.key === 'orderGlazing') && !phase.orderConfirmed) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const phaseEnd = new Date(phase.end);
        const daysDiff = Math.round((phaseEnd - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1 && daysDiff >= 0) {
            container.classList.add('flashing');
        }
    }
    
    const start = new Date(phase.start);
    
    // DIAGNOSTYKA DAT
    if (isNaN(start.getTime())) {
        console.error(`❌ Błędna data start dla fazy ${phase.key}: "${phase.start}"`);
        return null;
    }
    
    // Użyj adjustedEnd z pre-pass (już przeliczone)
    const adjustedEnd = new Date(phase.adjustedEnd || computeEnd(phase));
    
    const daysDiff = Math.round((start - visibleStartDate) / (1000 * 60 * 60 * 24));
    const duration = Math.round((adjustedEnd - start) / (1000 * 60 * 60 * 24)) + 1;
    
    // NEW - calculate WORKING days for display
    const workDays = phase.workDays || workingDaysBetween(start, adjustedEnd);
    const displayDays = workDays; // Display WORKING days, not calendar days
    
    // Calculate position and width with variable weekend widths
    const leftPos = getXPositionForDayIndex(daysDiff);
    const widthPx = getWidthForDateRange(start, duration);
    
    container.style.left = leftPos + 'px';
    container.style.width = widthPx + 'px';
    container.style.borderColor = phaseConfig.color;
    
    // OFFICE GANTT: Jeśli read-only (production phases), ustaw jako przezroczyste tło
    if (isReadOnly) {
        container.style.opacity = '0.15';
        container.style.pointerEvents = 'none';
        container.style.cursor = 'default';
        container.style.zIndex = '1';
        
        // Prosty render bez interakcji
        const topDiv = document.createElement('div');
        topDiv.className = 'phase-top';
        topDiv.style.background = phaseConfig.color;
        
        // Dodaj numer segmentu jeśli jest więcej niż 1
        const segmentCount = countPhaseSegments(project.phases, phase.key);
        const segmentLabel = segmentCount > 1 ? ` #${phase.segmentNo || 1}` : '';
        topDiv.innerHTML = '<span>' + phaseConfig.name + segmentLabel + '</span>';
        container.appendChild(topDiv);
        
        return container;
    }
    
    // Top part - colored
    const topDiv = document.createElement('div');
    topDiv.className = 'phase-top';
    
    // PROSTA LOGIKA: 
    // - Górna połowa (topDiv) = kolor fazy (zawsze)
    // - Dolna połowa (bottomDiv background) = kolor pracownika
    // - Overlap = dodatkowy layer NA GÓRZE topDiv
    
    topDiv.style.background = phaseConfig.color;
    
    // Dodaj numer segmentu jeśli jest więcej niż 1
    const segmentCount = countPhaseSegments(project.phases, phase.key);
    const segmentLabel = segmentCount > 1 ? ` #${phase.segmentNo || 1}` : '';
    topDiv.innerHTML = `<span>${phaseConfig.name}${segmentLabel}</span>`;
    
    // Bottom part
    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'phase-bottom';
    
    // Jeśli jest pracownik - dolna część ma border w jego kolorze (przezroczyste tło)
    if (teamMember) {
        bottomDiv.style.borderTop = `2px solid ${teamMember.color_code || teamMember.color}`;
        bottomDiv.style.borderBottom = `2px solid ${teamMember.color_code || teamMember.color}`;
        bottomDiv.style.borderLeft = `2px solid ${teamMember.color_code || teamMember.color}`;
        bottomDiv.style.borderRight = `2px solid ${teamMember.color_code || teamMember.color}`;
        bottomDiv.style.background = 'transparent';
    }
    
    // Tylko podstawowe info (bez ikon statusu i zamówień)
    let bottomContent = `<span class="phase-days-info">(${displayDays} days)</span>`;
    
    // Nazwa pracownika
    if (teamMember) {
        bottomContent += `<span style="font-size: 9px; color: ${teamMember.color_code || teamMember.color}; margin-left: 4px; font-weight: bold;">${teamMember.name}</span>`;
    }
    
    // TYLKO ikona notesu
    if (phase.notes) {
        bottomContent += `<span class="phase-note-icon" title="Has notes">📝</span>`;
    }
    
    bottomDiv.innerHTML = bottomContent;
    
    container.appendChild(topDiv);
    container.appendChild(bottomDiv);
    
    // OVERLAP: Rysuj WSZYSTKIE overlaps dla tej fazy
    const relatedOverlaps = overlaps.filter(o => 
        o.phase1Key === phase.key || o.phase2Key === phase.key
    );
    
    relatedOverlaps.forEach(overlap => {
        const dayMs = 86400000;
        
        // UTC z ekskluzywnym końcem
        const sPhase = dUTC(phase.start);
        const ePhaseEx = addDaysUTC(dUTC(phase.adjustedEnd || computeEnd(phase)), 1);
        
        const sOv = dUTC(overlap.overlapStart);
        const eOvEx = addDaysUTC(dUTC(overlap.overlapEnd), 1);
        
        // Dokładne milisekundy przecięcia
        const interStart = Math.max(sPhase.getTime(), sOv.getTime());
        const interEndEx = Math.min(ePhaseEx.getTime(), eOvEx.getTime());
        const interMs = interEndEx - interStart;
        
        if (interMs <= 0) return; // Brak przecięcia - skip
        
        const widthPxTotal = parseFloat(container.style.width);
        
        // Piksele bez zaokrąglania do dni
        const fromStartDays = (interStart - sPhase.getTime()) / dayMs;
        const overlapDaysExact = interMs / dayMs;
        
        const overlayLeft = Math.min(widthPxTotal, fromStartDays * dayWidth);
        const overlayWidth = Math.max(0, Math.min(widthPxTotal - overlayLeft, overlapDaysExact * dayWidth));
        
        if (overlayWidth <= 0) return; // Zbyt wąski - skip
        
        const otherKey = (overlap.phase1Key === phase.key) ? overlap.phase2Key : overlap.phase1Key;
        const otherColor = productionPhases[otherKey]?.color || '#888';
        
        // Overlap tylko na górnej 1/4 (25px podzielone na 2x 12.5px)
        const topBar = document.createElement('div');
        topBar.style.cssText = `
            position: absolute;
            left: ${overlayLeft}px;
            width: ${overlayWidth}px;
            top: 0;
            height: 12.5px;
            background: ${phaseConfig.color};
            pointer-events: none;
            z-index: 3;
            border: 1px solid #555;
            border-radius: 2px 2px 0 0;
        `;
        container.appendChild(topBar);
        
        const bottomBar = document.createElement('div');
        bottomBar.style.cssText = `
            position: absolute;
            left: ${overlayLeft}px;
            width: ${overlayWidth}px;
            top: 12.5px;
            height: 12.5px;
            background: ${otherColor};
            pointer-events: none;
            z-index: 3;
            border: 1px solid #555;
            border-radius: 0 0 2px 2px;
        `;
        container.appendChild(bottomBar);
    });
    
    container.dataset.projectIndex = projectIndex;
    container.dataset.phaseIndex = phaseIndex;
    
    const endDateStr = phase.adjustedEnd || formatDate(adjustedEnd);
    let tooltipText = `${phaseConfig.name}: ${phase.start} to ${endDateStr} (${displayDays} work days)`;
    tooltipText += `\nStatus: ${status.name}`;
    if (teamMember) tooltipText += `\nAssigned to: ${teamMember.name}`;
    if (phase.notes) tooltipText += `\nNotes: ${phase.notes.substring(0, 50)}...`;
    
    container.title = tooltipText;
    
    container.ondblclick = (e) => {
        e.stopPropagation();
        openPhaseEditModal(projectIndex, phaseIndex);
    };
    
    const leftHandle = document.createElement('div');
    leftHandle.className = 'resize-handle resize-handle-left';
    leftHandle.onmousedown = (e) => startResize(e, container, phase, 'left');
    
    const rightHandle = document.createElement('div');
    rightHandle.className = 'resize-handle resize-handle-right';
    rightHandle.onmousedown = (e) => startResize(e, container, phase, 'right');
    
    container.appendChild(leftHandle);
    container.appendChild(rightHandle);
    
    container.onmousedown = (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.classList.contains('phase-status-icon')) return;
        if (e.target.classList.contains('phase-note-icon')) return;
        if (e.target.classList.contains('phase-order-icon')) return;
        startDrag(e, container, phase, projectIndex, phaseIndex);
    };
    
    // Dodaj hover popup dla wyboru faz przy overlap
    setupPhaseHoverOffice(container, projectIndex, phaseIndex);
    
    return container;
}

function renderTodayLine() {
    const existing = document.querySelector('.today-line');
    if (existing) existing.remove();
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const daysDiff = Math.round((today - visibleStartDate) / (86400000));
    
    if (daysDiff >= 0 && daysDiff < daysToShow) {
        const baseLeft = baseLeftOffset();
        const chartBody = document.getElementById('chartBody');
        if (!chartBody) return;
        
        const leftPos = getXPositionForDayIndex(daysDiff);
        
        const line = document.createElement('div');
        line.className = 'today-line';
        line.style.cssText = `
            position: absolute;
            left: ${baseLeft + leftPos}px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #007acc;
            pointer-events: none;
            z-index: 5;
        `;
        chartBody.appendChild(line);
    }
}

function editProjectNumber(index) {
    // Project numbers are auto-generated and cannot be edited
    showToast('Project numbers are auto-generated and cannot be edited.', 'info');
}

function editProjectDeadline(index) {
    const project = projects[index];
    
    // Utwórz tymczasowy modal dla deadline
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="width: 300px;">
            <div class="modal-header">Set Project Deadline</div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Deadline Date</label>
                    <input type="date" id="tempDeadlineInput" value="${project.deadline || ''}" style="width: 100%; padding: 8px; background: #3e3e42; border: 1px solid #555; color: #e8e2d5; border-radius: 3px;">
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="modal-btn primary" onclick="saveDeadlineFromModal(${index})">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus na input
    setTimeout(() => {
        document.getElementById('tempDeadlineInput').focus();
    }, 100);
}

function saveDeadlineFromModal(index) {
    const newDeadline = document.getElementById('tempDeadlineInput').value;
    const modal = document.querySelector('.modal.active');
    
    if (newDeadline) {
        const project = projects[index];
        const today = new Date();
        today.setHours(0,0,0,0);
        const deadlineDate = new Date(newDeadline);
        
        // Sprawdź czy deadline nie jest w przeszłości
        if (deadlineDate < today) {
            showToast('Deadline cannot be in the past!', 'info');
            return;
        }
        
        // Oblicz dostępne dni robocze
        const availableWorkDays = workingDaysBetween(today, deadlineDate);
        const phasesCount = project.phases ? project.phases.length : 0;
        
        // Sprawdź minimalne wymagania
        if (phasesCount > 0 && availableWorkDays < phasesCount) {
            showToast(`Deadline too short! Need at least ${phasesCount} working days for ${phasesCount} phases.`, 'info');
            return;
        }
        
        // Zapisz deadline
        project.deadline = newDeadline;
        
      
        
        saveDataQueued();
        render();
    }
    
    modal.remove();
}

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

function renderDeadlineCell(project, timelineCell) {
    if (!project.deadline) return;
    
    const deadlineDate = new Date(project.deadline);
    const daysDiff = Math.round((deadlineDate - visibleStartDate) / (1000 * 60 * 60 * 24));
    
    // Tylko jeśli deadline jest w widocznym zakresie
    if (daysDiff >= 0 && daysDiff < daysToShow) {
        const leftPos = getXPositionForDayIndex(daysDiff);
        const cellWidth = getDayWidthForDate(deadlineDate);
        
        const deadlineCell = document.createElement('div');
        deadlineCell.className = 'deadline-cell';
        deadlineCell.style.cssText = `
            position: absolute;
            left: ${leftPos}px;
            top: 2px;
            width: ${cellWidth}px;
            height: 50px;
            background: #8B0000;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            border-radius: 3px;
            z-index: 4;
            cursor: pointer;
            border: 1px solid #5B0000;
        `;
        deadlineCell.innerHTML = 'DL';
        deadlineCell.title = `Deadline: ${project.deadline}`;
        
        timelineCell.appendChild(deadlineCell);
    }
}

// NOWA FUNKCJA: Dodaj/Edytuj link Google Drive
async function addGoogleDriveLink(projectIndex) {
    const project = projects[projectIndex];
    
    // Use fancy Google Picker API if available
    if (typeof openGoogleDrivePicker === 'function') {
        openGoogleDrivePicker(project);
    } else {
        // Fallback to simple prompt if picker not loaded
        const currentUrl = project.google_drive_url || '';
        const newUrl = prompt('Enter Google Drive folder URL:', currentUrl);
        
        if (newUrl !== null && newUrl !== currentUrl) {
            // Validate URL
            if (newUrl && !newUrl.includes('drive.google.com')) {
                showToast('Please enter a valid Google Drive URL', 'warning');
                return;
            }
            
            // Update local data
            project.google_drive_url = newUrl;
            
            // Save to Supabase if connected
            if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
                try {
                    const { error } = await supabaseClient
                        .from('projects')
                        .update({ google_drive_url: newUrl })
                        .eq('project_number', project.projectNumber);
                    
                    if (error) {
                        console.error('Error updating Google Drive URL:', error);
                        showToast('Error saving to database. URL saved locally only.', 'error');
                    }
                } catch (err) {
                    console.error('Database connection error:', err);
                }
            }
            
            // Update local storage and refresh
            saveDataQueued();
            render();
        }
    }
}
// Wczytaj zapisane sortowanie przy starcie
window.addEventListener('DOMContentLoaded', function() {
    const savedSort = localStorage.getItem('joinerySortMode') || 'number';
    currentSortMode = savedSort;

    // Zaznacz aktywny przycisk po załadowaniu
    setTimeout(() => {
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.sort-btn[data-sort="${savedSort}"]`)?.classList.add('active');
    }, 100);
    
    // Utwórz popup dla hover na fazach
    createPhaseHoverPopupOffice();
});

// ========== PHASE HOVER POPUP (OFFICE) ==========
let phaseHoverPopupOffice = null;
let hoverTimeoutOffice = null;

function createPhaseHoverPopupOffice() {
    if (phaseHoverPopupOffice) return;
    
    phaseHoverPopupOffice = document.createElement('div');
    phaseHoverPopupOffice.id = 'phaseHoverPopupOffice';
    phaseHoverPopupOffice.style.cssText = `
        position: fixed;
        background: #2d2d30;
        border: 1px solid #4a90e2;
        border-radius: 6px;
        padding: 8px 0;
        min-width: 200px;
        max-width: 300px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        z-index: 10000;
        display: none;
        font-size: 13px;
    `;
    document.body.appendChild(phaseHoverPopupOffice);
    
    // Ukryj popup gdy kursor wyjdzie
    phaseHoverPopupOffice.addEventListener('mouseleave', hidePhaseHoverPopupOffice);
}

function showPhaseHoverPopupOffice(e, projectIndex, phaseIndex) {
    if (!phaseHoverPopupOffice) createPhaseHoverPopupOffice();
    
    const project = projects[projectIndex];
    if (!project || !project.phases) return;
    
    const currentPhase = project.phases[phaseIndex];
    if (!currentPhase) return;
    
    // Znajdź wszystkie fazy które nakładają się z pozycją kursora
    const currentStart = new Date(currentPhase.start);
    const currentEnd = new Date(currentPhase.adjustedEnd || computeEnd(currentPhase));
    
    // Filtruj tylko office phases
    const overlappingPhases = project.phases
        .map((p, idx) => ({ phase: p, index: idx }))
        .filter(({ phase }) => {
            // Tylko office phases
            if (phase.category === 'production') return false;
            if (!OFFICE_PHASES.includes(phase.key) && phase.category !== 'office') return false;
            
            const pStart = new Date(phase.start);
            const pEnd = new Date(phase.adjustedEnd || computeEnd(phase));
            
            // Sprawdź czy fazy się nakładają
            return !(pEnd < currentStart || pStart > currentEnd);
        });
    
    // Buduj listę HTML
    let html = `<div style="padding: 5px 12px; color: #888; font-size: 11px; border-bottom: 1px solid #3e3e42; margin-bottom: 5px;">
        ${overlappingPhases.length} phase${overlappingPhases.length > 1 ? 's' : ''} at this position
    </div>`;
    
    overlappingPhases.forEach(({ phase, index }) => {
        const config = productionPhases[phase.key] || { name: phase.key, color: '#808080' };
        const workDays = phase.workDays || '?';
        
        html += `
            <div class="phase-popup-item" data-project="${projectIndex}" data-phase="${index}" 
                 style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s;"
                 onmouseover="this.style.background='#3e3e42'" 
                 onmouseout="this.style.background='transparent'">
                <div style="width: 12px; height: 12px; background: ${config.color}; border-radius: 2px; flex-shrink: 0;"></div>
                <div style="flex: 1; min-width: 0;">
                    <div style="color: #e8e2d5; font-weight: 500;">${config.name}</div>
                    <div style="color: #888; font-size: 11px;">${workDays} days</div>
                </div>
                <div style="color: #4a90e2; font-size: 11px;">Edit →</div>
            </div>
        `;
    });
    
    phaseHoverPopupOffice.innerHTML = html;
    
    // Dodaj click handlers
    phaseHoverPopupOffice.querySelectorAll('.phase-popup-item').forEach(item => {
        item.addEventListener('click', () => {
            const pIdx = parseInt(item.dataset.project);
            const phIdx = parseInt(item.dataset.phase);
            hidePhaseHoverPopupOffice();
            openPhaseEditModal(pIdx, phIdx);
        });
    });
    
    // Pozycjonowanie popup
    const rect = e.target.closest('.phase-container').getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 5;
    
    // Sprawdź czy mieści się na ekranie
    const popupWidth = 250;
    const popupHeight = overlappingPhases.length * 50 + 40;
    
    if (left + popupWidth > window.innerWidth) {
        left = window.innerWidth - popupWidth - 10;
    }
    if (top + popupHeight > window.innerHeight) {
        top = rect.top - popupHeight - 5;
    }
    
    phaseHoverPopupOffice.style.left = left + 'px';
    phaseHoverPopupOffice.style.top = top + 'px';
    phaseHoverPopupOffice.style.display = 'block';
}

function hidePhaseHoverPopupOffice() {
    if (phaseHoverPopupOffice) {
        phaseHoverPopupOffice.style.display = 'none';
    }
}

function setupPhaseHoverOffice(container, projectIndex, phaseIndex) {
    container.addEventListener('mouseenter', (e) => {
        // Opóźnienie przed pokazaniem popup
        hoverTimeoutOffice = setTimeout(() => {
            showPhaseHoverPopupOffice(e, projectIndex, phaseIndex);
        }, 300);
    });
    
    container.addEventListener('mouseleave', (e) => {
        clearTimeout(hoverTimeoutOffice);
        // Daj czas na przejście do popup
        setTimeout(() => {
            if (phaseHoverPopupOffice && !phaseHoverPopupOffice.matches(':hover')) {
                hidePhaseHoverPopupOffice();
            }
        }, 100);
    });
}