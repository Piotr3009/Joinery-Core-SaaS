// ========================================
// ACTIVITY LOG - Modal Functions
// ========================================
// Note: logActivity() function is in activity-logger.js

let activityLogData = [];
let activityFilterUser = 'all';
let activityFilterDepartment = 'all';

// ========================================
// MODAL FUNCTIONS
// ========================================

async function openActivityModal() {
    // Show modal
    document.getElementById('activityModal').style.display = 'flex';
    
    // Load data
    await loadActivityLog();
    
    // Render
    renderActivityLog();
}

function closeActivityModal() {
    document.getElementById('activityModal').style.display = 'none';
}

async function loadActivityLog() {
    try {
        // Get yesterday's date at 00:00
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Load last 2 days of activity
        const { data, error } = await supabaseClient
            .from('activity_log')
            .select('*')
            .gte('created_at', yesterday.toISOString())
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        activityLogData = data || [];
        
    } catch (err) {
        console.error('Error loading activity log:', err);
        activityLogData = [];
    }
}

function filterActivityByUser(userId) {
    activityFilterUser = userId;
    renderActivityLog();
}

function filterActivityByDepartment(department) {
    activityFilterDepartment = department;
    renderActivityLog();
}

function renderActivityLog() {
    const container = document.getElementById('activityLogContent');
    
    // Apply filters
    let filtered = activityLogData;
    
    if (activityFilterUser !== 'all') {
        filtered = filtered.filter(a => a.user_id === activityFilterUser);
    }
    
    if (activityFilterDepartment !== 'all') {
        filtered = filtered.filter(a => a.department === activityFilterDepartment);
    }
    
    // Separate TODAY and YESTERDAY
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayActivities = filtered.filter(a => new Date(a.created_at) >= today);
    const yesterdayActivities = filtered.filter(a => {
        const actDate = new Date(a.created_at);
        return actDate < today && actDate >= new Date(today.getTime() - 24*60*60*1000);
    });
    
    // Update filter dropdowns with unique users
    updateUserFilter();
    
    // Build HTML
    let html = '';
    
    // TODAY section
    html += `<div class="activity-section">
        <div class="activity-section-header">TODAY</div>`;
    
    if (todayActivities.length === 0) {
        html += `<div class="activity-empty">No activity today</div>`;
    } else {
        todayActivities.forEach(a => {
            html += renderActivityItem(a);
        });
    }
    html += `</div>`;
    
    // YESTERDAY section
    html += `<div class="activity-section">
        <div class="activity-section-header">YESTERDAY</div>`;
    
    if (yesterdayActivities.length === 0) {
        html += `<div class="activity-empty">No activity yesterday</div>`;
    } else {
        yesterdayActivities.forEach(a => {
            html += renderActivityItem(a);
        });
    }
    html += `</div>`;
    
    container.innerHTML = html;
}

function renderActivityItem(activity) {
    const time = new Date(activity.created_at).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const deptColors = {
        stock: '#f97316',
        project: '#3b82f6',
        wages: '#8b5cf6',
        files: '#10b981',
        accounting: '#f59e0b',
        team: '#ec4899'
    };
    
    const deptColor = deptColors[activity.department] || '#71717a';
    const projectNum = activity.project_number || '—';
    
    return `
        <div class="activity-item">
            <span class="activity-time">${time}</span>
            <span class="activity-user">${activity.user_name}</span>
            <span class="activity-project">${projectNum}</span>
            <span class="activity-dept" style="border-color: ${deptColor}; color: ${deptColor};">${activity.department}</span>
            <span class="activity-desc">${activity.description}</span>
        </div>
    `;
}

function updateUserFilter() {
    const select = document.getElementById('activityUserFilter');
    if (!select) return;
    
    // Get unique users
    const users = [...new Map(activityLogData.map(a => [a.user_id, { id: a.user_id, name: a.user_name }])).values()];
    
    // Keep current selection
    const currentValue = select.value;
    
    // Rebuild options
    let html = '<option value="all">All Users</option>';
    users.forEach(u => {
        html += `<option value="${u.id}" ${currentValue === u.id ? 'selected' : ''}>${u.name}</option>`;
    });
    
    select.innerHTML = html;
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('activityModal');
    if (e.target === modal) {
        closeActivityModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('activityModal');
        if (modal && modal.style.display === 'flex') {
            closeActivityModal();
        }
    }
});