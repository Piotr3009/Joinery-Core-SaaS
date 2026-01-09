// ========== TEAM MANAGEMENT SYSTEM ==========
let teamMembers = [];
let currentEditEmployee = null;
let currentUser = null;

// Toggle password visibility in confirmation modal
function toggleTeamPassword() {
    const input = document.getElementById('confirmPassword');
    const btn = event.target;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

// ========== LOAD & DISPLAY ==========
async function loadTeam() {
    try {
        // Load from Supabase - wszystko widoczne, bez zabezpieczeń
        const { data, error } = await supabaseClient
    .from('team_members')
    .select('*')
    .eq('active', true)  // DODANE - tylko aktywni
    .order('name');
        if (error) {
            console.error('Error loading team:', error);
            return;
        }
        
        teamMembers = data || [];
        renderTeam(teamMembers);
        updateStats();
        
    } catch (err) {
        console.error('Failed to load team:', err);
    }
}

// Render team table
async function renderTeam(members) {
    const tbody = document.getElementById('teamTableBody');
    tbody.innerHTML = '';
    
    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #999;">No team members found</td></tr>';
        return;
    }
    
    // Load user profiles with roles
    const { data: userProfiles } = await supabaseClient
        .from('user_profiles')
        .select('team_member_id, role');
    
    const roleMap = {};
    if (userProfiles) {
        userProfiles.forEach(profile => {
            if (profile.team_member_id) {
                roleMap[profile.team_member_id] = profile.role;
            }
        });
    }
    
    members.forEach((member, index) => {
        const tr = document.createElement('tr');
        
        // Calculate holiday percentage (remaining/allowance)
        const remaining = (member.holiday_allowance || 0) - (member.holiday_used || 0);
        const holidayPercent = member.holiday_allowance > 0 ? 
            Math.max(0, (remaining / member.holiday_allowance * 100)) : 0;
        
        // Holiday display - N/A for B2B contracts
        const holidayDisplay = member.contract_type === 'b2b' ? 
            '<span style="color: #999;">N/A</span>' :
            `<div class="holiday-bar">
                <div class="holiday-progress">
                    <div class="holiday-fill" style="width: ${holidayPercent}%"></div>
                </div>
                <small>${member.holiday_remaining || 0}/${member.holiday_allowance || 28}</small>
            </div>`;
        
        // Account role
        const accountRole = roleMap[member.id] || '-';
        const roleDisplay = accountRole !== '-' ? 
            `<span style="padding: 3px 8px; background: ${getRoleColor(accountRole)}; border-radius: 3px; font-size: 11px; font-weight: 600;">${accountRole.toUpperCase()}</span>` : 
            '<span style="color: #666;">No account</span>';
        
        // Change Role button (only for admin)
        const changeRoleBtn = window.currentUserRole === 'admin' && accountRole !== '-' ? 
            `<button class="action-btn" onclick="openChangeRoleModal('${member.id}', '${accountRole}')" title="Change Role" style="background: #3b82f6;">🔐</button>` : '';
        
        // Invite button (only for admin when no account exists)
        const inviteBtn = window.currentUserRole === 'admin' && accountRole === '-' && member.email ? 
            `<button class="action-btn" onclick="openInviteModal('${member.id}', '${member.name}', '${member.email}')" title="Invite to system" style="background: #22c55e;">📧</button>` : '';
        
        // Edit button (only for admin)
        const editBtn = window.currentUserRole === 'admin' ? 
            `<button class="action-btn" onclick="editEmployee('${member.id}')" title="Edit">✏️</button>` : '';
        
        // Archive button (only for admin)
        const archiveBtn = window.currentUserRole === 'admin' ? 
            `<button class="action-btn archive" onclick="archiveEmployee('${member.id}')" title="Archive">📦</button>` : '';
        
        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600; color: #888;">${index + 1}</td>
            <td>
                <span class="color-indicator" style="background: ${member.color_code || '#999'};"></span>
            </td>
            <td>
                <strong>${member.name}</strong><br>
                <small style="color: #999;">
                    ${member.email || 'No email'} | ${member.phone || 'No phone'}
                </small>
            </td>
            <td>
                <span class="department-badge dept-${member.department || 'production'}">
                    ${formatDepartment(member.department)}
                </span>
            </td>
            <td>${formatJobType(member.job_type)}</td>
            <td>${member.role || '-'}</td>
            <td>
                <small>${formatContract(member.contract_type)}</small>
            </td>
            <td>
                <span class="status-badge status-${member.status?.toLowerCase() || 'active'}">
                    ${member.status || 'Active'}
                </span>
            </td>
            <td>
                ${holidayDisplay}
            </td>
            <td>${roleDisplay}</td>
            <td>
               <button class="action-btn" onclick="viewEmployee('${member.id}')" title="View">👁️</button>
${editBtn}
${inviteBtn}
${changeRoleBtn}
${archiveBtn}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Get role badge color
function getRoleColor(role) {
    switch(role) {
        case 'admin': return '#ef4444';
        case 'manager': return '#3b82f6';
        case 'worker': return '#10b981';
        case 'viewer': return '#6b7280';
        default: return '#666';
    }
}

// Update statistics - only tab counts now (stats cards removed)
function updateStats() {
    // Update tab counts
    updateActiveCount();
    updateArchivedCount();
}

// ========== ADD/EDIT EMPLOYEE ==========
function openAddEmployeeModal() {
    currentEditEmployee = null;
    document.getElementById('employeeModalTitle').textContent = 'Add Employee';
    
    // Clear form
    document.getElementById('empName').value = '';
    document.getElementById('empEmail').value = '';
    document.getElementById('empPhone').value = '';
    document.getElementById('empNumber').value = generateEmployeeNumber();
    document.getElementById('empDepartment').value = 'production';
    document.getElementById('empJobType').value = '';
    document.getElementById('empRole').value = '';
    document.getElementById('empContract').value = 'contract';
    document.getElementById('salaryType').value = 'hourly';
    document.getElementById('salaryRate').value = '';
    document.getElementById('empStartDate').value = formatDate(new Date());
    document.getElementById('empColor').value = generateRandomColor();
    document.getElementById('empColorHex').value = document.getElementById('empColor').value;
    document.getElementById('empNotes').value = '';
    document.getElementById('emergencyName').value = '';
    document.getElementById('emergencyPhone').value = '';
    document.getElementById('emergencyRelation').value = '';
    
    // Sensitive Information
    document.getElementById('empNIN').value = '';
    document.getElementById('empUTR').value = '';
    
    // Medical Information
    document.getElementById('empBloodType').value = '';
    document.getElementById('empAllergies').value = '';
    document.getElementById('empMedicalNotes').value = '';
    document.getElementById('empSpecialCare').value = '';
    document.getElementById('empHolidayAllowance').value = 28;
    
    openModal('employeeModal');
}

function editEmployee(id) {
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    
    currentEditEmployee = id;
    document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
    
    // Fill form
    document.getElementById('empName').value = member.name || '';
    document.getElementById('empEmail').value = member.email || '';
    document.getElementById('empPhone').value = member.phone || '';
    document.getElementById('empNumber').value = member.employee_number || '';
    document.getElementById('empDepartment').value = member.department || 'production';
    document.getElementById('empJobType').value = member.job_type || '';
    document.getElementById('empRole').value = member.role || '';
    document.getElementById('empContract').value = member.contract_type || 'contract';
    document.getElementById('salaryType').value = member.salary_type || 'hourly';
    document.getElementById('salaryRate').value = member.hourly_rate || '';
    document.getElementById('empStartDate').value = member.start_date || '';
    document.getElementById('empHolidayAllowance').value = member.holiday_allowance || 28;
    document.getElementById('empColor').value = member.color_code || '#FFA500';
    document.getElementById('empColorHex').value = member.color_code || '#FFA500';
    document.getElementById('empNotes').value = member.notes || '';
    
    // Sensitive Information
    document.getElementById('empNIN').value = member.nin_encrypted || '';
    document.getElementById('empUTR').value = member.utr_encrypted || '';
    
    // Medical Information
    document.getElementById('empBloodType').value = member.blood_type || '';
    document.getElementById('empAllergies').value = member.allergies || '';
    document.getElementById('empMedicalNotes').value = member.medical_notes || '';
    document.getElementById('empSpecialCare').value = member.special_care_notes || '';
    
    // Emergency contact (if stored in JSON)
    if (member.emergency_contact) {
        try {
            const ec = JSON.parse(member.emergency_contact);
            document.getElementById('emergencyName').value = ec.name || '';
            document.getElementById('emergencyPhone').value = ec.phone || '';
            document.getElementById('emergencyRelation').value = ec.relation || '';
        } catch(e) {
            // If not JSON, ignore
        }
    }
    
    openModal('employeeModal');
}

async function saveEmployee() {
    const name = document.getElementById('empName').value.trim();
    
    if (!name) {
        showToast('Please enter employee name', 'warning');
        return;
    }
    
    // Prepare employee data - BEZ SZYFROWANIA i BEZ STATUS
    const employeeData = {
        name: name,
        email: document.getElementById('empEmail').value.trim() || null,
        phone: document.getElementById('empPhone').value.trim() || null,
        employee_number: document.getElementById('empNumber').value.trim() || null,
        department: document.getElementById('empDepartment').value,
        job_type: document.getElementById('empJobType').value || null,
        role: document.getElementById('empRole').value.trim() || null,
        contract_type: document.getElementById('empContract').value,
        salary_type: document.getElementById('salaryType').value,
        hourly_rate: parseFloat(document.getElementById('salaryRate').value) || null,
        start_date: document.getElementById('empStartDate').value || null,
        holiday_allowance: parseInt(document.getElementById('empHolidayAllowance').value) || 28,
        color_code: document.getElementById('empColor').value,
        color: document.getElementById('empColor').value,
        notes: document.getElementById('empNotes').value.trim() || null,
        active: true,
        // Sensitive Information
        nin_encrypted: document.getElementById('empNIN').value.trim() || null,
        utr_encrypted: document.getElementById('empUTR').value.trim() || null,
        // Medical Information
        blood_type: document.getElementById('empBloodType').value || null,
        allergies: document.getElementById('empAllergies').value.trim() || null,
        medical_notes: document.getElementById('empMedicalNotes').value.trim() || null,
        special_care_notes: document.getElementById('empSpecialCare').value.trim() || null
    };

    
    // Add emergency contact if provided
    const emergencyName = document.getElementById('emergencyName').value.trim();
    if (emergencyName) {
        employeeData.emergency_contact = JSON.stringify({
            name: emergencyName,
            phone: document.getElementById('emergencyPhone').value.trim(),
            relation: document.getElementById('emergencyRelation').value.trim()
        });
    }
    
    try {
        if (currentEditEmployee) {
            // Update existing
            const { error } = await supabaseClient
                .from('team_members')
                .update(employeeData)
                .eq('id', currentEditEmployee);
            
            if (error) throw error;
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('team_members')
                .insert([employeeData]);
            
            if (error) throw error;
        }
        
        closeModal('employeeModal');
        loadTeam();
        
    } catch (error) {
        console.error('Error saving employee:', error);
        showToast('Error saving: ' + error.message, 'error');
    }
}

// ========== VIEW EMPLOYEE DETAILS ==========
function viewEmployee(id) {
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    
    const panel = document.getElementById('detailPanel');
    const body = document.getElementById('detailBody');
    
    document.getElementById('detailName').textContent = member.name;
    
    // Parse emergency contact if exists
    let emergencyHTML = 'Not provided';
    if (member.emergency_contact) {
        try {
            const ec = JSON.parse(member.emergency_contact);
            emergencyHTML = `${ec.name || '-'} (${ec.relation || '-'})<br>📱 ${ec.phone || '-'}`;
        } catch (e) {
            emergencyHTML = member.emergency_contact;
        }
    }
    
    // Pokaż prawdziwe wynagrodzenie
    const salaryInfo = member.hourly_rate ? 
        `£${member.hourly_rate}/hour` : 
        'Not set';
    
    body.innerHTML = `
        <div class="detail-section">
            <h3>Personal Information</h3>
            <p><strong>Email:</strong> ${member.email || 'Not provided'}</p>
            <p><strong>Phone:</strong> ${member.phone || 'Not provided'}</p>
            <p><strong>Employee #:</strong> ${member.employee_number || 'Not assigned'}</p>
        </div>
        
        <div class="detail-section">
            <h3>Employment Details</h3>
            <p><strong>Department:</strong> <span class="department-badge dept-${member.department}">${formatDepartment(member.department)}</span></p>
            <p><strong>Role:</strong> ${member.role || 'Not specified'}</p>
            <p><strong>Contract:</strong> ${formatContract(member.contract_type)}</p>
            <p><strong>Salary:</strong> ${salaryInfo}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${member.status?.toLowerCase()}">${member.status}</span></p>
            <p><strong>Start Date:</strong> ${formatDateDisplay(member.start_date)}</p>
        </div>
        
        <div class="detail-section">
            <h3>Holiday Information</h3>
            <p><strong>Allowance:</strong> ${member.holiday_allowance || 28} days</p>
            <p><strong>Used:</strong> ${member.holiday_used || 0} days</p>
            <p><strong>Remaining:</strong> ${member.holiday_remaining || member.holiday_allowance} days</p>
            <div class="holiday-progress" style="width: 100%; height: 20px; margin-top: 10px;">
                <div class="holiday-fill" style="width: ${((member.holiday_remaining || 0) / (member.holiday_allowance || 28) * 100)}%; height: 100%;"></div>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>Emergency Contact</h3>
            <p>${emergencyHTML}</p>
        </div>
        
        <div class="detail-section" style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444;">
            <h3 style="color: #ef4444;">🔒 Sensitive Information</h3>
            <p style="font-size: 11px; color: #888; margin-bottom: 10px;">Only visible to managers</p>
            <p><strong>NIN:</strong> ${member.nin_encrypted || 'Not provided'}</p>
            <p><strong>UTR:</strong> ${member.utr_encrypted || 'Not provided'}</p>
        </div>
        
        <div class="detail-section" style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6;">
            <h3 style="color: #3b82f6;">🏥 Medical Information</h3>
            <p><strong>Blood Type:</strong> ${member.blood_type || 'Not specified'}</p>
            <p><strong>Allergies:</strong> ${member.allergies || 'None reported'}</p>
            <p><strong>Medical Notes:</strong> ${member.medical_notes || 'None'}</p>
            <p><strong>Special Care:</strong> ${member.special_care_notes || 'None'}</p>
        </div>
        
        <div class="detail-section">
            <h3>Notes</h3>
            <p>${member.notes || 'No notes'}</p>
        </div>
        
        <div class="detail-section">
            <h3>System</h3>
            <p><strong>Gantt Color:</strong> <span class="color-indicator" style="background: ${member.color_code};"></span> ${member.color_code}</p>
            <p><strong>Created:</strong> ${formatDateDisplay(member.created_at)}</p>
        </div>
    `;
    
    panel.classList.add('active');
}

function closeDetailPanel() {
    document.getElementById('detailPanel').classList.remove('active');
}

// ========== DEACTIVATE EMPLOYEE ==========
async function deactivateEmployee(id) {
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    
    if (!confirm(`Deactivate employee "${member.name}"?`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('team_members')
            .update({ 
                active: false,
                end_date: new Date().toISOString().split('T')[0]
            })
            .eq('id', id);
        
        if (error) throw error;
        
        loadTeam();
        
    } catch (error) {
        console.error('Error deactivating employee:', error);
        showToast('Error: ' + error.message, 'error');
    }
}
// ========== ARCHIVE EMPLOYEE TO ARCHIVES SCHEMA ==========
async function archiveEmployee(id) {
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    
    // Okno dialogowe z powodem
    const reason = prompt(`Archive employee "${member.name}"?\n\n1 = Resigned\n2 = Fired\n3 = Contract Ended\n4 = Other`);
    
    const reasons = {
        '1': 'resigned',
        '2': 'fired', 
        '3': 'contract_ended',
        '4': 'other'
    };
    
    if (!reason || !reasons[reason]) {
        showToast('Please select a valid reason', 'warning');
        return;
    }
    
    const notes = prompt('Additional notes (optional):');
    
    if (!confirm(`Archive "${member.name}"?\n\nThis will:\n- Remove login access\n- Delete holidays\n- Unassign from projects\n- Unassign van\n\nContinue?`)) {
        return;
    }
    
    try {
        // 1. Oznacz jako zarchiwizowany w team_members
        const { error: archiveError } = await supabaseClient
            .from('team_members')
            .update({ 
                archived: true,
                active: false,
                end_date: new Date().toISOString().split('T')[0],
                departure_reason: reasons[reason],
                departure_notes: notes || null,
                archived_date: new Date().toISOString()
            })
            .eq('id', id);
        if (archiveError) throw archiveError;

        // 2. Usuń dostęp - user_profiles
        const { error: userError } = await supabaseClient
            .from('user_profiles')
            .delete()
            .eq('team_member_id', id);
        if (userError) console.warn('user_profiles:', userError.message);

        // 3. Pobierz urlopy i zapisz do historii przed usunięciem
        const { data: holidays, error: fetchHolidaysError } = await supabaseClient
            .from('employee_holidays')
            .select('date_from, date_to, holiday_type, status, notes')
            .eq('employee_id', id);
        
        if (fetchHolidaysError) {
            console.warn('Error fetching holidays:', fetchHolidaysError.message);
        } else if (holidays && holidays.length > 0) {
            // Zapisz historię urlopów do team_members
            const { error: historyError } = await supabaseClient
                .from('team_members')
                .update({ holidays_history: holidays })
                .eq('id', id);
            if (historyError) console.warn('holidays_history:', historyError.message);
        }

        // 4. Usuń urlopy z tabeli employee_holidays
        const { error: holidaysError } = await supabaseClient
            .from('employee_holidays')
            .delete()
            .eq('employee_id', id);
        if (holidaysError) console.warn('employee_holidays:', holidaysError.message);

        // 5. Odepnij z project_phases (assigned_to)
        const { error: phasesError } = await supabaseClient
            .from('project_phases')
            .update({ assigned_to: null })
            .eq('assigned_to', id);
        if (phasesError) console.warn('project_phases assigned_to:', phasesError.message);

        // 6. Odepnij z project_phases (materials_ordered_confirmed_by)
        const { error: phases2Error } = await supabaseClient
            .from('project_phases')
            .update({ materials_ordered_confirmed_by: null })
            .eq('materials_ordered_confirmed_by', id);
        if (phases2Error) console.warn('project_phases materials_ordered:', phases2Error.message);

        // 7. Odepnij z projects (timber_worker_id)
        const { error: timberError } = await supabaseClient
            .from('projects')
            .update({ timber_worker_id: null })
            .eq('timber_worker_id', id);
        if (timberError) console.warn('projects timber:', timberError.message);

        // 8. Odepnij z projects (spray_worker_id)
        const { error: sprayError } = await supabaseClient
            .from('projects')
            .update({ spray_worker_id: null })
            .eq('spray_worker_id', id);
        if (sprayError) console.warn('projects spray:', sprayError.message);

        // 9. Odepnij z projects (admin_id)
        const { error: adminError } = await supabaseClient
            .from('projects')
            .update({ admin_id: null })
            .eq('admin_id', id);
        if (adminError) console.warn('projects admin:', adminError.message);

        // 10. Odepnij z projects (sales_person_id)
        const { error: salesError } = await supabaseClient
            .from('projects')
            .update({ sales_person_id: null })
            .eq('sales_person_id', id);
        if (salesError) console.warn('projects sales:', salesError.message);

        // 11. Odepnij van
        const { error: vanError } = await supabaseClient
            .from('vans')
            .update({ assigned_to_worker_id: null })
            .eq('assigned_to_worker_id', id);
        if (vanError) console.warn('vans:', vanError.message);

        showToast(`${member.name} has been archived successfully!`, 'success');
        loadTeam();
        
    } catch (err) {
        console.error('Error archiving employee:', err);
        showToast('Error: ' + err.message, 'error');
    }
}



// ========== HOLIDAYS MODAL ==========
function openHolidaysModal() {
    const tbody = document.getElementById('holidaysTableBody');
    tbody.innerHTML = '';
    
    teamMembers
        .filter(m => m.active)
        .forEach(member => {
            const tr = document.createElement('tr');
            const remaining = member.holiday_remaining || member.holiday_allowance || 0;
            
            tr.innerHTML = `
                <td>${member.name}</td>
                <td>${member.holiday_allowance || 28}</td>
                <td>${member.holiday_used || 0}</td>
                <td><strong>${remaining}</strong></td>
                <td>
                    <input type="number" id="holiday-${member.id}" 
                           min="0" max="${remaining}" value="0" 
                           style="width: 60px;">
                    <button class="action-btn primary" 
                            onclick="bookHoliday('${member.id}')">Book</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    
    openModal('holidaysModal');
}

async function bookHoliday(memberId) {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;
    
    const days = parseInt(document.getElementById(`holiday-${memberId}`).value) || 0;
    if (days <= 0) {
        showToast('Please enter valid number of days', 'warning');
        return;
    }
    
    const remaining = member.holiday_remaining || member.holiday_allowance || 0;
    if (days > remaining) {
        showToast(`Cannot book ${days} days. Only ${remaining} days remaining.`, 'error');
        return;
    }
    
    const newUsed = (member.holiday_used || 0) + days;
    
    if (!confirm(`Book ${days} days holiday for ${member.name}?`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('team_members')
            .update({ 
                holiday_used: newUsed
                // USUNIĘTE: holiday_remaining - to jest wyliczane w bazie!
            })
            .eq('id', memberId);
        
        if (error) throw error;
        
        loadTeam();
        openHolidaysModal(); // Refresh modal
        
    } catch (error) {
        console.error('Error booking holiday:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ========== WAGES MODAL ==========
function openWagesModal() {
    // Populate employee select with job_type
    const select = document.getElementById('wageEmployee');
    select.innerHTML = '<option value="">Select Employee...</option>';
    
    const jobTypeLabels = {
        'joiner': '🪚 Joiner',
        'sprayer': '🎨 Sprayer',
        'prep': '🖌️ Prep',
        'glazing': '🪟 Glazing',
        'labour': '🧹 Labour',
        'driver': '🚐 Driver',
        'other': '🔧 Other',
        'office': '📊 Office'
    };
    
    teamMembers
        .filter(m => m.active && m.job_type) // tylko z job_type
        .sort((a, b) => (a.job_type || '').localeCompare(b.job_type || ''))
        .forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            const jobLabel = jobTypeLabels[member.job_type] || member.job_type;
            option.textContent = `${member.name} (${jobLabel})`;
            select.appendChild(option);
        });
    
    // Initialize period dropdown
    updateWagePeriodFields();
    
    // Load recent wages
    loadRecentWages();
    
    openModal('wagesModal');
}

function updateWagePeriodFields() {
    const periodType = document.getElementById('wagePeriodType').value;
    const periodSelect = document.getElementById('wagePeriod');
    periodSelect.innerHTML = '';
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    if (periodType === 'weekly') {
        // Generate last 12 weeks
        for (let i = 0; i < 12; i++) {
            const weekDate = new Date(now);
            weekDate.setDate(weekDate.getDate() - (i * 7));
            
            const weekNum = getWeekNumber(weekDate);
            const weekStart = getWeekStart(weekDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const option = document.createElement('option');
            option.value = JSON.stringify({
                start: formatDate(weekStart),
                end: formatDate(weekEnd)
            });
            option.textContent = `Week ${weekNum} (${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)})`;
            periodSelect.appendChild(option);
        }
    } else {
        // Generate last 12 months
        for (let i = 0; i < 12; i++) {
            const monthDate = new Date(currentYear, now.getMonth() - i, 1);
            const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            
            const option = document.createElement('option');
            option.value = JSON.stringify({
                start: formatDate(monthDate),
                end: formatDate(monthEnd)
            });
            option.textContent = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            periodSelect.appendChild(option);
        }
    }
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function formatDateShort(date) {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

async function loadRecentWages() {
    const tbody = document.getElementById('wagesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';
    
    const jobTypeLabels = {
        'joiner': '🪚',
        'sprayer': '🎨',
        'prep': '🖌️',
        'glazing': '🪟',
        'labour': '🧹',
        'driver': '🚐',
        'other': '🔧',
        'office': '📊'
    };
    
    try {
        const { data, error } = await supabaseClient
            .from('wages')
            .select(`
                *,
                team_members (
                    name,
                    job_type
                )
            `)
            .order('period_start', { ascending: false })
            .limit(30);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No wages found</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        data.forEach(wage => {
            const tr = document.createElement('tr');
            const periodLabel = wage.period_type === 'weekly' 
                ? `Week ${getWeekNumber(new Date(wage.period_start))}`
                : new Date(wage.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
            
            const jobIcon = jobTypeLabels[wage.team_members?.job_type] || '❓';
            
            tr.innerHTML = `
                <td>${jobIcon} ${wage.team_members?.name || 'Unknown'}</td>
                <td>${periodLabel}</td>
                <td>${formatDateDisplay(wage.period_start)} - ${formatDateDisplay(wage.period_end)}</td>
                <td><strong>£${parseFloat(wage.gross_amount).toFixed(2)}</strong></td>
                <td>
                    <button class="action-btn delete" onclick="deleteWage('${wage.id}')" title="Delete">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Error loading wages:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading wages</td></tr>';
    }
}

async function addWage() {
    const employeeId = document.getElementById('wageEmployee').value;
    const periodType = document.getElementById('wagePeriodType').value;
    const periodData = document.getElementById('wagePeriod').value;
    const amount = parseFloat(document.getElementById('wageAmount').value) || 0;
    
    if (!employeeId) {
        showToast('Please select employee', 'warning');
        return;
    }
    
    if (!periodData) {
        showToast('Please select period', 'warning');
        return;
    }
    
    if (amount <= 0) {
        showToast('Please enter wage amount', 'warning');
        return;
    }
    
    const period = JSON.parse(periodData);
    
    const wageData = {
        team_member_id: employeeId,
        period_type: periodType,
        period_start: period.start,
        period_end: period.end,
        gross_amount: amount
    };
    
    try {
        const { error } = await supabaseClient
            .from('wages')
            .insert([wageData]);
        
        if (error) throw error;
        
        
        // Clear form
        document.getElementById('wageEmployee').value = '';
        document.getElementById('wageAmount').value = '';
        
        // Reload wages
        loadRecentWages();
        
    } catch (error) {
        console.error('Error adding wage:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteWage(wageId) {
    if (!confirm('Delete this wage entry?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('wages')
            .delete()
            .eq('id', wageId);
        
        if (error) throw error;
        
        loadRecentWages();
    } catch (error) {
        console.error('Error deleting wage:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function exportWagesCSV() {
    try {
        showToast('Exporting wages...', 'info');
        
        // Load all wages
        const { data, error } = await supabaseClient
            .from('wages')
            .select(`
                *,
                team_members (
                    name,
                    job_type,
                    employee_number
                )
            `)
            .order('period_start', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showToast('No wages to export', 'warning');
            return;
        }
        
        // Build CSV
        const headers = ['Employee', 'Employee No', 'Job Type', 'Period Type', 'Period Start', 'Period End', 'Gross Amount', 'Created'];
        
        const rows = data.map(wage => [
            wage.team_members?.name || 'Unknown',
            wage.team_members?.employee_number || '-',
            wage.team_members?.job_type || '-',
            wage.period_type || '-',
            wage.period_start || '-',
            wage.period_end || '-',
            parseFloat(wage.gross_amount || 0).toFixed(2),
            wage.created_at ? new Date(wage.created_at).toLocaleDateString('en-GB') : '-'
        ]);
        
        // Convert to CSV string
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `wages-export-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        showToast(`Exported ${data.length} wage records`, 'success');
        
    } catch (error) {
        showToast('Error exporting: ' + error.message, 'error');
    }
}

// ========== SEARCH & FILTER ==========
function searchTeam() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = teamMembers.filter(m => 
        (m.name?.toLowerCase().includes(searchTerm)) ||
        (m.email?.toLowerCase().includes(searchTerm)) ||
        (m.role?.toLowerCase().includes(searchTerm)) ||
        (m.employee_number?.toLowerCase().includes(searchTerm))
    );
    renderTeam(filtered);
}

function filterTeam() {
    const dept = document.getElementById('filterDepartment').value;
    const status = document.getElementById('filterStatus').value;
    
    let filtered = teamMembers;
    
    if (dept) {
        filtered = filtered.filter(m => m.department === dept);
    }
    
    if (status) {
        filtered = filtered.filter(m => m.status?.toLowerCase() === status);
    }
    
    renderTeam(filtered);
}

// ========== EXPORT FUNCTIONS ==========
function exportTeamCSV() {
    const csv = [
        ['Name', 'Email', 'Phone', 'Department', 'Role', 'Contract', 'Status', 'Salary/Hour', 'Start Date', 'Holidays Remaining'],
        ...teamMembers.map(m => [
            m.name,
            m.email || '',
            m.phone || '',
            formatDepartment(m.department),
            m.role || '',
            formatContract(m.contract_type),
            m.status || 'Active',
            m.hourly_rate ? `£${m.hourly_rate}` : '',
            m.start_date || '',
            m.holiday_remaining || '0'
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function exportTeamJSON() {
    const json = JSON.stringify(teamMembers, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

async function exportPaymentsCSV() {
    try {
        // Pobierz payments z bazy
        const { data, error } = await supabaseClient
            .from('team_payments')
            .select(`
                *,
                team_members (
                    name,
                    employee_number
                )
            `)
            .order('payment_date', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showToast('No payments to export', 'info');
            return;
        }
        
        // Stwórz CSV
        const csv = [
            ['Date', 'Employee', 'Employee Number', 'Period', 'Base Amount', 'Bonus', 'Total', 'Payment Method'],
            ...data.map(p => {
                const base = parseFloat(p.base_payment) || 0;
                const bonus = parseFloat(p.bonus) || 0;
                const total = parseFloat(p.total) || base + bonus;
                
                return [
                    p.payment_date,
                    p.team_members?.name || 'Unknown',
                    p.team_members?.employee_number || '-',
                    `${p.period_start} to ${p.period_end}`,
                    `£${base.toFixed(2)}`,
                    `£${bonus.toFixed(2)}`,
                    `£${total.toFixed(2)}`,
                    p.payment_method || 'bank'
                ];
            })
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
    } catch (error) {
        console.error('Error exporting payments:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ========== UTILITY FUNCTIONS ==========
function generateEmployeeNumber() {
    const existingNumbers = teamMembers
        .map(m => m.employee_number)
        .filter(n => n && n.startsWith('EMP'))
        .map(n => parseInt(n.replace('EMP', '')) || 0);
    
    const nextNumber = existingNumbers.length > 0 ? 
        Math.max(...existingNumbers) + 1 : 1;
    
    return `EMP${nextNumber.toString().padStart(4, '0')}`;
}

function generateRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFD93D', '#6BCF7F', '#C06FBB'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function formatDate(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

function formatDateDisplay(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB');
}

function formatDepartment(dept) {
    if (!dept) return 'Unknown';
    const deptMap = {
        'production': 'Production',
        'spray': 'Spray Shop',
        'installation': 'Installation',
        'drivers': 'Drivers',
        'management': 'Management',
        'admin': 'Admin'
    };
    return deptMap[dept] || dept;
}

function formatContract(type) {
    if (!type) return 'Unknown';
    const typeMap = {
        'contract': 'Contract',
        'permanent': 'Permanent',
        'temporary': 'Temporary',
        'probation': 'Probation'
    };
    return typeMap[type] || type;
}

function formatJobType(jobType) {
    if (!jobType) return '-';
    const jobTypeMap = {
        'joiner': '🪚 Joiner',
        'sprayer': '🎨 Sprayer',
        'prep': '🖌️ Prep',
        'glazing': '🪟 Glazing',
        'labour': '🧹 Labour',
        'driver': '🚐 Driver',
        'other': '🔧 Other',
        'office': '📊 Office'
    };
    return jobTypeMap[jobType] || jobType;
}

// ========== MODAL FUNCTIONS ==========
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Color picker sync
document.addEventListener('DOMContentLoaded', function() {
    const colorPicker = document.getElementById('empColor');
    const colorHex = document.getElementById('empColorHex');
    
    if (colorPicker && colorHex) {
        colorPicker.addEventListener('input', function() {
            colorHex.value = this.value;
        });
    }
    
    // loadTeam() is called from team.html - don't duplicate here
});

// Close modals on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// ========== INITIALIZATION ==========

// ========== CHANGE ROLE MODAL ==========
let currentRoleChangeTeamMemberId = null;

window.openChangeRoleModal = function(teamMemberId, currentRole) {
    currentRoleChangeTeamMemberId = teamMemberId;
    
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "changeRoleModal";
    modal.style.display = "flex";
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">Change Account Role</div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Current Role: <strong style="color: #4a9eff;">${currentRole.toUpperCase()}</strong></label>
                </div>
                <div class="form-group">
                    <label>New Role</label>
                    <select id="newRoleSelect" data-current-role="${currentRole}" style="width: 100%; padding: 10px; background: #3e3e42; border: 1px solid #555; color: #e8e2d5; border-radius: 3px;">
                        <option value="viewer" ${currentRole === "viewer" ? "selected" : ""}>Viewer (Read Only)</option>
                        <option value="worker" ${currentRole === "worker" ? "selected" : ""}>Worker (Carpenter)</option>
                        <option value="manager" ${currentRole === "manager" ? "selected" : ""}>Manager</option>
                        <option value="admin" ${currentRole === "admin" ? "selected" : ""}>Admin (Full Access)</option>
                    </select>
                </div>
                <div style="background: #2a2a2a; padding: 12px; border-radius: 5px; margin-top: 15px; font-size: 12px; color: #999;">
                    <strong style="color: #f59e0b;">⚠️ Warning:</strong> Changing roles will affect user permissions immediately.
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="closeChangeRoleModal()">Cancel</button>
                <button class="modal-btn primary" onclick="saveRoleChange()">Save Role</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

window.closeChangeRoleModal = function() {
    const modal = document.getElementById("changeRoleModal");
    if (modal) {
        modal.remove();
    }
    currentRoleChangeTeamMemberId = null;
}

window.saveRoleChange = function() {
    if (!currentRoleChangeTeamMemberId) return;
    
    const selectEl = document.getElementById("newRoleSelect");
    const newRole = selectEl.value;
    const currentRole = selectEl.getAttribute('data-current-role') || '';
    
    
    // Jeśli rola się nie zmienia, nie wymagaj hasła
    if (newRole === currentRole) {
        closeChangeRoleModal();
        return;
    }
    
    // WAŻNE: Zapisz ID przed zamknięciem modala (closeChangeRoleModal resetuje do null)
    const teamMemberId = currentRoleChangeTeamMemberId;
    
    // Zamknij modal zmiany roli przed pokazaniem modala z hasłem
    closeChangeRoleModal();
    
    
    // Wymagaj hasła przy zmianie roli
    confirmWithPassword(
        '🔐 Confirm Role Change',
        `Changing user role to "${newRole.toUpperCase()}". This action requires password confirmation.`,
        async function() {
            await executeSaveRoleChangeWithId(teamMemberId, newRole);
        }
    );
    
}

async function executeSaveRoleChangeWithId(teamMemberId, newRole) {
    console.log('teamMemberId:', teamMemberId);
    
    if (!teamMemberId) {
        console.log('ERROR: teamMemberId is null!');
        return;
    }
    
    try {
        // Find user_profile by team_member_id
        const { data: profile, error: fetchError } = await supabaseClient
            .from("user_profiles")
            .select("id")
            .eq("team_member_id", teamMemberId)
            .single();
        
        
        if (fetchError) {
            console.error("Error fetching profile:", fetchError);
            showToast("Error: Could not find user account.", 'info');
            return;
        }
        
        // Update role
        const { error: updateError } = await supabaseClient
            .from("user_profiles")
            .update({ role: newRole })
            .eq("id", profile.id);
        
        
        if (updateError) {
            console.error("Error updating role:", updateError);
            showToast("Error: " + updateError.message, 'error');
            return;
        }
        
        showToast("Role updated successfully!", 'info');
        
        // Reload team to show updated role
        await loadTeam();
        
    } catch (err) {
        console.error("Error:", err);
        showToast("Error updating role.", 'info');
    }
}

// ========== SYSTEM ACCOUNTS MANAGEMENT ==========
async function loadSystemAccounts() {
    // Only show for admin
    if (window.currentUserRole !== 'admin') {
        document.getElementById('systemAccountsSection').style.display = 'none';
        return;
    }
    
    document.getElementById('systemAccountsSection').style.display = 'block';
    
    try {
        // Get all user profiles without team_member_id (with email from user_profiles)
        const { data: profiles, error } = await supabaseClient
            .from('user_profiles')
            .select('id, role, full_name, last_login, email')
            .is('team_member_id', null)
            .order('email');
        
        if (error) throw error;
        
        renderSystemAccounts(profiles || []);
        
    } catch (err) {
        console.error('Error loading system accounts:', err);
    }
}

function renderSystemAccounts(accounts) {
    const tbody = document.getElementById('systemAccountsBody');
    
    if (!accounts || accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">No system accounts found</td></tr>';
        return;
    }
    
    tbody.innerHTML = accounts.map(account => {
        const roleColor = getRoleColor(account.role);
        const lastLogin = account.last_login ? 
            new Date(account.last_login).toLocaleDateString() : 'Never';
        
        return `
            <tr>
                <td><strong>${account.email}</strong></td>
                <td>${account.full_name || '-'}</td>
                <td>
                    <span style="padding: 3px 8px; background: ${roleColor}; border-radius: 3px; font-size: 11px; font-weight: 600;">
                        ${account.role.toUpperCase()}
                    </span>
                </td>
                <td><small style="color: #999;">${lastLogin}</small></td>
                <td>
                    <button class="action-btn" onclick="openChangeRoleModalForUser('${account.id}', '${account.role}', '${account.email}')" title="Change Role" style="background: #3b82f6;">🔐</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Change role for system account (without team_member_id)
window.openChangeRoleModalForUser = function(userId, currentRole, email) {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "changeRoleModal";
    modal.style.display = "flex";
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">Change Account Role</div>
            <div class="modal-body">
                <div class="form-group">
                    <label>User: <strong style="color: #4a9eff;">${email}</strong></label>
                </div>
                <div class="form-group">
                    <label>Current Role: <strong style="color: #4a9eff;">${currentRole.toUpperCase()}</strong></label>
                </div>
                <div class="form-group">
                    <label>New Role</label>
                    <select id="newRoleSelect" data-current-role="${currentRole}" style="width: 100%; padding: 10px; background: #3e3e42; border: 1px solid #555; color: #e8e2d5; border-radius: 3px;">
                        <option value="viewer" ${currentRole === "viewer" ? "selected" : ""}>Viewer (Read Only)</option>
                        <option value="worker" ${currentRole === "worker" ? "selected" : ""}>Worker (Carpenter)</option>
                        <option value="manager" ${currentRole === "manager" ? "selected" : ""}>Manager</option>
                        <option value="admin" ${currentRole === "admin" ? "selected" : ""}>Admin (Full Access)</option>
                    </select>
                </div>
                <div style="background: #2a2a2a; padding: 12px; border-radius: 5px; margin-top: 15px; font-size: 12px; color: #999;">
                    <strong style="color: #f59e0b;">⚠️ Warning:</strong> Changing roles will affect user permissions immediately.
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="closeChangeRoleModal()">Cancel</button>
                <button class="modal-btn primary" onclick="saveRoleChangeForUser('${userId}')">Save Role</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

window.saveRoleChangeForUser = function(userId) {
    const selectEl = document.getElementById("newRoleSelect");
    const newRole = selectEl.value;
    const currentRole = selectEl.getAttribute('data-current-role') || '';
    
    // Jeśli rola się nie zmienia, nie wymagaj hasła
    if (newRole === currentRole) {
        closeChangeRoleModal();
        return;
    }
    
    // Zamknij modal zmiany roli przed pokazaniem modala z hasłem
    closeChangeRoleModal();
    
    // Wymagaj hasła przy zmianie roli
    confirmWithPassword(
        '🔐 Confirm Role Change',
        `Changing user role to "${newRole.toUpperCase()}". This action requires password confirmation.`,
        async function() {
            await executeSaveRoleChangeForUser(userId, newRole);
        }
    );
};

async function executeSaveRoleChangeForUser(userId, newRole) {
    try {
        const { error } = await supabaseClient
            .from("user_profiles")
            .update({ role: newRole })
            .eq("id", userId);
        
        if (error) throw error;
        
        showToast("Role updated successfully!", 'info');
        
        closeChangeRoleModal();
        await loadSystemAccounts();
        await loadTeam();
        
    } catch (err) {
        console.error("Error updating role:", err);
        showToast("Error: " + err.message, 'error');
    }
}

// ========== ARCHIVED TEAM FUNCTIONS ==========
let archivedTeamMembers = [];
let filteredArchivedMembers = [];

// Switch to Active tab
function showActiveTeam() {
    document.getElementById('activeTab').classList.add('active');
    document.getElementById('archivedTab').classList.remove('active');
    document.getElementById('activeSection').classList.remove('hidden');
    document.getElementById('archivedSection').classList.remove('active');
}

// Switch to Archived tab
async function showArchivedTeam() {
    document.getElementById('archivedTab').classList.add('active');
    document.getElementById('activeTab').classList.remove('active');
    document.getElementById('archivedSection').classList.add('active');
    document.getElementById('activeSection').classList.add('hidden');
    
    await loadArchivedTeam();
}

// Load archived team members
async function loadArchivedTeam() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('*')
            .eq('archived', true)
            .order('archived_date', { ascending: false });
            
        if (error) {
            console.error('Error loading archived team:', error);
            return;
        }
        
        archivedTeamMembers = data || [];
        filteredArchivedMembers = [...archivedTeamMembers];
        renderArchivedTeam(filteredArchivedMembers);
        updateArchivedCount();
        
    } catch (err) {
        console.error('Failed to load archived team:', err);
    }
}

// Render archived team cards
function renderArchivedTeam(members) {
    const container = document.getElementById('archivedTeamContainer');
    
    if (members.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No archived employees found</div>';
        return;
    }
    
    container.innerHTML = members.map(member => {
        const reason = member.departure_reason || 'other';
        const reasonText = {
            'resigned': 'Resigned',
            'fired': 'Fired',
            'contract_ended': 'Contract Ended',
            'other': 'Other'
        }[reason] || reason;
        
        const reasonColor = {
            'resigned': '#f59e0b',
            'fired': '#ef4444',
            'contract_ended': '#3b82f6',
            'other': '#6b7280'
        }[reason] || '#6b7280';
        
        const archivedDate = member.archived_date ? 
            new Date(member.archived_date).toLocaleDateString('en-GB') : '-';
        const startDate = member.start_date ? 
            new Date(member.start_date).toLocaleDateString('en-GB') : '-';
        const endDate = member.end_date ? 
            new Date(member.end_date).toLocaleDateString('en-GB') : '-';
            
        // Calculate duration
        let duration = '-';
        if (member.start_date && member.end_date) {
            const start = new Date(member.start_date);
            const end = new Date(member.end_date);
            const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
            if (months < 12) {
                duration = `${months} months`;
            } else {
                const years = Math.floor(months / 12);
                const remainingMonths = months % 12;
                duration = remainingMonths > 0 ? `${years}y ${remainingMonths}m` : `${years} years`;
            }
        }
        
        // Holidays history - compact table
        let holidaysHtml = '';
        if (member.holidays_history && member.holidays_history.length > 0) {
            const holidayRows = member.holidays_history.map(h => {
                const fromDate = new Date(h.date_from).toLocaleDateString('en-GB', {day:'2-digit', month:'2-digit'});
                const toDate = new Date(h.date_to).toLocaleDateString('en-GB', {day:'2-digit', month:'2-digit'});
                const typeClass = h.holiday_type || 'annual';
                const typeColor = {
                    'annual': '#10b981',
                    'sick': '#f59e0b',
                    'unpaid': '#6b7280'
                }[typeClass] || '#6b7280';
                const typeText = {
                    'annual': 'Annual',
                    'sick': 'Sick',
                    'unpaid': 'Unpaid'
                }[typeClass] || typeClass;
                
                return `<tr style="font-size: 11px;">
                    <td style="padding: 3px 8px; border-bottom: 1px solid #3e3e42;">${fromDate} - ${toDate}</td>
                    <td style="padding: 3px 8px; border-bottom: 1px solid #3e3e42; text-align: right;">
                        <span style="background: ${typeColor}; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px;">${typeText}</span>
                    </td>
                </tr>`;
            }).join('');
            
            holidaysHtml = `
                <div style="margin-top: 10px;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 5px;">📅 Holidays (${member.holidays_history.length})</div>
                    <table style="width: auto; border-collapse: collapse; background: #252528; border-radius: 4px;">
                        ${holidayRows}
                    </table>
                </div>
            `;
        }
        
        return `
            <div style="background: #2d2d30; border: 1px solid #3e3e42; border-radius: 6px; padding: 15px; margin-bottom: 10px; position: relative;">
                <span style="position: absolute; top: 10px; right: 10px; background: ${reasonColor}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px; font-weight: 600;">${reasonText.toUpperCase()}</span>
                
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 15px; font-weight: 600; color: #e8e2d5;">${member.name}</div>
                    <div style="font-size: 12px; color: #888;">${member.department || '-'} • ${member.role || '-'} • #${member.employee_number || '-'}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; font-size: 12px;">
                    <div><span style="color: #666;">Email:</span> <span style="color: #aaa;">${member.email || '-'}</span></div>
                    <div><span style="color: #666;">Phone:</span> <span style="color: #aaa;">${member.phone || '-'}</span></div>
                    <div><span style="color: #666;">Start:</span> <span style="color: #aaa;">${startDate}</span></div>
                    <div><span style="color: #666;">End:</span> <span style="color: #aaa;">${endDate}</span></div>
                    <div><span style="color: #666;">Duration:</span> <span style="color: #aaa;">${duration}</span></div>
                    <div><span style="color: #666;">Archived:</span> <span style="color: #aaa;">${archivedDate}</span></div>
                    <div><span style="color: #666;">Holidays:</span> <span style="color: #aaa;">${member.holiday_used || 0}/${member.holiday_allowance || 28} days</span></div>
                </div>
                
                ${member.departure_notes ? `<div style="margin-top: 10px; font-size: 12px;"><span style="color: #666;">Notes:</span> <span style="color: #aaa;">${member.departure_notes}</span></div>` : ''}
                
                ${holidaysHtml}
            </div>
        `;
    }).join('');
}

// Search archived team
function searchArchivedTeam() {
    const searchTerm = document.getElementById('archivedSearchInput').value.toLowerCase();
    const reasonFilter = document.getElementById('filterArchivedReason').value;
    
    filteredArchivedMembers = archivedTeamMembers.filter(member => {
        const matchesSearch = !searchTerm || 
            member.name?.toLowerCase().includes(searchTerm) ||
            member.email?.toLowerCase().includes(searchTerm) ||
            member.role?.toLowerCase().includes(searchTerm) ||
            member.employee_number?.toLowerCase().includes(searchTerm);
            
        const matchesReason = !reasonFilter || member.departure_reason === reasonFilter;
        
        return matchesSearch && matchesReason;
    });
    
    renderArchivedTeam(filteredArchivedMembers);
}

// Filter archived team
function filterArchivedTeam() {
    searchArchivedTeam();
}

// Update archived count in tab
async function updateArchivedCount() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('id')
            .eq('archived', true);
            
        if (!error) {
            const countEl = document.getElementById('archivedCount');
            if (countEl) countEl.textContent = data?.length || 0;
        }
    } catch (err) {
        console.error('Error counting archived:', err);
    }
}

// Update active count in tab
async function updateActiveCount() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('id')
            .eq('active', true);
            
        if (!error) {
            const countEl = document.getElementById('activeCount');
            if (countEl) countEl.textContent = data?.length || 0;
        }
    } catch (err) {
        console.error('Error counting active:', err);
    }
}

// ========== INVITE SYSTEM ==========

function openInviteModal(teamMemberId, name, email) {
    document.getElementById('inviteTeamMemberId').value = teamMemberId;
    document.getElementById('inviteEmployeeName').textContent = name;
    document.getElementById('inviteEmail').value = email;
    document.getElementById('inviteRole').value = 'worker'; // default
    document.getElementById('inviteError').style.display = 'none';
    document.getElementById('inviteSuccess').style.display = 'none';
    document.getElementById('sendInviteBtn').disabled = false;
    document.getElementById('inviteModal').style.display = 'flex';
}

function closeInviteModal() {
    document.getElementById('inviteModal').style.display = 'none';
}

async function sendInvite() {
    const teamMemberId = document.getElementById('inviteTeamMemberId').value;
    const email = document.getElementById('inviteEmail').value;
    const role = document.getElementById('inviteRole').value;
    const errorEl = document.getElementById('inviteError');
    const successEl = document.getElementById('inviteSuccess');
    const btn = document.getElementById('sendInviteBtn');
    
    // Reset messages
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    
    // Disable button
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    try {
        const response = await fetch(`${window.API_URL || 'https://joinerycore.com'}/api/team/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                teamMemberId,
                email,
                role
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to send invite');
        }
        
        // Success
        successEl.textContent = `✓ Invitation sent to ${email}. They will receive an email to set their password.`;
        successEl.style.display = 'block';
        
        // Refresh team table after 2 seconds
        setTimeout(() => {
            closeInviteModal();
            loadTeamMembers();
        }, 2000);
        
    } catch (error) {
        console.error('Invite error:', error);
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Send Invite';
    }
}