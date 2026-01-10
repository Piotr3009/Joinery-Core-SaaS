// ========== EQUIPMENT MANAGEMENT APP ==========

let machines = [];
let vans = [];
let smallTools = [];
let currentView = 'machines'; // machines / vans / tools
let currentEditItem = null;
let toolCategories = ['saws', 'bits', 'clamps', 'measuring', 'other']; // default categories

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadAllEquipment();
    await loadToolCategories(); // Load unique categories from DB
    renderView();
    updateStats();
});

// ========== IMAGE UPLOAD FUNCTION ==========
async function uploadImage(file, folder = 'equipment') {
    if (!file) return null;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('File too large! Max 5MB for images', 'info');
        return null;
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Invalid file type! Only JPG, PNG, WEBP allowed', 'info');
        return null;
    }
    
    try {
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}_${timestamp}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;
        
        
        const { data, error } = await supabaseClient.storage
            .from('equipment-images')
            .upload(filePath, file);
        
        if (error) throw error;
        
        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('equipment-images')
            .getPublicUrl(filePath);
        
        return publicUrl;
        
    } catch (err) {
        console.error('Error uploading image:', err);
        showToast('Error uploading: ' + err.message, 'error');
        return null;
    }
}

// ========== DOCUMENT UPLOAD FUNCTION ==========
async function uploadDocument(file, folder = 'equipment') {
    if (!file) return null;
    
    // Check file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
        showToast('File too large! Max 20MB for documents', 'info');
        return null;
    }
    
    // Check file type
    const allowedTypes = [
        'application/pdf',
        'image/jpeg', 'image/jpg', 'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        showToast('Invalid file type! Only PDF, DOC, DOCX, JPG, PNG allowed', 'info');
        return null;
    }
    
    try {
        const timestamp = Date.now();
        const fileName = `${folder}_${timestamp}_${file.name}`;
        const filePath = `${folder}/${fileName}`;
        
        
        const { data, error } = await supabaseClient.storage
            .from('equipment-documents')
            .upload(filePath, file);
        
        if (error) throw error;
        
        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('equipment-documents')
            .getPublicUrl(filePath);
        
        return publicUrl;
        
    } catch (err) {
        console.error('Error uploading document:', err);
        showToast('Error uploading: ' + err.message, 'error');
        return null;
    }
}

// ========== AUTH CHECK ==========
async function checkAuth() {
    if (typeof supabaseClient !== 'undefined') {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        window.currentUser = profile;
        
        // Dodaj user dropdown do toolbara
        addUserDropdownToToolbar(profile);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        supabaseClient.auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    }
}

// ========== LOAD DATA ==========
async function loadAllEquipment() {
    try {
        // Load machines
        const { data: machinesData, error: machinesError } = await supabaseClient
            .from('machines')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (machinesError) throw machinesError;
        machines = machinesData || [];
        
        // Load latest service info for each machine
        const { data: servicesData } = await supabaseClient
            .from('machine_service_history')
            .select('machine_id, next_service_date, service_date')
            .order('service_date', { ascending: false });
        
        // Map next_service_date to machines (use most recent service record)
        if (servicesData) {
            const serviceMap = {};
            servicesData.forEach(s => {
                if (!serviceMap[s.machine_id]) {
                    serviceMap[s.machine_id] = s;
                }
            });
            machines = machines.map(m => ({
                ...m,
                next_service_date: serviceMap[m.id]?.next_service_date || null,
                last_service_date: serviceMap[m.id]?.service_date || null
            }));
        }
        
        // Load vans
        const { data: vansData, error: vansError } = await supabaseClient
            .from('vans')
            .select(`
                *,
                team_members (
                    id,
                    name
                )
            `)
            .order('created_at', { ascending: false });
        
        if (vansError) throw vansError;
        vans = vansData || [];
        
        // Load small tools
        const { data: toolsData, error: toolsError } = await supabaseClient
            .from('small_tools')
            .select('*')
            .order('name', { ascending: true });
        
        if (toolsError) throw toolsError;
        smallTools = toolsData || [];
        
    } catch (err) {
        console.error('Error loading equipment:', err);
        showToast('Error loading: ' + err.message, 'error');
    }
}

// ========== LOAD TOOL CATEGORIES FROM DB ==========
async function loadToolCategories() {
    try {
        // Get all unique categories from small_tools
        const { data, error } = await supabaseClient
            .from('small_tools')
            .select('category');
        
        if (error) throw error;
        
        // Extract unique categories
        const uniqueCategories = [...new Set((data || []).map(t => t.category))];
        
        // Merge with default categories (ensure defaults are always present)
        const defaults = ['saws', 'bits', 'clamps', 'measuring', 'other'];
        toolCategories = [...new Set([...defaults, ...uniqueCategories])].sort();
        
        
    } catch (err) {
        console.error('Error loading categories:', err);
        // Keep default categories on error
        toolCategories = ['saws', 'bits', 'clamps', 'measuring', 'other'];
    }
}

// ========== VIEW SWITCHING ==========
function switchView(view) {
    currentView = view;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderView();
    updateStats();
}

// ========== RENDER VIEW ==========
function renderView() {
    const container = document.getElementById('equipmentContainer');
    
    if (currentView === 'machines') {
        renderMachinesTable(container);
    } else if (currentView === 'vans') {
        renderVansTable(container);
    } else if (currentView === 'tools') {
        renderToolsTable(container);
    }
}

// ========== RENDER MACHINES TABLE ==========
function renderMachinesTable(container) {
    if (machines.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">🔧</div>
                <div style="font-size: 18px;">No machines found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Machine" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #252526;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">IMAGE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MANUFACTURER</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MODEL</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">SERIAL #</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">STATUS</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">VALUE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">WARRANTY</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NEXT SERVICE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${machines.map(machine => createMachineRow(machine)).join('')}
            </tbody>
        </table>
    `;
}

function createMachineRow(machine) {
    const statusColors = {
        working: '#4CAF50',
        repair: '#ff9800',
        retired: '#f44336'
    };
    
    const warrantyDate = machine.warranty_end_date ? new Date(machine.warranty_end_date) : null;
    const warrantyExpired = warrantyDate && warrantyDate < new Date();
    const warrantyClass = warrantyExpired ? 'expired' : 'active';
    
    return `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                ${machine.image_url ? 
                    `<img src="${machine.image_url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 3px; cursor: pointer;" onclick="viewImage('${machine.image_url}')">` 
                    : '<div style="width: 60px; height: 60px; background: #3e3e42; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔧</div>'}
            </td>
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${machine.name}</div>
            </td>
            <td style="padding: 12px; color: #b5cea8;">${machine.manufacturer || '-'}</td>
            <td style="padding: 12px; color: #4a9eff;">${machine.model || '-'}</td>
            <td style="padding: 12px; font-family: monospace; color: #999;">${machine.serial_number || '-'}</td>
            <td style="padding: 12px; text-align: center;">
                <span style="padding: 4px 10px; background: ${statusColors[machine.status]}20; color: ${statusColors[machine.status]}; border-radius: 3px; font-size: 11px; text-transform: uppercase; font-weight: 600;">
                    ${machine.status}
                </span>
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: #4CAF50;">
                £${(machine.current_value || 0).toLocaleString()}
            </td>
            <td style="padding: 12px; text-align: center;">
                ${warrantyDate ? 
                    `<span style="color: ${warrantyExpired ? '#f44336' : '#4CAF50'};">${warrantyDate.toLocaleDateString('en-GB')}</span>` 
                    : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px; text-align: center;">
                ${(() => {
                    const nextService = machine.next_service_date ? new Date(machine.next_service_date) : null;
                    const now = new Date();
                    const daysUntil = nextService ? Math.ceil((nextService - now) / (1000 * 60 * 60 * 24)) : null;
                    const isOverdue = daysUntil !== null && daysUntil < 0;
                    const isDueSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;
                    
                    if (!nextService) return '<span style="color: #666;">-</span>';
                    
                    const color = isOverdue ? '#f44336' : (isDueSoon ? '#ff9800' : '#4CAF50');
                    const label = isOverdue ? 'OVERDUE' : (isDueSoon ? `${daysUntil}d` : '');
                    
                    return `<span style="color: ${color};">${nextService.toLocaleDateString('en-GB')}</span>
                            ${label ? `<div style="font-size: 10px; color: ${color}; font-weight: 600;">${label}</div>` : ''}`;
                })()}
            </td>
            <td style="padding: 12px; text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button onclick="openServiceModalForMachine('${machine.id}')" class="icon-btn" style="color: #f59e0b; border: 1px solid #f59e0b;" title="Add Service">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M.102 2.223A3.004 3.004 0 0 0 3.78 5.897l6.341 6.252A3.003 3.003 0 0 0 13 16a3 3 0 1 0-.851-5.878L5.897 3.781A3.004 3.004 0 0 0 2.223.1l2.141 2.142L4 4l-1.757.364L.102 2.223zm13.37 9.019.528.026.287.445.445.287.026.529L15 13l-.242.471-.026.529-.445.287-.287.445-.529.026L13 15l-.471-.242-.529-.026-.287-.445-.445-.287-.026-.529L11 13l.242-.471.026-.529.445-.287.287-.445.529-.026L13 11l.471.242z"/></svg>
                    </button>
                    <button onclick="viewMachineDetails('${machine.id}')" class="icon-btn" style="color: #569cd6; border: 1px solid #569cd6;" title="Details">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 11.5v-8zM2.5 3a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-11z"/><path d="M3 5.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8zm0 2.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/></svg>
                    </button>
                    <button onclick="editMachine('${machine.id}')" class="icon-btn" style="color: #4ec9b0; border: 1px solid #4ec9b0;" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                    </button>
                    <button onclick="deleteMachine('${machine.id}')" class="icon-btn" style="color: #f48771; border: 1px solid #f48771;" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// ========== RENDER VANS TABLE ==========
function renderVansTable(container) {
    if (vans.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">🚐</div>
                <div style="font-size: 18px;">No vans found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Van" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #252526;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">IMAGE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">REG PLATE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MOT DUE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">INSURANCE DUE</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MILEAGE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ASSIGNED TO</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">STATUS</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${vans.map(van => createVanRow(van)).join('')}
            </tbody>
        </table>
    `;
}

function createVanRow(van) {
    const motDate = van.mot_due_date ? new Date(van.mot_due_date) : null;
    const insuranceDate = van.insurance_due_date ? new Date(van.insurance_due_date) : null;
    const today = new Date();
    
    const motDaysLeft = motDate ? Math.floor((motDate - today) / (1000 * 60 * 60 * 24)) : null;
    const insuranceDaysLeft = insuranceDate ? Math.floor((insuranceDate - today) / (1000 * 60 * 60 * 24)) : null;
    
    const motColor = motDaysLeft <= 30 ? '#f44336' : (motDaysLeft <= 60 ? '#ff9800' : '#4CAF50');
    const insuranceColor = insuranceDaysLeft <= 30 ? '#f44336' : (insuranceDaysLeft <= 60 ? '#ff9800' : '#4CAF50');
    
    const statusColors = {
        active: '#4CAF50',
        repair: '#ff9800',
        retired: '#f44336'
    };
    
    return `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                ${van.image_url ? 
                    `<img src="${van.image_url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 3px; cursor: pointer;" onclick="viewImage('${van.image_url}')">` 
                    : '<div style="width: 60px; height: 60px; background: #3e3e42; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🚐</div>'}
            </td>
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${van.name}</div>
            </td>
            <td style="padding: 12px; font-family: monospace; font-weight: 600; color: #4a9eff;">${van.registration_plate}</td>
            <td style="padding: 12px; text-align: center;">
                ${motDate ? 
                    `<div style="color: ${motColor}; font-weight: 600;">${motDate.toLocaleDateString('en-GB')}</div>
                     <div style="font-size: 11px; color: ${motColor};">${motDaysLeft} days</div>` 
                    : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px; text-align: center;">
                ${insuranceDate ? 
                    `<div style="color: ${insuranceColor}; font-weight: 600;">${insuranceDate.toLocaleDateString('en-GB')}</div>
                     <div style="font-size: 11px; color: ${insuranceColor};">${insuranceDaysLeft} days</div>` 
                    : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: #b5cea8;">
                ${(van.mileage || 0).toLocaleString()} mi
            </td>
            <td style="padding: 12px;">
                ${van.team_members ? 
                    `<span style="color: #4ec9b0;">${van.team_members.name}</span>` 
                    : '<span style="color: #666;">Unassigned</span>'}
            </td>
            <td style="padding: 12px; text-align: center;">
                <span style="padding: 4px 10px; background: ${statusColors[van.status]}20; color: ${statusColors[van.status]}; border-radius: 3px; font-size: 11px; text-transform: uppercase; font-weight: 600;">
                    ${van.status}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button onclick="viewVanDetails('${van.id}')" class="icon-btn" style="color: #569cd6; border: 1px solid #569cd6;" title="Details">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 11.5v-8zM2.5 3a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-11z"/><path d="M3 5.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8zm0 2.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/></svg>
                    </button>
                    <button onclick="editVan('${van.id}')" class="icon-btn" style="color: #4ec9b0; border: 1px solid #4ec9b0;" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                    </button>
                    <button onclick="deleteVan('${van.id}')" class="icon-btn" style="color: #f48771; border: 1px solid #f48771;" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// ========== RENDER TOOLS TABLE ==========
function renderToolsTable(container) {
    if (smallTools.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">🔩</div>
                <div style="font-size: 18px;">No tools found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Tool" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #252526;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">IMAGE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">CATEGORY</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">QUANTITY</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MIN QTY</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">LOCATION</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">COST/UNIT</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${smallTools.map(tool => createToolRow(tool)).join('')}
            </tbody>
        </table>
    `;
}

function createToolRow(tool) {
    const isLowStock = tool.quantity <= tool.min_quantity;
    
    return `
        <tr style="border-bottom: 1px solid #333; ${isLowStock ? 'background: rgba(244, 67, 54, 0.1);' : ''}">
            <td style="padding: 12px;">
                ${tool.image_url ? 
                    `<img src="${tool.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 3px; cursor: pointer;" onclick="viewImage('${tool.image_url}')">` 
                    : '<div style="width: 50px; height: 50px; background: #3e3e42; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🔩</div>'}
            </td>
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${tool.name}</div>
            </td>
            <td style="padding: 12px;">
                <span style="padding: 3px 8px; background: #3e3e42; border-radius: 3px; font-size: 11px; text-transform: uppercase;">${tool.category}</span>
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: ${isLowStock ? '#f44336' : '#4CAF50'};">
                ${tool.quantity} ${isLowStock ? '⚠️' : ''}
            </td>
            <td style="padding: 12px; text-align: right; color: #999;">
                ${tool.min_quantity}
            </td>
            <td style="padding: 12px; color: #b5cea8;">
                ${tool.location || '-'}
            </td>
            <td style="padding: 12px; text-align: right; color: #4a9eff;">
                £${(tool.cost_per_unit || 0).toFixed(2)}
            </td>
            <td style="padding: 12px; text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button onclick="editTool('${tool.id}')" class="icon-btn" style="color: #4ec9b0; border: 1px solid #4ec9b0;" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                    </button>
                    <button onclick="deleteTool('${tool.id}')" class="icon-btn" style="color: #f48771; border: 1px solid #f48771;" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// ========== STATS ==========
function updateStats() {
    if (currentView === 'machines') {
        const workingMachines = machines.filter(m => m.status === 'working').length;
        const totalValue = machines.reduce((sum, m) => sum + (m.current_value || 0), 0);
        const servicesNeeded = machines.filter(m => {
            if (!m.next_service_date) return false;
            const daysLeft = Math.ceil((new Date(m.next_service_date) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 30; // w ciągu 30 dni lub przeterminowane
        }).length;
        
        document.getElementById('stat1Value').textContent = machines.length;
        document.getElementById('stat1Label').textContent = 'Total Machines';
        
        document.getElementById('stat2Value').textContent = workingMachines;
        document.getElementById('stat2Label').textContent = 'Working';
        
        document.getElementById('stat3Value').textContent = `£${totalValue.toLocaleString()}`;
        document.getElementById('stat3Label').textContent = 'Total Value';
        
        document.getElementById('stat4Value').textContent = servicesNeeded;
        document.getElementById('stat4Label').textContent = 'Services Needed';
        
    } else if (currentView === 'vans') {
        const activeVans = vans.filter(v => v.status === 'active').length;
        const totalValue = vans.reduce((sum, v) => sum + (v.current_value || 0), 0);
        const motExpiring = vans.filter(v => {
            if (!v.mot_due_date) return false;
            const daysLeft = Math.floor((new Date(v.mot_due_date) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft > 0 && daysLeft <= 60;
        }).length;
        const insuranceExpiring = vans.filter(v => {
            if (!v.insurance_due_date) return false;
            const daysLeft = Math.floor((new Date(v.insurance_due_date) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft > 0 && daysLeft <= 60;
        }).length;
        
        document.getElementById('stat1Value').textContent = vans.length;
        document.getElementById('stat1Label').textContent = 'Total Vans';
        
        document.getElementById('stat2Value').textContent = activeVans;
        document.getElementById('stat2Label').textContent = 'Active';
        
        document.getElementById('stat3Value').textContent = `£${totalValue.toLocaleString()}`;
        document.getElementById('stat3Label').textContent = 'Total Value';
        
        document.getElementById('stat4Value').textContent = `${motExpiring} / ${insuranceExpiring}`;
        document.getElementById('stat4Label').textContent = 'MOT / Insurance Expiring';
        
    } else if (currentView === 'tools') {
        const lowStock = smallTools.filter(t => t.quantity <= t.min_quantity).length;
        const totalQuantity = smallTools.reduce((sum, t) => sum + (t.quantity || 0), 0);
        const totalValue = smallTools.reduce((sum, t) => sum + ((t.quantity || 0) * (t.cost_per_unit || 0)), 0);
        
        document.getElementById('stat1Value').textContent = smallTools.length;
        document.getElementById('stat1Label').textContent = 'Total Items';
        
        document.getElementById('stat2Value').textContent = lowStock;
        document.getElementById('stat2Label').textContent = 'Low Stock';
        
        document.getElementById('stat3Value').textContent = totalQuantity;
        document.getElementById('stat3Label').textContent = 'Total Quantity';
        
        document.getElementById('stat4Value').textContent = `£${totalValue.toLocaleString()}`;
        document.getElementById('stat4Label').textContent = 'Total Value';
    }
}

// ========== MODAL FUNCTIONS ==========

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Handle custom category input
function handleCategoryChange() {
    const select = document.getElementById('toolCategory');
    const customInput = document.getElementById('toolCustomCategory');
    
    if (select.value === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
}

// ========== ADD MACHINE ==========
function openAddMachineModal() {
    currentEditItem = null;
    document.getElementById('machineModalTitle').textContent = 'Add Machine';
    
    // Clear form
    document.getElementById('machineName').value = '';
    document.getElementById('machineManufacturer').value = '';
    document.getElementById('machineModel').value = '';
    document.getElementById('machineSerial').value = '';
    document.getElementById('machinePurchaseDate').value = '';
    document.getElementById('machineWarrantyEnd').value = '';
    document.getElementById('machinePurchaseCost').value = '';
    document.getElementById('machineCurrentValue').value = '';
    document.getElementById('machineStatus').value = 'working';
    document.getElementById('machineImageFile').value = '';
    document.getElementById('machineImagePreview').innerHTML = '';
    document.getElementById('machineNotes').value = '';
    
    document.getElementById('machineModal').classList.add('active');
}

async function saveMachine() {
    const name = document.getElementById('machineName').value.trim();
    
    if (!name) {
        showToast('Please enter machine name', 'warning');
        return;
    }
    
    // Upload image if selected
    let imageUrl = null;
    const imageFile = document.getElementById('machineImageFile').files[0];
    if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'machines');
        if (!imageUrl) return; // Upload failed
    }
    
    const machineData = {
        name: name,
        manufacturer: document.getElementById('machineManufacturer').value.trim() || null,
        model: document.getElementById('machineModel').value.trim() || null,
        serial_number: document.getElementById('machineSerial').value.trim() || null,
        purchase_date: document.getElementById('machinePurchaseDate').value || null,
        warranty_end_date: document.getElementById('machineWarrantyEnd').value || null,
        purchase_cost: parseFloat(document.getElementById('machinePurchaseCost').value) || null,
        current_value: parseFloat(document.getElementById('machineCurrentValue').value) || null,
        status: document.getElementById('machineStatus').value,
        notes: document.getElementById('machineNotes').value.trim() || null
    };
    
    // Add image URL only if we uploaded one
    if (imageUrl) {
        machineData.image_url = imageUrl;
    }
    
    try {
        if (currentEditItem) {
            // Update existing
            const { error } = await supabaseClient
                .from('machines')
                .update(machineData)
                .eq('id', currentEditItem);
            
            if (error) throw error;
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('machines')
                .insert([machineData]);
            
            if (error) throw error;
        }
        
        closeModal('machineModal');
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error saving machine:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== ADD VAN ==========
async function openAddVanModal() {
    currentEditItem = null;
    document.getElementById('vanModalTitle').textContent = 'Add Van';
    
    // Load team members for assignment
    const { data: teamData } = await supabaseClient
        .from('team_members')
        .select('id, name')
        .eq('active', true)
        .order('name');
    
    const select = document.getElementById('vanAssignedWorker');
    select.innerHTML = '<option value="">Unassigned</option>';
    
    if (teamData) {
        teamData.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            select.appendChild(option);
        });
    }
    
    // Clear form
    document.getElementById('vanName').value = '';
    document.getElementById('vanRegPlate').value = '';
    document.getElementById('vanPurchaseDate').value = '';
    document.getElementById('vanMileage').value = '';
    document.getElementById('vanMotDue').value = '';
    document.getElementById('vanInsuranceDue').value = '';
    document.getElementById('vanPurchaseCost').value = '';
    document.getElementById('vanCurrentValue').value = '';
    document.getElementById('vanAssignedWorker').value = '';
    document.getElementById('vanStatus').value = 'active';
    document.getElementById('vanImageFile').value = '';
    document.getElementById('vanImagePreview').innerHTML = '';
    document.getElementById('vanNotes').value = '';
    
    document.getElementById('vanModal').classList.add('active');
}

async function saveVan() {
    const name = document.getElementById('vanName').value.trim();
    const regPlate = document.getElementById('vanRegPlate').value.trim().toUpperCase();
    
    if (!name) {
        showToast('Please enter van name', 'warning');
        return;
    }
    
    if (!regPlate) {
        showToast('Please enter registration plate', 'warning');
        return;
    }
    
    // Upload image if selected
    let imageUrl = null;
    const imageFile = document.getElementById('vanImageFile').files[0];
    if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'vans');
        if (!imageUrl) return; // Upload failed
    }
    
    const vanData = {
        name: name,
        registration_plate: regPlate,
        purchase_date: document.getElementById('vanPurchaseDate').value || null,
        mileage: parseInt(document.getElementById('vanMileage').value) || 0,
        mot_due_date: document.getElementById('vanMotDue').value || null,
        insurance_due_date: document.getElementById('vanInsuranceDue').value || null,
        purchase_cost: parseFloat(document.getElementById('vanPurchaseCost').value) || null,
        current_value: parseFloat(document.getElementById('vanCurrentValue').value) || null,
        assigned_to_worker_id: document.getElementById('vanAssignedWorker').value || null,
        status: document.getElementById('vanStatus').value,
        notes: document.getElementById('vanNotes').value.trim() || null
    };
    
    // Add image URL only if we uploaded one
    if (imageUrl) {
        vanData.image_url = imageUrl;
    }
    
    try {
        if (currentEditItem) {
            // Update existing
            const { error } = await supabaseClient
                .from('vans')
                .update(vanData)
                .eq('id', currentEditItem);
            
            if (error) throw error;
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('vans')
                .insert([vanData]);
            
            if (error) throw error;
        }
        
        closeModal('vanModal');
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error saving van:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== ADD TOOL ==========
function openAddToolModal() {
    currentEditItem = null;
    document.getElementById('toolModalTitle').textContent = 'Add Tool';
    
    // Populate categories dropdown dynamically
    const categorySelect = document.getElementById('toolCategory');
    categorySelect.innerHTML = toolCategories.map(cat => 
        `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`
    ).join('') + '<option value="custom">➕ Add New Category...</option>';
    
    // Clear form
    document.getElementById('toolName').value = '';
    document.getElementById('toolCategory').value = toolCategories[0] || 'other';
    document.getElementById('toolCustomCategory').value = '';
    document.getElementById('toolCustomCategory').style.display = 'none';
    document.getElementById('toolQuantity').value = '0';
    document.getElementById('toolMinQuantity').value = '0';
    document.getElementById('toolLocation').value = '';
    document.getElementById('toolCostPerUnit').value = '';
    document.getElementById('toolImageFile').value = '';
    document.getElementById('toolImagePreview').innerHTML = '';
    document.getElementById('toolNotes').value = '';
    
    document.getElementById('toolModal').classList.add('active');
}

async function saveTool() {
    const name = document.getElementById('toolName').value.trim();
    
    if (!name) {
        showToast('Please enter tool name', 'warning');
        return;
    }
    
    // Get category - check if custom
    let category = document.getElementById('toolCategory').value;
    if (category === 'custom') {
        const customCategory = document.getElementById('toolCustomCategory').value.trim().toLowerCase();
        if (!customCategory) {
            showToast('Please enter custom category name', 'warning');
            return;
        }
        category = customCategory;
    }
    
    // Upload image if selected
    let imageUrl = null;
    const imageFile = document.getElementById('toolImageFile').files[0];
    if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'tools');
        if (!imageUrl) return; // Upload failed
    }
    
    const toolData = {
        name: name,
        category: category,
        quantity: parseInt(document.getElementById('toolQuantity').value) || 0,
        min_quantity: parseInt(document.getElementById('toolMinQuantity').value) || 0,
        location: document.getElementById('toolLocation').value.trim() || null,
        cost_per_unit: parseFloat(document.getElementById('toolCostPerUnit').value) || null,
        notes: document.getElementById('toolNotes').value.trim() || null
    };
    
    // Add image URL only if we uploaded one
    if (imageUrl) {
        toolData.image_url = imageUrl;
    }
    
    try {
        if (currentEditItem) {
            // Update existing
            const { error } = await supabaseClient
                .from('small_tools')
                .update(toolData)
                .eq('id', currentEditItem);
            
            if (error) throw error;
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('small_tools')
                .insert([toolData]);
            
            if (error) throw error;
        }
        
        closeModal('toolModal');
        await loadAllEquipment();
        await loadToolCategories(); // Reload categories to include new custom category
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error saving tool:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== EDIT FUNCTIONS ==========
async function editMachine(id) {
    const machine = machines.find(m => m.id === id);
    if (!machine) return;
    
    currentEditItem = id;
    document.getElementById('machineModalTitle').textContent = 'Edit Machine';
    
    // Fill form
    document.getElementById('machineName').value = machine.name || '';
    document.getElementById('machineManufacturer').value = machine.manufacturer || '';
    document.getElementById('machineModel').value = machine.model || '';
    document.getElementById('machineSerial').value = machine.serial_number || '';
    document.getElementById('machinePurchaseDate').value = machine.purchase_date || '';
    document.getElementById('machineWarrantyEnd').value = machine.warranty_end_date || '';
    document.getElementById('machinePurchaseCost').value = machine.purchase_cost || '';
    document.getElementById('machineCurrentValue').value = machine.current_value || '';
    document.getElementById('machineStatus').value = machine.status;
    document.getElementById('machineImageFile').value = '';
    document.getElementById('machineNotes').value = machine.notes || '';
    
    // Show current image if exists
    const preview = document.getElementById('machineImagePreview');
    if (machine.image_url) {
        preview.innerHTML = `
            <div style="margin-top: 10px;">
                <div style="color: #999; font-size: 11px; margin-bottom: 5px;">Current image:</div>
                <img src="${machine.image_url}" style="max-width: 200px; max-height: 150px; border-radius: 3px;">
                <div style="color: #999; font-size: 11px; margin-top: 5px;">Upload new image to replace</div>
            </div>
        `;
    } else {
        preview.innerHTML = '';
    }
    
    document.getElementById('machineModal').classList.add('active');
}

async function editVan(id) {
    const van = vans.find(v => v.id === id);
    if (!van) return;
    
    currentEditItem = id;
    document.getElementById('vanModalTitle').textContent = 'Edit Van';
    
    // Load team members
    const { data: teamData } = await supabaseClient
        .from('team_members')
        .select('id, name')
        .eq('active', true)
        .order('name');
    
    const select = document.getElementById('vanAssignedWorker');
    select.innerHTML = '<option value="">Unassigned</option>';
    
    if (teamData) {
        teamData.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            select.appendChild(option);
        });
    }
    
    // Fill form
    document.getElementById('vanName').value = van.name || '';
    document.getElementById('vanRegPlate').value = van.registration_plate || '';
    document.getElementById('vanPurchaseDate').value = van.purchase_date || '';
    document.getElementById('vanMileage').value = van.mileage || '';
    document.getElementById('vanMotDue').value = van.mot_due_date || '';
    document.getElementById('vanInsuranceDue').value = van.insurance_due_date || '';
    document.getElementById('vanPurchaseCost').value = van.purchase_cost || '';
    document.getElementById('vanCurrentValue').value = van.current_value || '';
    document.getElementById('vanAssignedWorker').value = van.assigned_to_worker_id || '';
    document.getElementById('vanStatus').value = van.status;
    document.getElementById('vanImageFile').value = '';
    document.getElementById('vanNotes').value = van.notes || '';
    
    // Show current image if exists
    const preview = document.getElementById('vanImagePreview');
    if (van.image_url) {
        preview.innerHTML = `
            <div style="margin-top: 10px;">
                <div style="color: #999; font-size: 11px; margin-bottom: 5px;">Current image:</div>
                <img src="${van.image_url}" style="max-width: 200px; max-height: 150px; border-radius: 3px;">
                <div style="color: #999; font-size: 11px; margin-top: 5px;">Upload new image to replace</div>
            </div>
        `;
    } else {
        preview.innerHTML = '';
    }
    
    document.getElementById('vanModal').classList.add('active');
}

async function editTool(id) {
    const tool = smallTools.find(t => t.id === id);
    if (!tool) return;
    
    currentEditItem = id;
    document.getElementById('toolModalTitle').textContent = 'Edit Tool';
    
    // Populate categories dropdown dynamically
    const categorySelect = document.getElementById('toolCategory');
    categorySelect.innerHTML = toolCategories.map(cat => 
        `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`
    ).join('') + '<option value="custom">➕ Add New Category...</option>';
    
    // Fill form
    document.getElementById('toolName').value = tool.name || '';
    document.getElementById('toolCategory').value = tool.category;
    document.getElementById('toolQuantity').value = tool.quantity || 0;
    document.getElementById('toolMinQuantity').value = tool.min_quantity || 0;
    document.getElementById('toolLocation').value = tool.location || '';
    document.getElementById('toolCostPerUnit').value = tool.cost_per_unit || '';
    document.getElementById('toolImageFile').value = '';
    document.getElementById('toolNotes').value = tool.notes || '';
    
    // Show current image if exists
    const preview = document.getElementById('toolImagePreview');
    if (tool.image_url) {
        preview.innerHTML = `
            <div style="margin-top: 10px;">
                <div style="color: #999; font-size: 11px; margin-bottom: 5px;">Current image:</div>
                <img src="${tool.image_url}" style="max-width: 200px; max-height: 150px; border-radius: 3px;">
                <div style="color: #999; font-size: 11px; margin-top: 5px;">Upload new image to replace</div>
            </div>
        `;
    } else {
        preview.innerHTML = '';
    }
    
    document.getElementById('toolModal').classList.add('active');
}

// ========== DELETE FUNCTIONS ==========
async function deleteMachine(id) {
    if (!confirm('Delete this machine? This cannot be undone!')) return;
    
    try {
        // 1. Pobierz dane maszyny
        const { data: machine, error: fetchError } = await supabaseClient
            .from('machines')
            .select('image_url')
            .eq('id', id)
            .single();
        
        if (fetchError) throw fetchError;
        
        console.log('Machine data:', machine);
        console.log('Image URL:', machine.image_url);
        
        // 2. Usuń image ze storage jeśli istnieje
        if (machine.image_url) {
            // Wyciągnij ścieżkę po nazwie bucket (equipment-images/)
            const bucketName = 'equipment-images';
            const urlParts = machine.image_url.split(bucketName + '/');
            const imagePath = urlParts.length > 1 ? urlParts[1] : machine.image_url.split('/').pop();
            
            console.log('Attempting to delete image from bucket equipment-images, path:', imagePath);
            
            const { error: imageError } = await supabaseClient.storage
                .from('equipment-images')
                .remove([imagePath]);
            
            if (imageError) {
                console.error('Error deleting image:', imageError);
            } else {
                console.log('Image deleted successfully from storage');
            }
        } else {
            console.log('No image_url found for this machine');
        }
        
        // 3. Usuń dokumenty z machine_documents
        const { data: docs, error: docsError } = await supabaseClient
            .from('machine_documents')
            .select('file_url')
            .eq('machine_id', id);
        
        if (!docsError && docs && docs.length > 0) {
            
            // Usuń fizyczne pliki
            for (const doc of docs) {
                if (doc.file_url) {
                    // Wyciągnij ścieżkę po nazwie bucket (equipment-documents/)
                    const docBucket = 'equipment-documents';
                    const docUrlParts = doc.file_url.split(docBucket + '/');
                    const docPath = docUrlParts.length > 1 ? docUrlParts[1] : doc.file_url.split('/').pop();
                    
                    const { error: docStorageError } = await supabaseClient.storage
                        .from('equipment-documents')
                        .remove([docPath]);
                    
                    if (docStorageError) {
                        console.error('Error deleting document file:', docStorageError);
                    }
                }
            }
            
            // Usuń rekordy z DB
            const { error: deleteDocsError } = await supabaseClient
                .from('machine_documents')
                .delete()
                .eq('machine_id', id);
            
            if (deleteDocsError) {
                console.error('Error deleting document records:', deleteDocsError);
            } else {
            }
        }
        
        // 4. Usuń service history
        const { error: serviceError } = await supabaseClient
            .from('machine_service_history')
            .delete()
            .eq('machine_id', id);
        
        if (serviceError) {
            console.error('Error deleting service history:', serviceError);
        }
        
        // 5. Usuń maszynę
        const { error } = await supabaseClient
            .from('machines')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error deleting machine:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteVan(id) {
    if (!confirm('Delete this van? This cannot be undone!')) return;
    
    try {
        // 1. Pobierz dane vana
        const { data: van, error: fetchError } = await supabaseClient
            .from('vans')
            .select('image_url')
            .eq('id', id)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 2. Usuń image ze storage jeśli istnieje
        if (van.image_url) {
            // Wyciągnij ścieżkę po nazwie bucket (equipment-images/)
            const bucketName = 'equipment-images';
            const urlParts = van.image_url.split(bucketName + '/');
            const imagePath = urlParts.length > 1 ? urlParts[1] : van.image_url.split('/').pop();
            
            console.log('Deleting van image, path:', imagePath);
            const { error: imageError } = await supabaseClient.storage
                .from('equipment-images')
                .remove([imagePath]);
            
            if (imageError) {
                console.error('Error deleting image:', imageError);
            } else {
                console.log('Van image deleted successfully');
            }
        }
        
        // 3. Usuń dokumenty z van_documents
        const { data: docs, error: docsError } = await supabaseClient
            .from('van_documents')
            .select('file_url')
            .eq('van_id', id);
        
        if (!docsError && docs && docs.length > 0) {
            
            // Usuń fizyczne pliki
            for (const doc of docs) {
                if (doc.file_url) {
                    // Wyciągnij ścieżkę po nazwie bucket (equipment-documents/)
                    const docBucket = 'equipment-documents';
                    const docUrlParts = doc.file_url.split(docBucket + '/');
                    const docPath = docUrlParts.length > 1 ? docUrlParts[1] : doc.file_url.split('/').pop();
                    
                    const { error: docStorageError } = await supabaseClient.storage
                        .from('equipment-documents')
                        .remove([docPath]);
                    
                    if (docStorageError) {
                        console.error('Error deleting document file:', docStorageError);
                    }
                }
            }
            
            // Usuń rekordy z DB
            const { error: deleteDocsError } = await supabaseClient
                .from('van_documents')
                .delete()
                .eq('van_id', id);
            
            if (deleteDocsError) {
                console.error('Error deleting document records:', deleteDocsError);
            } else {
            }
        }
        
        // 4. Usuń vana
        const { error } = await supabaseClient
            .from('vans')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error deleting van:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteTool(id) {
    if (!confirm('Delete this tool? This cannot be undone!')) return;
    
    try {
        // 1. Pobierz dane tool
        const { data: tool, error: fetchError } = await supabaseClient
            .from('small_tools')
            .select('image_url')
            .eq('id', id)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 2. Usuń image ze storage jeśli istnieje
        if (tool.image_url) {
            // Wyciągnij ścieżkę po nazwie bucket (equipment-images/)
            const bucketName = 'equipment-images';
            const urlParts = tool.image_url.split(bucketName + '/');
            const imagePath = urlParts.length > 1 ? urlParts[1] : tool.image_url.split('/').pop();
            
            console.log('Deleting tool image, path:', imagePath);
            const { error: imageError } = await supabaseClient.storage
                .from('equipment-images')
                .remove([imagePath]);
            
            if (imageError) {
                console.error('Error deleting image:', imageError);
            } else {
                console.log('Tool image deleted successfully');
            }
        }
        
        // 3. Usuń tool
        const { error } = await supabaseClient
            .from('small_tools')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error deleting tool:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== DETAILS/DOCUMENTS ==========
let currentDetailsItem = null;
let currentDocuments = [];
let currentServiceHistory = [];

async function viewMachineDetails(id) {
    const machine = machines.find(m => m.id === id);
    if (!machine) return;
    
    currentDetailsItem = { type: 'machine', id: id, data: machine };
    
    // Load documents for this machine
    await loadDocuments('machine', id);
    
    // Load service history for this machine
    await loadServiceHistory(id);
    
    // Show modal
    document.getElementById('detailsModalTitle').textContent = machine.name;
    document.getElementById('detailsContent').innerHTML = renderMachineDetailsContent(machine);
    document.getElementById('detailsDocuments').innerHTML = renderDocumentsList();
    
    document.getElementById('detailsModal').classList.add('active');
}

async function viewVanDetails(id) {
    const van = vans.find(v => v.id === id);
    if (!van) return;
    
    currentDetailsItem = { type: 'van', id: id, data: van };
    
    // Load documents for this van
    await loadDocuments('van', id);
    
    // Show modal
    document.getElementById('detailsModalTitle').textContent = van.name;
    document.getElementById('detailsContent').innerHTML = renderVanDetailsContent(van);
    document.getElementById('detailsDocuments').innerHTML = renderDocumentsList();
    
    document.getElementById('detailsModal').classList.add('active');
}

async function loadServiceHistory(machineId) {
    try {
        const { data, error } = await supabaseClient
            .from('machine_service_history')
            .select('*')
            .eq('machine_id', machineId)
            .order('service_date', { ascending: false });
        
        if (error) throw error;
        
        currentServiceHistory = data || [];
        
    } catch (err) {
        console.error('Error loading service history:', err);
        currentServiceHistory = [];
    }
}

async function loadDocuments(type, itemId) {
    try {
        const tableName = type === 'machine' ? 'machine_documents' : 'van_documents';
        const idField = type === 'machine' ? 'machine_id' : 'van_id';
        
        const { data, error } = await supabaseClient
            .from(tableName)
            .select('*')
            .eq(idField, itemId)
            .order('uploaded_at', { ascending: false });
        
        if (error) throw error;
        
        currentDocuments = data || [];
        
    } catch (err) {
        console.error('Error loading documents:', err);
        currentDocuments = [];
    }
}

function renderMachineDetailsContent(machine) {
    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <div class="detail-row">
                    <span class="detail-label">Manufacturer:</span>
                    <span class="detail-value">${machine.manufacturer || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Model:</span>
                    <span class="detail-value">${machine.model || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Serial Number:</span>
                    <span class="detail-value">${machine.serial_number || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Purchase Date:</span>
                    <span class="detail-value">${machine.purchase_date ? new Date(machine.purchase_date).toLocaleDateString('en-GB') : '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Purchase Cost:</span>
                    <span class="detail-value">£${(machine.purchase_cost || 0).toLocaleString()}</span>
                </div>
            </div>
            <div>
                <div class="detail-row">
                    <span class="detail-label">Current Value:</span>
                    <span class="detail-value">£${(machine.current_value || 0).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value" style="text-transform: capitalize;">${machine.status}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Warranty End:</span>
                    <span class="detail-value">${machine.warranty_end_date ? new Date(machine.warranty_end_date).toLocaleDateString('en-GB') : '-'}</span>
                </div>
                ${machine.notes ? `
                <div class="detail-row">
                    <span class="detail-label">Notes:</span>
                    <span class="detail-value">${machine.notes}</span>
                </div>
                ` : ''}
            </div>
        </div>
        ${machine.image_url ? `
        <div style="margin-top: 20px;">
            <img src="${machine.image_url}" style="max-width: 100%; max-height: 300px; border-radius: 5px;">
        </div>
        ` : ''}
    `;
}

function renderVanDetailsContent(van) {
    const motDate = van.mot_due_date ? new Date(van.mot_due_date) : null;
    const insuranceDate = van.insurance_due_date ? new Date(van.insurance_due_date) : null;
    const today = new Date();
    
    const motDaysLeft = motDate ? Math.floor((motDate - today) / (1000 * 60 * 60 * 24)) : null;
    const insuranceDaysLeft = insuranceDate ? Math.floor((insuranceDate - today) / (1000 * 60 * 60 * 24)) : null;
    
    const motColor = motDaysLeft <= 30 ? '#f44336' : (motDaysLeft <= 60 ? '#ff9800' : '#4CAF50');
    const insuranceColor = insuranceDaysLeft <= 30 ? '#f44336' : (insuranceDaysLeft <= 60 ? '#ff9800' : '#4CAF50');
    
    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <div class="detail-row">
                    <span class="detail-label">Registration Plate:</span>
                    <span class="detail-value" style="font-weight: 700; font-family: monospace;">${van.registration_plate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">MOT Due:</span>
                    <span class="detail-value" style="color: ${motColor}; font-weight: 600;">
                        ${motDate ? `${motDate.toLocaleDateString('en-GB')} (${motDaysLeft} days)` : '-'}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Insurance Due:</span>
                    <span class="detail-value" style="color: ${insuranceColor}; font-weight: 600;">
                        ${insuranceDate ? `${insuranceDate.toLocaleDateString('en-GB')} (${insuranceDaysLeft} days)` : '-'}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Mileage:</span>
                    <span class="detail-value">${(van.mileage || 0).toLocaleString()} miles</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Assigned To:</span>
                    <span class="detail-value">${van.team_members ? van.team_members.name : 'Unassigned'}</span>
                </div>
            </div>
            <div>
                <div class="detail-row">
                    <span class="detail-label">Purchase Date:</span>
                    <span class="detail-value">${van.purchase_date ? new Date(van.purchase_date).toLocaleDateString('en-GB') : '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Purchase Cost:</span>
                    <span class="detail-value">£${(van.purchase_cost || 0).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Current Value:</span>
                    <span class="detail-value">£${(van.current_value || 0).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value" style="text-transform: capitalize;">${van.status}</span>
                </div>
                ${van.notes ? `
                <div class="detail-row">
                    <span class="detail-label">Notes:</span>
                    <span class="detail-value">${van.notes}</span>
                </div>
                ` : ''}
            </div>
        </div>
        ${van.image_url ? `
        <div style="margin-top: 20px;">
            <img src="${van.image_url}" style="max-width: 100%; max-height: 300px; border-radius: 5px;">
        </div>
        ` : ''}
    `;
}

function renderDocumentsList() {
    if (currentDocuments.length === 0) {
        return `
            <div style="padding: 40px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
                <div>No documents uploaded</div>
            </div>
        `;
    }
    
    return `
        <div style="display: grid; gap: 10px;">
            ${currentDocuments.map(doc => `
                <div style="background: #2d2d30; padding: 15px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #e8e2d5; margin-bottom: 5px;">${doc.file_name}</div>
                        <div style="font-size: 11px; color: #999;">
                            <span style="text-transform: uppercase; background: #3e3e42; padding: 2px 6px; border-radius: 2px; margin-right: 10px;">${doc.document_type.replace(/_/g, ' ')}</span>
                            Uploaded: ${new Date(doc.uploaded_at).toLocaleDateString('en-GB')}
                            ${doc.expiry_date ? ` • Expires: <span style="color: ${new Date(doc.expiry_date) < new Date() ? '#f44336' : '#4CAF50'}">${new Date(doc.expiry_date).toLocaleDateString('en-GB')}</span>` : ''}
                        </div>
                        ${doc.notes ? `<div style="font-size: 11px; color: #999; margin-top: 5px;">${doc.notes}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <a href="${doc.file_url}" target="_blank" style="background: #1a237e; color: white; padding: 8px 12px; border-radius: 3px; text-decoration: none; font-size: 11px; font-weight: 600;">View</a>
                        <button onclick="deleteDocument('${doc.id}')" style="background: #b71c1c; color: white; padding: 8px 12px; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: 600;">Delete</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ========== UPLOAD DOCUMENT ==========
function openUploadDocumentModal() {
    if (!currentDetailsItem) return;
    
    const docTypeSelect = document.getElementById('docType');
    
    if (currentDetailsItem.type === 'machine') {
        docTypeSelect.innerHTML = `
            <option value="manual">Manual / Instruction</option>
            <option value="certificate">Certificate</option>
            <option value="warranty">Warranty</option>
            <option value="invoice">Purchase Invoice</option>
            <option value="technical_sheet">Technical Sheet</option>
            <option value="service_report">Service Report / Invoice</option>
            <option value="other">Other</option>
        `;
    } else if (currentDetailsItem.type === 'van') {
        docTypeSelect.innerHTML = `
            <option value="v5_certificate">V5 Certificate</option>
            <option value="insurance_policy">Insurance Policy</option>
            <option value="mot_certificate">MOT Certificate</option>
            <option value="service_book">Service Book</option>
            <option value="repair_invoice">Repair Invoice</option>
            <option value="purchase_invoice">Purchase Invoice</option>
            <option value="other">Other</option>
        `;
    }
    
    // Clear form
    document.getElementById('docFile').value = '';
    document.getElementById('docExpiry').value = '';
    document.getElementById('docNotes').value = '';
    document.getElementById('docExpiryGroup').style.display = 'none';
    
    // Show expiry for insurance/MOT
    docTypeSelect.onchange = () => {
        const type = docTypeSelect.value;
        const expiryGroup = document.getElementById('docExpiryGroup');
        if (type === 'insurance_policy' || type === 'mot_certificate') {
            expiryGroup.style.display = 'block';
        } else {
            expiryGroup.style.display = 'none';
        }
    };
    
    document.getElementById('uploadDocModal').classList.add('active');
}

async function saveDocument() {
    const file = document.getElementById('docFile').files[0];
    const docType = document.getElementById('docType').value;
    const expiry = document.getElementById('docExpiry').value;
    const notes = document.getElementById('docNotes').value.trim();
    
    if (!file) {
        showToast('Please select a file', 'warning');
        return;
    }
    
    if (!currentDetailsItem) return;
    
    try {
        // Upload file to storage
        const fileUrl = await uploadDocument(file, currentDetailsItem.type + 's');
        if (!fileUrl) return; // Upload failed
        
        // Save to database
        const tableName = currentDetailsItem.type === 'machine' ? 'machine_documents' : 'van_documents';
        const idField = currentDetailsItem.type === 'machine' ? 'machine_id' : 'van_id';
        
        const docData = {
            [idField]: currentDetailsItem.id,
            document_type: docType,
            file_name: file.name,
            file_url: fileUrl,
            expiry_date: expiry || null,
            notes: notes || null
        };
        
        const { error } = await supabaseClient
            .from(tableName)
            .insert([docData]);
        
        if (error) throw error;
        
        closeModal('uploadDocModal');
        
        // Reload documents
        await loadDocuments(currentDetailsItem.type, currentDetailsItem.id);
        document.getElementById('detailsDocuments').innerHTML = renderDocumentsList();
        
    } catch (err) {
        console.error('Error saving document:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteDocument(docId) {
    if (!confirm('Delete this document? This cannot be undone!')) return;
    
    if (!currentDetailsItem) return;
    
    try {
        const tableName = currentDetailsItem.type === 'machine' ? 'machine_documents' : 'van_documents';
        
        // 1. Pobierz file_url przed usunięciem
        const { data: doc, error: fetchError } = await supabaseClient
            .from(tableName)
            .select('file_url')
            .eq('id', docId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 2. Usuń plik ze storage
        if (doc.file_url) {
            const filePath = doc.file_url.split('/').pop();
            const { error: storageError } = await supabaseClient.storage
                .from('equipment-documents')
                .remove([filePath]);
            
            if (storageError) {
                console.error('Error deleting file from storage:', storageError);
            } else {
            }
        }
        
        // 3. Usuń rekord z DB
        const { error } = await supabaseClient
            .from(tableName)
            .delete()
            .eq('id', docId);
        
        if (error) throw error;
        
        
        // Reload documents
        await loadDocuments(currentDetailsItem.type, currentDetailsItem.id);
        document.getElementById('detailsDocuments').innerHTML = renderDocumentsList();
        
    } catch (err) {
        console.error('Error deleting document:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function generateMachinesReport() {
    // Load ALL service history for all machines
    const { data: allServices, error } = await supabaseClient
        .from('machine_service_history')
        .select('*')
        .order('service_date', { ascending: false });
    
    if (error) {
        console.error('Error loading services:', error);
        showToast('Error loading service data', 'error');
        return;
    }
    
    const today = new Date();
    
    // Calculate service costs per machine
    const serviceCostsByMachine = {};
    const bladeCostsByMachine = {};
    const nextServicesByMachine = {};
    
    (allServices || []).forEach(service => {
        if (!serviceCostsByMachine[service.machine_id]) {
            serviceCostsByMachine[service.machine_id] = 0;
            bladeCostsByMachine[service.machine_id] = 0;
        }
        serviceCostsByMachine[service.machine_id] += service.total_cost || 0;
        if (service.blade_replacement && service.blade_cost) {
            bladeCostsByMachine[service.machine_id] += service.blade_cost;
        }
        
        // Track next service date
        if (service.next_service_date) {
            if (!nextServicesByMachine[service.machine_id] || 
                new Date(service.next_service_date) < new Date(nextServicesByMachine[service.machine_id])) {
                nextServicesByMachine[service.machine_id] = service.next_service_date;
            }
        }
    });
    
    const reportContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Machines Report - ${new Date().toLocaleDateString('en-GB')}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    background: white;
                    color: #000;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #000;
                    padding-bottom: 20px;
                }
                .header h1 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                }
                .summary {
                    background: #f5f5f5;
                    padding: 15px;
                    margin-bottom: 30px;
                    border-left: 4px solid #000;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }
                .summary-box {
                    padding: 10px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                    font-size: 11px;
                }
                thead {
                    background: #333;
                    color: white;
                }
                th, td {
                    padding: 8px;
                    text-align: left;
                    border: 1px solid #ddd;
                }
                .status-working { background: #c8e6c9; }
                .status-repair { background: #fff9c4; }
                .status-retired { background: #ffcdd2; }
                .warranty-expired { color: #f44336; font-weight: bold; }
                .warranty-expiring { color: #ff9800; }
                .service-due { background: #fff9c4; }
                .service-overdue { background: #ffebee; font-weight: bold; }
                @media print {
                    body { padding: 20px; font-size: 10px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔧 MACHINES REPORT</h1>
                <div>Joinery Core - Operational System - ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>

            <div class="summary">
                <div class="summary-box">
                    <h3>📊 Fleet Overview</h3>
                    <p><strong>Total Machines:</strong> ${machines.length}</p>
                    <p><strong>Working:</strong> ${machines.filter(m => m.status === 'working').length}</p>
                    <p><strong>In Repair:</strong> ${machines.filter(m => m.status === 'repair').length}</p>
                    <p><strong>Retired:</strong> ${machines.filter(m => m.status === 'retired').length}</p>
                </div>
                <div class="summary-box">
                    <h3>💰 Financial</h3>
                    <p><strong>Total Value:</strong> £${machines.reduce((sum, m) => sum + (m.current_value || 0), 0).toLocaleString()}</p>
                    <p><strong>Original Cost:</strong> £${machines.reduce((sum, m) => sum + (m.purchase_cost || 0), 0).toLocaleString()}</p>
                    <p><strong>Total Service Costs:</strong> £${Object.values(serviceCostsByMachine).reduce((sum, cost) => sum + cost, 0).toLocaleString()}</p>
                    <p><strong>Blade Replacement Costs:</strong> £${Object.values(bladeCostsByMachine).reduce((sum, cost) => sum + cost, 0).toLocaleString()}</p>
                </div>
            </div>

            <h2>Machine Details</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 60px;">Image</th>
                        <th>Name</th>
                        <th>Manufacturer</th>
                        <th>Status</th>
                        <th>Purchase Date</th>
                        <th>Value (£)</th>
                        <th>Warranty</th>
                        <th>Service Costs</th>
                        <th>Blades</th>
                        <th>Next Service</th>
                    </tr>
                </thead>
                <tbody>
                    ${machines.map(machine => {
                        const warrantyDate = machine.warranty_end_date ? new Date(machine.warranty_end_date) : null;
                        const warrantyExpired = warrantyDate && warrantyDate < today;
                        const warrantyExpiring = warrantyDate && !warrantyExpired && Math.floor((warrantyDate - today) / (1000 * 60 * 60 * 24)) <= 90;
                        
                        const nextServiceDate = nextServicesByMachine[machine.id] ? new Date(nextServicesByMachine[machine.id]) : null;
                        const serviceDaysLeft = nextServiceDate ? Math.floor((nextServiceDate - today) / (1000 * 60 * 60 * 24)) : null;
                        const serviceClass = serviceDaysLeft !== null ? (serviceDaysLeft < 0 ? 'service-overdue' : (serviceDaysLeft <= 30 ? 'service-due' : '')) : '';
                        
                        return `
                            <tr>
                                <td style="text-align: center;">
                                    ${machine.image_url ? 
                                        `<img src="${machine.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 3px;">` 
                                        : '<span style="color: #999;">-</span>'}
                                </td>
                                <td><strong>${machine.name}</strong></td>
                                <td>${machine.manufacturer || '-'}</td>
                                <td class="status-${machine.status}">${machine.status.toUpperCase()}</td>
                                <td>${machine.purchase_date ? new Date(machine.purchase_date).toLocaleDateString('en-GB') : '-'}</td>
                                <td style="text-align: right;">£${(machine.current_value || 0).toLocaleString()}</td>
                                <td class="${warrantyExpired ? 'warranty-expired' : (warrantyExpiring ? 'warranty-expiring' : '')}">
                                    ${warrantyDate ? warrantyDate.toLocaleDateString('en-GB') : '-'}
                                    ${warrantyExpired ? '<br><small>(EXPIRED)</small>' : ''}
                                </td>
                                <td style="text-align: right;">£${(serviceCostsByMachine[machine.id] || 0).toFixed(2)}</td>
                                <td style="text-align: right;">£${(bladeCostsByMachine[machine.id] || 0).toFixed(2)}</td>
                                <td class="${serviceClass}">
                                    ${nextServiceDate ? 
                                        `${nextServiceDate.toLocaleDateString('en-GB')}<br><small>(${serviceDaysLeft < 0 ? 'OVERDUE' : serviceDaysLeft + ' days'})</small>` 
                                        : '-'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <h2>Service Summary by Machine</h2>
            <table>
                <thead>
                    <tr>
                        <th>Machine</th>
                        <th>Total Services</th>
                        <th>Major Services</th>
                        <th>Minor Services</th>
                        <th>Blade Replacements</th>
                        <th>Blades Changed</th>
                        <th>Last Service Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${machines.map(machine => {
                        const machineServices = (allServices || []).filter(s => s.machine_id === machine.id);
                        const majorServices = machineServices.filter(s => s.service_type === 'major_service').length;
                        const minorServices = machineServices.filter(s => s.service_type === 'minor_service').length;
                        const bladeReplacementServices = machineServices.filter(s => s.service_type === 'blade_replacement').length;
                        const bladesChanged = machineServices.filter(s => s.blade_replacement).length;
                        const lastService = machineServices.length > 0 ? new Date(machineServices[0].service_date) : null;
                        
                        return `
                            <tr>
                                <td><strong>${machine.name}</strong></td>
                                <td style="text-align: center;">${machineServices.length}</td>
                                <td style="text-align: center;">${majorServices}</td>
                                <td style="text-align: center;">${minorServices}</td>
                                <td style="text-align: center;">${bladeReplacementServices}</td>
                                <td style="text-align: center;">${bladesChanged}</td>
                                <td>${lastService ? lastService.toLocaleDateString('en-GB') : 'Never'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div style="margin-top: 30px; padding: 15px; background: #f5f5f5;">
                <h3>Legend:</h3>
                <p><span style="background: #ffebee; padding: 3px 8px;">Red highlight</span> = Service overdue or warranty expired</p>
                <p><span style="background: #fff9c4; padding: 3px 8px;">Yellow highlight</span> = Service due within 30 days</p>
            </div>

            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="background: #1b5e20; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">Print Report</button>
                <button onclick="window.close()" style="background: #666; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </body>
        </html>
    `;
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(reportContent);
    reportWindow.document.close();
}

function generateVansReport() {
    const today = new Date();
    
    // Calculate alerts
    const motExpiring = vans.filter(v => {
        if (!v.mot_due_date) return false;
        const daysLeft = Math.floor((new Date(v.mot_due_date) - today) / (1000 * 60 * 60 * 24));
        return daysLeft > 0 && daysLeft <= 60;
    });
    
    const insuranceExpiring = vans.filter(v => {
        if (!v.insurance_due_date) return false;
        const daysLeft = Math.floor((new Date(v.insurance_due_date) - today) / (1000 * 60 * 60 * 24));
        return daysLeft > 0 && daysLeft <= 60;
    });
    
    const reportContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Vans Report - ${new Date().toLocaleDateString('en-GB')}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    background: white;
                    color: #000;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #000;
                    padding-bottom: 20px;
                }
                .header h1 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                }
                .summary {
                    background: #f5f5f5;
                    padding: 15px;
                    margin-bottom: 30px;
                    border-left: 4px solid #000;
                }
                .alerts {
                    background: #ffebee;
                    border-left: 4px solid #f44336;
                    padding: 15px;
                    margin-bottom: 30px;
                }
                .alerts h3 {
                    margin: 0 0 10px 0;
                    color: #c62828;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                thead {
                    background: #333;
                    color: white;
                }
                th, td {
                    padding: 10px;
                    text-align: left;
                    border: 1px solid #ddd;
                    font-size: 12px;
                }
                .status-active { background: #c8e6c9; }
                .status-repair { background: #fff9c4; }
                .status-retired { background: #ffcdd2; }
                .alert-critical { background: #ffebee; font-weight: bold; }
                .alert-warning { background: #fff9c4; }
                @media print {
                    body { padding: 20px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚐 VANS FLEET REPORT</h1>
                <div class="date">Joinery Core - Operational System - ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>

            <div class="summary">
                <h3>📊 Fleet Summary</h3>
                <p><strong>Total Vans:</strong> ${vans.length}</p>
                <p><strong>Active:</strong> ${vans.filter(v => v.status === 'active').length}</p>
                <p><strong>In Repair:</strong> ${vans.filter(v => v.status === 'repair').length}</p>
                <p><strong>Retired:</strong> ${vans.filter(v => v.status === 'retired').length}</p>
                <p><strong>Total Fleet Value:</strong> £${vans.reduce((sum, v) => sum + (v.current_value || 0), 0).toLocaleString()}</p>
                <p><strong>Total Mileage:</strong> ${vans.reduce((sum, v) => sum + (v.mileage || 0), 0).toLocaleString()} miles</p>
            </div>

            ${(motExpiring.length > 0 || insuranceExpiring.length > 0) ? `
            <div class="alerts">
                <h3>⚠️ URGENT ALERTS - Action Required</h3>
                ${motExpiring.length > 0 ? `
                <p><strong>MOT Expiring Soon (next 60 days):</strong></p>
                <ul>
                    ${motExpiring.map(v => {
                        const daysLeft = Math.floor((new Date(v.mot_due_date) - today) / (1000 * 60 * 60 * 24));
                        return `<li><strong>${v.name} (${v.registration_plate})</strong> - ${daysLeft} days left (${new Date(v.mot_due_date).toLocaleDateString('en-GB')})</li>`;
                    }).join('')}
                </ul>
                ` : ''}
                ${insuranceExpiring.length > 0 ? `
                <p><strong>Insurance Expiring Soon (next 60 days):</strong></p>
                <ul>
                    ${insuranceExpiring.map(v => {
                        const daysLeft = Math.floor((new Date(v.insurance_due_date) - today) / (1000 * 60 * 60 * 24));
                        return `<li><strong>${v.name} (${v.registration_plate})</strong> - ${daysLeft} days left (${new Date(v.insurance_due_date).toLocaleDateString('en-GB')})</li>`;
                    }).join('')}
                </ul>
                ` : ''}
            </div>
            ` : ''}

            <h2>Fleet Details</h2>
            <table>
                <thead>
                    <tr>
                        <th>Van Name</th>
                        <th>Reg Plate</th>
                        <th>Status</th>
                        <th>MOT Due</th>
                        <th>Insurance Due</th>
                        <th>Mileage</th>
                        <th>Assigned To</th>
                        <th>Value (£)</th>
                    </tr>
                </thead>
                <tbody>
                    ${vans.map(van => {
                        const motDate = van.mot_due_date ? new Date(van.mot_due_date) : null;
                        const insuranceDate = van.insurance_due_date ? new Date(van.insurance_due_date) : null;
                        const motDaysLeft = motDate ? Math.floor((motDate - today) / (1000 * 60 * 60 * 24)) : null;
                        const insuranceDaysLeft = insuranceDate ? Math.floor((insuranceDate - today) / (1000 * 60 * 60 * 24)) : null;
                        
                        const motClass = motDaysLeft !== null ? (motDaysLeft <= 30 ? 'alert-critical' : (motDaysLeft <= 60 ? 'alert-warning' : '')) : '';
                        const insuranceClass = insuranceDaysLeft !== null ? (insuranceDaysLeft <= 30 ? 'alert-critical' : (insuranceDaysLeft <= 60 ? 'alert-warning' : '')) : '';
                        
                        return `
                            <tr>
                                <td><strong>${van.name}</strong></td>
                                <td style="font-family: monospace; font-weight: bold;">${van.registration_plate}</td>
                                <td class="status-${van.status}">${van.status.toUpperCase()}</td>
                                <td class="${motClass}">
                                    ${motDate ? `${motDate.toLocaleDateString('en-GB')}<br><small>(${motDaysLeft} days)</small>` : '-'}
                                </td>
                                <td class="${insuranceClass}">
                                    ${insuranceDate ? `${insuranceDate.toLocaleDateString('en-GB')}<br><small>(${insuranceDaysLeft} days)</small>` : '-'}
                                </td>
                                <td>${(van.mileage || 0).toLocaleString()}</td>
                                <td>${van.team_members ? van.team_members.name : 'Unassigned'}</td>
                                <td style="text-align: right;">£${(van.current_value || 0).toLocaleString()}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div style="margin-top: 30px; padding: 15px; background: #f5f5f5;">
                <h3>Legend:</h3>
                <p><span style="background: #ffebee; padding: 3px 8px;">Red highlight</span> = Expires within 30 days (CRITICAL)</p>
                <p><span style="background: #fff9c4; padding: 3px 8px;">Yellow highlight</span> = Expires within 60 days (WARNING)</p>
            </div>

            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="background: #1b5e20; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">Print Report</button>
                <button onclick="window.close()" style="background: #666; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </body>
        </html>
    `;
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(reportContent);
    reportWindow.document.close();
}

function generateToolsReport() {
    // Generate tools remanent report (inventory checklist)
    const reportContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Tools Remanent Checklist - ${new Date().toLocaleDateString('en-GB')}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    background: white;
                    color: #000;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #000;
                    padding-bottom: 20px;
                }
                .header h1 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                }
                .header .date {
                    font-size: 14px;
                    color: #666;
                }
                .summary {
                    background: #f5f5f5;
                    padding: 15px;
                    margin-bottom: 30px;
                    border-left: 4px solid #000;
                }
                .summary h3 {
                    margin: 0 0 10px 0;
                }
                .alerts {
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin-bottom: 30px;
                }
                .alerts h3 {
                    margin: 0 0 10px 0;
                    color: #856404;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                thead {
                    background: #333;
                    color: white;
                }
                th, td {
                    padding: 12px;
                    text-align: left;
                    border: 1px solid #ddd;
                }
                th {
                    font-size: 12px;
                    text-transform: uppercase;
                }
                .checkbox {
                    width: 30px;
                    height: 30px;
                    border: 2px solid #333;
                    display: inline-block;
                    margin-right: 10px;
                }
                .low-stock {
                    background: #ffebee;
                }
                .category-header {
                    background: #e0e0e0;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .footer {
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 2px solid #ddd;
                }
                .signature-line {
                    margin-top: 40px;
                    border-top: 1px solid #000;
                    width: 300px;
                    padding-top: 5px;
                    font-size: 12px;
                }
                @media print {
                    body { padding: 20px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔩 TOOLS INVENTORY REMANENT</h1>
                <div class="date">Joinery Core - Operational System - ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>

            <div class="summary">
                <h3>📊 Summary</h3>
                <p><strong>Total Items:</strong> ${smallTools.length}</p>
                <p><strong>Total Quantity:</strong> ${smallTools.reduce((sum, t) => sum + (t.quantity || 0), 0)} units</p>
                <p><strong>Total Value:</strong> £${smallTools.reduce((sum, t) => sum + ((t.quantity || 0) * (t.cost_per_unit || 0)), 0).toFixed(2)}</p>
                <p><strong>Low Stock Alerts:</strong> ${smallTools.filter(t => t.quantity <= t.min_quantity).length} items</p>
            </div>

            ${smallTools.filter(t => t.quantity <= t.min_quantity).length > 0 ? `
            <div class="alerts">
                <h3>⚠️ Low Stock Alerts - Action Required</h3>
                <ul>
                    ${smallTools.filter(t => t.quantity <= t.min_quantity).map(tool => 
                        `<li><strong>${tool.name}</strong> - Current: ${tool.quantity}, Min: ${tool.min_quantity} (Need: ${Math.max(0, tool.min_quantity - tool.quantity + 2)})</li>`
                    ).join('')}
                </ul>
            </div>
            ` : ''}

            <h2 style="margin-bottom: 20px;">Inventory Checklist</h2>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">✓</th>
                        <th style="width: 60px;">Image</th>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Location</th>
                        <th style="text-align: center;">Expected Qty</th>
                        <th style="text-align: center;">Counted Qty</th>
                        <th style="text-align: right;">Value (£)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(
                        smallTools.reduce((acc, tool) => {
                            if (!acc[tool.category]) acc[tool.category] = [];
                            acc[tool.category].push(tool);
                            return acc;
                        }, {})
                    ).map(([category, tools]) => `
                        <tr class="category-header">
                            <td colspan="8">${category.toUpperCase()}</td>
                        </tr>
                        ${tools.map(tool => `
                            <tr ${tool.quantity <= tool.min_quantity ? 'class="low-stock"' : ''}>
                                <td><span class="checkbox"></span></td>
                                <td style="text-align: center;">
                                    ${tool.image_url ? 
                                        `<img src="${tool.image_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 3px;">` 
                                        : '<span style="color: #999;">-</span>'}
                                </td>
                                <td><strong>${tool.name}</strong></td>
                                <td>${category}</td>
                                <td>${tool.location || '-'}</td>
                                <td style="text-align: center; font-weight: bold;">${tool.quantity}</td>
                                <td style="text-align: center; border-left: 2px solid #333;">_______</td>
                                <td style="text-align: right;">£${((tool.quantity || 0) * (tool.cost_per_unit || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    `).join('')}
                </tbody>
            </table>

            <div class="footer">
                <p><strong>Instructions:</strong></p>
                <ol>
                    <li>Check each item in its designated location</li>
                    <li>Count actual quantity and write in "Counted Qty" column</li>
                    <li>Mark checkbox (✓) when verified</li>
                    <li>Items highlighted in <span style="background: #ffebee; padding: 2px 5px;">pink</span> are below minimum stock</li>
                    <li>Report any discrepancies to management</li>
                </ol>

                <div style="display: flex; justify-content: space-between; margin-top: 40px;">
                    <div>
                        <div class="signature-line">Checked by (Name & Signature)</div>
                    </div>
                    <div>
                        <div class="signature-line">Date & Time</div>
                    </div>
                </div>
            </div>

            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="background: #1b5e20; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">Print Report</button>
                <button onclick="window.close()" style="background: #666; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </body>
        </html>
    `;
    
    // Open in new window
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(reportContent);
    reportWindow.document.close();
}

function viewImage(url) {
    window.open(url, '_blank');
}


// ========== SERVICE HISTORY ==========
function renderServiceHistoryList() {
    if (currentServiceHistory.length === 0) {
        return `
            <div style="padding: 40px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 10px;">🔧</div>
                <div>No service history recorded</div>
            </div>
        `;
    }
    
    return `
        <div style="display: grid; gap: 10px;">
            ${currentServiceHistory.map(service => {
                const serviceDate = new Date(service.service_date);
                const nextDate = service.next_service_date ? new Date(service.next_service_date) : null;
                const today = new Date();
                const daysUntilNext = nextDate ? Math.floor((nextDate - today) / (1000 * 60 * 60 * 24)) : null;
                
                const nextColor = daysUntilNext !== null ? (daysUntilNext <= 7 ? '#f44336' : (daysUntilNext <= 30 ? '#ff9800' : '#4CAF50')) : '#999';
                
                const serviceTypeNames = {
                    'major_service': 'Major Service',
                    'minor_service': 'Minor Service',
                    'blade_replacement': 'Blade Replacement'
                };
                
                return `
                    <div style="background: #2d2d30; padding: 15px; border-radius: 5px;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #e8e2d5; margin-bottom: 5px;">
                                    ${serviceDate.toLocaleDateString('en-GB')} - ${serviceTypeNames[service.service_type]}
                                    ${service.blade_replacement ? '<span style="background: #ff9800; color: #000; padding: 2px 6px; border-radius: 2px; font-size: 10px; margin-left: 8px;">🔪 BLADE REPLACED</span>' : ''}
                                </div>
                                <div style="font-size: 12px; color: #999;">
                                    <strong>Cost:</strong> £${(service.total_cost || 0).toFixed(2)}
                                    ${service.blade_replacement && service.blade_cost ? ` (incl. £${service.blade_cost.toFixed(2)} blades)` : ''}
                                    ${service.performed_by ? ` • <strong>By:</strong> ${service.performed_by}` : ''}
                                </div>
                                ${nextDate ? `
                                <div style="font-size: 12px; color: ${nextColor}; margin-top: 5px;">
                                    <strong>Next Service:</strong> ${nextDate.toLocaleDateString('en-GB')} 
                                    ${daysUntilNext !== null ? `(${daysUntilNext > 0 ? daysUntilNext + ' days' : 'OVERDUE'})` : ''}
                                </div>
                                ` : ''}
                                ${service.notes ? `
                                <div style="font-size: 12px; color: #b5cea8; margin-top: 8px; padding: 8px; background: #1e1e1e; border-radius: 3px;">
                                    ${service.notes}
                                </div>
                                ` : ''}
                            </div>
                            <button onclick="deleteServiceRecord('${service.id}')" style="background: #b71c1c; color: white; padding: 6px 10px; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: 600;">Delete</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Open service modal directly from machine list
let serviceMachineId = null;

function openServiceModalForMachine(machineId) {
    serviceMachineId = machineId;
    
    // Set today's date as default
    document.getElementById('serviceDate').value = new Date().toISOString().split('T')[0];
    
    // Set next service date = +1 year by default
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    document.getElementById('serviceNextDate').value = nextYear.toISOString().split('T')[0];
    
    // Clear form
    document.getElementById('serviceType').value = 'minor_service';
    document.getElementById('bladeReplacement').checked = false;
    document.getElementById('bladeCost').value = '';
    document.getElementById('bladeCostGroup').style.display = 'none';
    document.getElementById('serviceCost').value = '';
    document.getElementById('servicePerformedBy').value = '';
    document.getElementById('serviceNotes').value = '';
    
    document.getElementById('addServiceModal').classList.add('active');
}

function openAddServiceModal() {
    if (!currentDetailsItem || currentDetailsItem.type !== 'machine') return;
    
    serviceMachineId = currentDetailsItem.item.id;
    
    // Set today's date as default
    document.getElementById('serviceDate').value = new Date().toISOString().split('T')[0];
    
    // Set next service date = +1 year by default
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    document.getElementById('serviceNextDate').value = nextYear.toISOString().split('T')[0];
    
    // Clear form
    document.getElementById('serviceType').value = 'minor_service';
    document.getElementById('bladeReplacement').checked = false;
    document.getElementById('bladeCost').value = '';
    document.getElementById('bladeCostGroup').style.display = 'none';
    document.getElementById('serviceCost').value = '';
    document.getElementById('servicePerformedBy').value = '';
    document.getElementById('serviceNotes').value = '';
    
    document.getElementById('addServiceModal').classList.add('active');
}

function toggleBladeCost() {
    const checked = document.getElementById('bladeReplacement').checked;
    const costGroup = document.getElementById('bladeCostGroup');
    costGroup.style.display = checked ? 'block' : 'none';
    
    if (!checked) {
        document.getElementById('bladeCost').value = '';
    }
}

async function saveServiceRecord() {
    const serviceDate = document.getElementById('serviceDate').value;
    const serviceType = document.getElementById('serviceType').value;
    const bladeReplacement = document.getElementById('bladeReplacement').checked;
    const bladeCost = parseFloat(document.getElementById('bladeCost').value) || null;
    const totalCost = parseFloat(document.getElementById('serviceCost').value);
    const performedBy = document.getElementById('servicePerformedBy').value.trim();
    const nextDate = document.getElementById('serviceNextDate').value;
    const notes = document.getElementById('serviceNotes').value.trim();
    
    if (!serviceDate) {
        showToast('Please enter service date', 'warning');
        return;
    }
    
    if (!totalCost || totalCost <= 0) {
        showToast('Please enter total service cost', 'warning');
        return;
    }
    
    // Get machine ID from either source
    const machineId = serviceMachineId || (currentDetailsItem?.type === 'machine' ? currentDetailsItem.id : null);
    
    if (!machineId) {
        showToast('No machine selected', 'error');
        return;
    }
    
    try {
        const serviceData = {
            machine_id: machineId,
            service_date: serviceDate,
            service_type: serviceType,
            blade_replacement: bladeReplacement, // używamy starej kolumny w DB
            blade_cost: bladeReplacement ? bladeCost : null, // używamy starej kolumny w DB
            total_cost: totalCost,
            performed_by: performedBy || null,
            next_service_date: nextDate || null,
            notes: notes || null
        };
        
        const { error } = await supabaseClient
            .from('machine_service_history')
            .insert([serviceData]);
        
        if (error) throw error;
        
        showToast('Service record saved!', 'success');
        closeModal('addServiceModal');
        serviceMachineId = null;
        
        // Refresh main list to update next service date display
        await loadAllEquipment();
        renderView();
        
    } catch (err) {
        console.error('Error saving service record:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteServiceRecord(serviceId) {
    if (!confirm('Delete this service record? This cannot be undone!')) return;
    
    try {
        const { error } = await supabaseClient
            .from('machine_service_history')
            .delete()
            .eq('id', serviceId);
        
        if (error) throw error;
        
        showToast('Service record deleted', 'success');
        
        // Refresh main list
        await loadAllEquipment();
        renderView();
        
    } catch (err) {
        console.error('Error deleting service record:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Open image modal for enlarged view
function openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.display = 'flex';
    modal.style.cursor = 'pointer';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-height: 90%; padding: 0; background: transparent; box-shadow: none;">
            <img src="${imageUrl}" style="max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 5px;">
        </div>
    `;
    
    // Zamknij przy kliknięciu
    modal.addEventListener('click', function() {
        modal.remove();
    });
    
    // Zamknij przy ESC
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    document.body.appendChild(modal);
}

// Backward compatibility
function viewImage(url) {
    openImageModal(url);
}