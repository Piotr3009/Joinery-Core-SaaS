// ========== OFFICE ALERTS SYSTEM ==========

// Pracownicy administracyjni (hardcoded - można też fetch z Supabase)
const OFFICE_STAFF = [
    { id: '4e2d2ed2-38c0-4597-b5c3-0d34737e9a0b', name: 'Julia Dodzian', role: 'Office Admin' },
    { id: '8b4213b9-1d79-4ecd-902d-e4417c5223e2', name: 'Katarzyna Kowalska', role: 'OM' }
];

// Pobierz aktywne alerty z Supabase
async function loadActiveAlerts() {
    try {
        const now = new Date().toISOString();
        
        const { data, error } = await supabaseClient
            .from('project_alerts')
            .select('*')
            .eq('status', 'active')
            .or(`snoozed_until.is.null,snoozed_until.lt.${now}`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Dla alertów materiałowych - sprawdź czy już potwierdzone
        const alertsToShow = [];
        for (const alert of (data || [])) {
            // Jeśli to alert o materiałach - sprawdź phase
            if (alert.type === 'materials_warning' && alert.phase_id) {
                const { data: phase } = await supabaseClient
                    .from('project_phases')
                    .select('materials_ordered_confirmed')
                    .eq('id', alert.phase_id)
                    .single();
                
                // Jeśli materiały potwierdzone - pomiń alert
                if (phase?.materials_ordered_confirmed === true) {
                    continue;
                }
            }
            alertsToShow.push(alert);
        }
        
        if (alertsToShow.length > 0) {
            displayAlerts(alertsToShow);
        } else {
            hideAlerts();
        }
        
        return alertsToShow;
    } catch (error) {
        console.error('Error loading alerts:', error);
        return [];
    }
}

// ========== MATERIALS REPORT ==========
async function openMaterialsReport() {
    try {
        // 1. Pobierz phases z potwierdzonymi materiałami
        const { data: phases, error: phasesError } = await supabaseClient
            .from('project_phases')
            .select('*')
            .not('materials_ordered_confirmed', 'is', null)
            .eq('materials_ordered_confirmed', true)
            .order('materials_ordered_confirmed_at', { ascending: false });
        
        if (phasesError) throw phasesError;
        
        if (!phases || phases.length === 0) {
            showEmptyReport();
            return;
        }
        
        // 2. Pobierz unikalne project_id
        const projectIds = [...new Set(phases.map(p => p.project_id))];
        
        // 3. Pobierz projekty
        const { data: projects, error: projectsError } = await supabaseClient
            .from('projects')
            .select('id, project_number, name')
            .in('id', projectIds);
        
        if (projectsError) throw projectsError;
        
        // 4. Połącz dane i zmapuj user_id → imię
        const projectsMap = {};
        projects.forEach(p => {
            projectsMap[p.id] = p;
        });
        
        // Mapowanie user_id → imię (z OFFICE_STAFF lub "Unknown")
        const staffMap = {};
        OFFICE_STAFF.forEach(staff => {
            staffMap[staff.id] = staff.name;
        });
        
        const combinedData = phases.map(phase => ({
            ...phase,
            project: projectsMap[phase.project_id],
            confirmed_by_name: staffMap[phase.materials_ordered_confirmed_by] || phase.materials_ordered_confirmed_by || 'Unknown'
        })).filter(item => item.project); // Usuń te bez projektu
        
        // 5. Utwórz modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'materialsReportModal';
        modal.style.display = 'flex';
        
        let tableRows = combinedData.map(item => `
            <tr style="border-bottom: 1px solid #404040;">
                <td style="padding: 12px; color: #e0e0e0;">${item.project.project_number}</td>
                <td style="padding: 12px; color: #e0e0e0;">${item.project.name}</td>
                <td style="padding: 12px; color: #4a9eff; text-transform: capitalize;">${item.phase_key || 'N/A'}</td>
                <td style="padding: 12px; color: #88d498; font-weight: 600;">${item.confirmed_by_name}</td>
                <td style="padding: 12px; color: #999;">${new Date(item.materials_ordered_confirmed_at).toLocaleString('en-GB')}</td>
            </tr>
        `).join('');
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px !important; max-height: 80vh; background: #1a1a1a; border: 1px solid #404040;">
                <div class="modal-header" style="background: #252525; border-bottom: 1px solid #404040; color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 18px; font-weight: 600;">📋 Materials Confirmation Report</div>
                        <div style="font-size: 13px; color: #999; margin-top: 4px;">Who confirmed 100% material orders (${combinedData.length} confirmations)</div>
                    </div>
                    <button onclick="closeMaterialsReport()" style="
                        background: #333;
                        border: 1px solid #555;
                        color: #fff;
                        width: 32px;
                        height: 32px;
                        border-radius: 6px;
                        font-size: 18px;
                        cursor: pointer;
                    ">✕</button>
                </div>
                <div class="modal-body" style="padding: 0; overflow-y: auto; max-height: calc(80vh - 140px);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: #252525; position: sticky; top: 0; z-index: 10;">
                            <tr style="border-bottom: 2px solid #404040;">
                                <th style="padding: 12px; text-align: left; color: #999; font-weight: 600; font-size: 12px; text-transform: uppercase;">Project #</th>
                                <th style="padding: 12px; text-align: left; color: #999; font-weight: 600; font-size: 12px; text-transform: uppercase;">Project Name</th>
                                <th style="padding: 12px; text-align: left; color: #999; font-weight: 600; font-size: 12px; text-transform: uppercase;">Phase</th>
                                <th style="padding: 12px; text-align: left; color: #999; font-weight: 600; font-size: 12px; text-transform: uppercase;">Confirmed By</th>
                                <th style="padding: 12px; text-align: left; color: #999; font-weight: 600; font-size: 12px; text-transform: uppercase;">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                <div style="padding: 16px 20px; background: #252525; border-top: 1px solid #404040; display: flex; justify-content: flex-end;">
                    <button onclick="closeMaterialsReport()" style="
                        background: #333;
                        border: 1px solid #555;
                        color: #e0e0e0;
                        padding: 10px 24px;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                    ">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error loading materials report:', error);
        showToast('Error loading: ' + error.message, 'error');
    }
}

function showEmptyReport() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'materialsReportModal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; background: #1a1a1a; border: 1px solid #404040;">
            <div class="modal-header" style="background: #252525; border-bottom: 1px solid #404040; color: #fff; padding: 16px 20px;">
                <div style="font-size: 18px; font-weight: 600;">📋 Materials Confirmation Report</div>
            </div>
            <div class="modal-body" style="padding: 40px; text-align: center;">
                <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
                <div style="font-size: 18px; color: #999; margin-bottom: 8px;">No confirmed material orders found</div>
                <div style="font-size: 14px; color: #666;">Start confirming materials to see them here</div>
            </div>
            <div style="padding: 16px 20px; background: #252525; border-top: 1px solid #404040; display: flex; justify-content: flex-end;">
                <button onclick="closeMaterialsReport()" style="
                    background: #333;
                    border: 1px solid #555;
                    color: #e0e0e0;
                    padding: 10px 24px;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                ">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeMaterialsReport() {
    const modal = document.getElementById('materialsReportModal');
    if (modal) modal.remove();
}

// Wyświetl alerty na stronie
function displayAlerts(alerts) {
    const container = document.getElementById('alertsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    alerts.forEach(alert => {
        const alertHTML = createAlertHTML(alert);
        container.insertAdjacentHTML('beforeend', alertHTML);
    });
    
    container.style.display = 'block';
}

// Utwórz HTML dla pojedynczego alertu
function createAlertHTML(alert) {
    const metadata = alert.metadata || {};
    const projectName = metadata.project_name || 'Unknown Project';
    const phaseKey = metadata.phase_key || '';
    const startDate = metadata.start_date || '';
    const endDate = metadata.end_date || '';
    
    // Format daty
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    
    // Nazwa fazy
    const phaseNames = {
        'timber': 'Timber',
        'spray': 'Spray',
        'glazing': 'Glazing',
        'qc': 'QC'
    };
    const phaseName = phaseNames[phaseKey] || phaseKey;
    
    // Dropdown pracowników
    const staffOptions = OFFICE_STAFF.map(staff => 
        `<option value="${staff.id}">${staff.name} (${staff.role})</option>`
    ).join('');
    
    return `
        <div class="alert-banner" data-alert-id="${alert.id}">
            <div class="alert-tape">
                ⚠️ PRODUCTION UPDATED - ACTION REQUIRED ⚠️
            </div>
            <div class="alert-content">
                <div class="alert-project-title">
                    Project: ${alert.project_number} - ${projectName}
                </div>
                
                <div class="alert-phases-list">
                    Production dates changed:
                    <div class="alert-phase-item">
                        • <strong>${phaseName}</strong>: ${formatDate(startDate)} - ${formatDate(endDate)}
                    </div>
                </div>
                
                <div class="alert-deadline">
                    ⏰ Order materials before: <strong>${formatDate(startDate)}</strong>
                </div>
                
                <div class="alert-confirm-section">
                    <label class="alert-confirm-label">Confirmed by:</label>
                    <select class="alert-staff-select" id="staff-${alert.id}">
                        <option value="">Select staff member...</option>
                        ${staffOptions}
                    </select>
                </div>
                
                <div class="alert-actions">
                    <button class="alert-btn alert-btn-dismiss" onclick="dismissAlert('${alert.id}')">
                        Dismiss
                    </button>
                    <button class="alert-btn alert-btn-snooze" onclick="snoozeAlert('${alert.id}')">
                        ⏰ Remind Later
                    </button>
                    <button class="alert-btn alert-btn-confirm" onclick="confirmAlert('${alert.id}')">
                        ✓ Confirm Order
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Ukryj kontener alertów
function hideAlerts() {
    const container = document.getElementById('alertsContainer');
    if (container) {
        container.style.display = 'none';
    }
}

// Dismiss alert (usuń bez potwierdzenia)
async function dismissAlert(alertId) {
    try {
        const { error } = await supabaseClient
            .from('project_alerts')
            .update({ 
                status: 'dismissed',
                dismissed_at: new Date().toISOString()
            })
            .eq('id', alertId);
        
        if (error) throw error;
        
        // Usuń alert z UI
        const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
        if (alertElement) {
            alertElement.style.transition = 'opacity 0.3s, transform 0.3s';
            alertElement.style.opacity = '0';
            alertElement.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                alertElement.remove();
                
                // Jeśli nie ma więcej alertów, ukryj kontener
                const container = document.getElementById('alertsContainer');
                if (container && container.children.length === 0) {
                    hideAlerts();
                }
            }, 300);
        }
        
    } catch (error) {
        console.error('Error dismissing alert:', error);
        showToast('Error dismissing alert. Please try again.', 'error');
    }
}

// Confirm alert (potwierdź zamówienie materiałów)
async function confirmAlert(alertId) {
    const staffSelect = document.getElementById(`staff-${alertId}`);
    const confirmedBy = staffSelect?.value;
    
    if (!confirmedBy) {
        showToast('Please select a staff member who confirmed the order.', 'warning');
        return;
    }
    
    try {
        // 1. Update alert status
        const { error: alertError } = await supabaseClient
            .from('project_alerts')
            .update({ 
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
                confirmed_by: confirmedBy
            })
            .eq('id', alertId);
        
        if (alertError) throw alertError;
        
        // 2. Get alert data to find project
        const { data: alertData, error: fetchError } = await supabaseClient
            .from('project_alerts')
            .select('project_id, metadata')
            .eq('id', alertId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 3. Update production phases - mark materials as confirmed
        const phaseKey = alertData.metadata?.phase_key;
        
        if (phaseKey) {
            const { error: phaseError } = await supabaseClient
                .from('project_phases')
                .update({
                    materials_ordered_confirmed: true,
                    materials_ordered_confirmed_by: confirmedBy,
                    materials_ordered_confirmed_at: new Date().toISOString()
                })
                .eq('project_id', alertData.project_id)
                .eq('phase_key', phaseKey);
            
            if (phaseError) throw phaseError;
        }
        
        // 4. Usuń alert z UI
        const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
        if (alertElement) {
            alertElement.style.transition = 'opacity 0.3s, transform 0.3s';
            alertElement.style.opacity = '0';
            alertElement.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                alertElement.remove();
                
                const container = document.getElementById('alertsContainer');
                if (container && container.children.length === 0) {
                    hideAlerts();
                }
                
                // Odśwież widok Gantt żeby pokazać badge na fazie
                if (typeof render === 'function') {
                    render();
                }
            }, 300);
        }
        
    } catch (error) {
        console.error('Error confirming alert:', error);
        showToast('Error confirming alert. Please try again.', 'error');
    }
}

// Załaduj alerty po załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
    loadActiveAlerts();
    
    // Odświeżaj alerty co 5 minut
    setInterval(loadActiveAlerts, 5 * 60 * 1000);
});

// Snooze alert (remind me later)
async function snoozeAlert(alertId) {
    // Modal wyboru czasu snooze
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'snoozeModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '10001'; // Wyżej niż alert-container (9999)
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; background: #1a1a1a; border: 1px solid #404040;">
            <div class="modal-header" style="background: #252525; border-bottom: 1px solid #404040; color: #fff; padding: 16px 20px;">
                <div style="font-size: 18px; font-weight: 600;">⏰ Remind Me Later</div>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <div style="margin-bottom: 16px;">
                    <label style="color: #999; font-size: 13px; display: block; margin-bottom: 8px;">Select reminder time:</label>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button class="snooze-option" data-hours="24" style="
                            background: #333; border: 1px solid #555; color: #e0e0e0;
                            padding: 10px 16px; border-radius: 6px; cursor: pointer;
                            font-size: 14px;
                        ">24 hours</button>
                        <button class="snooze-option" data-days="2" style="
                            background: #333; border: 1px solid #555; color: #e0e0e0;
                            padding: 10px 16px; border-radius: 6px; cursor: pointer;
                            font-size: 14px;
                        ">2 days</button>
                        <button class="snooze-option" data-days="5" style="
                            background: #333; border: 1px solid #555; color: #e0e0e0;
                            padding: 10px 16px; border-radius: 6px; cursor: pointer;
                            font-size: 14px;
                        ">5 days</button>
                        <button class="snooze-option" data-days="7" style="
                            background: #333; border: 1px solid #555; color: #e0e0e0;
                            padding: 10px 16px; border-radius: 6px; cursor: pointer;
                            font-size: 14px;
                        ">1 week</button>
                    </div>
                </div>
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #404040;">
                    <label style="color: #999; font-size: 13px; display: block; margin-bottom: 8px;">Or custom days (1-30):</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="number" id="customDays" min="1" max="30" placeholder="Days" style="
                            background: #252525; border: 1px solid #404040; color: #e0e0e0;
                            padding: 10px 12px; border-radius: 6px; width: 100px; font-size: 14px;
                        ">
                        <button id="customSnoozeBtn" style="
                            background: #4a9eff; border: none; color: #fff;
                            padding: 10px 16px; border-radius: 6px; cursor: pointer;
                            font-size: 14px;
                        ">Set</button>
                    </div>
                </div>
            </div>
            <div style="padding: 16px 20px; background: #252525; border-top: 1px solid #404040; display: flex; justify-content: flex-end;">
                <button id="cancelSnooze" style="
                    background: #333; border: 1px solid #555; color: #e0e0e0;
                    padding: 10px 24px; border-radius: 6px; font-size: 14px; cursor: pointer;
                ">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event handlers
    const closeModal = () => modal.remove();
    
    modal.querySelector('#cancelSnooze').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    
    // Preset buttons
    modal.querySelectorAll('.snooze-option').forEach(btn => {
        btn.onclick = async () => {
            const hours = btn.dataset.hours ? parseInt(btn.dataset.hours) : null;
            const days = btn.dataset.days ? parseInt(btn.dataset.days) : null;
            closeModal();
            await executeSnooze(alertId, hours, days);
        };
    });
    
    // Custom days
    modal.querySelector('#customSnoozeBtn').onclick = async () => {
        const days = parseInt(modal.querySelector('#customDays').value);
        if (!days || days < 1 || days > 30) {
            showToast('Please enter a number between 1 and 30', 'warning');
            return;
        }
        closeModal();
        await executeSnooze(alertId, null, days);
    };
}

// Execute snooze with hours or days
async function executeSnooze(alertId, hours, days) {
    try {
        const snoozeUntil = new Date();
        
        if (hours) {
            snoozeUntil.setHours(snoozeUntil.getHours() + hours);
        } else if (days) {
            snoozeUntil.setDate(snoozeUntil.getDate() + days);
        }
        
        const { error } = await supabaseClient
            .from('project_alerts')
            .update({ 
                snoozed_until: snoozeUntil.toISOString()
            })
            .eq('id', alertId);
        
        if (error) throw error;
        
        // Usuń alert z UI
        const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
        if (alertElement) {
            alertElement.style.transition = 'opacity 0.3s, transform 0.3s';
            alertElement.style.opacity = '0';
            alertElement.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                alertElement.remove();
                
                const container = document.getElementById('alertsContainer');
                if (container && container.children.length === 0) {
                    hideAlerts();
                }
            }, 300);
        }
        
        const timeText = hours ? `${hours} hours` : `${days} days`;
    } catch (error) {
        console.error('Error snoozing alert:', error);
        showToast('Error snoozing alert. Please try again.', 'error');
    }
}