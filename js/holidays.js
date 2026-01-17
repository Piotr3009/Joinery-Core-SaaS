// ========== HOLIDAY CALENDAR SYSTEM ==========
let employees = [];
let holidays = [];
let selectedYear = new Date().getFullYear();
let activeFilters = new Set(); // Aktywni pracownicy do wyświetlenia

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    populateYearSelect();
    await loadEmployees();
    await loadHolidays();
    renderCalendar();
    
    // Event listeners
    document.getElementById('yearSelect').addEventListener('change', (e) => {
        selectedYear = parseInt(e.target.value);
        renderCalendar();
    });
    
    document.getElementById('employeeFilter').addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'all') {
            activeFilters = new Set(employees.map(emp => emp.id));
        } else {
            activeFilters = new Set([value]);
        }
        renderCalendar();
    });
});

// Populate year select dynamically (current year -1 to +5)
function populateYearSelect() {
    const select = document.getElementById('yearSelect');
    const currentYear = new Date().getFullYear();
    
    select.innerHTML = '';
    for (let year = currentYear - 1; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

// ========== LOAD DATA ==========
async function loadEmployees() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('*')
            .eq('active', true)
            .order('name');
        
        if (error) throw error;
        
        employees = data || [];
        activeFilters = new Set(employees.map(emp => emp.id));
        
        // Populate employee filters
        const employeeFilter = document.getElementById('employeeFilter');
        const modalEmployee = document.getElementById('modalEmployee');
        
        employeeFilter.innerHTML = '<option value="all">All Employees</option>';
        
        // Wyczyść i zbuduj modal select od nowa
        modalEmployee.innerHTML = '';
        
        // Dodaj ALL jako pierwszą opcję
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'ALL TEAM MEMBERS';
        allOpt.className = 'opt-all-members';
        modalEmployee.appendChild(allOpt);
        
        // Dodaj pracowników
        employees.forEach(emp => {
            const option1 = document.createElement('option');
            option1.value = emp.id;
            option1.textContent = emp.name;
            employeeFilter.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = emp.id;
            option2.textContent = emp.name;
            modalEmployee.appendChild(option2);
        });
        
        renderEmployeeLegend();
        updateStats();
        
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

async function loadHolidays() {
    try {
        const { data, error } = await supabaseClient
            .from('employee_holidays')
            .select(`
                *,
                team_members (
                    name,
                    color_code,
                    color
                )
            `)
            .gte('date_from', `${selectedYear}-01-01`)
            .lte('date_to', `${selectedYear}-12-31`);
        
        if (error) throw error;
        
        holidays = data || [];
        
    } catch (error) {
        console.error('Error loading holidays:', error);
    }
}

// ========== RENDER CALENDAR ==========
function renderCalendar() {
    const container = document.getElementById('calendarYear');
    container.innerHTML = '';
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let month = 0; month < 12; month++) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'calendar-month';
        
        // Month header
        const header = document.createElement('div');
        header.className = 'month-header';
        header.textContent = monthNames[month];
        monthDiv.appendChild(header);
        
        // Calendar grid
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        
        // Day headers
        dayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });
        
        // Get first day and total days
        const firstDay = new Date(selectedYear, month, 1);
        const lastDay = new Date(selectedYear, month + 1, 0);
        const totalDays = lastDay.getDate();
        
        // Get day of week (0=Sunday, 1=Monday, etc.)
        let startDay = firstDay.getDay();
        // Convert to Monday-based (0=Monday, 6=Sunday)
        startDay = startDay === 0 ? 6 : startDay - 1;
        
        // Empty cells before first day
        for (let i = 0; i < startDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            grid.appendChild(emptyDay);
        }
        
        // Days of month
        const today = new Date();
        
        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(selectedYear, month, day);
            const dateStr = formatDate(date);
            const dayOfWeek = date.getDay();
            
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.textContent = day;
            dayDiv.dataset.date = dateStr;
            
            // Weekend styling
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                dayDiv.classList.add('weekend');
            }
            
            // Today styling
            if (date.toDateString() === today.toDateString()) {
                dayDiv.classList.add('today');
            }
            
            // Check for holidays on this date
            const dayHolidays = getHolidaysForDate(dateStr);
            
            if (dayHolidays.length > 0) {
                dayDiv.classList.add('has-holiday');
                
                // Stwórz kontener na kropki
                const indicatorsContainer = document.createElement('div');
                indicatorsContainer.className = 'holiday-indicators-container';
                
                // Add colored indicators for each employee with holiday
                dayHolidays.forEach(holiday => {
                    if (activeFilters.has(holiday.employee_id)) {
                        const indicator = document.createElement('div');
                        indicator.className = 'holiday-indicator';
                        const color = holiday.team_members?.color_code || holiday.team_members?.color || '#999';
                        indicator.style.background = color;
                        indicator.title = holiday.team_members?.name || 'Unknown';
                        indicatorsContainer.appendChild(indicator);
                    }
                });
                
                dayDiv.appendChild(indicatorsContainer);
            }
            
            // Click to add/edit holiday
            dayDiv.addEventListener('click', () => {
                if (dayHolidays.length > 0) {
                    openEditDayModal(dateStr, dayHolidays);
                } else {
                    openHolidayModal(dateStr);
                }
            });
            
            grid.appendChild(dayDiv);
        }
        
        monthDiv.appendChild(grid);
        container.appendChild(monthDiv);
    }
}

// ========== RENDER EMPLOYEE LEGEND ==========
function renderEmployeeLegend() {
    const legend = document.getElementById('employeeLegend');
    legend.innerHTML = '';
    
    employees.forEach(emp => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        if (!activeFilters.has(emp.id)) {
            item.classList.add('inactive');
        }
        
        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.background = emp.color_code || emp.color || '#999';
        
        const name = document.createElement('div');
        name.className = 'legend-name';
        name.textContent = emp.name;
        
        const stats = document.createElement('div');
        stats.className = 'legend-stats';
        stats.textContent = `${emp.holiday_used || 0}/${emp.holiday_allowance || 28} days`;
        
        item.appendChild(colorBox);
        item.appendChild(name);
        item.appendChild(stats);
        
        // Click to toggle filter
        item.addEventListener('click', () => {
            if (activeFilters.has(emp.id)) {
                activeFilters.delete(emp.id);
            } else {
                activeFilters.add(emp.id);
            }
            renderEmployeeLegend();
            renderCalendar();
        });
        
        legend.appendChild(item);
    });
}

// ========== UPDATE STATS ==========
function updateStats() {
    const totalHolidays = holidays.length;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const upcomingThisMonth = holidays.filter(h => {
        const dateFrom = new Date(h.date_from);
        return dateFrom.getMonth() === currentMonth && 
               dateFrom.getFullYear() === currentYear &&
               dateFrom >= now;
    }).length;
    
    const totalDaysUsed = holidays.reduce((sum, h) => {
        const from = new Date(h.date_from);
        const to = new Date(h.date_to);
        const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
        return sum + (h.status === 'approved' ? days : 0);
    }, 0);
    
    document.getElementById('totalHolidays').textContent = totalHolidays;
    document.getElementById('upcomingHolidays').textContent = upcomingThisMonth;
    document.getElementById('activeEmployees').textContent = employees.length;
    document.getElementById('totalDaysUsed').textContent = totalDaysUsed;
}

// ========== HELPER FUNCTIONS ==========
function getHolidaysForDate(dateStr) {
    return holidays.filter(h => {
        const date = new Date(dateStr);
        const from = new Date(h.date_from);
        const to = new Date(h.date_to);
        return date >= from && date <= to;
    });
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ========== MODAL FUNCTIONS ==========
function addHolidayModal() {
    populateEmployeeSelect();
    document.getElementById('modalDateFrom').value = '';
    document.getElementById('modalDateTo').value = '';
    document.getElementById('modalEmployee').value = 'all';
    document.getElementById('modalHolidayType').value = 'annual';
    document.getElementById('modalStatus').value = 'approved';
    document.getElementById('modalNotes').value = '';
    
    document.getElementById('holidayModal').classList.add('active');
}

function openHolidayModal(dateStr) {
    populateEmployeeSelect();
    document.getElementById('modalDateFrom').value = dateStr;
    document.getElementById('modalDateTo').value = dateStr;
    document.getElementById('modalEmployee').value = 'all';
    document.getElementById('modalHolidayType').value = 'annual';
    document.getElementById('modalStatus').value = 'approved';
    document.getElementById('modalNotes').value = '';
    
    document.getElementById('holidayModal').classList.add('active');
}

function populateEmployeeSelect() {
    const modalEmployee = document.getElementById('modalEmployee');
    if (!modalEmployee) return;
    
    modalEmployee.innerHTML = '';
    
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'ALL TEAM MEMBERS';
    allOpt.className = 'opt-all-members';
    modalEmployee.appendChild(allOpt);
    
    employees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = emp.name;
        modalEmployee.appendChild(opt);
    });
}

function closeModal() {
    document.getElementById('holidayModal').classList.remove('active');
}

async function saveHoliday() {
    const employeeId = document.getElementById('modalEmployee').value;
    const dateFrom = document.getElementById('modalDateFrom').value;
    const dateTo = document.getElementById('modalDateTo').value;
    const holidayType = document.getElementById('modalHolidayType').value;
    const status = document.getElementById('modalStatus').value;
    const notes = document.getElementById('modalNotes').value;
    
    if ((employeeId !== 'all' && !employeeId) || !dateFrom || !dateTo) {
        showToast('Please fill in all required fields', 'warning');
        return;
    }
    
    // Validate dates
    if (new Date(dateTo) < new Date(dateFrom)) {
        showToast('End date cannot be before start date', 'info');
        return;
    }
    
    try {
        // Jeśli wybrano "All Team Members"
        if (employeeId === 'all') {
            // Dodaj urlop dla każdego pracownika
            const holidaysToInsert = employees.map(emp => ({
                employee_id: emp.id,
                date_from: dateFrom,
                date_to: dateTo,
                holiday_type: holidayType,
                status: status,
                notes: notes || null
            }));
            
            const { error } = await supabaseClient
                .from('employee_holidays')
                .insert(holidaysToInsert);
            
            if (error) throw error;
            
            // Log activity
            logActivity('add', 'team', `added ${holidayType} for all team (${dateFrom} - ${dateTo})`);
            
        } else {
            // Dodaj urlop dla jednego pracownika
            const { error } = await supabaseClient
                .from('employee_holidays')
                .insert({
                    employee_id: employeeId,
                    date_from: dateFrom,
                    date_to: dateTo,
                    holiday_type: holidayType,
                    status: status,
                    notes: notes || null
                });
            
            if (error) throw error;
            
            // Log activity
            const emp = employees.find(e => e.id === employeeId);
            logActivity('add', 'team', `added ${holidayType} for ${emp?.name || 'employee'} (${dateFrom} - ${dateTo})`);
        }
        
        closeModal();
        await loadEmployees(); // Refresh employee stats
        await loadHolidays();
        renderCalendar();
        updateStats();
        
    } catch (error) {
        console.error('Error saving holiday:', error);
        showToast('Error saving: ' + error.message, 'error');
    }
}

// ========== EDIT DAY MODAL ==========
let currentEditDate = null;

function openEditDayModal(dateStr, dayHolidays) {
    currentEditDate = dateStr;
    const modal = document.getElementById('editDayModal');
    const header = document.getElementById('editDayHeader');
    const list = document.getElementById('editDayList');
    
    // Format date for display
    const date = new Date(dateStr);
    const formattedDate = date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    header.textContent = `Holidays on ${formattedDate}`;
    
    // Build list of holidays
    list.innerHTML = '';
    
    dayHolidays.forEach(holiday => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 12px; background: #3e3e42; border-radius: 3px; margin-bottom: 8px;';
        
        const color = document.createElement('div');
        color.style.cssText = `width: 20px; height: 20px; border-radius: 3px; background: ${holiday.team_members?.color_code || holiday.team_members?.color || '#999'}; border: 1px solid #555;`;
        
        const info = document.createElement('div');
        info.style.flex = '1';
        info.innerHTML = `
            <strong>${holiday.team_members?.name || 'Unknown'}</strong><br>
            <small style="color: #999;">${holiday.holiday_type} - ${holiday.status} ${holiday.notes ? '- ' + holiday.notes : ''}</small>
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'modal-btn';
        deleteBtn.textContent = '🗑️ Remove';
        deleteBtn.style.cssText = 'padding: 8px 12px; background: #d32f2f; color: white;';
        deleteBtn.onclick = () => deleteHoliday(holiday.id);
        
        item.appendChild(color);
        item.appendChild(info);
        item.appendChild(deleteBtn);
        list.appendChild(item);
    });
    
    modal.classList.add('active');
}

function closeEditDayModal() {
    document.getElementById('editDayModal').classList.remove('active');
    currentEditDate = null;
}

function addMoreHolidaysForDay() {
    closeEditDayModal();
    openHolidayModal(currentEditDate);
}

async function deleteHoliday(holidayId) {
    if (!confirm('Are you sure you want to remove this holiday?')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('employee_holidays')
            .delete()
            .eq('id', holidayId);
        
        if (error) throw error;
        
        await loadEmployees();
        await loadHolidays();
        renderCalendar();
        updateStats();
        
        // Refresh edit modal if still open
        if (currentEditDate) {
            const dayHolidays = getHolidaysForDate(currentEditDate);
            if (dayHolidays.length > 0) {
                openEditDayModal(currentEditDate, dayHolidays);
            } else {
                closeEditDayModal();
            }
        }
        
    } catch (error) {
        console.error('Error deleting holiday:', error);
        showToast('Error deleting: ' + error.message, 'error');
    }
}