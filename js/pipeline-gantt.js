// ========== PIPELINE RENDERING ==========

// Helper function - emoji dla job_type
function getJobTypeIconPipeline(jobType) {
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

// Load team members for pipeline phases (management, admin)
async function loadTeamMembersForPipelinePhase() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('id, name, employee_number, color, color_code, job_type')
            .eq('active', true)
            .or('department.eq.management,department.eq.admin')
            .order('name');
        
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error loading team for pipeline:', err);
        return [];
    }
}

// Helper: Format date as DD/MM/YY
function formatShortDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
}

// Helper: Calculate lead time and return colored display
function calculateLeadTime(createdAt) {
    if (!createdAt) return { text: '-', color: '#999' };
    
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now - created;
    const diffWeeks = diffMs / (1000 * 60 * 60 * 24 * 7);
    
    let text = '';
    let color = '';
    
    if (diffWeeks < 1) {
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        text = `${diffDays}d`;
    } else {
        text = `${Math.floor(diffWeeks)}w`;
    }
    
    // Color coding: < 3w green, 3-6w yellow, 6-10w orange, > 10w red
    if (diffWeeks < 3) {
        color = '#4CAF50'; // green
    } else if (diffWeeks < 6) {
        color = '#FFC107'; // yellow
    } else if (diffWeeks < 10) {
        color = '#FF9800'; // orange
    } else {
        color = '#f44336'; // red
    }
    
    return { text, color, weeks: diffWeeks };
}

function renderPipeline() {
    renderPipelineTimeline();
    renderPipelineProjects();
    renderPipelineGridPattern();
    renderTodayLine();
}

// Grid pattern and green stripes for Sundays (pipeline version)
function renderPipelineGridPattern() {
    document.querySelectorAll('.grid-line').forEach(el => el.remove());
    document.querySelectorAll('.sunday-stripe').forEach(el => el.remove());
    
    const baseLeft = 695;
    const gridHeight = Math.max(2000, pipelineProjects.length * 60 + 500);
    const gridWidth = baseLeft + daysToShow * dayWidth;
    const chartBody = document.getElementById('chartBody');
    if (!chartBody) return;
    
    // Ustaw minimalną wielkość chartBody
    chartBody.style.minWidth = gridWidth + 'px';
    chartBody.style.minHeight = gridHeight + 'px';
    
    // Użyj CSS repeating-linear-gradient dla linii pionowych
    chartBody.style.backgroundImage = `repeating-linear-gradient(
        to right,
        transparent,
        transparent ${dayWidth - 1}px,
        rgba(255,255,255,0.05) ${dayWidth - 1}px,
        rgba(255,255,255,0.05) ${dayWidth}px
    )`;
    chartBody.style.backgroundSize = `${dayWidth}px 100%`;
    chartBody.style.backgroundPosition = `${baseLeft}px 0`;
    
    // Sunday stripes (blue for pipeline)
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        
        if (date.getDay() === 0) {  // Sunday
            const stripe = document.createElement('div');
            stripe.className = 'sunday-stripe';
            stripe.style.cssText = `
                position: absolute;
                left: ${baseLeft + i * dayWidth}px;
                top: 0;
                bottom: 0;
                width: ${dayWidth}px;
                background: rgba(7, 79, 138, 0.1);
                pointer-events: none;
                z-index: 1;
                border-left: 1px solid rgba(41, 15, 173, 0.2);
                border-right: 1px solid rgba(41, 15, 173, 0.2);
            `;
            chartBody.appendChild(stripe);
        }
    }
}

function renderPipelineTimeline() {
    const header = document.getElementById('timelineHeader');
    if (!header) {
        console.error('Timeline header not found!');
        return;
    }
    
    // Clear header
    header.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'timeline-grid';
    grid.style.cssText = `
        display: flex;
        height: 100%;
        position: relative;
        width: ${daysToShow * dayWidth}px;
        min-width: ${daysToShow * dayWidth}px;
    `;
    
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        // Basic styles for each cell
        cell.style.cssText = `
            width: ${dayWidth}px;
            min-width: ${dayWidth}px;
            max-width: ${dayWidth}px;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-right: 1px solid #354339;
            box-sizing: border-box;
            flex-shrink: 0;
        `;
        
        // SUNDAY - add style (no class!)
        if (date.getDay() === 0) {
            cell.style.backgroundColor = 'rgba(7, 79, 138, 0.1)';
        }
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.style.cssText = `
            font-size: 14px;
            font-weight: ${date.getDay() === 0 ? 'bold' : 'normal'};
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
        grid.appendChild(cell);
    }
    
    header.appendChild(grid);
    
    // Sync width with timeline cells
    const timelineCells = document.querySelectorAll('.timeline-cell');
    timelineCells.forEach(cell => {
        cell.style.width = (daysToShow * dayWidth) + 'px';
        cell.style.minWidth = (daysToShow * dayWidth) + 'px';
    });
}

function renderPipelineProjects() {
    const body = document.getElementById('chartBody');
    body.innerHTML = '';
    
    // Sort projects based on current sort mode
    let sortedProjects = [...pipelineProjects];
    
    if (typeof pipelineSortMode !== 'undefined') {
        if (pipelineSortMode === 'number') {
            // Sort by project number
            sortedProjects.sort((a, b) => {
                const numA = a.projectNumber || '';
                const numB = b.projectNumber || '';
                return numA.localeCompare(numB);
            });
        } else if (pipelineSortMode === 'leadtime') {
            // Sort by lead time - shortest first (newest projects first)
            sortedProjects.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                const leadTimeA = Math.floor((Date.now() - dateA) / (1000 * 60 * 60 * 24));
                const leadTimeB = Math.floor((Date.now() - dateB) / (1000 * 60 * 60 * 24));
                return leadTimeA - leadTimeB;
            });
        }
    }
    
    sortedProjects.forEach((project, sortedIndex) => {
        // Find original index in pipelineProjects array (same method as Production)
        const originalIndex = pipelineProjects.indexOf(project);
        
        const phaseKeys = project.phases?.map(p => p.key) || [];
        const uniqueKeys = [...new Set(phaseKeys)];
        if (phaseKeys.length !== uniqueKeys.length) {
            console.error(`Duplicate phase keys in project ${project.name}:`, phaseKeys);
        }
        
        const row = document.createElement('div');
        row.className = 'project-row';
        
        const projectCell = document.createElement('div');
        projectCell.className = 'project-cell';
        
        const projectType = projectTypes[project.type] || projectTypes.other;
        
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
            <div class="project-column project-date-added" title="Date Added">
                ${formatShortDate(project.created_at)}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-lead-time" title="Lead Time" style="color: ${calculateLeadTime(project.created_at).color}; font-weight: 600;">
                ${calculateLeadTime(project.created_at).text}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-actions">
                <button class="action-btn" onclick="editPipelineProject(${originalIndex})" title="Edit">✏️</button>
                <button class="action-btn" onclick="openProjectFilesModal(${originalIndex}, 'pipeline')" title="Project Files">📁</button>
                <button class="action-btn ${project.notes ? 'has-notes' : 'no-notes'}" onclick="openPipelineProjectNotes(${originalIndex})" title="Project Notes">${project.notes ? '📝' : '📋'}</button>
            </div>
        `;
        
        const timelineCell = document.createElement('div');
        timelineCell.className = 'timeline-cell';
        timelineCell.style.width = (daysToShow * dayWidth) + 'px';
        timelineCell.style.minWidth = (daysToShow * dayWidth) + 'px';
        timelineCell.style.overflow = 'hidden';
        
        if (project.phases) {
            // NIE sortujemy - wyświetlamy w kolejności użytkownika
            const overlaps = detectPipelinePhaseOverlaps(project.phases);
            
            project.phases.forEach((phase, phaseIndex) => {
                const phaseBar = createPipelinePhaseBar(phase, project, originalIndex, phaseIndex, overlaps);
                if (phaseBar) timelineCell.appendChild(phaseBar);
            });
        }
        
        row.appendChild(projectCell);
        row.appendChild(timelineCell);
        body.appendChild(row);
    });
}

function detectPipelinePhaseOverlaps(phases) {
    const overlaps = [];
    if (!Array.isArray(phases) || phases.length < 2) return overlaps;

    const norm = phases.map((p, idx) => ({
        idx,
        key: p.key,
        start: new Date(p.start),
        end: new Date(p.adjustedEnd || p.end)
    })).sort((a,b) => a.start - b.start);

    for (let i = 0; i < norm.length; i++) {
        for (let j = i + 1; j < norm.length; j++) {
            const A = norm[i], B = norm[j];
            if (B.start >= A.end) break;
            const overlapStart = new Date(Math.max(A.start, B.start));
            const overlapEnd = new Date(Math.min(A.end, B.end));
            if (overlapEnd > overlapStart) {
                overlaps.push({ 
                    phase1Key: phases[A.idx].key, 
                    phase2Key: phases[B.idx].key, 
                    phase1Idx: A.idx,
                    phase2Idx: B.idx,
                    overlapStart, overlapEnd 
                });
            }
        }
    }
    return overlaps;
}

function createPipelinePhaseBar(phase, project, projectIndex, phaseIndex, overlaps) {
    const container = document.createElement('div');
    const phaseConfig = pipelinePhases[phase.key] || phases[phase.key];
    
    // Fallback for custom phases - create config on the fly
    const color = phaseConfig?.color || '#888888';
    const phaseName = phaseConfig?.name || phase.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    container.className = 'phase-container';
    
    const start = new Date(phase.start);
    const end = computeEnd(phase);
    
    let adjustedEnd = new Date(end);
    
    const daysDiff = Math.round((start - visibleStartDate) / (1000 * 60 * 60 * 24));
    const duration = Math.round((adjustedEnd - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const workDays = phase.workDays || workingDaysBetween(start, adjustedEnd);
    const displayDays = workDays;
    
    container.style.left = (daysDiff * dayWidth) + 'px';
    container.style.width = (duration * dayWidth) + 'px';
    container.style.borderColor = color;
    
    // Top part - colored
    const topDiv = document.createElement('div');
    topDiv.className = 'phase-top';
    
    const overlap = overlaps.find(o => 
        o.phase1Key === phase.key || o.phase2Key === phase.key
    );
    
    if (overlap) {
        const sPhase = new Date(phase.start);
        const ePhase = new Date(phase.adjustedEnd || phase.end);
        const sOverlap = overlap.overlapStart;
        const eOverlap = overlap.overlapEnd;

        const dayMs = 1000 * 60 * 60 * 24;
        const widthPx = parseInt(container.style.width);

        const fromStartDays = Math.max(0, Math.round((sOverlap - sPhase) / dayMs));
        const overlapDays = Math.max(0, Math.round((eOverlap - sOverlap) / dayMs) + 1);

        const overlayLeft = Math.min(widthPx, fromStartDays * dayWidth);
        const overlayWidth = Math.max(0, Math.min(widthPx - overlayLeft, overlapDays * dayWidth));

        topDiv.style.background = color;

        if (overlayWidth > 0) {
            const otherKey = (overlap.phase1Key === phase.key) ? overlap.phase2Key : overlap.phase1Key;
            const otherConfig = pipelinePhases[otherKey] || phases[otherKey];
            const otherColor = otherConfig?.color || '#888';
            const overlay = document.createElement('div');
            overlay.className = 'dual-overlay';
            overlay.style.left = overlayLeft + 'px';
            overlay.style.width = overlayWidth + 'px';
            overlay.style.background = `linear-gradient(90deg, ${color} 0 50%, ${otherColor} 50% 100%)`;
            container.appendChild(overlay);
        }
    } else {
        topDiv.style.background = color;
    }
    
    topDiv.innerHTML = `<span>${phaseName}</span>`;
    
    // Bottom part
    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'phase-bottom';
    
    let bottomContent = `<span class="phase-days-info">(${displayDays} days)</span>`;
    
    if (phase.notes) {
        bottomContent += `<span class="phase-note-icon" title="Has notes">📝</span>`;
    }
    
    bottomDiv.innerHTML = bottomContent;
    
    container.appendChild(topDiv);
    container.appendChild(bottomDiv);
    
    container.dataset.projectIndex = projectIndex;
    container.dataset.phaseIndex = phaseIndex;
    
    const endDateStr = formatDate(end);
    let tooltipText = `${phaseName}: ${phase.start} to ${endDateStr} (${displayDays} work days)`;
    tooltipText += `\nStatus: ${status.name}`;
    if (phase.notes) tooltipText += `\nNotes: ${phase.notes.substring(0, 50)}...`;
    if (overlap) {
        const otherKey = (overlap.phase1Key === phase.key) ? overlap.phase2Key : overlap.phase1Key;
        const otherConfig = pipelinePhases[otherKey] || phases[otherKey];
        tooltipText += `\n⚠️ Overlapping with ${otherConfig?.name || 'phase'}`;
    }
    
    container.title = tooltipText;
    
    container.ondblclick = (e) => {
        e.stopPropagation();
        openPipelinePhaseEditModal(projectIndex, phaseIndex);
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
        startDrag(e, container, phase, projectIndex, phaseIndex);
    };
    
    return container;
}

function editPipelineProjectNumber(index) {
    // Project numbers are auto-generated and cannot be edited
    showToast('Project numbers are auto-generated and cannot be edited.', 'info');
}

// Open phase edit modal for pipeline phases
function openPipelinePhaseEditModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = pipelineProjects[projectIndex];
    const phase = project.phases[phaseIndex];
    const phaseConfig = pipelinePhases[phase.key] || phases[phase.key];
    
    // Fallback for custom phases not in config
    const phaseName = phaseConfig?.name || phase.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    // Calculate work days
    const start = new Date(phase.start);
    const end = new Date(phase.end);
    const workDays = calculateWorkDays(start, end);
    
    // Set modal title
    document.getElementById('phaseEditTitle').textContent = `Edit ${phaseName}`;
    
    // Fill fields
    document.getElementById('phaseDuration').value = workDays;
    document.getElementById('phaseNotes').value = phase.notes || '';
    
    // Set phase status
    const statusSelect = document.getElementById('phaseStatus');
    statusSelect.value = phase.status || 'notStarted';
    
    // Pipeline phases - show team assignment (management, admin, sales)
    const assignSection = document.getElementById('assignSection');
    if (assignSection) {
        assignSection.style.display = 'block';
        
        // Load team members for pipeline phases
        loadTeamMembersForPipelinePhase().then(employees => {
            const select = document.getElementById('phaseAssignSelect');
            select.innerHTML = '<option value="">Select employee...</option>';
            
            employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = `${getJobTypeIconPipeline(emp.job_type)} ${emp.name} (${emp.employee_number || '-'})`;
                
                if (phase.assignedTo === emp.id) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            if (employees.length === 0) {
                select.innerHTML = '<option value="">No team members available</option>';
            }
        });
    }
    
    // Show delete button
    const deleteBtn = document.getElementById('deletePhaseBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
    }
    
    openModal('phaseEditModal');
}

// ADD MISSING renderTodayLine function
function renderTodayLine() {
    const existing = document.querySelector('.today-line');
    if (existing) existing.remove();
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const daysDiff = Math.round((today - visibleStartDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 0 && daysDiff < daysToShow) {
        const chartBody = document.getElementById('chartBody');
        if (!chartBody) return;
        
        const line = document.createElement('div');
        line.className = 'today-line';
        line.style.cssText = `
            position: absolute;
            left: ${695 + daysDiff * dayWidth}px;
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

// ADD MISSING workingDaysBetween function
function workingDaysBetween(startDate, endDate) {
    let count = 0;
    let current = new Date(startDate);
    while (current <= endDate) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) { // nie niedziela i nie sobota
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

// Google Drive link for pipeline
async function addPipelineGoogleDriveLink(projectIndex) {
    const project = pipelineProjects[projectIndex];
    const currentUrl = project.google_drive_url || '';
    
    const newUrl = prompt('Enter Google Drive folder URL:', currentUrl);
    
    if (newUrl !== null && newUrl !== currentUrl) {
        if (newUrl && !newUrl.includes('drive.google.com')) {
            showToast('Please enter a valid Google Drive URL', 'warning');
            return;
        }
        
        project.google_drive_url = newUrl;
        
        if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
            try {
                const { error } = await supabaseClient
                    .from('pipeline_projects')
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
        
        saveDataQueued();
        renderPipeline();
    }
}

// Google Drive Picker wrapper for Pipeline (fancy picker)
function openPipelineGoogleDrivePicker(projectIndex) {
    const project = pipelineProjects[projectIndex];
    
    // Check if picker is available
    if (typeof openGoogleDrivePicker !== 'function') {
        console.warn('Google Drive Picker not loaded, falling back to prompt');
        addPipelineGoogleDriveLink(projectIndex);
        return;
    }
    
    // Store original callback
    const originalCallback = window.pickerCallback;
    
    // Temporarily override pickerCallback for pipeline
    window.pickerCallback = async function(data) {
        if (data.action === google.picker.Action.PICKED) {
            const folder = data.docs[0];
            const folderUrl = folder.url || `https://drive.google.com/drive/folders/${folder.id}`;
            
            // Update pipeline project
            project.google_drive_url = folderUrl;
            project.google_drive_folder_id = folder.id;
            
            // Save to Supabase pipeline table
            if (typeof supabaseClient !== 'undefined') {
                const { error } = await supabaseClient
                    .from('pipeline_projects')
                    .update({ 
                        google_drive_url: folderUrl,
                        google_drive_folder_id: folder.id
                    })
                    .eq('project_number', project.projectNumber);
                
                if (error) {
                    console.error('Error saving:', error);
                    showToast('Failed to save Google Drive folder', 'error');
                } else {
                    showToast(`Folder "${folder.name}" linked!`, 'info');
                }
            }
            
            saveDataQueued();
            renderPipeline();
            
            // Restore original callback after delay
            setTimeout(() => {
                window.pickerCallback = originalCallback;
            }, 100);
        }
    };
    
    // Open picker
    openGoogleDrivePicker(project);
}

// Nadpisz funkcję shiftWeek dla Pipeline
window.shiftWeek = function(direction) {
    visibleStartDate.setDate(visibleStartDate.getDate() + (7 * direction));
    renderPipeline();
}