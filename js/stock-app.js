// ========== STOCK MANAGEMENT APP ==========

let stockItems = [];
let filteredItems = [];
let suppliers = [];
// projects i teamMembers są w data.js

// Sortowanie
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' lub 'desc'

// Subcategory mapping
const subcategories = {
    doors: ['Hinges', 'Locks', 'Handles', 'Seals', 'Other'],
    windows: ['Lead', 'Rope', 'Seals', 'Beads', 'Other'],
    consumables: ['Glue', 'Screws', 'Dowels', 'Biscuits', 'Tape', 'Other'],
    timber: [],
    hardware: [],
    sheet: [],
    glass: [],
    paint: [],
    other: []
};

// Helper function to get company logo HTML for reports
async function getCompanyLogoHtml() {
    try {
        const { data: settings } = await supabaseClient
            .from('company_settings')
            .select('logo_url')
            .single();
        
        if (settings?.logo_url) {
            return `<img src="${settings.logo_url}" alt="Company Logo" style="max-height: 80px; max-width: 200px;" crossorigin="anonymous" />`;
        }
    } catch (e) {
        console.log('Could not load company logo:', e);
    }
    return '<div style="width:150px;height:80px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#999;font-size:11px;border:2px dashed #ddd;border-radius:4px;">No Logo</div>';
}

// Sortowanie stock items
function sortStockItems(column) {
    // Jeśli kliknięto tę samą kolumnę - zmień kierunek
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    filteredItems.sort((a, b) => {
        let valA, valB;
        
        switch(column) {
            case 'item_number':
                valA = a.item_number || '';
                valB = b.item_number || '';
                break;
            case 'qty':
                valA = parseFloat(a.current_quantity) || 0;
                valB = parseFloat(b.current_quantity) || 0;
                break;
            case 'available':
                valA = (parseFloat(a.current_quantity) || 0) - (parseFloat(a.reserved_quantity) || 0);
                valB = (parseFloat(b.current_quantity) || 0) - (parseFloat(b.reserved_quantity) || 0);
                break;
            case 'ordered':
                valA = parseFloat(a.ordered_quantity) || 0;
                valB = parseFloat(b.ordered_quantity) || 0;
                break;
            case 'cost':
                valA = parseFloat(a.cost_per_unit) || 0;
                valB = parseFloat(b.cost_per_unit) || 0;
                break;
            case 'value':
                valA = (parseFloat(a.current_quantity) || 0) * (parseFloat(a.cost_per_unit) || 0);
                valB = (parseFloat(b.current_quantity) || 0) * (parseFloat(b.cost_per_unit) || 0);
                break;
            default:
                return 0;
        }
        
        // Sortowanie numeryczne lub alfabetyczne
        if (typeof valA === 'number' && typeof valB === 'number') {
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        } else {
            const comparison = String(valA).localeCompare(String(valB));
            return currentSortDirection === 'asc' ? comparison : -comparison;
        }
    });
    
    renderStockTable();
}


// Update subcategory dropdown based on category
async function updateSubcategoryOptions() {
    const category = document.getElementById('stockCategory').value;
    const subcategorySelect = document.getElementById('stockSubcategory');
    
    subcategorySelect.innerHTML = '<option value="">-- Select subcategory --</option>';
    
    // Load subcategories from database
    const categoryObj = stockCategories.find(c => c.name.toLowerCase() === category && c.type === 'category');
    
    if (categoryObj) {
        const subcats = stockCategories.filter(s => s.type === 'subcategory' && s.parent_category_id === categoryObj.id);
        
        if (subcats.length > 0) {
            subcats.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.name.toLowerCase();
                option.textContent = sub.name;
                subcategorySelect.appendChild(option);
            });
            subcategorySelect.disabled = false;
        } else {
            subcategorySelect.disabled = true;
        }
    } else {
        subcategorySelect.disabled = true;
    }
}

// Update subcategory dropdown for edit modal
async function updateEditSubcategoryOptions() {
    const category = document.getElementById('editStockCategory').value;
    const subcategorySelect = document.getElementById('editStockSubcategory');
    
    subcategorySelect.innerHTML = '<option value="">-- Select subcategory --</option>';
    
    // Find category in stockCategories - FIX: porównanie z toLowerCase()
    const categoryObj = stockCategories.find(c => c.type === 'category' && c.name.toLowerCase() === category);
    
    if (categoryObj) {
        // Load subcategories from database
        const subcats = stockCategories.filter(s => s.type === 'subcategory' && s.parent_category_id === categoryObj.id);
        
        if (subcats.length > 0) {
            subcats.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.name.toLowerCase();
                option.textContent = sub.name;
                subcategorySelect.appendChild(option);
            });
            subcategorySelect.disabled = false;
        } else {
            subcategorySelect.disabled = true;
        }
    } else {
        subcategorySelect.disabled = true;
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    await loadTeamMembers();
    await loadSuppliers();
    await loadProjects();
    await loadStockCategories();
    await populateCategoryDropdowns();
    await loadStockItems();
    updateStats();
});

// Load team members
async function loadTeamMembers() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('*')
            .eq('active', true)
            .order('name');
        
        if (error) throw error;
        
        teamMembers = data || [];
        
    } catch (err) {
        console.error('Error loading team members:', err);
    }
}

// Load suppliers
async function loadSuppliers() {
    try {
        const { data, error } = await supabaseClient
            .from('suppliers')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        suppliers = data || [];
        
    } catch (err) {
        console.error('Error loading suppliers:', err);
    }
}

// Load projects from production and pipeline
async function loadProjects() {
    try {
        const { data: prodProjects, error: prodError } = await supabaseClient
            .from('projects')
            .select('id, project_number, name')
            .order('project_number', { ascending: false });
        
        const { data: pipeProjects, error: pipeError } = await supabaseClient
            .from('pipeline_projects')
            .select('id, project_number, name')
            .order('project_number', { ascending: false});
        
        if (prodError) console.error('Error loading production projects:', prodError);
        if (pipeError) console.error('Error loading pipeline projects:', pipeError);
        
        projects = [
            ...(prodProjects || []).map(p => ({ ...p, source: 'production' })),
            ...(pipeProjects || []).map(p => ({ ...p, source: 'pipeline' }))
        ];
        
        
    } catch (err) {
        console.error('Error loading projects:', err);
    }
}

// Load stock items
async function loadStockItems() {
    try {
        const { data, error } = await supabaseClient
            .from('stock_items')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        stockItems = data || [];
        filteredItems = [...stockItems];
        
        // Load stock orders to calculate ordered quantities
        await loadStockOrders();
        
        
        renderStockTable();
        updateStats();
        
    } catch (err) {
        console.error('Error loading stock:', err);
        showToast('Error loading stock items', 'error');
    }
}

// Render stock table
function renderStockTable() {
    const container = document.getElementById('stockContainer');
    
    if (filteredItems.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">📦</div>
                <div style="font-size: 18px;">No stock items found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Stock Item" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div style="overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 250px);">
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #252526; position: sticky; top: 0; z-index: 10;">
                    <tr>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 70px;">IMAGE</th>
                        <th onclick="sortStockItems('item_number')" style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none; width: 100px;">
                            ITEM # ${currentSortColumn === 'item_number' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 250px; max-width: 250px;">NAME</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 120px;">SIZE</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 100px;">THICKNESS</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 100px;">COLOR</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 120px;">CATEGORY</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 100px;">SUBCATEGORY</th>
                        <th onclick="sortStockItems('qty')" style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none; width: 80px;">
                            QTY ${currentSortColumn === 'qty' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 80px;">
                            RESERVED
                        </th>
                        <th onclick="sortStockItems('available')" style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none; width: 80px;">
                            AVAILABLE ${currentSortColumn === 'available' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #2e7d32; width: 80px; cursor: pointer;" onclick="sortStockItems('ordered')">
                            ORDERED ${currentSortColumn === 'ordered' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 60px;">MIN</th>
                        <th onclick="sortStockItems('cost')" style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none; width: 100px;">
                            COST/UNIT ${currentSortColumn === 'cost' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </th>
                        <th onclick="sortStockItems('value')" style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none; width: 100px;">
                            VALUE ${currentSortColumn === 'value' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 220px;">ACTIONS</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999; width: 120px;">DS & CERT</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredItems.map(item => createStockRow(item)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Create stock row
function createStockRow(item) {
    // AVAILABLE = current_quantity - reserved_quantity
    const available = (item.current_quantity || 0) - (item.reserved_quantity || 0);
    const isLowStock = available <= (item.min_quantity || 0);
    const isNegative = available < 0;
    const value = (item.current_quantity || 0) * (item.cost_per_unit || 0);
    
    // Format date
    const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : 'N/A';
    
    // Cache buster for images
    const imageUrl = item.image_url ? `${item.image_url}?v=${Date.now()}` : null;
    
    return `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                ${imageUrl ? 
                    `<img src="${imageUrl}" onclick="openImageModal('${item.image_url}')" style="width: 50px; height: 50px; object-fit: cover; border-radius: 3px; cursor: pointer;" title="Click to enlarge">` 
                    : '<div style="width: 50px; height: 50px; background: #3e3e42; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666;">📦</div>'}
            </td>
            <td style="padding: 12px;">
                <span style="font-family: monospace; color: #e8e2d5; font-weight: 600;" title="Added: ${createdDate}">${item.item_number || '-'}</span>
            </td>
            <td style="padding: 12px; max-width: 250px;">
                <div style="font-weight: 600; color: #e8e2d5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.name}">${item.name}</div>
                ${getSuppliersWithLinksDisplay(item)}
            </td>
            <td style="padding: 12px;">
                <span style="color: #4a9eff; font-size: 13px;">${item.size || '-'}</span>
            </td>
            <td style="padding: 12px;">
                <span style="color: #4a9eff; font-size: 13px;">${item.thickness || '-'}</span>
            </td>
            <td style="padding: 12px;">
                ${item.color ? `<span style="padding: 3px 8px; background: #3e3e42; border-radius: 3px; font-size: 11px; color: #e8e2d5;">${item.color}</span>` : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px;">
                <span style="padding: 4px 8px; background: #3e3e42; border-radius: 3px; font-size: 11px; text-transform: uppercase;">
                    ${item.category}
                </span>
            </td>
            <td style="padding: 12px;">
                ${item.subcategory ? `<span style="padding: 3px 8px; background: #3e3e42; border-radius: 3px; font-size: 11px; text-transform: capitalize;">${item.subcategory}</span>` : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px; text-align: right;">
                <span style="font-weight: 600; color: #e8e2d5;">
                    ${parseFloat(item.current_quantity || 0).toFixed(2)}
                </span>
            </td>
            <td style="padding: 12px; text-align: right;">
                <span style="font-weight: 600; color: ${(item.reserved_quantity > 0) ? '#fbbf24' : '#666'};">
                    ${parseFloat(item.reserved_quantity || 0).toFixed(2)}
                </span>
            </td>
            <td style="padding: 12px; text-align: right;">
                <span style="font-weight: 600; color: ${isNegative ? '#ef4444' : (isLowStock ? '#fbbf24' : '#4CAF50')};">
                    ${available.toFixed(2)}
                </span>
                ${isNegative ? '<div style="font-size: 10px; color: #ef4444;">❌ NEGATIVE</div>' : 
                  (isLowStock ? '<div style="font-size: 10px; color: #fbbf24;">⚠️ LOW</div>' : '')}
            </td>
            <td style="padding: 12px; text-align: right; cursor: pointer;" onclick="openPendingOrdersModal('${item.id}')">
                <span style="font-weight: 600; color: ${(item.ordered_quantity > 0) ? '#2e7d32' : '#666'};">
                    ${item.ordered_quantity || 0}
                </span>
            </td>
            <td style="padding: 12px; text-align: right; color: #999; font-size: 11px;">
                ${item.min_quantity || 0}
            </td>
            <td style="padding: 12px; text-align: right; color: #e8e2d5;">
                £${(item.cost_per_unit || 0).toFixed(2)}
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: #e8e2d5;">
                £${value.toFixed(2)}
            </td>
            <td style="padding: 8px; text-align: center;">
                <button onclick="openStockInModal('${item.id}')" class="toolbar-btn success" style="padding: 4px 6px; font-size: 10px;">📥 IN</button>
                <button onclick="openStockOutModal('${item.id}')" class="toolbar-btn danger" style="padding: 4px 6px; font-size: 10px; margin-left: 3px;">📤 OUT</button>
                <button onclick="openOrderModal('${item.id}')" class="toolbar-btn" style="padding: 4px 6px; font-size: 10px; margin-left: 3px; background: #2e7d32; border-color: #2e7d32;">📦 ORDER</button>
                <button onclick="editStockItem('${item.id}')" class="toolbar-btn" style="padding: 4px 6px; font-size: 10px; margin-left: 3px;">✏️</button>
            </td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="openDocumentsModal('${item.id}')" class="icon-btn" style="color: #dcdcaa; border: 1px solid #dcdcaa;" title="Data Sheets & Certificates">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path fill-rule="evenodd" d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/><path d="M4 11a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0v-1zm6-4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V7zM7 9a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0V9z"/></svg>
                    ${item.documents && Array.isArray(item.documents) && item.documents.length > 0 ? `<span style="margin-left: 4px;">(${item.documents.length})</span>` : ''}
                </button>
            </td>
        </tr>
    `;
}

// Helper: Get supplier name by ID
function getSupplierName(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'Unknown';
}

// Helper: Get suppliers display for item (supports suppliers_data JSONB and old supplier_id)
function getSupplierNamesDisplay(item) {
    let supplierNames = [];
    
    if (item.suppliers_data && Array.isArray(item.suppliers_data) && item.suppliers_data.length > 0) {
        supplierNames = item.suppliers_data.map(s => s.name);
    } else if (item.supplier_id) {
        const supplier = suppliers.find(s => s.id === item.supplier_id);
        if (supplier) supplierNames = [supplier.name];
    }
    
    return supplierNames.length > 0 ? `Suppliers: ${supplierNames.join(', ')}` : '';
}

// Helper: Get suppliers with links display (each supplier shows its link)
function getSuppliersWithLinksDisplay(item) {
    let html = '';
    
    if (item.suppliers_data && Array.isArray(item.suppliers_data) && item.suppliers_data.length > 0) {
        const suppliersText = item.suppliers_data.map(s => s.name).join(', ');
        html += `<div style="font-size: 11px; color: #999; margin-top: 3px;">Suppliers: ${suppliersText}</div>`;
        
        item.suppliers_data.forEach(sup => {
            if (sup.link && sup.link.trim()) {
                html += `<div style="font-size: 11px; margin-top: 2px;">
                    <a href="${sup.link}" target="_blank" style="color: #4CAF50; text-decoration: none;">🔗 ${sup.name}</a>
                </div>`;
            }
        });
    } else if (item.supplier_id && item.material_link) {
        // Old format compatibility
        const supplier = suppliers.find(s => s.id === item.supplier_id);
        if (supplier) {
            html += `<div style="font-size: 11px; color: #999; margin-top: 3px;">Supplier: ${supplier.name}</div>`;
            html += `<div style="font-size: 11px; margin-top: 2px;">
                <a href="${item.material_link}" target="_blank" style="color: #4CAF50; text-decoration: none;">🔗 Material Link</a>
            </div>`;
        }
    }
    
    return html;
}

// Update stats
function updateStats() {
    const total = stockItems.length;
    const lowStock = stockItems.filter(item => item.current_quantity <= item.min_quantity).length;
    const totalValue = stockItems.reduce((sum, item) => {
        return sum + ((item.current_quantity || 0) * (item.cost_per_unit || 0));
    }, 0);
    
    document.getElementById('totalItems').textContent = total;
    document.getElementById('lowStockCount').textContent = lowStock;
    document.getElementById('totalValue').textContent = '£' + totalValue.toFixed(2);
}

// Filter stock
function filterStock() {
    const category = document.getElementById('categoryFilter').value;
    const searchInput = document.getElementById('stockSearch');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    filteredItems = stockItems.filter(item => {
        // Filter by category
        if (category && item.category !== category) return false;
        
        // Filter by search (name or item_number)
        if (search) {
            const nameMatch = item.name && item.name.toLowerCase().includes(search);
            const numberMatch = item.item_number && item.item_number.toLowerCase().includes(search);
            if (!nameMatch && !numberMatch) return false;
        }
        
        return true;
    });
    
    renderStockTable();
}

// Refresh stock
async function refreshStock() {
    await loadStockItems();
    await loadSuppliers();
    await loadProjects();
    updateStats();
    showToast('Stock refreshed!', 'info');
}

// Open modals
async function openAddStockModal() {
    // Load categories first
    await loadStockCategories();
    
    document.getElementById('stockName').value = '';
    document.getElementById('stockSize').value = '';
    document.getElementById('stockSizeUnit').value = 'mm';
    document.getElementById('stockThickness').value = '';
    document.getElementById('stockColor').value = '';
    document.getElementById('stockCategory').value = 'timber';
    document.getElementById('stockUnit').value = 'pcs';
    document.getElementById('stockMinQty').value = '0';
    document.getElementById('stockCost').value = '0';
    document.getElementById('stockNotes').value = '';
    
    // Populate suppliers
    const supplierSelect = document.getElementById('stockSupplier');
    supplierSelect.innerHTML = '<option value="">-- Select supplier --</option>';
    suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup.id;
        option.textContent = sup.name;
        supplierSelect.appendChild(option);
    });
    
    // Clear suppliers list
    tempStockSuppliers = [];
    document.getElementById('stockSuppliersList').innerHTML = '';
    
    // Update subcategories for default category
    updateSubcategoryOptions();
    
    document.getElementById('addStockModal').classList.add('active');
}

function openStockInModal(itemId = null) {
    // Reset category filter
    document.getElementById('stockInCategoryFilter').value = '';
    
    // Populate suppliers
    const supplierSelect = document.getElementById('stockInSupplier');
    supplierSelect.innerHTML = '<option value="">-- Select supplier --</option>';
    suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup.id;
        option.textContent = sup.name;
        supplierSelect.appendChild(option);
    });
    
    // Populate workers (active workers only)
    const workerSelect = document.getElementById('stockInWorker');
    workerSelect.innerHTML = '<option value="">-- Select worker --</option>';
    teamMembers.filter(w => w.active === true).forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = worker.name;
        workerSelect.appendChild(option);
    });
    
    // Populate all items initially
    populateStockInItems(stockItems, itemId);
    
    // If itemId provided, preselect default supplier
    if (itemId) {
        const item = stockItems.find(i => i.id === itemId);
        if (item && item.supplier_id) {
            supplierSelect.value = item.supplier_id;
        }
    }
    
    document.getElementById('stockInQty').value = '';
    document.getElementById('stockInCostPerUnit').value = '';
    document.getElementById('stockInInvoice').value = '';
    document.getElementById('stockInCost').value = '';
    document.getElementById('stockInNotes').value = '';
    
    document.getElementById('stockInModal').classList.add('active');
}

// Filter stock items by category in Stock IN
function filterStockInItems() {
    const category = document.getElementById('stockInCategoryFilter').value;
    const filtered = category ? stockItems.filter(item => item.category === category) : stockItems;
    populateStockInItems(filtered);
}

// Populate Stock IN items dropdown
function populateStockInItems(items, selectedId = null) {
    const select = document.getElementById('stockInItem');
    select.innerHTML = '<option value="">Select stock item...</option>';
    
    // Sort by item_number numerically
    const sortedItems = [...items].sort((a, b) => {
        const numA = a.item_number ? parseInt(a.item_number.replace(/\D/g, '')) || 0 : 0;
        const numB = b.item_number ? parseInt(b.item_number.replace(/\D/g, '')) || 0 : 0;
        return numA - numB;
    });
    
    sortedItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        
        // Build detailed description
        let desc = item.item_number || 'NO-NUM';
        desc += ` | ${item.name}`;
        if (item.size) desc += ` | ${item.size}`;
        if (item.thickness) desc += ` | ${item.thickness}`;
        if (item.color) desc += ` | ${item.color}`;
        desc += ` (${item.current_quantity} ${item.unit})`;
        
        option.textContent = desc;
        if (selectedId && item.id === selectedId) option.selected = true;
        select.appendChild(option);
    });
    
    // If item was preselected, set cost
    if (selectedId) {
        const item = items.find(i => i.id === selectedId);
        if (item) {
            document.getElementById('stockInCostPerUnit').value = (item.cost_per_unit || 0).toFixed(2);
        }
    }
}

// Handle item selection change
function onStockInItemChange() {
    const itemId = document.getElementById('stockInItem').value;
    const item = stockItems.find(i => i.id === itemId);
    if (item) {
        document.getElementById('stockInCostPerUnit').value = (item.cost_per_unit || 0).toFixed(2);
        calculateStockInCost();
    }
}

// Calculate total cost for Stock IN
function calculateStockInCost() {
    const qty = parseFloat(document.getElementById('stockInQty').value) || 0;
    const costPerUnit = parseFloat(document.getElementById('stockInCostPerUnit').value) || 0;
    const totalCost = qty * costPerUnit;
    document.getElementById('stockInCost').value = totalCost.toFixed(2);
}

function openStockOutModal(itemId = null) {
    const select = document.getElementById('stockOutItem');
    select.innerHTML = '<option value="">Select stock item...</option>';
    
    // Sort by item_number numerically
    const sortedItems = [...stockItems].sort((a, b) => {
        const numA = a.item_number ? parseInt(a.item_number.replace(/\D/g, '')) || 0 : 0;
        const numB = b.item_number ? parseInt(b.item_number.replace(/\D/g, '')) || 0 : 0;
        return numA - numB;
    });
    
    sortedItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        
        // Build detailed description
        let desc = item.item_number || 'NO-NUM';
        desc += ` | ${item.name}`;
        if (item.size) desc += ` | ${item.size}`;
        if (item.thickness) desc += ` | ${item.thickness}`;
        if (item.color) desc += ` | ${item.color}`;
        desc += ` (Available: ${item.current_quantity} ${item.unit})`;
        
        option.textContent = desc;
        if (itemId && item.id === itemId) option.selected = true;
        select.appendChild(option);
    });
    
    // Populate ONLY production projects with type icons
    const projectSelect = document.getElementById('stockOutProject');
    projectSelect.innerHTML = '<option value="">-- Select project --</option>';
    
    // Add OFFICE option for non-project items
    const officeOption = document.createElement('option');
    officeOption.value = 'OFFICE';
    officeOption.textContent = '🏢 OFFICE (No Project)';
    projectSelect.appendChild(officeOption);
    
    // Filter only production projects
    const productionProjects = projects.filter(proj => proj.source === 'production');
    
    productionProjects.forEach(proj => {
        const option = document.createElement('option');
        option.value = proj.project_number;
        
        // Get project type icon
        let icon = '📦'; // default
        if (proj.type === 'doors') icon = '🚪';
        else if (proj.type === 'sash') icon = '🪟';
        else if (proj.type === 'casement') icon = '🪟';
        else if (proj.type === 'kitchen') icon = '🏠';
        else if (proj.type === 'wardrobe') icon = '👔';
        else if (proj.type === 'furniture') icon = '🪑';
        
        option.textContent = `${icon} ${proj.project_number} - ${proj.name}`;
        projectSelect.appendChild(option);
    });
    
    // Populate workers (active workers only)
    const workerSelect = document.getElementById('stockOutWorker');
    workerSelect.innerHTML = '<option value="">-- Select worker --</option>';
    teamMembers.filter(w => w.active === true).forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = worker.name;
        workerSelect.appendChild(option);
    });
    
    if (itemId) {
        const item = stockItems.find(i => i.id === itemId);
        if (item) {
            document.getElementById('stockOutAvailable').textContent = `Available: ${item.current_quantity} ${item.unit}`;
        }
    }
    
    document.getElementById('stockOutQty').value = '';
    document.getElementById('stockOutNotes').value = '';
    
    document.getElementById('stockOutModal').classList.add('active');
    
    // Update available quantity on item change
    select.addEventListener('change', function() {
        const item = stockItems.find(i => i.id === this.value);
        if (item) {
            document.getElementById('stockOutAvailable').textContent = `Available: ${item.current_quantity} ${item.unit}`;
        }
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Save stock item
async function saveStockItem() {
    const name = document.getElementById('stockName').value.trim();
    const sizeValue = document.getElementById('stockSize').value.trim();
    const sizeUnit = document.getElementById('stockSizeUnit').value;
    const size = sizeValue ? `${sizeValue}${sizeUnit}` : null;
    const thickness = document.getElementById('stockThickness').value.trim();
    const color = document.getElementById('stockColor').value.trim();
    const category = document.getElementById('stockCategory').value;
    const subcategory = document.getElementById('stockSubcategory').value || null;
    const unit = document.getElementById('stockUnit').value;
    const minQty = parseFloat(document.getElementById('stockMinQty').value) || 0;
    const cost = parseFloat(document.getElementById('stockCost').value) || 0;
    const supplierData = tempStockSuppliers.length > 0 ? tempStockSuppliers : null;
    const notes = document.getElementById('stockNotes').value.trim();
    const imageFile = document.getElementById('stockImage').files[0];
    
    if (!name) {
        showToast('Please enter item name', 'warning');
        return;
    }
    
    try {
        // Generate item_number
        const { data: lastItem, error: lastError } = await supabaseClient
            .from('stock_items')
            .select('item_number')
            .order('item_number', { ascending: false })
            .limit(1);
        
        let nextNumber = 1;
        if (lastItem && lastItem.length > 0 && lastItem[0].item_number) {
            const match = lastItem[0].item_number.match(/^MAT-(\d+)$/);
            if (match && match[1]) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }
        
        const itemNumber = `MAT-${String(nextNumber).padStart(3, '0')}`;
        
        // Upload image if provided
        let imageUrl = null;
        if (imageFile) {
            imageUrl = await uploadStockImage(imageFile, itemNumber);
        }
        
        const { data, error } = await supabaseClient
            .from('stock_items')
            .insert([{
                item_number: itemNumber,
                name,
                size: size,
                thickness: thickness || null,
                color: color || null,
                category,
                subcategory: subcategory,
                unit,
                current_quantity: 0,
                min_quantity: minQty,
                cost_per_unit: cost,
                suppliers_data: supplierData,
                image_url: imageUrl,
                notes: notes || null
            }])
            .select();
        
        if (error) throw error;
        
        closeModal('addStockModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error saving stock item:', err);
        showToast('Error saving: ' + err.message, 'error');
    }
}

// Save stock IN
async function saveStockIn() {
    const itemId = document.getElementById('stockInItem').value;
    const supplierId = document.getElementById('stockInSupplier').value;
    const workerId = document.getElementById('stockInWorker').value;
    const qty = parseFloat(document.getElementById('stockInQty').value);
    const costPerUnit = parseFloat(document.getElementById('stockInCostPerUnit').value);
    const invoice = document.getElementById('stockInInvoice').value.trim();
    const notes = document.getElementById('stockInNotes').value.trim();
    
    if (!itemId) {
        showToast('Please select an item', 'warning');
        return;
    }
    
    if (!supplierId) {
        showToast('Please select a supplier', 'warning');
        return;
    }
    
    // WALIDACJA: Worker MUSI być wybrany
    if (!workerId) {
        showToast('Please select who received this delivery', 'warning');
        return;
    }
    
    if (!qty || qty <= 0) {
        showToast('Please enter valid quantity', 'warning');
        return;
    }
    
    if (!costPerUnit || costPerUnit <= 0) {
        showToast('Please enter cost per unit', 'warning');
        return;
    }
    
    try {
        const item = stockItems.find(i => i.id === itemId);
        const totalCost = qty * costPerUnit;
        
        // Calculate weighted average
        const oldQty = item.current_quantity || 0;
        const oldCost = item.cost_per_unit || 0;
        const newQty = Math.round((oldQty + qty) * 100) / 100;
        const newAvgCost = Math.round((((oldQty * oldCost) + (qty * costPerUnit)) / newQty) * 100) / 100;
        
        
        // Create transaction with supplier AND worker
        const { error: txError } = await supabaseClient
            .from('stock_transactions')
            .insert([{
                stock_item_id: itemId,
                type: 'IN',
                quantity: qty,
                supplier_id: supplierId,
                worker_id: workerId,
                invoice_number: invoice || null,
                cost: totalCost,
                notes: notes || null
            }]);
        
        if (txError) throw txError;
        
        // Update stock quantity AND weighted average cost
        const { error: updateError } = await supabaseClient
            .from('stock_items')
            .update({ 
                current_quantity: newQty,
                cost_per_unit: newAvgCost
            })
            .eq('id', itemId);
        
        if (updateError) throw updateError;
        
        closeModal('stockInModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error recording stock IN:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Save stock OUT
async function saveStockOut() {
    const itemId = document.getElementById('stockOutItem').value;
    const qty = parseFloat(document.getElementById('stockOutQty').value);
    const projectNumber = document.getElementById('stockOutProject').value;
    const workerId = document.getElementById('stockOutWorker').value;
    const notes = document.getElementById('stockOutNotes').value.trim();
    
    if (!itemId) {
        showToast('Please select an item', 'warning');
        return;
    }
    
    if (!qty || qty <= 0) {
        showToast('Please enter valid quantity', 'warning');
        return;
    }
    
    if (!projectNumber) {
        showToast('Please select a project', 'warning');
        return;
    }
    
    // WALIDACJA: Worker MUSI być wybrany
    if (!workerId) {
        showToast('Please select who is taking this material', 'warning');
        return;
    }
    
    const item = stockItems.find(i => i.id === itemId);
    
    if (qty > item.current_quantity) {
        showToast(`Not enough stock! Available: ${item.current_quantity} ${item.unit}`, 'info');
        return;
    }
    
    try {
        // Create transaction with worker
        const { error: txError } = await supabaseClient
            .from('stock_transactions')
            .insert([{
                stock_item_id: itemId,
                type: 'OUT',
                quantity: qty,
                project_number: projectNumber,
                worker_id: workerId,
                notes: notes || null
            }]);
        
        if (txError) throw txError;
        
        // Update stock quantity
        const newQty = Math.round((item.current_quantity - qty) * 100) / 100;
        const { error: updateError } = await supabaseClient
            .from('stock_items')
            .update({ current_quantity: newQty })
            .eq('id', itemId);
        
        if (updateError) throw updateError;
        
        closeModal('stockOutModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error recording stock OUT:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

function editStockItem(itemId) {
    const item = stockItems.find(i => i.id === itemId);
    if (!item) {
        showToast('Item not found', 'info');
        return;
    }
    
    document.getElementById('editStockId').value = item.id;
    document.getElementById('editStockName').value = item.name || '';
    
    // Parse size (e.g. "63x120mm" -> "63x120" + "mm")
    if (item.size) {
        const sizeMatch = item.size.match(/^(.+?)(mm|inch|m|kg|ml|litres|pack)$/);
        if (sizeMatch) {
            document.getElementById('editStockSize').value = sizeMatch[1];
            document.getElementById('editStockSizeUnit').value = sizeMatch[2];
        } else {
            document.getElementById('editStockSize').value = item.size;
            document.getElementById('editStockSizeUnit').value = 'mm';
        }
    } else {
        document.getElementById('editStockSize').value = '';
        document.getElementById('editStockSizeUnit').value = 'mm';
    }
    
    document.getElementById('editStockThickness').value = item.thickness || '';
    document.getElementById('editStockColor').value = item.color || '';
    document.getElementById('editStockCategory').value = item.category || 'timber';
    
    // Update subcategory options and set value
    updateEditSubcategoryOptions();
    document.getElementById('editStockSubcategory').value = item.subcategory || '';
    
    document.getElementById('editStockUnit').value = item.unit || 'pcs';
    document.getElementById('editStockMinQty').value = item.min_quantity || 0;
    document.getElementById('editStockCost').value = item.cost_per_unit || 0;
    document.getElementById('editStockNotes').value = item.notes || '';
    document.getElementById('editStockImageUrl').value = item.image_url || '';
    
    // Show existing image
    const preview = document.getElementById('editStockImagePreview');
    if (item.image_url) {
        preview.innerHTML = `<img src="${item.image_url}" style="max-width: 200px; max-height: 200px; border-radius: 5px;">`;
    } else {
        preview.innerHTML = '';
    }
    
    // Populate suppliers dropdown
    const supplierSelect = document.getElementById('editStockSupplier');
    supplierSelect.innerHTML = '<option value="">-- Select supplier --</option>';
    suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup.id;
        option.textContent = sup.name;
        supplierSelect.appendChild(option);
    });
    
    // Load existing suppliers_data into temp array
    tempEditStockSuppliers = [];
    if (item.suppliers_data && Array.isArray(item.suppliers_data)) {
        tempEditStockSuppliers = item.suppliers_data.map(s => ({
            id: s.id,
            name: s.name,
            link: s.link || ''
        }));
    } else if (item.supplier_id) {
        // Migrate old supplier_id
        const supplier = suppliers.find(s => s.id === item.supplier_id);
        if (supplier) {
            tempEditStockSuppliers = [{
                id: supplier.id,
                name: supplier.name,
                link: item.material_link || ''
            }];
        }
    }
    renderEditStockSuppliersList();
    
    document.getElementById('editStockModal').classList.add('active');
}

async function updateStockItem() {
    const id = document.getElementById('editStockId').value;
    const name = document.getElementById('editStockName').value.trim();
    const sizeValue = document.getElementById('editStockSize').value.trim();
    const sizeUnit = document.getElementById('editStockSizeUnit').value;
    const size = sizeValue ? `${sizeValue}${sizeUnit}` : null;
    const thickness = document.getElementById('editStockThickness').value.trim();
    const color = document.getElementById('editStockColor').value.trim();
    const category = document.getElementById('editStockCategory').value;
    const subcategory = document.getElementById('editStockSubcategory').value || null;
    const unit = document.getElementById('editStockUnit').value;
    const minQty = parseFloat(document.getElementById('editStockMinQty').value) || 0;
    const cost = parseFloat(document.getElementById('editStockCost').value) || 0;
    const supplierData = tempEditStockSuppliers.length > 0 ? tempEditStockSuppliers : null;
    const notes = document.getElementById('editStockNotes').value.trim();
    const imageFile = document.getElementById('editStockImage').files[0];
    const currentImageUrl = document.getElementById('editStockImageUrl').value;
    
    if (!name) {
        showToast('Please enter item name', 'warning');
        return;
    }
    
    try {
        const item = stockItems.find(i => i.id === id);
        
        // Upload new image if provided
        let imageUrl = currentImageUrl; // Keep existing if no new upload
        if (imageFile) {
            imageUrl = await uploadStockImage(imageFile, item.item_number);
        }
        
        const { error } = await supabaseClient
            .from('stock_items')
            .update({
                name,
                size,
                thickness: thickness || null,
                color: color || null,
                category,
                subcategory: subcategory,
                unit,
                min_quantity: minQty,
                cost_per_unit: cost,
                suppliers_data: supplierData,
                image_url: imageUrl,
                notes: notes || null
            })
            .eq('id', id);
        
        if (error) throw error;
        
        closeModal('editStockModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error updating stock item:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteStockItem() {
    const id = document.getElementById('editStockId').value;
    const item = stockItems.find(i => i.id === id);
    
    if (!confirm(`Delete "${item.name}"?\n\nThis will also delete all orders and transaction history for this item.`)) {
        return;
    }
    
    try {
        // 1. Usuń image ze storage jeśli istnieje
        if (item.image_url) {
            const imagePath = item.image_url.split('/').pop();
            const { error: imageError } = await supabaseClient.storage
                .from('stock-images')
                .remove([imagePath]);
            
            if (imageError) {
                console.error('Error deleting image:', imageError);
            } else {
            }
        }
        
        // 2. Usuń powiązane zamówienia
        await supabaseClient
            .from('stock_orders')
            .delete()
            .eq('stock_item_id', id);
        
        // 3. Usuń powiązane transakcje
        await supabaseClient
            .from('stock_transactions')
            .delete()
            .eq('stock_item_id', id);
        
        // 4. Wyczyść powiązania w project_materials
        await supabaseClient
            .from('project_materials')
            .update({ stock_item_id: null })
            .eq('stock_item_id', id);
        
        // 5. Usuń stock item
        const { error } = await supabaseClient
            .from('stock_items')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        closeModal('editStockModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error deleting stock item:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== SUPPLIER MANAGEMENT ==========

function openAddSupplierModal() {
    document.getElementById('supplierName').value = '';
    document.getElementById('supplierContact').value = '';
    document.getElementById('supplierEmail').value = '';
    document.getElementById('supplierPhone').value = '';
    document.getElementById('supplierWebsite').value = '';
    document.getElementById('supplierNotes').value = '';
    
    document.getElementById('addSupplierModal').classList.add('active');
}

// ========== IMAGE UPLOAD ==========

function openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.display = 'flex';
    modal.onclick = function(e) {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-height: 90%; padding: 0; background: transparent; box-shadow: none;">
            <img src="${imageUrl}" style="max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 5px;">
        </div>
    `;
    
    document.body.appendChild(modal);
}

function previewStockImage(input) {
    const preview = document.getElementById('stockImagePreview');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 5px;">`;
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.innerHTML = '';
    }
}

function previewEditStockImage(input) {
    const preview = document.getElementById('editStockImagePreview');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 5px;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function uploadStockImage(file, itemNumber) {
    if (!file) return null;
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${itemNumber}.${fileExt}`;
        const filePath = `${fileName}`;
        
        
        // Upload to Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('stock-images')
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type
            });
        
        if (error) throw error;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('stock-images')
            .getPublicUrl(filePath);
        
        return urlData.publicUrl;
        
    } catch (err) {
        console.error('Error uploading image:', err);
        showToast('Error uploading: ' + err.message, 'error');
        return null;
    }
}

async function saveSupplier() {
    const name = document.getElementById('supplierName').value.trim();
    const contact = document.getElementById('supplierContact').value.trim();
    const email = document.getElementById('supplierEmail').value.trim();
    const phone = document.getElementById('supplierPhone').value.trim();
    const website = document.getElementById('supplierWebsite').value.trim();
    const notes = document.getElementById('supplierNotes').value.trim();
    
    if (!name) {
        showToast('Please enter supplier name', 'warning');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('suppliers')
            .insert([{
                name,
                contact_person: contact || null,
                email: email || null,
                phone: phone || null,
                website: website || null,
                notes: notes || null
            }])
            .select();
        
        if (error) throw error;
        
        closeModal('addSupplierModal');
        
        // Reload suppliers and update dropdown
        await loadSuppliers();
        
        // Select the newly added supplier
        if (data && data[0]) {
            document.getElementById('stockSupplier').value = data[0].id;
        }
        
    } catch (err) {
        console.error('Error saving supplier:', err);
        showToast('Error saving: ' + err.message, 'error');
    }
}

// ========== CATEGORIES MANAGEMENT ==========

let stockCategories = [];

// Populate category dropdowns with data from database
async function populateCategoryDropdowns() {
    const categoryFilter = document.getElementById('categoryFilter');
    const stockCategory = document.getElementById('stockCategory');
    const editStockCategory = document.getElementById('editStockCategory');
    
    // Get all categories from database
    const categories = stockCategories.filter(c => c.type === 'category');
    
    // Clear existing options (except "All Categories" in filter)
    const filterFirstOption = categoryFilter.options[0];
    categoryFilter.innerHTML = '';
    categoryFilter.appendChild(filterFirstOption);
    
    stockCategory.innerHTML = '';
    editStockCategory.innerHTML = '';
    
    // Populate all dropdowns
    categories.forEach(cat => {
        // Filter dropdown
        const filterOption = document.createElement('option');
        filterOption.value = cat.name.toLowerCase();
        filterOption.textContent = cat.name;
        categoryFilter.appendChild(filterOption);
        
        // Add modal dropdown
        const addOption = document.createElement('option');
        addOption.value = cat.name.toLowerCase();
        addOption.textContent = cat.name;
        stockCategory.appendChild(addOption);
        
        // Edit modal dropdown
        const editOption = document.createElement('option');
        editOption.value = cat.name.toLowerCase();
        editOption.textContent = cat.name;
        editStockCategory.appendChild(editOption);
    });
}

// Load categories from database
async function loadStockCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('stock_categories')
            .select('*')
            .order('display_order');
        
        if (error) throw error;
        
        stockCategories = data || [];
        
    } catch (err) {
        console.error('Error loading stock categories:', err);
    }
}

// Open manage categories modal
async function openManageCategoriesModal() {
    await loadStockCategories();
    displayCategoriesList();
    document.getElementById('manageCategoriesModal').classList.add('active');
}

// Display categories list
function displayCategoriesList() {
    const container = document.getElementById('categoriesList');
    
    const categories = stockCategories.filter(c => c.type === 'category');
    
    let html = '';
    
    categories.forEach(cat => {
        const subcats = stockCategories.filter(s => s.type === 'subcategory' && s.parent_category_id === cat.id);
        
        html += `
            <div style="background: #3e3e42; padding: 12px; margin-bottom: 10px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 14px;">${cat.name}</strong>
                    <button class="modal-btn danger" onclick="deleteCategory('${cat.id}')" style="padding: 4px 8px; font-size: 11px;">Delete</button>
                </div>
                ${subcats.length > 0 ? `
                    <div style="padding-left: 15px; font-size: 12px; color: #aaa;">
                        ${subcats.map(s => `
                            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                                <span>↳ ${s.name}</span>
                                <button class="modal-btn danger" onclick="deleteCategory('${s.id}')" style="padding: 2px 6px; font-size: 10px;">Delete</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html || '<p style="color: #999;">No categories yet.</p>';
}

// Open add category modal
function openAddCategoryModal() {
    document.getElementById('newCategoryName').value = '';
    document.getElementById('addCategoryModal').classList.add('active');
}

// Open add subcategory modal
async function openAddSubcategoryModal() {
    await loadStockCategories();
    
    const select = document.getElementById('subcategoryParent');
    select.innerHTML = '<option value="">-- Select category --</option>';
    
    stockCategories.filter(c => c.type === 'category').forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
    
    document.getElementById('newSubcategoryName').value = '';
    document.getElementById('addSubcategoryModal').classList.add('active');
}

// Save new category
async function saveNewCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    
    if (!name) {
        showToast('Please enter category name', 'warning');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('stock_categories')
            .insert([{
                name,
                type: 'category',
                display_order: stockCategories.filter(c => c.type === 'category').length + 1
            }]);
        
        if (error) throw error;
        
        showToast('Category added successfully!', 'success');
        closeModal('addCategoryModal');
        await loadStockCategories();
        displayCategoriesList();
        await populateCategoryDropdowns();
        
    } catch (err) {
        console.error('Error saving category:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Save new subcategory
async function saveNewSubcategory() {
    const name = document.getElementById('newSubcategoryName').value.trim();
    const parentId = document.getElementById('subcategoryParent').value;
    
    if (!name || !parentId) {
        showToast('Please fill all fields', 'warning');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('stock_categories')
            .insert([{
                name,
                type: 'subcategory',
                parent_category_id: parentId,
                display_order: stockCategories.filter(c => c.type === 'subcategory' && c.parent_category_id === parentId).length + 1
            }]);
        
        if (error) throw error;
        
        showToast('Subcategory added successfully!', 'success');
        closeModal('addSubcategoryModal');
        await loadStockCategories();
        displayCategoriesList();
        await populateCategoryDropdowns();
        
    } catch (err) {
        console.error('Error saving subcategory:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Delete category
async function deleteCategory(categoryId) {
    const category = stockCategories.find(c => c.id === categoryId);
    if (!category) return;
    
    // Check if it's a category with subcategories
    if (category.type === 'category') {
        const subcats = stockCategories.filter(s => s.type === 'subcategory' && s.parent_category_id === categoryId);
        if (subcats.length > 0) {
            showToast(`Cannot delete - this category has ${subcats.length} subcategories. Delete them first.`, 'error');
            return;
        }
    }
    
    if (!confirm(`Delete "${category.name}"? Any materials using this category will become uncategorized.`)) return;
    
    try {
        // Clear category_id in project_materials before deleting
        await supabaseClient
            .from('project_materials')
            .update({ category_id: null })
            .eq('category_id', categoryId);
        
        // Now delete the category
        const { error } = await supabaseClient
            .from('stock_categories')
            .delete()
            .eq('id', categoryId);
        
        if (error) throw error;
        
        await loadStockCategories();
        displayCategoriesList();
        await populateCategoryDropdowns();
        
    } catch (err) {
        console.error('Error deleting category:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== DOCUMENTS MANAGEMENT ==========

let currentDocumentItemId = null;

// Open documents modal
async function openDocumentsModal(itemId) {
    currentDocumentItemId = itemId;
    
    const item = stockItems.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('documentsModalTitle').textContent = `DS & Cert: ${item.name}`;
    
    renderDocumentsList(item.documents || []);
    
    document.getElementById('documentsModal').classList.add('active');
}

// Render documents list
function renderDocumentsList(documents) {
    const container = document.getElementById('documentsList');
    
    if (!documents || documents.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No documents uploaded yet.</p>';
        return;
    }
    
    container.innerHTML = documents.map((doc, index) => `
        <div style="background: #3e3e42; padding: 12px; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #e8e2d5; margin-bottom: 4px;">
                    <a href="${doc.url}" target="_blank" style="color: #4CAF50; text-decoration: none;">
                        📄 ${doc.name}
                    </a>
                </div>
                <div style="font-size: 11px; color: #999;">
                    ${doc.type || 'Document'} • Uploaded: ${new Date(doc.uploaded_at).toLocaleDateString('en-GB')}
                </div>
            </div>
            <button onclick="deleteDocument(${index})" class="modal-btn danger" style="padding: 6px 12px; font-size: 11px;">Delete</button>
        </div>
    `).join('');
}

// Upload document
async function uploadDocument() {
    const fileInput = document.getElementById('documentFile');
    const typeInput = document.getElementById('documentType');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a file', 'warning');
        return;
    }
    
    const file = fileInput.files[0];
    const type = typeInput.value;
    
    try {
        // Upload to Supabase Storage
        const fileName = `${currentDocumentItemId}/${Date.now()}_${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('stock-documents')
            .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('stock-documents')
            .getPublicUrl(fileName);
        
        // Get current documents
        const item = stockItems.find(i => i.id === currentDocumentItemId);
        const documents = item.documents || [];
        
        // Add new document
        documents.push({
            name: file.name,
            url: urlData.publicUrl,
            type: type,
            uploaded_at: new Date().toISOString()
        });
        
        // Update database
        const { error: updateError } = await supabaseClient
            .from('stock_items')
            .update({ documents: documents })
            .eq('id', currentDocumentItemId);
        
        if (updateError) throw updateError;
        
        // Refresh
        await loadStockItems();
        const updatedItem = stockItems.find(i => i.id === currentDocumentItemId);
        renderDocumentsList(updatedItem.documents);
        
        // Reset form
        fileInput.value = '';
        typeInput.value = 'Certificate';
        
        showToast('Document uploaded successfully!', 'success');
        
    } catch (err) {
        console.error('Error uploading document:', err);
        console.error('Error details:', JSON.stringify(err, null, 2));
        showToast('Error uploading: ' + (err.message || JSON.stringify(err, 'error')));
    }
}

// Delete document
async function deleteDocument(index) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
        const item = stockItems.find(i => i.id === currentDocumentItemId);
        const documents = [...(item.documents || [])];
        const docToDelete = documents[index];
        
        // Delete from storage
        const fileName = docToDelete.url.split('/stock-documents/')[1];
        if (fileName) {
            await supabaseClient.storage
                .from('stock-documents')
                .remove([fileName]);
        }
        
        // Remove from array
        documents.splice(index, 1);
        
        // Update database
        const { error } = await supabaseClient
            .from('stock_items')
            .update({ documents: documents })
            .eq('id', currentDocumentItemId);
        
        if (error) throw error;
        
        // Refresh
        await loadStockItems();
        const updatedItem = stockItems.find(i => i.id === currentDocumentItemId);
        renderDocumentsList(updatedItem.documents);
        
        showToast('Document deleted successfully!', 'success');
        
    } catch (err) {
        console.error('Error deleting document:', err);
        showToast('Error deleting: ' + err.message, 'error');
    }
}

// ========== STOCK REPORTS ==========

// Open stock reports modal
async function openStockReportsModal() {
    // Populate workers dropdown
    const workerSelect = document.getElementById('reportWorker');
    workerSelect.innerHTML = '<option value="">All Workers</option>';
    teamMembers.forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = worker.name;
        workerSelect.appendChild(option);
    });
    
    // Populate categories dropdown
    const categorySelect = document.getElementById('reportCategory');
    categorySelect.innerHTML = '<option value="">All Categories</option>';
    const categories = stockCategories.filter(c => c.type === 'category');
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name.toLowerCase();
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
    
    // Set default dates for custom range
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('reportDateFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('reportDateTo').value = today.toISOString().split('T')[0];
    
    document.getElementById('stockReportsModal').classList.add('active');
}

// Toggle custom date range visibility
function toggleCustomDateRange() {
    const period = document.getElementById('reportPeriod').value;
    const customRange = document.getElementById('customDateRange');
    customRange.style.display = period === 'custom' ? 'block' : 'none';
}

// Update report filters based on report type
function updateReportFilters() {
    const reportType = document.querySelector('input[name="reportType"]:checked').value;
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    
    // Show Order Status filter only for Materials Ordered report
    if (reportType === 'ordered') {
        orderStatusFilter.style.display = 'block';
    } else {
        orderStatusFilter.style.display = 'none';
    }
}

// Generate stock report
async function generateStockReport() {
    const reportType = document.querySelector('input[name="reportType"]:checked').value;
    const period = document.getElementById('reportPeriod').value;
    const workerId = document.getElementById('reportWorker').value;
    const category = document.getElementById('reportCategory').value;
    const orderStatus = document.getElementById('reportOrderStatus').value;
    
    // Calculate date range
    let dateFrom, dateTo;
    const today = new Date();
    
    if (period === 'custom') {
        dateFrom = new Date(document.getElementById('reportDateFrom').value);
        dateTo = new Date(document.getElementById('reportDateTo').value);
        dateTo.setHours(23, 59, 59, 999); // End of day
    } else {
        dateTo = new Date(today);
        dateTo.setHours(23, 59, 59, 999);
        dateFrom = new Date(today);
        dateFrom.setDate(today.getDate() - parseInt(period));
        dateFrom.setHours(0, 0, 0, 0);
    }
    
    try {
        let reportHTML = '';
        
        if (reportType === 'in') {
            reportHTML = await generateStockInReport(dateFrom, dateTo, workerId, category);
        } else if (reportType === 'out') {
            reportHTML = await generateStockOutReport(dateFrom, dateTo, workerId, category);
        } else if (reportType === 'add') {
            reportHTML = await generateAddItemsReport(dateFrom, dateTo, workerId, category);
        } else if (reportType === 'ordered') {
            reportHTML = await generateOrderedItemsReport(dateFrom, dateTo, workerId, category, orderStatus);
        }
        
        // Open report in new window
        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(reportHTML);
        reportWindow.document.close();
        
        closeModal('stockReportsModal');
        
    } catch (err) {
        console.error('Error generating report:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Generate Stock IN Report
async function generateStockInReport(dateFrom, dateTo, workerId, category) {
    // Get company logo
    const logoHtml = await getCompanyLogoHtml();
    
    // Fetch transactions
    let query = supabaseClient
        .from('stock_transactions')
        .select('*, stock_items(name, category, unit, item_number), team_members(name), suppliers(name)')
        .eq('type', 'IN')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString())
        .order('created_at', { ascending: false });
    
    if (workerId) {
        query = query.eq('worker_id', workerId);
    }
    
    const { data: transactions, error } = await query;
    
    if (error) throw error;
    
    // Filter by category if needed
    let filteredTransactions = transactions || [];
    if (category) {
        filteredTransactions = filteredTransactions.filter(tx => 
            tx.stock_items && tx.stock_items.category === category
        );
    }
    
    // Calculate totals
    const totalQuantity = filteredTransactions.reduce((sum, tx) => sum + (parseFloat(tx.quantity) || 0), 0);
    const totalCost = filteredTransactions.reduce((sum, tx) => sum + (parseFloat(tx.cost) || 0), 0);
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Stock IN Report - ${new Date().toLocaleDateString('en-GB')}</title>
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
                .logo-placeholder {
                    width: 150px;
                    height: 60px;
                    background: #f0f0f0;
                    border: 2px dashed #999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    color: #999;
                    font-size: 12px;
                }
                .header h1 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                }
                .summary {
                    background: #f5f5f5;
                    padding: 15px;
                    margin-bottom: 30px;
                    border-left: 4px solid #4CAF50;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                }
                .summary-box {
                    padding: 10px;
                }
                .summary-box h3 {
                    margin: 0 0 5px 0;
                    font-size: 14px;
                    color: #666;
                }
                .summary-box .value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #4CAF50;
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
                tr:nth-child(even) {
                    background: #f9f9f9;
                }
                .no-data {
                    text-align: center;
                    padding: 40px;
                    color: #999;
                    font-style: italic;
                }
                @media print {
                    body { padding: 20px; font-size: 10px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoHtml}
                <h1>📥 STOCK IN REPORT</h1>
                <div>Joinery Core - Operational System</div>
                <div style="margin-top: 10px; font-size: 14px; color: #666;">
                    ${dateFrom.toLocaleDateString('en-GB')} - ${dateTo.toLocaleDateString('en-GB')}
                </div>
            </div>

            <div class="summary">
                <div class="summary-box">
                    <h3>Total Transactions</h3>
                    <div class="value">${filteredTransactions.length}</div>
                </div>
                <div class="summary-box">
                    <h3>Total Quantity</h3>
                    <div class="value">${totalQuantity.toFixed(2)}</div>
                </div>
                <div class="summary-box">
                    <h3>Total Cost</h3>
                    <div class="value">£${totalCost.toFixed(2)}</div>
                </div>
            </div>

            ${filteredTransactions.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Item #</th>
                            <th>Item Name</th>
                            <th>Quantity</th>
                            <th>Supplier</th>
                            <th>Worker</th>
                            <th>Invoice</th>
                            <th>Cost</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredTransactions.map(tx => `
                            <tr>
                                <td>${new Date(tx.created_at).toLocaleString('en-GB', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</td>
                                <td>${tx.stock_items?.item_number || '-'}</td>
                                <td>${tx.stock_items?.name || 'Unknown'}</td>
                                <td>${tx.quantity} ${tx.stock_items?.unit || ''}</td>
                                <td>${tx.suppliers?.name || '-'}</td>
                                <td>${tx.team_members?.name || '-'}</td>
                                <td>${tx.invoice_number || '-'}</td>
                                <td>£${(tx.cost || 0).toFixed(2)}</td>
                                <td>${tx.notes || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<div class="no-data">No transactions found for selected criteria</div>'}

            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">Print Report</button>
                <button onclick="window.close()" style="background: #666; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </body>
        </html>
    `;
}

// Generate Stock OUT Report
async function generateStockOutReport(dateFrom, dateTo, workerId, category) {
    // Get company logo
    const logoHtml = await getCompanyLogoHtml();
    
    // Fetch transactions
    let query = supabaseClient
        .from('stock_transactions')
        .select('*, stock_items(name, category, unit, item_number), team_members(name)')
        .eq('type', 'OUT')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString())
        .order('created_at', { ascending: false });
    
    if (workerId) {
        query = query.eq('worker_id', workerId);
    }
    
    const { data: transactions, error } = await query;
    
    if (error) throw error;
    
    // Filter by category if needed
    let filteredTransactions = transactions || [];
    if (category) {
        filteredTransactions = filteredTransactions.filter(tx => 
            tx.stock_items && tx.stock_items.category === category
        );
    }
    
    // Calculate totals
    const totalQuantity = filteredTransactions.reduce((sum, tx) => sum + (parseFloat(tx.quantity) || 0), 0);
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Stock OUT Report - ${new Date().toLocaleDateString('en-GB')}</title>
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
                .logo-placeholder {
                    width: 150px;
                    height: 60px;
                    background: #f0f0f0;
                    border: 2px dashed #999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    color: #999;
                    font-size: 12px;
                }
                .header h1 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                }
                .summary {
                    background: #f5f5f5;
                    padding: 15px;
                    margin-bottom: 30px;
                    border-left: 4px solid #f44336;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }
                .summary-box {
                    padding: 10px;
                }
                .summary-box h3 {
                    margin: 0 0 5px 0;
                    font-size: 14px;
                    color: #666;
                }
                .summary-box .value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #f44336;
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
                tr:nth-child(even) {
                    background: #f9f9f9;
                }
                .no-data {
                    text-align: center;
                    padding: 40px;
                    color: #999;
                    font-style: italic;
                }
                @media print {
                    body { padding: 20px; font-size: 10px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoHtml}
                <h1>📤 STOCK OUT REPORT</h1>
                <div>Joinery Core - Operational System</div>
                <div style="margin-top: 10px; font-size: 14px; color: #666;">
                    ${dateFrom.toLocaleDateString('en-GB')} - ${dateTo.toLocaleDateString('en-GB')}
                </div>
            </div>

            <div class="summary">
                <div class="summary-box">
                    <h3>Total Transactions</h3>
                    <div class="value">${filteredTransactions.length}</div>
                </div>
                <div class="summary-box">
                    <h3>Total Quantity Used</h3>
                    <div class="value">${totalQuantity.toFixed(2)}</div>
                </div>
            </div>

            ${filteredTransactions.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Item #</th>
                            <th>Item Name</th>
                            <th>Quantity</th>
                            <th>Project</th>
                            <th>Worker</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredTransactions.map(tx => `
                            <tr>
                                <td>${new Date(tx.created_at).toLocaleString('en-GB', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</td>
                                <td>${tx.stock_items?.item_number || '-'}</td>
                                <td>${tx.stock_items?.name || 'Unknown'}</td>
                                <td>${tx.quantity} ${tx.stock_items?.unit || ''}</td>
                                <td>${tx.project_number || '-'}</td>
                                <td>${tx.team_members?.name || '-'}</td>
                                <td>${tx.notes || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<div class="no-data">No transactions found for selected criteria</div>'}

            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="background: #f44336; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">Print Report</button>
                <button onclick="window.close()" style="background: #666; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </body>
        </html>
    `;
}

// Generate Add Items Report
async function generateAddItemsReport(dateFrom, dateTo, workerId, category) {
    // Get company logo
    const logoHtml = await getCompanyLogoHtml();
    
    // Fetch stock items
    let query = supabaseClient
        .from('stock_items')
        .select('*')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString())
        .order('created_at', { ascending: false });
    
    if (category) {
        query = query.eq('category', category);
    }
    
    // Note: created_by filtering will work after we add the column
    if (workerId) {
        query = query.eq('created_by', workerId);
    }
    
    const { data: items, error } = await query;
    
    if (error) throw error;
    
    const filteredItems = items || [];
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>New Items Added Report - ${new Date().toLocaleDateString('en-GB')}</title>
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
                .logo-placeholder {
                    width: 150px;
                    height: 60px;
                    background: #f0f0f0;
                    border: 2px dashed #999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    color: #999;
                    font-size: 12px;
                }
                .header h1 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                }
                .summary {
                    background: #f5f5f5;
                    padding: 15px;
                    margin-bottom: 30px;
                    border-left: 4px solid #2196F3;
                }
                .summary-box {
                    padding: 10px;
                }
                .summary-box h3 {
                    margin: 0 0 5px 0;
                    font-size: 14px;
                    color: #666;
                }
                .summary-box .value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2196F3;
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
                tr:nth-child(even) {
                    background: #f9f9f9;
                }
                .no-data {
                    text-align: center;
                    padding: 40px;
                    color: #999;
                    font-style: italic;
                }
                @media print {
                    body { padding: 20px; font-size: 10px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoHtml}
                <h1>➕ NEW ITEMS ADDED REPORT</h1>
                <div>Joinery Core - Operational System</div>
                <div style="margin-top: 10px; font-size: 14px; color: #666;">
                    ${dateFrom.toLocaleDateString('en-GB')} - ${dateTo.toLocaleDateString('en-GB')}
                </div>
            </div>

            <div class="summary">
                <div class="summary-box">
                    <h3>Total New Items</h3>
                    <div class="value">${filteredItems.length}</div>
                </div>
            </div>

            ${filteredItems.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Item #</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Subcategory</th>
                            <th>Unit</th>
                            <th>Initial Qty</th>
                            <th>Cost/Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredItems.map(item => `
                            <tr>
                                <td>${new Date(item.created_at).toLocaleString('en-GB', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</td>
                                <td>${item.item_number || '-'}</td>
                                <td>${item.name}</td>
                                <td style="text-transform: uppercase;">${item.category}</td>
                                <td>${item.subcategory || '-'}</td>
                                <td>${item.unit}</td>
                                <td>${item.current_quantity || 0}</td>
                                <td>£${(item.cost_per_unit || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<div class="no-data">No new items found for selected criteria</div>'}

            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="background: #2196F3; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">Print Report</button>
                <button onclick="window.close()" style="background: #666; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </body>
        </html>
    `;
}

// ========== STOCK ORDERS ==========

let stockOrders = [];

// Load stock orders
async function loadStockOrders() {
    try {
        const { data, error } = await supabaseClient
            .from('stock_orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        stockOrders = data || [];
        
        // Calculate ordered_quantity for each stock item
        calculateOrderedQuantities();
        
    } catch (err) {
        console.error('Error loading stock orders:', err);
    }
}

// Calculate ordered quantities for stock items
function calculateOrderedQuantities() {
    stockItems.forEach(item => {
        const pendingOrders = stockOrders.filter(order => 
            order.stock_item_id === item.id && order.status === 'ordered'
        );
        item.ordered_quantity = pendingOrders.reduce((sum, order) => sum + parseFloat(order.quantity_ordered || 0), 0);
    });
}

// Open ORDER modal
function openOrderModal(itemId) {
    const item = stockItems.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('orderStockItemId').value = item.id;
    document.getElementById('orderStockItemName').value = item.name;
    document.getElementById('orderQuantity').value = '';
    document.getElementById('orderExpectedDate').value = '';
    document.getElementById('orderNotes').value = '';
    
    // Populate workers (Management and Admin only)
    const workerSelect = document.getElementById('orderWorker');
    workerSelect.innerHTML = '<option value="">-- Select who is ordering --</option>';
    teamMembers.filter(w => w.active === true && (w.department === 'management' || w.department === 'admin')).forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = worker.name;
        workerSelect.appendChild(option);
    });
    
    // Populate suppliers - only those assigned to this item
    const supplierSelect = document.getElementById('orderSupplier');
    supplierSelect.innerHTML = '<option value="">-- Select supplier --</option>';
    
    const itemSuppliers = item.supplier_ids || (item.supplier_id ? [item.supplier_id] : []);
    
    if (itemSuppliers.length === 0) {
        // No suppliers assigned - show all
        suppliers.forEach(sup => {
            const option = document.createElement('option');
            option.value = sup.id;
            option.textContent = sup.name;
            supplierSelect.appendChild(option);
        });
    } else {
        // Show only assigned suppliers
        itemSuppliers.forEach(suppId => {
            const supplier = suppliers.find(s => s.id === suppId);
            if (supplier) {
                const option = document.createElement('option');
                option.value = supplier.id;
                option.textContent = supplier.name;
                supplierSelect.appendChild(option);
            }
        });
    }
    
    document.getElementById('orderStockModal').classList.add('active');
}

// Save stock order
async function saveStockOrder() {
    const itemId = document.getElementById('orderStockItemId').value;
    const quantity = parseFloat(document.getElementById('orderQuantity').value);
    const workerId = document.getElementById('orderWorker').value;
    const supplierId = document.getElementById('orderSupplier').value;
    const expectedDate = document.getElementById('orderExpectedDate').value || null;
    const notes = document.getElementById('orderNotes').value.trim();
    
    if (!quantity || quantity <= 0) {
        showToast('Please enter valid quantity', 'warning');
        return;
    }
    
    if (!workerId) {
        showToast('Please select who is ordering', 'warning');
        return;
    }
    
    if (!supplierId) {
        showToast('Please select a supplier', 'warning');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('stock_orders')
            .insert([{
                stock_item_id: itemId,
                quantity_ordered: quantity,
                supplier_id: supplierId,
                expected_delivery_date: expectedDate,
                order_notes: notes,
                status: 'ordered',
                created_by: workerId
            }]);
        
        if (error) throw error;
        
        closeModal('orderStockModal');
        await loadStockOrders();
        renderStockTable();
        
    } catch (err) {
        console.error('Error placing order:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Open pending orders modal
async function openPendingOrdersModal(itemId) {
    const item = stockItems.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('pendingOrdersTitle').textContent = `Pending Orders: ${item.name}`;
    
    const pendingOrders = stockOrders.filter(order => 
        order.stock_item_id === itemId && order.status === 'ordered'
    );
    
    const ordersList = document.getElementById('pendingOrdersList');
    
    if (pendingOrders.length === 0) {
        ordersList.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">📦</div>
                <div>No pending orders for this item</div>
                <button onclick="openOrderModal('${itemId}')" class="toolbar-btn primary" style="margin-top: 20px;">+ Place New Order</button>
            </div>
        `;
    } else {
        ordersList.innerHTML = pendingOrders.map(order => {
            const supplier = suppliers.find(s => s.id === order.supplier_id);
            const orderDate = new Date(order.order_date).toLocaleDateString('en-GB');
            const expectedDate = order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('en-GB') : 'Not set';
            
            return `
                <div style="background: #2d2d30; padding: 15px; margin-bottom: 15px; border-radius: 5px; border-left: 4px solid #2e7d32;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: 600; font-size: 16px; color: #e8e2d5;">Order #${order.id.substring(0, 8)}</div>
                            <div style="font-size: 12px; color: #999; margin-top: 5px;">Ordered: ${orderDate}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 600; color: #2e7d32;">${order.quantity_ordered} ${item.unit}</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; padding: 10px; background: #252526; border-radius: 3px;">
                        <div>
                            <div style="font-size: 11px; color: #999;">Supplier</div>
                            <div style="font-size: 13px; color: #e8e2d5;">${supplier ? supplier.name : 'Unknown'}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #999;">Expected Delivery</div>
                            <div style="font-size: 13px; color: #e8e2d5;">${expectedDate}</div>
                        </div>
                    </div>
                    
                    ${order.order_notes ? `
                        <div style="margin: 10px 0; padding: 8px; background: #252526; border-radius: 3px;">
                            <div style="font-size: 11px; color: #999; margin-bottom: 3px;">Notes</div>
                            <div style="font-size: 12px; color: #e8e2d5;">${order.order_notes}</div>
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button onclick="showDeliveryForm('${order.id}', ${order.quantity_ordered}, ${item.cost_per_unit || 0}, '${item.unit}')" class="toolbar-btn success" style="flex: 1;">✅ Mark as Delivered</button>
                        <button onclick="cancelOrder('${order.id}')" class="toolbar-btn danger">❌ Cancel</button>
                    </div>
                    
                    <!-- Delivery form - hidden by default -->
                    <div id="deliveryForm_${order.id}" style="display: none; margin-top: 15px; padding: 15px; background: #252526; border-radius: 5px; border: 1px solid #4CAF50;">
                        <div style="font-size: 12px; color: #4CAF50; margin-bottom: 12px; font-weight: 600;">📦 Confirm Delivery</div>
                        
                        <!-- Reference from DB -->
                        <div style="background: #2d2d30; padding: 10px; border-radius: 4px; margin-bottom: 12px; border-left: 3px solid #2196F3;">
                            <div style="font-size: 11px; color: #2196F3; margin-bottom: 8px;">Reference (from DB)</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px;">
                                <div>
                                    <div style="color: #999;">Qty</div>
                                    <div style="color: #e8e2d5; font-weight: 600;">${order.quantity_ordered} ${item.unit}</div>
                                </div>
                                <div>
                                    <div style="color: #999;">Unit Cost</div>
                                    <div style="color: #e8e2d5; font-weight: 600;">£${(item.cost_per_unit || 0).toFixed(2)}</div>
                                </div>
                                <div>
                                    <div style="color: #999;">Expected Total</div>
                                    <div style="color: #e8e2d5; font-weight: 600;">£${(order.quantity_ordered * (item.cost_per_unit || 0)).toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Invoice input -->
                        <div style="margin-bottom: 12px;">
                            <label style="font-size: 12px; color: #999; display: block; margin-bottom: 5px;">Total Cost from Invoice (£)</label>
                            <input type="number" id="invoiceCost_${order.id}" step="0.01" min="0" 
                                placeholder="Enter total invoice cost" 
                                value="${(order.quantity_ordered * (item.cost_per_unit || 0)).toFixed(2)}"
                                oninput="updateDeliveryCostPreview('${order.id}', ${order.quantity_ordered}, ${item.cost_per_unit || 0})"
                                style="width: 100%; padding: 8px; background: #3e3e42; border: 1px solid #555; color: #e8e2d5; border-radius: 3px; font-size: 14px;">
                        </div>
                        
                        <!-- Calculated unit cost -->
                        <div id="costPreview_${order.id}" style="background: #2d2d30; padding: 10px; border-radius: 4px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 12px; color: #999;">New Unit Cost:</span>
                                <span id="newUnitCost_${order.id}" style="font-size: 16px; font-weight: 600; color: #4CAF50;">£${(item.cost_per_unit || 0).toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <!-- Warning -->
                        <div id="costWarning_${order.id}" style="display: none; background: #5d4037; padding: 10px; border-radius: 4px; margin-bottom: 12px; font-size: 12px; color: #ffcc80;">
                            ⚠️ <span id="costWarningText_${order.id}"></span>
                        </div>
                        
                        <!-- Buttons -->
                        <div style="display: flex; gap: 10px;">
                            <button onclick="hideDeliveryForm('${order.id}')" class="toolbar-btn" style="flex: 1;">Cancel</button>
                            <button onclick="confirmDeliveryWithCost('${order.id}')" class="toolbar-btn success" style="flex: 1;">✅ Confirm Delivery</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('') + `
            <button onclick="openOrderModal('${itemId}'); closeModal('pendingOrdersModal');" class="toolbar-btn primary" style="width: 100%; margin-top: 10px;">+ Place Another Order</button>
        `;
    }
    
    document.getElementById('pendingOrdersModal').classList.add('active');
}

// Mark order as delivered
async function markAsDelivered(orderId) {
    if (!confirm('Mark this order as delivered?\n\nThis will add the quantity to stock and create a Stock IN transaction.')) {
        return;
    }
    
    try {
        const order = stockOrders.find(o => o.id === orderId);
        if (!order) throw new Error('Order not found');
        
        const item = stockItems.find(i => i.id === order.stock_item_id);
        if (!item) throw new Error('Stock item not found');
        
        // 1. Update order status to delivered
        const { error: orderError } = await supabaseClient
            .from('stock_orders')
            .update({
                status: 'delivered',
                delivered_date: new Date().toISOString()
            })
            .eq('id', orderId);
        
        if (orderError) throw orderError;
        
        // 2. Create Stock IN transaction
        const { error: transactionError } = await supabaseClient
            .from('stock_transactions')
            .insert([{
                stock_item_id: order.stock_item_id,
                type: 'IN',
                quantity: order.quantity_ordered,
                supplier_id: order.supplier_id,
                notes: `Order delivered: ${order.order_notes || ''}`,
                created_by: 'System'
            }]);
        
        if (transactionError) throw transactionError;
        
        // 3. Update stock item quantity
        const newQty = (parseFloat(item.current_quantity) || 0) + parseFloat(order.quantity_ordered);
        
        const { error: updateError } = await supabaseClient
            .from('stock_items')
            .update({
                current_quantity: newQty,
                updated_at: new Date().toISOString()
            })
            .eq('id', order.stock_item_id);
        
        if (updateError) throw updateError;
        
        await loadStockOrders();
        await loadStockItems();
        closeModal('pendingOrdersModal');
        
    } catch (err) {
        console.error('Error marking as delivered:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Show delivery form
function showDeliveryForm(orderId, quantity, unitCost, unit) {
    // Hide all other delivery forms first
    document.querySelectorAll('[id^="deliveryForm_"]').forEach(form => {
        form.style.display = 'none';
    });
    
    // Show this form
    document.getElementById(`deliveryForm_${orderId}`).style.display = 'block';
}

// Hide delivery form
function hideDeliveryForm(orderId) {
    document.getElementById(`deliveryForm_${orderId}`).style.display = 'none';
}

// Update cost preview when user types
function updateDeliveryCostPreview(orderId, quantity, oldUnitCost) {
    const totalCost = parseFloat(document.getElementById(`invoiceCost_${orderId}`).value) || 0;
    const newUnitCost = quantity > 0 ? totalCost / quantity : 0;
    
    // Update new unit cost display
    document.getElementById(`newUnitCost_${orderId}`).textContent = `£${newUnitCost.toFixed(2)}`;
    
    // Check difference and show warning if > 20%
    const warningDiv = document.getElementById(`costWarning_${orderId}`);
    const warningText = document.getElementById(`costWarningText_${orderId}`);
    
    if (oldUnitCost > 0) {
        const difference = Math.abs((newUnitCost - oldUnitCost) / oldUnitCost) * 100;
        
        if (difference > 20) {
            warningDiv.style.display = 'block';
            const direction = newUnitCost > oldUnitCost ? 'higher' : 'lower';
            warningText.textContent = `${difference.toFixed(0)}% ${direction} than previous cost. Please verify invoice.`;
        } else {
            warningDiv.style.display = 'none';
        }
    } else {
        warningDiv.style.display = 'none';
    }
}

// Confirm delivery with cost
async function confirmDeliveryWithCost(orderId) {
    const totalCost = parseFloat(document.getElementById(`invoiceCost_${orderId}`).value) || 0;
    
    if (totalCost <= 0) {
        showToast('Please enter the invoice total cost', 'warning');
        return;
    }
    
    try {
        const order = stockOrders.find(o => o.id === orderId);
        if (!order) throw new Error('Order not found');
        
        const item = stockItems.find(i => i.id === order.stock_item_id);
        if (!item) throw new Error('Stock item not found');
        
        const newUnitCost = totalCost / order.quantity_ordered;
        
        // 1. Update order status to delivered
        const { error: orderError } = await supabaseClient
            .from('stock_orders')
            .update({
                status: 'delivered',
                delivered_date: new Date().toISOString()
            })
            .eq('id', orderId);
        
        if (orderError) throw orderError;
        
        // 2. Create Stock IN transaction
        const { error: transactionError } = await supabaseClient
            .from('stock_transactions')
            .insert([{
                stock_item_id: order.stock_item_id,
                type: 'IN',
                quantity: order.quantity_ordered,
                supplier_id: order.supplier_id,
                notes: `Order delivered. Invoice total: £${totalCost.toFixed(2)}`,
                created_by: 'System'
            }]);
        
        if (transactionError) throw transactionError;
        
        // 3. Update stock item quantity AND cost_per_unit
        const newQty = (parseFloat(item.current_quantity) || 0) + parseFloat(order.quantity_ordered);
        
        const { error: updateError } = await supabaseClient
            .from('stock_items')
            .update({
                current_quantity: newQty,
                cost_per_unit: newUnitCost,
                updated_at: new Date().toISOString()
            })
            .eq('id', order.stock_item_id);
        
        if (updateError) throw updateError;
        
        await loadStockOrders();
        await loadStockItems();
        closeModal('pendingOrdersModal');
        
    } catch (err) {
        console.error('Error confirming delivery:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Cancel order
async function cancelOrder(orderId) {
    if (!confirm('Cancel this order?')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('stock_orders')
            .update({
                status: 'cancelled'
            })
            .eq('id', orderId);
        
        if (error) throw error;
        
        await loadStockOrders();
        renderStockTable();
        closeModal('pendingOrdersModal');
        
    } catch (err) {
        console.error('Error cancelling order:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ========== SUPPLIER MANAGEMENT FOR ITEMS ==========

// Track suppliers for Add Stock Modal
let tempStockSuppliers = [];

// Add supplier to item (Add Stock Modal)
function addSupplierToItem() {
    const supplierSelect = document.getElementById('stockSupplier');
    const supplierId = supplierSelect.value;
    
    if (!supplierId) {
        showToast('Please select a supplier', 'warning');
        return;
    }
    
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    tempStockSuppliers.push({
        id: supplierId,
        name: supplier.name,
        link: ''
    });
    
    renderStockSuppliersList();
    supplierSelect.value = '';
}

// Render suppliers list (Add Stock Modal)
function renderStockSuppliersList() {
    const container = document.getElementById('stockSuppliersList');
    
    container.innerHTML = tempStockSuppliers.map((sup, index) => `
        <div style="background: #2d2d30; padding: 12px; border-radius: 5px; border-left: 3px solid #4CAF50;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-weight: 600; color: #e8e2d5;">${sup.name}</div>
                <button onclick="removeStockSupplier(${index})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">×</button>
            </div>
            <input 
                type="text" 
                placeholder="https://supplier.com/product" 
                value="${sup.link}"
                onchange="updateStockSupplierLink(${index}, this.value)"
                style="width: 100%; padding: 6px; background: #252526; border: 1px solid #555; color: #e8e2d5; border-radius: 3px; font-size: 12px;"
            >
        </div>
    `).join('');
}

// Remove supplier from list (Add Stock Modal)
function removeStockSupplier(index) {
    tempStockSuppliers.splice(index, 1);
    renderStockSuppliersList();
}

// Update supplier link (Add Stock Modal)
function updateStockSupplierLink(index, link) {
    tempStockSuppliers[index].link = link;
}

// Track suppliers for Edit Stock Modal
let tempEditStockSuppliers = [];

// Add supplier to item (Edit Stock Modal)
function addSupplierToEditItem() {
    const supplierSelect = document.getElementById('editStockSupplier');
    const supplierId = supplierSelect.value;
    
    if (!supplierId) {
        showToast('Please select a supplier', 'warning');
        return;
    }
    
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    tempEditStockSuppliers.push({
        id: supplierId,
        name: supplier.name,
        link: ''
    });
    
    renderEditStockSuppliersList();
    supplierSelect.value = '';
}

// Render suppliers list (Edit Stock Modal)
function renderEditStockSuppliersList() {
    const container = document.getElementById('editStockSuppliersList');
    
    container.innerHTML = tempEditStockSuppliers.map((sup, index) => `
        <div style="background: #2d2d30; padding: 12px; border-radius: 5px; border-left: 3px solid #4CAF50;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-weight: 600; color: #e8e2d5;">${sup.name}</div>
                <button onclick="removeEditStockSupplier(${index})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">×</button>
            </div>
            <input 
                type="text" 
                placeholder="https://supplier.com/product" 
                value="${sup.link}"
                onchange="updateEditStockSupplierLink(${index}, this.value)"
                style="width: 100%; padding: 6px; background: #252526; border: 1px solid #555; color: #e8e2d5; border-radius: 3px; font-size: 12px;"
            >
        </div>
    `).join('');
}

// Remove supplier from list (Edit Stock Modal)
function removeEditStockSupplier(index) {
    tempEditStockSuppliers.splice(index, 1);
    renderEditStockSuppliersList();
}

// Update supplier link (Edit Stock Modal)
function updateEditStockSupplierLink(index, link) {
    tempEditStockSuppliers[index].link = link;
}

// Generate Ordered Items Report
async function generateOrderedItemsReport(dateFrom, dateTo, workerId, category, orderStatus) {
    // Get company logo
    const logoHtml = await getCompanyLogoHtml();
    
    // Fetch orders
    let query = supabaseClient
        .from('stock_orders')
        .select('*, stock_items(name, category, unit, item_number), suppliers(name), created_by_member:team_members!stock_orders_created_by_fkey(name), delivered_by_member:team_members!stock_orders_delivered_by_fkey(name)')
        .gte('order_date', dateFrom.toISOString())
        .lte('order_date', dateTo.toISOString())
        .order('order_date', { ascending: false });
    
    // Filter by worker (created_by)
    if (workerId) {
        query = query.eq('created_by', workerId);
    }
    
    // Filter by status
    if (orderStatus) {
        query = query.eq('status', orderStatus);
    }
    
    const { data: orders, error } = await query;
    
    if (error) throw error;
    
    // Filter by category if needed
    let filteredOrders = orders || [];
    if (category) {
        filteredOrders = filteredOrders.filter(order => 
            order.stock_items && order.stock_items.category === category
        );
    }
    
    // Calculate totals
    const totalOrders = filteredOrders.length;
    const totalQuantity = filteredOrders.reduce((sum, order) => sum + parseFloat(order.quantity_ordered || 0), 0);
    
    // Group by status
    const pendingCount = filteredOrders.filter(o => o.status === 'ordered').length;
    const deliveredCount = filteredOrders.filter(o => o.status === 'delivered').length;
    const cancelledCount = filteredOrders.filter(o => o.status === 'cancelled').length;
    
    // Format period
    const periodText = `${dateFrom.toLocaleDateString('en-GB')} - ${dateTo.toLocaleDateString('en-GB')}`;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Materials Ordered Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #333; border-bottom: 3px solid #2e7d32; padding-bottom: 10px; }
                .summary { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px; }
                .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
                .summary-item { text-align: center; }
                .summary-value { font-size: 32px; font-weight: bold; color: #2e7d32; }
                .summary-label { font-size: 14px; color: #666; margin-top: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #2e7d32; color: white; padding: 12px; text-align: left; font-size: 12px; }
                td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 11px; }
                tr:hover { background: #f5f5f5; }
                .status-ordered { color: #ff9800; font-weight: 600; }
                .status-delivered { color: #4CAF50; font-weight: 600; }
                .status-cancelled { color: #f44336; font-weight: 600; }
                .no-data { text-align: center; padding: 40px; color: #999; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; margin-bottom: 30px;">
                ${logoHtml}
                <h1>📦 Materials Ordered Report</h1>
                <div>Joinery Core - Operational System</div>
                <div style="margin-top: 10px; font-size: 14px; color: #666;">${periodText}</div>
            </div>
            
            <div class="summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-value">${totalOrders}</div>
                        <div class="summary-label">Total Orders</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value" style="color: #ff9800;">${pendingCount}</div>
                        <div class="summary-label">Pending</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value" style="color: #4CAF50;">${deliveredCount}</div>
                        <div class="summary-label">Delivered</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value" style="color: #f44336;">${cancelledCount}</div>
                        <div class="summary-label">Cancelled</div>
                    </div>
                </div>
            </div>
            
            ${filteredOrders.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Item #</th>
                            <th>Item Name</th>
                            <th>Quantity</th>
                            <th>Supplier</th>
                            <th>Ordered By</th>
                            <th>Expected</th>
                            <th>Status</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredOrders.map(order => {
                            const orderDate = new Date(order.order_date).toLocaleDateString('en-GB');
                            const expectedDate = order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('en-GB') : '-';
                            const deliveredDate = order.delivered_date ? new Date(order.delivered_date).toLocaleDateString('en-GB') : '';
                            
                            let statusClass = 'status-ordered';
                            let statusText = 'Pending';
                            if (order.status === 'delivered') {
                                statusClass = 'status-delivered';
                                statusText = `Delivered ${deliveredDate}`;
                            } else if (order.status === 'cancelled') {
                                statusClass = 'status-cancelled';
                                statusText = 'Cancelled';
                            }
                            
                            return `
                                <tr>
                                    <td>${orderDate}</td>
                                    <td>${order.stock_items?.item_number || '-'}</td>
                                    <td>${order.stock_items?.name || 'Unknown'}</td>
                                    <td>${order.quantity_ordered} ${order.stock_items?.unit || ''}</td>
                                    <td>${order.suppliers?.name || 'Unknown'}</td>
                                    <td>${order.created_by_member?.name || '-'}</td>
                                    <td>${expectedDate}</td>
                                    <td class="${statusClass}">${statusText}</td>
                                    <td>${order.order_notes || '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            ` : '<div class="no-data">No orders found for selected criteria</div>'}

            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="background: #2196F3; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">Print Report</button>
                <button onclick="window.close()" style="background: #666; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </body>
        </html>
    `;
}

// ========== PENDING ORDERS PDF ==========
async function generatePendingOrdersPDF() {
    try {
        // Załaduj pending orders
        const { data: orders, error } = await supabaseClient
            .from('stock_orders')
            .select(`
                *,
                stock_items (
                    name,
                    item_number,
                    image_url,
                    unit
                ),
                suppliers (
                    name
                )
            `)
            .eq('status', 'ordered')
            .order('expected_delivery_date', { ascending: true });
        
        if (error) throw error;
        
        if (!orders || orders.length === 0) {
            showToast('No pending orders found!', 'info');
            return;
        }
        
        // Generuj PDF
        const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (!jsPDF) {
            showToast('PDF library not loaded. Please refresh the page.', 'warning');
            return;
        }
        const doc = new jsPDF('landscape');
        
        // Get branding and add logo
        const branding = await getPdfBranding();
        if (branding.logoBase64) {
            try {
                doc.addImage(branding.logoBase64, 'PNG', 250, 10, 25, 25);
            } catch (e) { console.warn('Could not add logo:', e); }
        }
        
        // Header
        doc.setFontSize(20);
        doc.text('Pending Orders List', 20, 20);
        
        doc.setFontSize(12);
        doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 20, 30);
        doc.text(`Total Orders: ${orders.length}`, 20, 37);
        
        // Table header
        let y = 50;
        doc.setFontSize(10);
        doc.text('Photo', 20, y);
        doc.text('Material', 50, y);
        doc.text('Supplier', 120, y);
        doc.text('Qty Ordered', 165, y);
        doc.text('Expected', 200, y);
        doc.text('Received by', 230, y);
        doc.text('✓', 270, y);
        
        y += 3;
        doc.line(20, y, 280, y);
        y += 7;
        
        doc.setFontSize(9);
        
        // Process orders
        for (const order of orders) {
            const qtyOrdered = `${order.quantity_ordered} ${order.stock_items?.unit || ''}`;
            const expectedDate = order.expected_delivery_date ? 
                new Date(order.expected_delivery_date).toLocaleDateString('en-GB') : 
                'TBD';
            
            // Add image if exists
            if (order.stock_items?.image_url) {
                try {
                    const imgData = await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.crossOrigin = 'Anonymous';
                        img.onload = function() {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/jpeg'));
                        };
                        img.onerror = () => resolve(null);
                        img.src = order.stock_items.image_url;
                    });
                    
                    if (imgData) {
                        doc.addImage(imgData, 'JPEG', 20, y - 5, 20, 20);
                    }
                } catch (err) {
                    console.error('Error loading image:', err);
                }
            }
            
            // Material name + item number
            let materialText = order.stock_items?.name || 'Unknown';
            if (order.stock_items?.item_number) {
                materialText += `\n${order.stock_items.item_number}`;
            }
            
            const lines = doc.splitTextToSize(materialText, 60);
            doc.text(lines, 50, y + 5);
            
            // Other columns
            doc.text(order.suppliers?.name || 'N/A', 120, y + 5);
            doc.text(qtyOrdered, 165, y + 5);
            doc.text(expectedDate, 200, y + 5);
            
            // Received by - empty line
            doc.line(230, y + 10, 265, y + 10);
            
            // Checkbox
            doc.rect(268, y, 8, 8);
            
            // Row height
            const rowHeight = Math.max(25, lines.length * 5 + 10);
            y += rowHeight;
            
            // Separator line
            doc.setDrawColor(200, 200, 200);
            doc.line(20, y - 2, 280, y - 2);
            doc.setDrawColor(0, 0, 0);
            
            // New page if needed
            if (y > 180) {
                doc.addPage('landscape');
                y = 20;
            }
        }
        
        // Save
        doc.save(`Pending_Orders_${new Date().toISOString().split('T')[0]}.pdf`);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ========== PERMISSIONS: READ-ONLY FOR MANAGER/WORKER ==========
window.addEventListener("permissionsLoaded", function() {
    if (!window.currentUserRole) return;
    
    
    // Manager/Worker/Viewer = read-only mode  
    if (window.currentUserRole === "manager" || window.currentUserRole === "worker" || window.currentUserRole === "viewer") {
        // Hide action buttons
        const buttonsToHide = [
            "button[onclick*=\"openAddItemModal\"]",
            "button[onclick*=\"openAddSupplierModal\"]",
            "button[onclick*=\"openAddCategoryModal\"]", 
            "button[onclick*=\"openAddSubcategoryModal\"]",
            "button[onclick*=\"openOrderModal\"]",
            ".action-btn.edit",
            ".action-btn.delete"
        ];
        
        buttonsToHide.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => btn.style.display = "none");
        });
        
    }
});