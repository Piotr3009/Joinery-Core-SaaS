// ========================================
// TODAY - Daily Briefing
// ========================================

// supabaseClient is already declared in config.js

// Global data
let todayData = {
    production: [],
    spraying: [],
    meetings: [],
    holidays: [],
    stock: [],
    fleet: [],
    officeDaily: [],  // Daily office phases + alerts
    pipeline: [],     // Monday only - pipeline review
    weekDeadlines: [],
    events: []
};

// Date helpers
const today = new Date();
const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday...
const isMonday = dayOfWeek === 1;
const isThursday = dayOfWeek === 4;
const isFriday = dayOfWeek === 5;

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Format date for display
function formatDateFull(date) {
    return `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

// Format date for DB queries (YYYY-MM-DD)
function formatDateDB(date) {
    return date.toISOString().split('T')[0];
}

// Get week boundaries (Mon-Sat)
function getWeekBounds() {
    const start = new Date(today);
    const diff = today.getDay() === 0 ? -6 : 1 - today.getDay(); // Monday
    start.setDate(today.getDate() + diff);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 5); // Saturday
    
    return { start, end };
}

// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', async () => {
    // Set today's date
    document.getElementById('todayDate').textContent = formatDateFull(today);
    
    // Load all data
    await loadAllData();
    
    // Render sections
    renderAll();
    
    // Show grid, hide loading
    document.getElementById('todayLoading').style.display = 'none';
    document.getElementById('todayGrid').style.display = 'grid';
    
    // Show Monday-only section
    if (isMonday) {
        document.getElementById('sectionPipelineWrapper').style.display = 'block';
    }
});

// ========== DATA LOADING ==========
async function loadAllData() {
    const todayStr = formatDateDB(today);
    const tomorrowStr = formatDateDB(new Date(today.getTime() + 24*60*60*1000));
    const weekBounds = getWeekBounds();
    const weekStartStr = formatDateDB(weekBounds.start);
    const weekEndStr = formatDateDB(weekBounds.end);
    const sevenDaysLater = formatDateDB(new Date(today.getTime() + 7*24*60*60*1000));
    
    try {
        // 1. Load team members
        const { data: teamMembers } = await supabaseClient
            .from('team_members')
            .select('id, name, role')
            .eq('active', true);
        
        const workerMap = {};
        teamMembers?.forEach(m => workerMap[m.id] = m.name);
        
        // 2. Load production phases - only phases active TODAY
        const { data: phasesToday } = await supabaseClient
            .from('project_phases')
            .select('*')
            .lte('start_date', todayStr)
            .gte('end_date', todayStr)
            .neq('status', 'Completed');
        
        // Load phases starting TOMORROW (separate query)
        const { data: phasesTomorrow } = await supabaseClient
            .from('project_phases')
            .select('*')
            .eq('start_date', tomorrowStr)
            .neq('status', 'Completed');
        
        // Combine and deduplicate by phase ID
        const phaseMap = new Map();
        phasesToday?.forEach(p => phaseMap.set(p.id, { ...p, isToday: true }));
        phasesTomorrow?.forEach(p => {
            if (!phaseMap.has(p.id)) {
                phaseMap.set(p.id, { ...p, isTomorrow: true });
            }
        });
        const productionPhases = Array.from(phaseMap.values());
        
        // Load projects separately (use status='active' not stage='production')
        const { data: productionProjects } = await supabaseClient
            .from('projects')
            .select('id, project_number, name, deadline')
            .eq('status', 'active');
        
        const projectMap = {};
        productionProjects?.forEach(p => projectMap[p.id] = p);
        
        // Process production - separate joinery and spraying
        // Group by worker + project to combine phases
        const workerProjectMap = new Map();
        
        if (productionPhases) {
            productionPhases.forEach(phase => {
                const project = projectMap[phase.project_id];
                if (!project) return; // Skip if project not in production
                
                const isSpray = phase.phase_key?.toLowerCase().includes('spray') || 
                               phase.phase_name?.toLowerCase().includes('spray');
                
                const isOffice = phase.phase_key?.toLowerCase().includes('order') || 
                                phase.phase_key?.toLowerCase().includes('office') ||
                                phase.phase_name?.toLowerCase().includes('order') ||
                                phase.phase_name?.toLowerCase().includes('office');
                
                // Skip office phases here - they go to officeDaily
                if (isOffice) return;
                
                const worker = workerMap[phase.assigned_to] || 'Unassigned';
                const key = `${worker}|${project.project_number}|${isSpray ? 'spray' : 'prod'}`;
                
                if (!workerProjectMap.has(key)) {
                    workerProjectMap.set(key, {
                        projectNumber: project.project_number,
                        projectName: project.name,
                        phases: [],
                        worker: worker,
                        workerId: phase.assigned_to,
                        isSpray: isSpray,
                        isDeadlineToday: project.deadline === todayStr, // Use PROJECT deadline, not phase end_date
                        startsTomorrow: false
                    });
                }
                
                const entry = workerProjectMap.get(key);
                entry.phases.push(phase.phase_name || phase.phase_key);
                if (phase.isTomorrow) entry.startsTomorrow = true;
            });
        }
        
        // Convert to arrays
        workerProjectMap.forEach((item, key) => {
            const entry = {
                projectNumber: item.projectNumber,
                projectName: item.projectName,
                phaseName: [...new Set(item.phases)].join(', '), // Unique phases
                worker: item.worker,
                workerId: item.workerId,
                isDeadlineToday: item.isDeadlineToday,
                startsTomorrow: item.startsTomorrow
            };
            
            if (item.isSpray) {
                todayData.spraying.push(entry);
            } else {
                todayData.production.push(entry);
            }
        });
        
        // 3. Load recurring events for today
        const { data: events } = await supabaseClient
            .from('today_events')
            .select('*')
            .eq('active', true);
        
        if (events) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            todayData.events = events.filter(e => {
                // Check if event should show today
                if (shouldShowEventToday(e, today)) return true;
                // Check if event is tomorrow and has "show day before" enabled
                if (e.show_day_before && shouldShowEventToday(e, tomorrow)) return true;
                return false;
            }).map(e => ({
                ...e,
                isReminder: !shouldShowEventToday(e, today) && e.show_day_before && shouldShowEventToday(e, tomorrow)
            }));
        }
        
        // 4. Load holidays today (using correct column names: date_from, date_to)
        const { data: holidays } = await supabaseClient
            .from('employee_holidays')
            .select(`
                id, date_from, date_to,
                team_members(name)
            `)
            .lte('date_from', todayStr)
            .gte('date_to', todayStr);
        
        if (holidays) {
            todayData.holidays = holidays.map(h => ({
                name: h.team_members?.name || 'Unknown',
                startDate: h.date_from,
                endDate: h.date_to
            }));
        }
        
        // 5. Load stock alerts (negative quantity)
        const { data: stockItems } = await supabaseClient
            .from('stock_items')
            .select('*');
        
        if (stockItems) {
            stockItems.forEach(item => {
                const available = (item.current_quantity || 0) - (item.reserved_quantity || 0);
                if (available < 0) {
                    todayData.stock.push({
                        name: item.name,
                        available: available,
                        unit: item.unit,
                        type: 'negative'
                    });
                } else if (isMonday && item.min_quantity && available <= item.min_quantity) {
                    todayData.stock.push({
                        name: item.name,
                        available: available,
                        minQuantity: item.min_quantity,
                        unit: item.unit,
                        type: 'low'
                    });
                }
            });
        }
        
        // 6. Load fleet alerts (MOT, Insurance within 7 days) - correct column names
        const { data: vans } = await supabaseClient
            .from('vans')
            .select('*');
        
        if (vans) {
            vans.forEach(van => {
                // MOT - use mot_due_date
                if (van.mot_due_date && van.mot_due_date <= sevenDaysLater && van.mot_due_date >= todayStr) {
                    const daysUntil = Math.ceil((new Date(van.mot_due_date) - today) / (24*60*60*1000));
                    todayData.fleet.push({
                        type: 'MOT',
                        vehicle: `${van.registration || ''} (${van.make || ''} ${van.model || ''})`.trim(),
                        dueDate: van.mot_due_date,
                        daysUntil: daysUntil
                    });
                }
                // Insurance - use insurance_due_date
                if (van.insurance_due_date && van.insurance_due_date <= sevenDaysLater && van.insurance_due_date >= todayStr) {
                    const daysUntil = Math.ceil((new Date(van.insurance_due_date) - today) / (24*60*60*1000));
                    todayData.fleet.push({
                        type: 'Insurance',
                        vehicle: `${van.registration || ''} (${van.make || ''} ${van.model || ''})`.trim(),
                        dueDate: van.insurance_due_date,
                        daysUntil: daysUntil
                    });
                }
            });
        }
        
        // 7. Load machine service alerts (next_service_date is from machine_service_history)
        const { data: machines } = await supabaseClient
            .from('machines')
            .select('*');
        
        // Load service history to get next_service_date
        const { data: serviceHistory } = await supabaseClient
            .from('machine_service_history')
            .select('machine_id, next_service_date')
            .order('service_date', { ascending: false });
        
        // Map next_service_date to machines
        const serviceMap = {};
        serviceHistory?.forEach(s => {
            if (!serviceMap[s.machine_id] && s.next_service_date) {
                serviceMap[s.machine_id] = s.next_service_date;
            }
        });
        
        if (machines) {
            machines.forEach(m => {
                const nextService = serviceMap[m.id];
                if (nextService && nextService <= sevenDaysLater && nextService >= todayStr) {
                    const daysUntil = Math.ceil((new Date(nextService) - today) / (24*60*60*1000));
                    todayData.fleet.push({
                        type: 'Service',
                        vehicle: m.name,
                        dueDate: nextService,
                        daysUntil: daysUntil
                    });
                }
            });
        }
        
        // 8. DAILY - Office phases (order, office type) active today + alerts
        // Load office phases from production projects
        if (productionPhases) {
            productionPhases.forEach(phase => {
                const project = projectMap[phase.project_id];
                if (!project) return;
                
                const isOffice = phase.phase_key?.toLowerCase().includes('order') || 
                                phase.phase_key?.toLowerCase().includes('office') ||
                                phase.phase_name?.toLowerCase().includes('order') ||
                                phase.phase_name?.toLowerCase().includes('office');
                
                if (isOffice) {
                    // Use phase_key for full name (e.g. "order_materials", "order_glazing")
                    // Convert underscore to space and capitalize
                    let fullPhaseName = phase.phase_key || phase.phase_name || 'order';
                    fullPhaseName = fullPhaseName.replace(/_/g, ' ');
                    
                    todayData.officeDaily.push({
                        type: 'phase',
                        projectNumber: project.project_number,
                        projectName: project.name,
                        phaseName: fullPhaseName,
                        worker: workerMap[phase.assigned_to] || 'Unassigned',
                        startDate: phase.start_date,
                        endDate: phase.end_date,
                        isDeadlineToday: project.deadline === todayStr // Use PROJECT deadline
                    });
                }
            });
        }
        
        // Load active alerts (excluding materials_warning - those are handled by the alerts system)
        const { data: alerts } = await supabaseClient
            .from('project_alerts')
            .select('*')
            .eq('status', 'active')
            .neq('alert_type', 'materials_warning');
        
        if (alerts && alerts.length > 0) {
            // Get project info for alerts
            const alertProjectIds = [...new Set(alerts.map(a => a.project_id).filter(Boolean))];
            let alertProjects = {};
            
            if (alertProjectIds.length > 0) {
                const { data: projData } = await supabaseClient
                    .from('projects')
                    .select('id, project_number, name')
                    .in('id', alertProjectIds);
                
                projData?.forEach(p => alertProjects[p.id] = p);
            }
            
            alerts.forEach(alert => {
                const proj = alertProjects[alert.project_id];
                todayData.officeDaily.push({
                    type: 'alert',
                    alertType: alert.alert_type,
                    message: alert.message,
                    projectNumber: proj?.project_number || '',
                    projectName: proj?.name || '',
                    createdAt: alert.created_at
                });
            });
        }
        
        // 9. Monday only - Pipeline projects > 8 weeks
        if (isMonday) {
            const eightWeeksAgo = new Date(today.getTime() - 8*7*24*60*60*1000);
            const { data: pipelineOld } = await supabaseClient
                .from('pipeline_projects')
                .select('id, project_number, name, created_at')
                .lte('created_at', eightWeeksAgo.toISOString());
            
            if (pipelineOld) {
                pipelineOld.forEach(p => {
                    const weeks = Math.floor((today - new Date(p.created_at)) / (7*24*60*60*1000));
                    todayData.pipeline.push({
                        type: 'pipeline_old',
                        projectNumber: p.project_number,
                        projectName: p.name,
                        weeks: weeks
                    });
                });
            }
            
            // Unassigned phases this week
            const { data: unassignedPhases } = await supabaseClient
                .from('project_phases')
                .select('*')
                .is('assigned_to', null)
                .gte('start_date', todayStr)
                .lte('start_date', weekEndStr);
            
            if (unassignedPhases && productionProjects) {
                unassignedPhases.forEach(p => {
                    const project = projectMap[p.project_id];
                    if (!project) return;
                    
                    todayData.pipeline.push({
                        type: 'unassigned',
                        projectNumber: project.project_number,
                        projectName: project.name,
                        phaseName: p.phase_name || p.phase_key,
                        startDate: p.start_date
                    });
                });
            }
        }
        
        // 10. This week deadlines (use status='active')
        if (productionProjects) {
            todayData.weekDeadlines = productionProjects
                .filter(p => p.deadline && p.deadline >= todayStr && p.deadline <= weekEndStr)
                .sort((a, b) => a.deadline.localeCompare(b.deadline))
                .map(p => ({
                    projectNumber: p.project_number,
                    projectName: p.name,
                    deadline: p.deadline,
                    isToday: p.deadline === todayStr
                }));
        }
        
    } catch (err) {
        showToast('Error loading data: ' + err.message, 'error');
    }
}

// ========== RENDERING ==========
function renderAll() {
    renderProduction();
    renderSpraying();
    renderMeetings();
    renderHolidays();
    renderStock();
    renderFleet();
    renderOfficeDaily();
    renderPipeline();
    renderWeekDeadlines();
}

function renderProduction() {
    const container = document.getElementById('sectionProduction');
    const badge = document.getElementById('badgeProduction');
    
    if (todayData.production.length === 0) {
        container.innerHTML = '<div class="today-empty">No production tasks today</div>';
        badge.textContent = '0';
        return;
    }
    
    // Group by worker
    const byWorker = {};
    todayData.production.forEach(item => {
        if (!byWorker[item.worker]) byWorker[item.worker] = [];
        byWorker[item.worker].push(item);
    });
    
    let html = '';
    Object.keys(byWorker).sort().forEach(worker => {
        html += `<div class="today-worker">
            <div class="today-worker-name">👤 ${worker}</div>
            <div class="today-worker-tasks">`;
        
        byWorker[worker].forEach(task => {
            let classes = 'today-task';
            let prefix = '';
            if (task.isDeadlineToday) {
                classes += ' deadline-today';
                prefix = '🔴 DEADLINE TODAY - ';
            } else if (task.startsTomorrow) {
                classes += ' starts-tomorrow';
                prefix = '🟢 Starts tomorrow - ';
            }
            
            html += `<div class="${classes}">
                ${prefix}<strong>${task.projectNumber}</strong> ${task.projectName}
                <span style="color: #888; font-size: 12px;"> - ${task.phaseName}</span>
            </div>`;
        });
        
        html += '</div></div>';
    });
    
    container.innerHTML = html;
    badge.textContent = todayData.production.length;
}

function renderSpraying() {
    const container = document.getElementById('sectionSpraying');
    const badge = document.getElementById('badgeSpraying');
    
    if (todayData.spraying.length === 0) {
        container.innerHTML = '<div class="today-empty">No spraying tasks today</div>';
        badge.textContent = '0';
        return;
    }
    
    // Group by worker
    const byWorker = {};
    todayData.spraying.forEach(item => {
        if (!byWorker[item.worker]) byWorker[item.worker] = [];
        byWorker[item.worker].push(item);
    });
    
    let html = '';
    Object.keys(byWorker).sort().forEach(worker => {
        html += `<div class="today-worker">
            <div class="today-worker-name">👤 ${worker}</div>
            <div class="today-worker-tasks">`;
        
        byWorker[worker].forEach(task => {
            let classes = 'today-task';
            let prefix = '';
            if (task.isDeadlineToday) {
                classes += ' deadline-today';
                prefix = '🔴 DEADLINE TODAY - ';
            }
            
            html += `<div class="${classes}">
                ${prefix}<strong>${task.projectNumber}</strong> ${task.projectName}
                <span style="color: #888; font-size: 12px;"> - ${task.phaseName}</span>
            </div>`;
        });
        
        html += '</div></div>';
    });
    
    container.innerHTML = html;
    badge.textContent = todayData.spraying.length;
}

function renderMeetings() {
    const container = document.getElementById('sectionMeetings');
    
    if (todayData.events.length === 0) {
        container.innerHTML = '<div class="today-empty">No meetings or reminders today</div>';
        return;
    }
    
    let html = '';
    todayData.events.forEach(event => {
        const timeStr = event.time ? `<strong>${event.time}</strong> - ` : '';
        const reminderBadge = event.isReminder ? '<span style="background: #f59e0b; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 8px;">TOMORROW</span>' : '';
        
        html += `<div class="today-item ${event.isReminder ? 'warning' : 'info'}">
            <div class="today-item-title">${timeStr}${event.title}${reminderBadge}</div>
            ${event.description ? `<div class="today-item-subtitle">${event.description}</div>` : ''}
        </div>`;
    });
    
    container.innerHTML = html;
}

function renderHolidays() {
    const container = document.getElementById('sectionHolidays');
    
    if (todayData.holidays.length === 0) {
        container.innerHTML = '<div class="today-empty">Everyone is working today ✓</div>';
        return;
    }
    
    let html = '';
    todayData.holidays.forEach(h => {
        html += `<div class="today-item warning">
            <div class="today-item-title">🏖️ ${h.name}</div>
            <div class="today-item-subtitle">Off until ${new Date(h.endDate).toLocaleDateString('en-GB')}</div>
        </div>`;
    });
    
    container.innerHTML = html;
}

function renderStock() {
    const container = document.getElementById('sectionStock');
    const badge = document.getElementById('badgeStock');
    
    const negative = todayData.stock.filter(s => s.type === 'negative');
    const low = todayData.stock.filter(s => s.type === 'low');
    
    if (todayData.stock.length === 0) {
        container.innerHTML = '<div class="today-empty">Stock levels OK ✓</div>';
        badge.style.display = 'none';
        return;
    }
    
    let html = '';
    
    if (negative.length > 0) {
        html += `<div class="today-item urgent">
            <div class="today-item-title">🔴 ${negative.length} items NEGATIVE</div>
            <div class="today-item-subtitle">Check urgent orders needed!</div>
        </div>`;
        
        // List in 2 columns
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 8px;">';
        negative.forEach(s => {
            html += `<div style="padding: 4px 8px; background: #2d2d30; border-radius: 3px; font-size: 11px; color: #e8e2d5; border-left: 2px solid #ef4444;">
                ${s.name}
            </div>`;
        });
        html += '</div>';
        
        badge.textContent = negative.length;
        badge.style.display = 'inline';
    }
    
    if (low.length > 0 && isMonday) {
        html += `<div class="today-item warning" style="margin-top: 12px;">
            <div class="today-item-title">⚠️ ${low.length} items LOW STOCK</div>
        </div>`;
        
        // List in 2 columns
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 8px;">';
        low.forEach(s => {
            html += `<div style="padding: 4px 8px; background: #2d2d30; border-radius: 3px; font-size: 11px; color: #e8e2d5; border-left: 2px solid #f59e0b;">
                ${s.name}
            </div>`;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function renderFleet() {
    const container = document.getElementById('sectionFleet');
    
    if (todayData.fleet.length === 0) {
        container.innerHTML = '<div class="today-empty">No alerts ✓</div>';
        return;
    }
    
    let html = '';
    todayData.fleet.sort((a, b) => a.daysUntil - b.daysUntil).forEach(item => {
        const urgentClass = item.daysUntil <= 3 ? 'urgent' : 'warning';
        const icon = item.type === 'MOT' ? '🔧' : item.type === 'Insurance' ? '📋' : '⚙️';
        
        html += `<div class="today-item ${urgentClass}">
            <div class="today-item-title">${icon} ${item.type} - ${item.vehicle}</div>
            <div class="today-item-subtitle">Due in ${item.daysUntil} day${item.daysUntil !== 1 ? 's' : ''} (${new Date(item.dueDate).toLocaleDateString('en-GB')})</div>
        </div>`;
    });
    
    container.innerHTML = html;
}

function renderOfficeDaily() {
    const container = document.getElementById('sectionOfficeDaily');
    const badge = document.getElementById('badgeOfficeDaily');
    
    if (todayData.officeDaily.length === 0) {
        container.innerHTML = '<div class="today-empty">No office tasks today ✓</div>';
        badge.textContent = '0';
        badge.style.display = 'none';
        return;
    }
    
    badge.textContent = todayData.officeDaily.length;
    badge.style.display = 'inline';
    
    let html = '';
    
    // Office phases
    const phases = todayData.officeDaily.filter(o => o.type === 'phase');
    if (phases.length > 0) {
        html += '<div style="margin-bottom: 10px;"><strong style="color: #f97316; font-size: 12px;">📋 Office Tasks:</strong></div>';
        phases.forEach(p => {
            const urgentClass = p.isDeadlineToday ? 'urgent' : '';
            const prefix = p.isDeadlineToday ? '🔴 ' : '';
            html += `<div class="today-item ${urgentClass}">
                <div class="today-item-title">${prefix}<strong>${p.projectNumber}</strong> - ${p.phaseName}</div>
                <div class="today-item-subtitle">${p.projectName} • ${p.worker}</div>
            </div>`;
        });
    }
    
    // Alerts
    const alerts = todayData.officeDaily.filter(o => o.type === 'alert');
    if (alerts.length > 0) {
        html += '<div style="margin-bottom: 10px; margin-top: 15px;"><strong style="color: #ef4444; font-size: 12px;">🔔 Active Alerts:</strong></div>';
        alerts.forEach(a => {
            html += `<div class="today-item warning">
                <div class="today-item-title">${a.projectNumber ? `<strong>${a.projectNumber}</strong> - ` : ''}${a.alertType || 'Alert'}</div>
                <div class="today-item-subtitle">${a.message || a.projectName}</div>
            </div>`;
        });
    }
    
    container.innerHTML = html;
}

function renderPipeline() {
    const container = document.getElementById('sectionPipeline');
    
    if (!isMonday || todayData.pipeline.length === 0) {
        container.innerHTML = '<div class="today-empty">No items to review ✓</div>';
        return;
    }
    
    let html = '';
    
    // Pipeline old
    const pipelineOld = todayData.pipeline.filter(o => o.type === 'pipeline_old');
    if (pipelineOld.length > 0) {
        html += '<div style="margin-bottom: 15px;"><strong style="color: #f59e0b;">📋 Pipeline - Too Long:</strong></div>';
        pipelineOld.forEach(p => {
            html += `<div class="today-item warning">
                <div class="today-item-title">${p.projectNumber} - ${p.projectName}</div>
                <div class="today-item-subtitle">${p.weeks} weeks in pipeline - Contact client or archive?</div>
            </div>`;
        });
    }
    
    // Unassigned
    const unassigned = todayData.pipeline.filter(o => o.type === 'unassigned');
    if (unassigned.length > 0) {
        html += '<div style="margin-bottom: 15px; margin-top: 20px;"><strong style="color: #4a9eff;">👤 Unassigned Phases This Week:</strong></div>';
        unassigned.forEach(p => {
            html += `<div class="today-item info">
                <div class="today-item-title">${p.projectNumber} - ${p.phaseName}</div>
                <div class="today-item-subtitle">Starts ${new Date(p.startDate).toLocaleDateString('en-GB')}</div>
            </div>`;
        });
    }
    
    container.innerHTML = html;
}

function renderWeekDeadlines() {
    const container = document.getElementById('sectionWeek');
    
    if (todayData.weekDeadlines.length === 0) {
        container.innerHTML = '<div class="today-empty">No deadlines this week ✓</div>';
        return;
    }
    
    let html = '';
    todayData.weekDeadlines.forEach(p => {
        const dateObj = new Date(p.deadline);
        const dayName = dayNames[dateObj.getDay()].substring(0, 3);
        const dateStr = dateObj.toLocaleDateString('en-GB');
        
        html += `<div class="today-item ${p.isToday ? 'urgent' : ''}">
            <div class="today-item-title">${p.isToday ? '🔴 TODAY - ' : ''}${dayName} ${dateStr}</div>
            <div class="today-item-subtitle"><strong>${p.projectNumber}</strong> - ${p.projectName}</div>
        </div>`;
    });
    
    container.innerHTML = html;
}

// ========== MANAGE EVENTS ==========
function openManageEvents() {
    loadEventsList();
    document.getElementById('manageEventsModal').classList.add('active');
}

function closeManageEvents() {
    document.getElementById('manageEventsModal').classList.remove('active');
}

async function loadEventsList() {
    const container = document.getElementById('eventsList');
    
    try {
        const { data: events, error } = await supabaseClient
            .from('today_events')
            .select('*')
            .order('day_of_week')
            .order('time');
        
        if (error) throw error;
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 30px; font-style: italic;">No recurring events yet. Add your first event below!</div>';
            return;
        }
        
        const dayColors = {
            1: '#3b82f6', // Monday - blue
            2: '#8b5cf6', // Tuesday - purple
            3: '#10b981', // Wednesday - green
            4: '#f59e0b', // Thursday - amber
            5: '#ef4444', // Friday - red
            6: '#06b6d4'  // Saturday - cyan
        };
        
        const sectionIcons = {
            'general': '📋',
            'production': '🪵',
            'spraying': '🎨',
            'office': '🗂️'
        };
        
        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #252526;">
                        <th style="text-align: left; padding: 12px 15px; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Frequency</th>
                        <th style="text-align: left; padding: 12px 15px; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Time</th>
                        <th style="text-align: left; padding: 12px 15px; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Event</th>
                        <th style="text-align: center; padding: 12px 15px; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Section</th>
                        <th style="text-align: center; padding: 12px 15px; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Active</th>
                        <th style="text-align: center; padding: 12px 15px; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Actions</th>
                    </tr>
                </thead>
                <tbody>`;
        
        events.forEach(e => {
            const dayColor = dayColors[e.day_of_week] || '#888';
            const sectionIcon = sectionIcons[e.section] || '📋';
            const activeStyle = e.active ? '' : 'opacity: 0.5;';
            const frequencyLabel = getFrequencyLabel(e);
            
            html += `
                <tr style="border-bottom: 1px solid #2d2d30; transition: background 0.2s; ${activeStyle}" onmouseover="this.style.background='#252526'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 14px 15px;">
                        <span style="display: inline-block; padding: 4px 12px; background: ${dayColor}22; color: ${dayColor}; border-radius: 4px; font-size: 11px; font-weight: 600;">
                            ${frequencyLabel}
                        </span>
                    </td>
                    <td style="padding: 14px 15px; color: #e8e2d5; font-family: monospace; font-size: 13px;">
                        ${e.time || '<span style="color: #666;">—</span>'}
                    </td>
                    <td style="padding: 14px 15px;">
                        <div style="color: #e8e2d5; font-weight: 500; font-size: 13px;">${e.title}</div>
                        ${e.description ? `<div style="color: #888; font-size: 11px; margin-top: 3px;">${e.description}</div>` : ''}
                        ${e.show_day_before ? `<span style="display: inline-block; margin-top: 4px; padding: 2px 6px; background: #f59e0b22; color: #f59e0b; border-radius: 3px; font-size: 10px;">🔔 Reminds day before</span>` : ''}
                    </td>
                    <td style="padding: 14px 15px; text-align: center;">
                        <span style="font-size: 16px;" title="${e.section}">${sectionIcon}</span>
                    </td>
                    <td style="padding: 14px 15px; text-align: center;">
                        <label style="display: inline-flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" ${e.active ? 'checked' : ''} onchange="toggleEventActive('${e.id}', this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: #22c55e;">
                        </label>
                    </td>
                    <td style="padding: 14px 15px; text-align: center;">
                        <button onclick="deleteEvent('${e.id}')" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='#ef4444';">
                            🗑️ Delete
                        </button>
                    </td>
                </tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (err) {
        container.innerHTML = '<div style="color: #ef4444; padding: 20px;">Error loading events</div>';
    }
}

async function addEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    const day = parseInt(document.getElementById('eventDay').value);
    const time = document.getElementById('eventTime').value || null;
    const section = document.getElementById('eventSection').value;
    const description = document.getElementById('eventDescription').value.trim() || null;
    const showDayBefore = document.getElementById('eventShowDayBefore').checked;
    
    if (!title) {
        showToast('Please enter a title', 'warning');
        return;
    }
    
    // Get frequency settings
    const frequency = document.getElementById('eventFrequency').value;
    let dayOfWeek = null;
    let dayOfMonth = null;
    let weekOfMonth = null;
    let months = null;
    let startDate = null;
    
    switch (frequency) {
        case 'weekly':
        case 'bi-weekly':
            dayOfWeek = parseInt(document.getElementById('eventDay').value);
            if (frequency === 'bi-weekly') {
                startDate = document.getElementById('eventStartDate').value || new Date().toISOString().split('T')[0];
            }
            break;
        case 'monthly-day':
            dayOfMonth = parseInt(document.getElementById('eventDayOfMonth').value);
            break;
        case 'monthly-weekday':
            dayOfWeek = parseInt(document.getElementById('eventDay').value);
            weekOfMonth = parseInt(document.getElementById('eventWeekOfMonth').value);
            break;
        case 'quarterly':
            dayOfMonth = parseInt(document.getElementById('eventDayOfMonth').value);
            months = document.getElementById('eventMonths').value;
            break;
        case 'semi-annual':
            dayOfMonth = parseInt(document.getElementById('eventDayOfMonth').value);
            months = document.getElementById('eventMonthsSemi').value;
            break;
        case 'annual':
            dayOfMonth = parseInt(document.getElementById('eventDayOfMonth').value);
            months = document.getElementById('eventMonthAnnual').value;
            break;
    }
    
    try {
        const { error } = await supabaseClient
            .from('today_events')
            .insert({
                title,
                day_of_week: dayOfWeek,
                time,
                section,
                description,
                show_day_before: showDayBefore,
                frequency,
                day_of_month: dayOfMonth,
                week_of_month: weekOfMonth,
                months,
                start_date: startDate
            });
        
        if (error) throw error;
        
        showToast('Event added!', 'success');
        
        // Clear form
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventTime').value = '';
        document.getElementById('eventDescription').value = '';
        document.getElementById('eventShowDayBefore').checked = false;
        document.getElementById('eventFrequency').value = 'weekly';
        updateFrequencyFields();
        
        // Reload list
        loadEventsList();
        
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function toggleEventActive(id, active) {
    try {
        const { error } = await supabaseClient
            .from('today_events')
            .update({ active })
            .eq('id', id);
        
        if (error) throw error;
        
        showToast(active ? 'Event activated' : 'Event deactivated', 'success');
        
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('today_events')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('Event deleted', 'success');
        loadEventsList();
        
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== FREQUENCY FIELD MANAGEMENT ==========
function updateFrequencyFields() {
    const frequency = document.getElementById('eventFrequency').value;
    
    // Hide all optional fields
    document.getElementById('fieldDayOfWeek').style.display = 'none';
    document.getElementById('fieldWeekOfMonth').style.display = 'none';
    document.getElementById('fieldDayOfMonth').style.display = 'none';
    document.getElementById('fieldMonths').style.display = 'none';
    document.getElementById('fieldMonthsSemi').style.display = 'none';
    document.getElementById('fieldMonthAnnual').style.display = 'none';
    document.getElementById('fieldStartDate').style.display = 'none';
    
    switch (frequency) {
        case 'weekly':
            document.getElementById('fieldDayOfWeek').style.display = 'block';
            break;
        case 'bi-weekly':
            document.getElementById('fieldDayOfWeek').style.display = 'block';
            document.getElementById('fieldStartDate').style.display = 'block';
            // Set default start date to today
            if (!document.getElementById('eventStartDate').value) {
                document.getElementById('eventStartDate').value = new Date().toISOString().split('T')[0];
            }
            break;
        case 'monthly-day':
            document.getElementById('fieldDayOfMonth').style.display = 'block';
            break;
        case 'monthly-weekday':
            document.getElementById('fieldDayOfWeek').style.display = 'block';
            document.getElementById('fieldWeekOfMonth').style.display = 'block';
            break;
        case 'quarterly':
            document.getElementById('fieldDayOfMonth').style.display = 'block';
            document.getElementById('fieldMonths').style.display = 'block';
            break;
        case 'semi-annual':
            document.getElementById('fieldDayOfMonth').style.display = 'block';
            document.getElementById('fieldMonthsSemi').style.display = 'block';
            break;
        case 'annual':
            document.getElementById('fieldDayOfMonth').style.display = 'block';
            document.getElementById('fieldMonthAnnual').style.display = 'block';
            break;
    }
}

// Check if event should show today based on frequency
function shouldShowEventToday(event, checkDate = new Date()) {
    const dayOfWeek = checkDate.getDay(); // 0=Sunday, 1=Monday...
    const dayOfMonth = checkDate.getDate();
    const month = checkDate.getMonth() + 1; // 1-12
    const frequency = event.frequency || 'weekly';
    
    switch (frequency) {
        case 'weekly':
            return event.day_of_week === dayOfWeek;
            
        case 'bi-weekly':
            if (event.day_of_week !== dayOfWeek) return false;
            // Check if it's the right week (every 2 weeks from start_date)
            const startDate = event.start_date ? new Date(event.start_date) : new Date('2025-01-06'); // Default Monday
            const diffTime = checkDate - startDate;
            const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
            return diffWeeks % 2 === 0;
            
        case 'monthly-day':
            return event.day_of_month === dayOfMonth;
            
        case 'monthly-weekday':
            if (event.day_of_week !== dayOfWeek) return false;
            // Check week of month
            const weekNum = Math.ceil(dayOfMonth / 7);
            if (event.week_of_month === -1) {
                // Last week - check if next week would be in next month
                const nextWeek = new Date(checkDate);
                nextWeek.setDate(dayOfMonth + 7);
                return nextWeek.getMonth() !== checkDate.getMonth();
            }
            return event.week_of_month === weekNum;
            
        case 'quarterly':
        case 'semi-annual':
        case 'annual':
            if (event.day_of_month !== dayOfMonth) return false;
            const eventMonths = event.months ? event.months.split(',').map(m => parseInt(m)) : [];
            return eventMonths.includes(month);
            
        default:
            return event.day_of_week === dayOfWeek;
    }
}

// Get frequency display text
function getFrequencyLabel(event) {
    const frequency = event.frequency || 'weekly';
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    switch (frequency) {
        case 'weekly':
            return dayNames[event.day_of_week] || 'Weekly';
        case 'bi-weekly':
            return `Every 2 weeks (${dayNames[event.day_of_week]})`;
        case 'monthly-day':
            return `Monthly (${event.day_of_month}${getOrdinal(event.day_of_month)})`;
        case 'monthly-weekday':
            const weekLabels = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', '-1': 'Last' };
            return `${weekLabels[event.week_of_month] || ''} ${dayNames[event.day_of_week]} monthly`;
        case 'quarterly':
            return `Quarterly (${event.day_of_month}${getOrdinal(event.day_of_month)})`;
        case 'semi-annual':
            return `Twice yearly (${event.day_of_month}${getOrdinal(event.day_of_month)})`;
        case 'annual':
            const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `Annual (${monthNames[parseInt(event.months)]} ${event.day_of_month})`;
        default:
            return dayNames[event.day_of_week] || 'Weekly';
    }
}

function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}