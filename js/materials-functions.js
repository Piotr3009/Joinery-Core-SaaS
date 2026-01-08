// ========== MATERIALS LIST FUNCTIONS ==========

// Globalna zmienna dla aktualnego projektu
let currentMaterialsProject = null;

// Zmienne dla trybu edycji
let editingMaterialId = null;
let editingMaterialOriginal = null;

// Funkcja do przejścia do Stock Item
window.goToStockItem = function(stockItemId) {
    if (!stockItemId) {
        showToast('This is a bespoke item - not linked to stock', 'info');
        return;
    }
    // Zamknij modal materials
    document.getElementById('materialsModal').classList.remove('active');
    // Przejdź do stock.html z parametrem highlight
    window.location.href = `stock.html?highlight=${stockItemId}`;
};

// Otwórz Materials List Modal
async function openMaterialsList(projectIndex) {
    const project = projects[projectIndex];
    currentMaterialsProject = project;
    
    // Update header info
    document.getElementById('materialsProjectInfo').textContent = 
        `Project: ${project.projectNumber} | ${project.name} | Client: ${project.client_name || 'N/A'}`;
    
    // Załaduj dane
    await loadProjectMaterials(project.id);
    
    // Pokaż modal
    document.getElementById('materialsModal').classList.add('active');
}

// Załaduj materiały projektu
async function loadProjectMaterials(projectId) {
    try {
        const { data, error } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items (
                    id,
                    name,
                    item_number,
                    size,
                    thickness,
                    image_url,
                    current_quantity,
                    reserved_quantity,
                    unit,
                    cost_per_unit
                ),
                stock_categories!category_id (
                    id,
                    name
                ),
                suppliers (
                    id,
                    name
                )
            `)
            .eq('project_id', projectId)
            .order('used_in_stage', { ascending: true })
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // Renderuj materials list
        renderMaterialsList(data);
        
    } catch (error) {
        console.error('Error loading materials:', error);
        showToast('Error loading: ' + error.message, 'error');
    }
}

// Renderuj Materials List
function renderMaterialsList(materials) {
    const body = document.getElementById('materialsModalBody');
    
    if (!materials || materials.length === 0) {
        body.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #888;">
                <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                <p style="font-size: 16px; margin-bottom: 20px;">No materials added yet for this project.</p>
                <button class="modal-btn primary" onclick="showAddMaterialModal()">+ Add First Material</button>
            </div>
        `;
        return;
    }
    
    // Grupuj po stage
    const grouped = {
        'Production': [],
        'Spraying': [],
        'Installation': []
    };
    
    materials.forEach(m => {
        if (grouped[m.used_in_stage]) {
            grouped[m.used_in_stage].push(m);
        }
    });
    
    // Render stages
    let html = '';
    
    Object.keys(grouped).forEach(stage => {
        if (grouped[stage].length === 0) return;
        
        const stageIcon = {
            'Production': '📦',
            'Spraying': '🎨',
            'Installation': '🔧'
        }[stage];
        
        const stageClass = stage.toLowerCase();
        
        html += `
            <div class="materials-stage-section ${stageClass}">
                <div class="materials-stage-header">
                    <div class="materials-stage-title">
                        <span>${stageIcon}</span>
                        ${stage.toUpperCase()} STAGE
                    </div>
                </div>
                <table class="materials-table">
                    <thead>
                        <tr>
                            <th style="width: 25%;">Material</th>
                            <th style="width: 80px;">Item #</th>
                            <th style="width: 120px;">Size / Thickness</th>
                            <th>Reserved</th>
                            <th>Stock Left</th>
                            <th>Unit Cost</th>
                            <th>Total Cost</th>
                            <th>Status</th>
                            <th style="width: 100px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grouped[stage].map(m => renderMaterialRow(m)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });
    
    // Summary
    const summary = calculateMaterialsSummary(materials);
    html += renderMaterialsSummary(summary);
    
    body.innerHTML = html;
}

// Renderuj pojedynczy wiersz materiału
function renderMaterialRow(material) {
    const stockItem = material.stock_items;
    
    // RESERVED - dla bespoke to quantity_needed, dla stock to quantity_reserved
    const reserved = material.is_bespoke ? (material.quantity_needed || 0) : (material.quantity_reserved || 0);
    
    // STOCK LEFT - ile AVAILABLE na magazynie (current_quantity - reserved_quantity)
    // To jest to samo co AVAILABLE w Stock App
    const stockLeft = material.is_bespoke ? 0 : 
        (stockItem ? ((stockItem.current_quantity || 0) - (stockItem.reserved_quantity || 0)) : 0);
    
    // TO ORDER - ile trzeba zamówić
    // TO ORDER = max(0, RESERVED - STOCK LEFT)
    // Jeśli zarezerwowano więcej niż jest na stocku, trzeba zamówić różnicę
    const toOrder = material.is_bespoke ? 0 : Math.max(0, reserved - stockLeft);
    
    const totalCost = reserved * (material.unit_cost || 0);
    
    // Status
    let statusBadge = '';
    if (material.usage_recorded) {
        statusBadge = `<span class="material-status-badge status-used">✅ Used</span>`;
    } else if (material.is_bespoke) {
        statusBadge = `<span class="material-status-badge status-bespoke">🛒 Bespoke</span>`;
    } else if (stockLeft < 0) {
        statusBadge = `<span class="material-status-badge status-warning">⚠️ Order Needed</span>`;
    } else if (reserved > 0) {
        statusBadge = `<span class="material-status-badge status-reserved">🔒 Reserved</span>`;
    } else {
        statusBadge = `<span class="material-status-badge status-ok">✅ In Stock</span>`;
    }
    
    return `
        <tr>
            <td>
                <div class="material-item-cell">
                    ${stockItem?.image_url ? 
                        `<img src="${stockItem.image_url}" class="material-image clickable-material" onclick="goToStockItem('${material.stock_item_id}')" title="Click to view in Stock" alt="${material.item_name}">` :
                        (material.image_url ? 
                            `<img src="${material.image_url}" class="material-image clickable-material" onclick="goToStockItem('${material.stock_item_id}')" title="Click to view in Stock" alt="${material.item_name}">` :
                            `<div class="material-image-placeholder">📦</div>`)
                    }
                    <div>
                        <div class="material-name ${material.stock_item_id ? 'clickable-material' : ''}" ${material.stock_item_id ? `onclick="goToStockItem('${material.stock_item_id}')" title="Click to view in Stock"` : ''}>${material.item_name}</div>
                        <div class="material-category">${material.stock_categories?.name || 'N/A'}</div>
                        ${material.item_notes ? `<div class="material-notes-display">📝 ${material.item_notes}</div>` : ''}
                        <div style="margin-top: 4px;">
                            <input type="text" 
                                   id="notes-${material.id}" 
                                   value="${material.item_notes || ''}" 
                                   placeholder="Add notes..."
                                   onchange="updateMaterialNotes('${material.id}', this.value)"
                                   style="width: 100%; padding: 4px 8px; border: 1px solid #404040; background: #252525; color: #e0e0e0; border-radius: 4px; font-size: 12px;">
                        </div>
                    </div>
                </div>
            </td>
            <td style="font-size: 11px; color: #999;">${stockItem?.item_number || (material.is_bespoke ? 'BESPOKE' : '-')}</td>
            <td style="font-size: 11px; color: #999;">
                ${stockItem ? 
                    `${stockItem.size || '-'}${stockItem.thickness ? ' / ' + stockItem.thickness : ''}` : 
                    (material.is_bespoke ? '-' : '-')
                }
            </td>
            <td class="material-quantity">${reserved.toFixed(2)} ${material.unit}</td>
            <td class="material-quantity">
                ${material.is_bespoke ? '-' : `
                    <span style="color: ${stockLeft < 0 ? '#ef4444' : '#e0e0e0'}; font-weight: ${stockLeft < 0 ? '600' : 'normal'};">
                        ${stockLeft.toFixed(2)} ${material.unit}
                    </span>
                    ${stockLeft < 0 ? '<div style="font-size: 10px; color: #ef4444;">❌ NEGATIVE</div>' : ''}
                `}
            </td>
            <td class="material-cost">£${(material.unit_cost || 0).toFixed(2)}</td>
            <td class="material-cost">£${totalCost.toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${!material.usage_recorded && stockLeft < 0 ? `
                        <button class="icon-btn" disabled title="Cannot mark as used - material needs to be ordered first" style="background: #444; color: #666; font-size: 11px; padding: 4px 8px; cursor: not-allowed;">✅ Mark as Used</button>
                    ` : ''}
                    ${!material.usage_recorded && stockLeft >= 0 && (material.is_bespoke || reserved > 0) ? `
                        <button class="icon-btn" onclick="showRecordUsageModal('${material.id}')" title="Mark as Used" style="background: #10b981; font-size: 11px; padding: 4px 8px;">✅ Mark as Used</button>
                    ` : ''}
                    ${!material.usage_recorded && !material.is_bespoke && reserved === 0 && toOrder === 0 ? `
                        <button class="icon-btn" disabled title="Cannot mark as used - nothing reserved from stock" style="background: #444; color: #666; font-size: 11px; padding: 4px 8px; cursor: not-allowed;">✅ Mark as Used</button>
                    ` : ''}
                    ${!material.usage_recorded ? `
                        <button class="icon-btn" onclick="editMaterial('${material.id}')" title="Edit">✏️</button>
                        <button class="icon-btn" onclick="deleteMaterial('${material.id}')" title="Delete">🗑️</button>
                    ` : `
                        <span style="font-size: 11px; color: #666; padding: 4px;">🔒 Locked</span>
                    `}
                </div>
            </td>
        </tr>
    `;
}

// Oblicz summary
function calculateMaterialsSummary(materials) {
    let totalItems = materials.length;
    let itemsToOrder = 0;
    let bespokeItems = 0;
    let estimatedCost = 0;
    
    materials.forEach(m => {
        // TO ORDER = max(0, RESERVED - STOCK LEFT)
        // STOCK LEFT = AVAILABLE = current - reserved (dla całego magazynu, nie tylko ten projekt)
        const reserved = m.is_bespoke ? (m.quantity_needed || 0) : (m.quantity_reserved || 0);
        const stockLeft = m.is_bespoke ? 0 : 
            (m.stock_items ? ((m.stock_items.current_quantity || 0) - (m.stock_items.reserved_quantity || 0)) : 0);
        const toOrder = Math.max(0, reserved - stockLeft);
        
        if (toOrder > 0) itemsToOrder++;
        if (m.is_bespoke) bespokeItems++;
        estimatedCost += m.quantity_needed * (m.unit_cost || 0);
    });
    
    return { totalItems, itemsToOrder, bespokeItems, estimatedCost };
}

// Renderuj summary
function renderMaterialsSummary(summary) {
    return `
        <div class="materials-summary">
            <div class="materials-summary-grid">
                <div class="materials-summary-item">
                    <div class="materials-summary-label">Total Materials</div>
                    <div class="materials-summary-value">${summary.totalItems}</div>
                </div>
                <div class="materials-summary-item">
                    <div class="materials-summary-label">Items to Order</div>
                    <div class="materials-summary-value ${summary.itemsToOrder > 0 ? 'warning' : ''}">${summary.itemsToOrder}</div>
                </div>
                <div class="materials-summary-item">
                    <div class="materials-summary-label">Bespoke Items</div>
                    <div class="materials-summary-value">${summary.bespokeItems}</div>
                </div>
                <div class="materials-summary-item">
                    <div class="materials-summary-label">Estimated Total Cost</div>
                    <div class="materials-summary-value">£${summary.estimatedCost.toFixed(2)}</div>
                </div>
            </div>
        </div>
    `;
}

// Zamknij modal
function closeMaterialsModal() {
    document.getElementById('materialsModal').classList.remove('active');
    // NIE zeruj currentMaterialsProject - potrzebne dla Record Usage Modal
    // currentMaterialsProject = null;
}

// Placeholder functions (do implementacji później)
async function showAddMaterialModal() {
    // Załaduj dane
    await loadCategoriesAndItems();
    await loadSuppliers();
    
    // Reset form
    resetAddMaterialForm();
    
    // Pokaż modal
    document.getElementById('addMaterialModal').classList.add('active');
}

// Zamknij modal
function closeAddMaterialModal() {
    document.getElementById('addMaterialModal').classList.remove('active');
    resetAddMaterialForm();
    
    // Ukryj sekcję info
    document.getElementById('editMaterialInfo').style.display = 'none';
    
    // Reset edit mode
    editingMaterialId = null;
    editingMaterialOriginal = null;
    
    // Przywróć oryginalny tytuł i przycisk
    document.querySelector('#addMaterialModal .modal-header h2').textContent = 'Add Material';
    document.querySelector('#addMaterialModal .modal-footer .primary').textContent = 'Add Material';
    document.querySelector('#addMaterialModal .modal-footer .primary').onclick = saveMaterial;
    
    // Odblokuj pola stock item (na wypadek edycji)
    document.getElementById('addMaterialCategory').disabled = false;
    document.getElementById('addMaterialSubcategory').disabled = false;
    document.getElementById('addMaterialStockItem').disabled = false;
}

// Reset formularza
function resetAddMaterialForm() {
    document.getElementById('addMaterialStage').value = '';
    document.querySelectorAll('input[name="materialType"]')[0].checked = true;
    document.getElementById('addMaterialCategory').value = '';
    document.getElementById('addMaterialSubcategory').value = '';
    document.getElementById('addMaterialStockItem').value = '';
    document.getElementById('bespokeItemName').value = '';
    document.getElementById('bespokeMaterialCategory').value = '';
    document.getElementById('bespokeDescription').value = '';
    document.getElementById('bespokeSupplier').value = '';
    document.getElementById('bespokePurchaseLink').value = '';
    document.getElementById('bespokeUnitCost').value = '';
    document.getElementById('bespokeImageUpload').value = '';
    document.getElementById('bespokeImagePreview').style.display = 'none';
    document.getElementById('addMaterialQuantity').value = '';
    document.getElementById('addMaterialUnit').value = '';
    document.getElementById('addMaterialNotes').value = '';
    
    document.getElementById('stockItemSection').style.display = 'block';
    document.getElementById('bespokeItemSection').style.display = 'none';
    document.getElementById('subcategoryGroup').style.display = 'none';
    document.getElementById('stockItemGroup').style.display = 'none';
    document.getElementById('stockItemInfo').style.display = 'none';
    
    selectedStockItem = null;
}

// Załaduj categories i stock items
async function loadCategoriesAndItems() {
    try {
        // Load categories
        const { data: cats, error: catsError } = await supabaseClient
            .from('stock_categories')
            .select('*')
            .order('name');
        
        if (catsError) throw catsError;
        stockCategories = cats || [];
        
        // Load stock items
        const { data: items, error: itemsError } = await supabaseClient
            .from('stock_items')
            .select('*')
            .order('name');
        
        if (itemsError) throw itemsError;
        stockItems = items || [];
        
        // Populate category dropdowns
        populateCategoryDropdowns();
        
    } catch (error) {
        console.error('Error loading categories and items:', error);
        showToast('Error loading: ' + error.message, 'error');
    }
}

// Załaduj suppliers
async function loadSuppliers() {
    try {
        const { data, error } = await supabaseClient
            .from('suppliers')
            .select('*')
            .order('name');
        
        if (error) throw error;
        suppliers = data || [];
        
        // Populate supplier dropdown
        const supplierSelect = document.getElementById('bespokeSupplier');
        supplierSelect.innerHTML = '<option value="">-- Select Supplier --</option>';
        suppliers.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = s.name;
            supplierSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

// Populate category dropdowns
function populateCategoryDropdowns() {
    const mainCategories = stockCategories.filter(c => c.type === 'category');
    
    // Stock category dropdown
    const categorySelect = document.getElementById('addMaterialCategory');
    categorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    mainCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
    
    
    // Bespoke category dropdown
    const bespokeCategorySelect = document.getElementById('bespokeMaterialCategory');
    bespokeCategorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    mainCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        bespokeCategorySelect.appendChild(option);
    });
    
}

// Stage change
function onStageChange() {
    // Możesz tu dodać logikę filtrowania categorii per stage jeśli potrzebne
}

// Material type change (Stock vs Bespoke)
function onMaterialTypeChange() {
    const type = document.querySelector('input[name="materialType"]:checked').value;
    
    if (type === 'stock') {
        document.getElementById('stockItemSection').style.display = 'block';
        document.getElementById('bespokeItemSection').style.display = 'none';
    } else {
        document.getElementById('stockItemSection').style.display = 'none';
        document.getElementById('bespokeItemSection').style.display = 'block';
    }
}

// Category change
function onCategoryChange() {
    const categoryId = document.getElementById('addMaterialCategory').value;
    
    if (!categoryId) {
        document.getElementById('subcategoryGroup').style.display = 'none';
        document.getElementById('stockItemGroup').style.display = 'none';
        return;
    }
    
    // Znajdź subcategories dla tej kategorii
    const subcats = stockCategories.filter(c => 
        c.type === 'subcategory' && c.parent_category_id === categoryId
    );
    
    if (subcats.length > 0) {
        // Pokaż subcategory dropdown
        const subcatSelect = document.getElementById('addMaterialSubcategory');
        subcatSelect.innerHTML = '<option value="">-- All (no filter) --</option>';
        subcats.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.id;
            option.textContent = sub.name;
            subcatSelect.appendChild(option);
        });
        document.getElementById('subcategoryGroup').style.display = 'block';
        
        // Pokaż OD RAZU wszystkie items z tej kategorii (bez filtra subcategory)
        populateStockItems(categoryId, null);
    } else {
        // Nie ma subcategorii - pokaż od razu items
        document.getElementById('subcategoryGroup').style.display = 'none';
        populateStockItems(categoryId, null);
    }
}

// Subcategory change
function onSubcategoryChange() {
    const categoryId = document.getElementById('addMaterialCategory').value;
    const subcategoryId = document.getElementById('addMaterialSubcategory').value;
    
    if (subcategoryId) {
        populateStockItems(categoryId, subcategoryId);
    }
}

// Populate stock items dropdown
function populateStockItems(categoryId, subcategoryId) {
    const category = stockCategories.find(c => c.id === categoryId);
    
    // Filtruj items po category name
    let filteredItems = stockItems.filter(item => {
        if (!item.category) return false;
        const match = item.category.toLowerCase() === category.name.toLowerCase();
        return match;
    });
    
    
    // Jeśli jest subcategory - dodatkowy filtr
    if (subcategoryId) {
        const subcategory = stockCategories.find(c => c.id === subcategoryId);
        
        filteredItems = filteredItems.filter(item => {
            if (!item.subcategory) return false;
            const match = item.subcategory.toLowerCase() === subcategory.name.toLowerCase();
            if (match) {
            }
            return match;
        });
        
    }
    
    const itemSelect = document.getElementById('addMaterialStockItem');
    itemSelect.innerHTML = '<option value="">-- Select Item --</option>';
    
    if (filteredItems.length === 0) {
        console.warn('⚠️ No items found for this category/subcategory combination');
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- No items available --';
        option.disabled = true;
        itemSelect.appendChild(option);
    } else {
        filteredItems.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            
            // Format: ITEM# | NAME - SIZE - COLOR | THICKNESS | QTY: X
            let text = item.item_number || 'N/A';
            text += ` | ${item.name}`;
            if (item.size) text += ` - ${item.size}`;
            if (item.color) text += ` - ${item.color}`;
            if (item.thickness) text += ` | ${item.thickness}${item.thickness.match(/mm|cm|m/) ? '' : 'mm'}`;
            text += ` | Qty: ${item.current_quantity || 0}`;
            
            option.textContent = text;
            itemSelect.appendChild(option);
        });
    }
    
    document.getElementById('stockItemGroup').style.display = 'block';
}

// Stock item change
function onStockItemChange() {
    const itemId = document.getElementById('addMaterialStockItem').value;
    
    if (!itemId) {
        document.getElementById('stockItemInfo').style.display = 'none';
        selectedStockItem = null;
        return;
    }
    
    selectedStockItem = stockItems.find(i => i.id === itemId);
    
    if (selectedStockItem) {
        // Oblicz AVAILABLE = current_quantity - reserved_quantity
        const available = (selectedStockItem.current_quantity || 0) - (selectedStockItem.reserved_quantity || 0);
        
        // Pokaż info o item
        document.getElementById('itemInStock').textContent = 
            `${available.toFixed(2)} ${selectedStockItem.unit}`;
        document.getElementById('itemUnit').textContent = selectedStockItem.unit;
        document.getElementById('itemCost').textContent = 
            `£${(selectedStockItem.cost_per_unit || 0).toFixed(2)}`;
        document.getElementById('stockItemInfo').style.display = 'block';
        
        // Auto-fill unit
        document.getElementById('addMaterialUnit').value = selectedStockItem.unit;
    }
}

// Save material
async function saveMaterial() {
    try {
        // Validation
        const stage = document.getElementById('addMaterialStage').value;
        const quantity = parseFloat(document.getElementById('addMaterialQuantity').value);
        const unit = document.getElementById('addMaterialUnit').value.trim();
        
        if (!stage) {
            showToast('Please select a stage', 'warning');
            return;
        }
        
        if (!quantity || quantity <= 0) {
            showToast('Please enter a valid quantity', 'warning');
            return;
        }
        
        if (!unit) {
            showToast('Please enter a unit', 'warning');
            return;
        }
        
        const materialType = document.querySelector('input[name="materialType"]:checked').value;
        let materialData = {
            project_id: currentMaterialsProject.id,
            used_in_stage: stage,
            quantity_needed: quantity,
            unit: unit,
            item_notes: document.getElementById('addMaterialNotes').value.trim() || null,
            quantity_reserved: 0,
            quantity_used: 0,
            quantity_wasted: 0,
            usage_recorded: false
        };
        
        if (materialType === 'stock') {
            // Stock item
            if (!selectedStockItem) {
                showToast('Please select a stock item', 'warning');
                return;
            }
            
            materialData.stock_item_id = selectedStockItem.id;
            materialData.item_name = selectedStockItem.name;
            materialData.unit_cost = selectedStockItem.cost_per_unit;
            materialData.is_bespoke = false;
            
            const categoryId = document.getElementById('addMaterialCategory').value;
            const subcategoryId = document.getElementById('addMaterialSubcategory').value;
            materialData.category_id = categoryId || null;
            materialData.subcategory_id = subcategoryId || null;
            
        } else {
            // Bespoke item
            const bespokeName = document.getElementById('bespokeItemName').value.trim();
            const bespokeCategory = document.getElementById('bespokeMaterialCategory').value;
            const bespokeUnitCost = parseFloat(document.getElementById('bespokeUnitCost').value);
            const bespokeImageFile = document.getElementById('bespokeImageUpload').files[0];
            
            if (!bespokeName) {
                showToast('Please enter item name', 'warning');
                return;
            }
            
            if (!bespokeCategory) {
                showToast('Please select a category', 'warning');
                return;
            }
            
            if (!bespokeUnitCost || bespokeUnitCost < 0) {
                showToast('Please enter a valid unit cost', 'warning');
                return;
            }
            
            // Upload obrazka jeśli jest
            let imageUrl = null;
            if (bespokeImageFile) {
                try {
                    imageUrl = await uploadBespokeImage(bespokeImageFile);
                } catch (uploadError) {
                    console.error('Error uploading image:', uploadError);
                    showToast('Warning: Image upload failed, but material will be saved without image.', 'error');
                }
            }
            
            materialData.stock_item_id = null;
            materialData.item_name = bespokeName;
            materialData.unit_cost = bespokeUnitCost;
            materialData.is_bespoke = true;
            materialData.category_id = bespokeCategory;
            materialData.subcategory_id = null;
            materialData.bespoke_description = document.getElementById('bespokeDescription').value.trim() || null;
            materialData.supplier_id = document.getElementById('bespokeSupplier').value || null;
            materialData.purchase_link = document.getElementById('bespokePurchaseLink').value.trim() || null;
            materialData.image_url = imageUrl;
        }
        
        // Save to database
        const { data: newMaterial, error: insertError } = await supabaseClient
            .from('project_materials')
            .insert(materialData)
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        // Jeśli to stock item - OD RAZU odejmij ze stocku i oznacz jako reserved
        if (materialType === 'stock' && selectedStockItem) {
            // Pobierz AKTUALNY stan stocku z bazy (selectedStockItem może mieć stare dane)
            const { data: freshStock, error: fetchError } = await supabaseClient
                .from('stock_items')
                .select('current_quantity, reserved_quantity')
                .eq('id', selectedStockItem.id)
                .single();
            
            if (fetchError) throw fetchError;
            
            const availableStock = freshStock.current_quantity || 0;
            // NOWA LOGIKA: Zawsze rezerwuj całą quantity_needed, niezależnie od dostępności
            const toReserve = quantity;
            
            // Dodaj transakcję OUT (od razu zabieramy ze stocku lub rezerwujemy na minus)
            const { error: reserveError } = await supabaseClient
                .from('stock_transactions')
                .insert({
                    stock_item_id: selectedStockItem.id,
                    type: 'OUT',
                    quantity: toReserve,
                    project_id: currentMaterialsProject.id,
                    project_material_id: newMaterial.id,
                    notes: `Reserved for ${currentMaterialsProject.projectNumber} - ${stage}`
                });
            
            if (reserveError) throw reserveError;
            
            // Update quantity_reserved w project_materials (ile zarezerwowaliśmy)
            await supabaseClient
                .from('project_materials')
                .update({ quantity_reserved: toReserve })
                .eq('id', newMaterial.id);
            
            // Rezerwacja NIE zmienia current_quantity (fizyczny stock)
            // Tylko zwiększa reserved_quantity
            const currentReserved = freshStock.reserved_quantity || 0;
            
            await supabaseClient
                .from('stock_items')
                .update({ 
                    reserved_quantity: Math.round((currentReserved + toReserve) * 100) / 100
                })
                .eq('id', selectedStockItem.id);
        }
        
        showToast('Material added successfully!', 'success');
        closeAddMaterialModal();
        
        // Reload materials list
        await loadProjectMaterials(currentMaterialsProject.id);
        
    } catch (error) {
        console.error('Error saving material:', error);
        showToast('Error saving: ' + error.message, 'error');
    }
}

// ========== UPDATE MATERIAL NOTES ==========
async function updateMaterialNotes(materialId, notes) {
    try {
        const { error } = await supabaseClient
            .from('project_materials')
            .update({ item_notes: notes.trim() || null })
            .eq('id', materialId);
        
        if (error) throw error;
        
        
    } catch (error) {
        console.error('Error updating notes:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ========== SHOW RECORD USAGE MODAL ==========
let currentRecordingMaterial = null;

async function showRecordUsageModal(materialId) {
    try {
        // Załaduj material z bazy
        const { data, error } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items (
                    id,
                    name,
                    current_quantity,
                    unit
                )
            `)
            .eq('id', materialId)
            .single();
        
        if (error) throw error;
        
        currentRecordingMaterial = data;
        
        // Check if modal elements exist
        const nameEl = document.getElementById('recordMaterialName');
        const neededEl = document.getElementById('recordQuantityNeeded');
        const reservedEl = document.getElementById('recordQuantityReserved');
        const usedEl = document.getElementById('recordQuantityUsed');
        const wasteEl = document.getElementById('recordWasteReason');
        
        if (!nameEl || !neededEl || !reservedEl || !usedEl || !wasteEl) {
            console.error('Record usage modal elements not found in DOM');
            showToast('Error: Modal not loaded properly', 'error');
            return;
        }
        
        // Wypełnij modal
        nameEl.textContent = data.item_name;
        neededEl.textContent = `${data.quantity_needed} ${data.unit}`;
        reservedEl.textContent = `${data.quantity_reserved} ${data.unit}`;
        usedEl.value = data.quantity_needed;
        wasteEl.value = '';
        
        // Pokaż modal
        document.getElementById('recordUsageModal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading material:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

function closeRecordUsageModal() {
    document.getElementById('recordUsageModal').classList.remove('active');
    currentRecordingMaterial = null;
}

// ========== SAVE MATERIAL USAGE ==========
async function saveMaterialUsage() {
    try {
        const quantityUsed = parseFloat(document.getElementById('recordQuantityUsed').value);
        const wasteReason = document.getElementById('recordWasteReason').value.trim();
        
        if (!quantityUsed || quantityUsed <= 0) {
            showToast('Please enter quantity used', 'warning');
            return;
        }
        
        const material = currentRecordingMaterial;
        const quantityReserved = material.quantity_reserved || 0;
        
        // WALIDACJA: Dla STOCK items - sprawdź czy zarezerwowano
        // Dla BESPOKE - pomiń (nie ma w stocku)
        if (!material.is_bespoke && quantityReserved === 0) {
            showToast('Cannot mark as used!\n\nThis material has NOT been reserved from stock (quantity reserved = 0).\n\nYou must first:\n1. Order this material\n2. Receive it into stock\n3. Material will be automatically reserved\n\nThen you can mark as used.', 'error');
            return;
        }
        
        // Dla STOCK items: Sprawdź czy nie używasz więcej niż zarezerwowano
        if (!material.is_bespoke && quantityUsed > quantityReserved) {
            const difference = quantityUsed - quantityReserved;
            if (!confirm(`⚠️ WARNING!\n\nYou are recording ${quantityUsed} ${material.unit} used, but only ${quantityReserved} ${material.unit} was reserved.\n\nThis will create a negative adjustment of ${difference.toFixed(2)} ${material.unit} in stock.\n\nDo you want to continue?`)) {
                return;
            }
        }
        
        const difference = quantityUsed - quantityReserved; // + jeśli użyto więcej, - jeśli mniej
        
        // Update project_materials
        const { error: updateError } = await supabaseClient
            .from('project_materials')
            .update({
                quantity_used: quantityUsed,
                quantity_wasted: Math.max(0, quantityUsed - material.quantity_needed),
                waste_reason: wasteReason || null,
                usage_recorded: true,
                quantity_reserved: 0 // już wykorzystane, zerujemy rezerwację
            })
            .eq('id', material.id);
        
        if (updateError) throw updateError;
        
        // Jeśli to stock item - zmniejsz reserved_quantity i odejmij użytą ilość
        if (material.stock_item_id) {
            // Pobierz aktualny stan stocku
            const { data: currentStock, error: fetchError } = await supabaseClient
                .from('stock_items')
                .select('current_quantity, reserved_quantity')
                .eq('id', material.stock_item_id)
                .single();
            
            if (fetchError) throw fetchError;
            
            // 1. Zmniejsz reserved_quantity (bo już wykorzystane)
            const newReserved = Math.max(0, Math.round(((currentStock.reserved_quantity || 0) - quantityReserved) * 100) / 100);
            
            // 2. Odejmij użytą ilość od current_quantity (fizycznie zużyto materiał)
            let newQuantity = Math.round(((currentStock.current_quantity || 0) - quantityUsed) * 100) / 100;
            
            // 3. Jeśli użyto WIĘCEJ niż zarezerwowano - dodaj transakcję adjustment
            if (difference > 0) {
                const { error: txError } = await supabaseClient
                    .from('stock_transactions')
                    .insert({
                        stock_item_id: material.stock_item_id,
                        type: 'OUT',
                        quantity: difference,
                        project_id: currentMaterialsProject.id,
                        project_material_id: material.id,
                        notes: `Additional ${difference} used in ${currentMaterialsProject.projectNumber}${wasteReason ? ' - ' + wasteReason : ''}`
                    });
                
                if (txError) throw txError;
            }
            // 4. Jeśli użyto MNIEJ niż zarezerwowano - zwróć nadmiar
            else if (difference < 0) {
                const returned = Math.abs(difference);
                const { error: txError } = await supabaseClient
                    .from('stock_transactions')
                    .insert({
                        stock_item_id: material.stock_item_id,
                        type: 'IN',
                        quantity: returned,
                        project_id: currentMaterialsProject.id,
                        project_material_id: material.id,
                        notes: `Returned ${returned} from ${currentMaterialsProject.projectNumber} (used less than reserved)`
                    });
                
                if (txError) throw txError;
                
                // Dodaj zwrot do stocku
                newQuantity = Math.round((newQuantity + returned) * 100) / 100;
            }
            
            // Update stock_items
            const { error: stockError } = await supabaseClient
                .from('stock_items')
                .update({ 
                    current_quantity: Math.round(Math.max(0, newQuantity) * 100) / 100,
                    reserved_quantity: Math.round(newReserved * 100) / 100
                })
                .eq('id', material.stock_item_id);
            
            if (stockError) throw stockError;
        }
        
        showToast('Material usage recorded successfully!', 'success');
        closeRecordUsageModal();
        
        // Reload materials
        await loadProjectMaterials(currentMaterialsProject.id);
        
    } catch (error) {
        console.error('Error recording usage:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ========== EXPORT SHOPPING LIST PDF ==========
async function exportShoppingListPDF() {
    try {
        // Załaduj materiały
        const { data: materials, error } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items (
                    current_quantity,
                    reserved_quantity,
                    unit,
                    image_url,
                    size,
                    thickness
                ),
                suppliers (
                    name
                )
            `)
            .eq('project_id', currentMaterialsProject.id)
            .order('used_in_stage', { ascending: true })
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (materials.length === 0) {
            showToast('No materials added yet!', 'success');
            return;
        }
        
        // Grupuj po stage
        const grouped = {
            'Production': [],
            'Spraying': [],
            'Installation': []
        };
        
        materials.forEach(m => {
            if (grouped[m.used_in_stage]) {
                grouped[m.used_in_stage].push(m);
            }
        });
        
        // Generuj PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        
        // Header
        doc.setFontSize(20);
        doc.text('Materials List', 20, 20);
        
        doc.setFontSize(12);
        doc.text(`Project: ${currentMaterialsProject.projectNumber} - ${currentMaterialsProject.name}`, 20, 30);
        doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 20, 37);
        
        let y = 50;
        
        // Process each stage
        for (const [stage, stageMaterials] of Object.entries(grouped)) {
            if (stageMaterials.length === 0) continue;
            
            // Stage header
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`${stage.toUpperCase()} STAGE`, 20, y);
            y += 8;
            
            // Table header
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('Photo', 20, y);
            doc.text('Material', 50, y);
            doc.text('Reserved', 150, y);
            doc.text('Stock Left', 180, y);
            doc.text('Notes', 215, y);
            doc.text('✓', 270, y);
            
            y += 3;
            doc.line(20, y, 280, y);
            y += 7;
            
            doc.setFontSize(9);
            
            // Process materials for this stage
            for (const m of stageMaterials) {
                // RESERVED - dla bespoke to quantity_needed, dla stock to quantity_reserved
                const reserved = m.is_bespoke ? (m.quantity_needed || 0) : (m.quantity_reserved || 0);
                
                // STOCK LEFT - AVAILABLE (current - reserved z całego magazynu)
                const stockLeft = m.is_bespoke ? 0 : 
                    (m.stock_items ? ((m.stock_items.current_quantity || 0) - (m.stock_items.reserved_quantity || 0)) : 0);
                
                const reservedStr = reserved.toFixed(2);
                const stockLeftStr = m.is_bespoke ? '-' : stockLeft.toFixed(2);
                
                // Add image if exists
                const imageUrl = m.stock_items?.image_url || m.image_url;
                if (imageUrl) {
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
                            img.src = imageUrl;
                        });
                        
                        if (imgData) {
                            doc.addImage(imgData, 'JPEG', 20, y - 5, 20, 20);
                        }
                    } catch (err) {
                        console.error('Error loading image:', err);
                    }
                }
                
                // Build description
                let description = m.item_name;
                
                if (m.stock_items) {
                    const size = m.stock_items.size || '';
                    const thickness = m.stock_items.thickness || '';
                    if (size || thickness) {
                        description += '\n' + [size, thickness].filter(x => x).join(' / ');
                    }
                }
                
                if (m.item_notes) {
                    description += '\n' + m.item_notes;
                }
                
                // Add text
                const lines = doc.splitTextToSize(description, 90);
                doc.text(lines, 50, y + 5);
                
                doc.text(`${reservedStr} ${m.unit}`, 150, y + 5);
                
                // Stock Left z oznaczeniem NEGATIVE jeśli ujemne
                const stockLeftText = `${stockLeftStr} ${m.is_bespoke ? '' : m.unit}`;
                doc.text(stockLeftText, 180, y + 5);
                if (!m.is_bespoke && stockLeft < 0) {
                    doc.setFontSize(7);
                    doc.setTextColor(239, 68, 68); // Czerwony kolor
                    doc.text('X NEGATIVE', 180, y + 9);
                    doc.setTextColor(0, 0, 0); // Powrót do czarnego
                    doc.setFontSize(9);
                }
                
                // Notes line
                doc.line(215, y + 10, 265, y + 10);
                
                // Checkbox
                doc.rect(268, y, 8, 8);
                
                // Row height
                const rowHeight = Math.max(25, lines.length * 5 + 10);
                y += rowHeight;
                
                // Horizontal separator line
                doc.setDrawColor(200, 200, 200);
                doc.line(20, y - 2, 280, y - 2);
                doc.setDrawColor(0, 0, 0);
                
                // New page if needed
                if (y > 160) {
                    doc.addPage('landscape');
                    y = 20;
                }
            }
            
            // Extra space between stages
            y += 10;
            
            if (y > 160) {
                doc.addPage('landscape');
                y = 20;
            }
        }
        
        // Footer
        const footerY = 175;
        doc.setFontSize(10);
        doc.text('Checked by:', 20, footerY);
        doc.line(50, footerY, 100, footerY);
        
        doc.text('Date:', 120, footerY);
        doc.line(140, footerY, 180, footerY);
        
        doc.text('Signature:', 200, footerY);
        doc.line(230, footerY, 280, footerY);
        
        // Save
        doc.save(`Materials_List_${currentMaterialsProject.projectNumber}.pdf`);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Error: ' + error.message, 'error');
    }
}
// Edit Material
async function editMaterial(materialId) {
    try {
        // Pobierz dane materiału
        const { data: material, error } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items (
                    id,
                    name,
                    item_number,
                    size,
                    thickness,
                    current_quantity,
                    reserved_quantity,
                    unit,
                    cost_per_unit,
                    category,
                    subcategory
                )
            `)
            .eq('id', materialId)
            .single();
        
        if (error) throw error;
        
        editingMaterialId = materialId;
        editingMaterialOriginal = material;
        
        // Pokaż info o edytowanym materiale
        document.getElementById('editMaterialInfo').style.display = 'block';
        document.getElementById('editMaterialName').textContent = material.item_name;
        document.getElementById('editMaterialCategory').textContent = material.stock_categories?.name || 'N/A';
        document.getElementById('editMaterialItemNumber').textContent = material.stock_items?.item_number || (material.is_bespoke ? 'BESPOKE' : 'N/A');
        document.getElementById('editMaterialReserved').textContent = `${material.quantity_reserved || 0} ${material.unit}`;
        
        // Pokaż zdjęcie lub placeholder (stock lub bespoke)
        const imageUrl = material.stock_items?.image_url || material.image_url;
        if (imageUrl) {
            document.getElementById('editMaterialImage').src = imageUrl;
            document.getElementById('editMaterialImage').style.display = 'block';
            document.getElementById('editMaterialImagePlaceholder').style.display = 'none';
        } else {
            document.getElementById('editMaterialImage').style.display = 'none';
            document.getElementById('editMaterialImagePlaceholder').style.display = 'flex';
        }
        
        // Załaduj dane do formularza
        await loadCategoriesAndItems();
        await loadSuppliers();
        
        // Wypełnij stage
        document.getElementById('addMaterialStage').value = material.used_in_stage;
        
        // Ustaw typ materiału
        if (material.is_bespoke) {
            document.querySelectorAll('input[name="materialType"]')[1].checked = true;
            onMaterialTypeChange();
            
            // Wypełnij bespoke fields
            document.getElementById('bespokeItemName').value = material.item_name;
            document.getElementById('bespokeMaterialCategory').value = material.category_id || '';
            document.getElementById('bespokeDescription').value = material.bespoke_description || '';
            document.getElementById('bespokeSupplier').value = material.supplier_id || '';
            document.getElementById('bespokePurchaseLink').value = material.purchase_link || '';
            document.getElementById('bespokeUnitCost').value = material.unit_cost || 0;
        } else {
            document.querySelectorAll('input[name="materialType"]')[0].checked = true;
            onMaterialTypeChange();
            
            // Wypełnij stock item fields (tylko pokazuj info - nie pozwól zmienić stock item)
            if (material.stock_items) {
                document.getElementById('addMaterialCategory').disabled = true;
                document.getElementById('addMaterialSubcategory').disabled = true;
                document.getElementById('addMaterialStockItem').disabled = true;
                
                // Pokaż info o aktualnym stock item
                document.getElementById('stockItemInfo').style.display = 'block';
                document.getElementById('itemInStock').textContent = `${material.stock_items.current_quantity || 0} ${material.stock_items.unit}`;
                document.getElementById('itemUnit').textContent = material.stock_items.unit;
                document.getElementById('itemCost').textContent = `£${(material.stock_items.cost_per_unit || 0).toFixed(2)}`;
            }
        }
        
        // Wypełnij quantity i unit
        document.getElementById('addMaterialQuantity').value = material.quantity_needed;
        document.getElementById('addMaterialUnit').value = material.unit;
        document.getElementById('addMaterialNotes').value = material.item_notes || '';
        
        // Zmień tytuł i przycisk
        document.querySelector('#addMaterialModal .modal-header h2').textContent = 'Edit Material';
        document.querySelector('#addMaterialModal .modal-footer .primary').textContent = 'Save Changes';
        document.querySelector('#addMaterialModal .modal-footer .primary').onclick = saveEditedMaterial;
        
        // Pokaż modal
        document.getElementById('addMaterialModal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading material:', error);
        showToast('Error loading: ' + error.message, 'error');
    }
}

// Save Edited Material
async function saveEditedMaterial() {
    try {
        const newQuantityNeeded = parseFloat(document.getElementById('addMaterialQuantity').value);
        const newNotes = document.getElementById('addMaterialNotes').value.trim() || null;
        
        if (!newQuantityNeeded || newQuantityNeeded <= 0) {
            showToast('Please enter a valid quantity', 'warning');
            return;
        }
        
        const original = editingMaterialOriginal;
        const oldQuantityNeeded = original.quantity_needed;
        const oldQuantityReserved = original.quantity_reserved;
        const quantityDifference = newQuantityNeeded - oldQuantityNeeded;
        
        // Dla bespoke - można zmienić wszystko
        if (original.is_bespoke) {
            const updateData = {
                quantity_needed: newQuantityNeeded,
                item_notes: newNotes,
                item_name: document.getElementById('bespokeItemName').value.trim(),
                unit_cost: parseFloat(document.getElementById('bespokeUnitCost').value),
                bespoke_description: document.getElementById('bespokeDescription').value.trim() || null,
                supplier_id: document.getElementById('bespokeSupplier').value || null,
                purchase_link: document.getElementById('bespokePurchaseLink').value.trim() || null
            };
            
            // Sprawdź czy jest nowy obrazek
            const newImageFile = document.getElementById('bespokeImageUpload').files[0];
            if (newImageFile) {
                try {
                    // Usuń stary obrazek jeśli istnieje
                    if (original.image_url) {
                        await deleteFileFromStorage('stock-images', original.image_url);
                    }
                    
                    // Upload nowy obrazek
                    const newImageUrl = await uploadBespokeImage(newImageFile);
                    updateData.image_url = newImageUrl;
                    
                } catch (imgError) {
                    console.error('Error handling image update:', imgError);
                    showToast('Warning: Image update failed, other changes will be saved.', 'error');
                }
            }
            
            const { error } = await supabaseClient
                .from('project_materials')
                .update(updateData)
                .eq('id', editingMaterialId);
            
            if (error) throw error;
            
        } else {
            // Dla stock item - można zmienić tylko quantity i notes
            // Oblicz nową rezerwację
            let newQuantityReserved = oldQuantityReserved;
            
            if (quantityDifference !== 0 && original.stock_item_id) {
                // Pobierz aktualny stock
                const { data: stockItem, error: fetchError } = await supabaseClient
                    .from('stock_items')
                    .select('current_quantity, reserved_quantity')
                    .eq('id', original.stock_item_id)
                    .single();
                
                if (fetchError) throw fetchError;
                
                if (quantityDifference > 0) {
                    // Zwiększono quantity_needed - rezerwuj więcej jeśli możliwe
                    const availableToReserve = stockItem.current_quantity;
                    const additionalToReserve = Math.min(availableToReserve, quantityDifference);
                    
                    if (additionalToReserve > 0) {
                        // Dodaj transakcję OUT
                        await supabaseClient
                            .from('stock_transactions')
                            .insert({
                                stock_item_id: original.stock_item_id,
                                type: 'OUT',
                                quantity: additionalToReserve,
                                project_id: currentMaterialsProject.id,
                                project_material_id: editingMaterialId,
                                notes: `Additional reservation for ${currentMaterialsProject.projectNumber} (quantity increased)`
                            });
                        
                        // Update stock - tylko reserved_quantity, NIE current_quantity
                        await supabaseClient
                            .from('stock_items')
                            .update({
                                reserved_quantity: Math.round(((stockItem.reserved_quantity || 0) + additionalToReserve) * 100) / 100
                            })
                            .eq('id', original.stock_item_id);
                        
                        newQuantityReserved = oldQuantityReserved + additionalToReserve;
                    }
                    
                } else if (quantityDifference < 0) {
                    // Zmniejszono quantity_needed - zwróć nadmiar do stocku
                    const toReturn = Math.min(oldQuantityReserved, Math.abs(quantityDifference));
                    
                    if (toReturn > 0) {
                        // Dodaj transakcję IN
                        await supabaseClient
                            .from('stock_transactions')
                            .insert({
                                stock_item_id: original.stock_item_id,
                                type: 'IN',
                                quantity: toReturn,
                                project_id: currentMaterialsProject.id,
                                project_material_id: editingMaterialId,
                                notes: `Returned from ${currentMaterialsProject.projectNumber} (quantity decreased)`
                            });
                        
                        // Update stock - tylko reserved_quantity, NIE current_quantity
                        await supabaseClient
                            .from('stock_items')
                            .update({
                                reserved_quantity: Math.round(Math.max(0, (stockItem.reserved_quantity || 0) - toReturn) * 100) / 100
                            })
                            .eq('id', original.stock_item_id);
                        
                        newQuantityReserved = oldQuantityReserved - toReturn;
                    }
                }
            }
            
            // Update project_materials
            const { error } = await supabaseClient
                .from('project_materials')
                .update({
                    quantity_needed: newQuantityNeeded,
                    quantity_reserved: newQuantityReserved,
                    item_notes: newNotes
                })
                .eq('id', editingMaterialId);
            
            if (error) throw error;
        }
        
        showToast('Material updated successfully!', 'success');
        closeAddMaterialModal();
        
        // Reset edit mode
        editingMaterialId = null;
        editingMaterialOriginal = null;
        
        // Reload materials
        await loadProjectMaterials(currentMaterialsProject.id);
        
    } catch (error) {
        console.error('Error saving material:', error);
        showToast('Error saving: ' + error.message, 'error');
    }
}

// Delete Material
async function deleteMaterial(materialId) {
    if (!confirm('Are you sure you want to delete this material?\n\nThis will:\n- Return reserved quantity back to stock\n- Delete all related transactions\n- Remove material from project')) {
        return;
    }
    
    try {
        // 1. Pobierz informacje o materiale
        const { data: material, error: fetchError } = await supabaseClient
            .from('project_materials')
            .select('*, stock_items(id, current_quantity, reserved_quantity)')
            .eq('id', materialId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 2. Jeśli to bespoke z obrazkiem - usuń obrazek z Storage
        if (material.is_bespoke && material.image_url) {
            try {
                await deleteFileFromStorage('stock-images', material.image_url);
            } catch (imgError) {
                console.warn('Failed to delete bespoke image:', imgError);
                // Nie blokuj usuwania materiału
            }
        }
        
        // 3. Jeśli to stock item i ma reserved quantity - zwróć do stocku
        if (material.stock_item_id && material.quantity_reserved > 0) {
            const stockItem = material.stock_items;
            
            // Zmniejsz reserved_quantity (unreserve)
            // NIE zwiększaj current_quantity bo rezerwacja go nie zmniejszała
            const newReserved = Math.round(Math.max(0, (stockItem.reserved_quantity || 0) - material.quantity_reserved) * 100) / 100;
            
            const { error: stockError } = await supabaseClient
                .from('stock_items')
                .update({
                    reserved_quantity: newReserved
                })
                .eq('id', material.stock_item_id);
            
            if (stockError) throw stockError;
        }
        
        // 4. Usuń powiązane transakcje
        const { error: txDeleteError } = await supabaseClient
            .from('stock_transactions')
            .delete()
            .eq('project_material_id', materialId);
        
        if (txDeleteError) throw txDeleteError;
        
        // 5. Usuń materiał
        const { error: deleteError } = await supabaseClient
            .from('project_materials')
            .delete()
            .eq('id', materialId);
        
        if (deleteError) throw deleteError;
        
        
        // Reload materials list
        await loadProjectMaterials(currentMaterialsProject.id);
        
    } catch (err) {
        console.error('Error deleting material:', err);
        showToast('Error deleting: ' + err.message, 'error');
    }
}

// Export Materials PDF
async function exportMaterialsPDF() {
    if (!currentMaterialsProject) {
        showToast('No project selected', 'error');
        return;
    }
    
    try {
        // Load materials
        const { data: materials, error } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items (
                    id,
                    name,
                    item_number,
                    size,
                    thickness,
                    unit,
                    cost_per_unit
                ),
                stock_categories!category_id (
                    id,
                    name
                ),
                suppliers (
                    id,
                    name
                )
            `)
            .eq('project_id', currentMaterialsProject.id)
            .order('used_in_stage', { ascending: true });
        
        if (error) throw error;
        
        if (!materials || materials.length === 0) {
            showToast('No materials to export', 'warning');
            return;
        }
        
        // Initialize jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const margin = 15;
        let y = margin;
        
        // Get branding
        const branding = await getPdfBranding();
        
        // Header
        doc.setFillColor(39, 39, 42);
        doc.rect(0, 0, 210, 35, 'F');
        
        // Logo w prawym górnym rogu
        if (branding.logoBase64) {
            try {
                doc.addImage(branding.logoBase64, 'PNG', 180, 5, 20, 20);
            } catch (e) { console.warn('Could not add logo:', e); }
        }
        
        doc.setTextColor(78, 201, 176);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('MATERIALS LIST', margin, 20);
        
        doc.setTextColor(200, 200, 200);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Project: ${currentMaterialsProject.projectNumber} - ${currentMaterialsProject.name}`, margin, 28);
        
        y = 45;
        
        // Group by stage
        const grouped = {
            'Production': [],
            'Spraying': [],
            'Installation': []
        };
        
        materials.forEach(m => {
            if (grouped[m.used_in_stage]) {
                grouped[m.used_in_stage].push(m);
            }
        });
        
        let totalCost = 0;
        
        // Render each stage
        Object.keys(grouped).forEach(stage => {
            if (grouped[stage].length === 0) return;
            
            // Check if need new page
            if (y > 250) {
                doc.addPage();
                y = margin;
            }
            
            // Stage header
            doc.setFillColor(45, 45, 48);
            doc.rect(margin, y, 180, 8, 'F');
            doc.setTextColor(78, 201, 176);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`${stage.toUpperCase()} STAGE`, margin + 3, y + 6);
            y += 12;
            
            // Table header
            doc.setFillColor(55, 55, 58);
            doc.rect(margin, y, 180, 7, 'F');
            doc.setTextColor(180, 180, 180);
            doc.setFontSize(8);
            doc.text('Material', margin + 2, y + 5);
            doc.text('Size', margin + 70, y + 5);
            doc.text('Qty', margin + 105, y + 5);
            doc.text('Unit', margin + 120, y + 5);
            doc.text('Supplier', margin + 135, y + 5);
            doc.text('Cost', margin + 165, y + 5);
            y += 10;
            
            // Table rows
            doc.setTextColor(220, 220, 220);
            doc.setFont('helvetica', 'normal');
            
            grouped[stage].forEach((m, index) => {
                if (y > 280) {
                    doc.addPage();
                    y = margin;
                }
                
                // Alternating row colors
                if (index % 2 === 0) {
                    doc.setFillColor(40, 40, 43);
                    doc.rect(margin, y - 4, 180, 7, 'F');
                }
                
                const materialName = m.is_bespoke ? 
                    `[BESPOKE] ${m.custom_name || 'Custom Item'}` : 
                    (m.stock_items?.name || 'Unknown');
                
                const size = m.is_bespoke ? 
                    (m.custom_description || '-') : 
                    (m.stock_items?.size || '-');
                
                const unit = m.is_bespoke ? 
                    (m.custom_unit || 'pcs') : 
                    (m.stock_items?.unit || 'pcs');
                
                const supplier = m.suppliers?.name || '-';
                
                const costPerUnit = m.is_bespoke ? 
                    (m.custom_cost_per_unit || 0) : 
                    (m.stock_items?.cost_per_unit || 0);
                
                const lineCost = m.quantity_needed * costPerUnit;
                totalCost += lineCost;
                
                // Truncate long text
                const truncName = materialName.length > 35 ? materialName.substring(0, 32) + '...' : materialName;
                const truncSize = size.length > 18 ? size.substring(0, 15) + '...' : size;
                const truncSupplier = supplier.length > 15 ? supplier.substring(0, 12) + '...' : supplier;
                
                doc.text(truncName, margin + 2, y);
                doc.text(truncSize, margin + 70, y);
                doc.text(String(m.quantity_needed), margin + 105, y);
                doc.text(unit, margin + 120, y);
                doc.text(truncSupplier, margin + 135, y);
                doc.text(`£${lineCost.toFixed(2)}`, margin + 165, y);
                
                y += 7;
            });
            
            y += 5;
        });
        
        // Total
        if (y > 265) {
            doc.addPage();
            y = margin;
        }
        
        y += 5;
        doc.setFillColor(39, 39, 42);
        doc.rect(margin, y, 180, 10, 'F');
        doc.setTextColor(78, 201, 176);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ESTIMATED TOTAL:', margin + 120, y + 7);
        doc.text(`£${totalCost.toFixed(2)}`, margin + 165, y + 7);
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} | Page ${i} of ${pageCount}`, margin, 290);
        }
        
        // Save
        const filename = `${currentMaterialsProject.projectNumber.replace(/\//g, '-')}-materials.pdf`;
        doc.save(filename);
        
        showToast('Materials PDF exported successfully', 'success');
        
    } catch (error) {
        showToast('Error generating PDF: ' + error.message, 'error');
    }
}

// Generate Shopping List
async function generateShoppingList() {
    if (!currentMaterialsProject) {
        showToast('No project selected', 'error');
        return;
    }
    
    try {
        // Load materials that need ordering (not reserved or not enough in stock)
        const { data: materials, error } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items (
                    id,
                    name,
                    item_number,
                    size,
                    thickness,
                    unit,
                    cost_per_unit,
                    current_quantity,
                    reserved_quantity
                ),
                stock_categories!category_id (
                    id,
                    name
                ),
                suppliers (
                    id,
                    name,
                    email,
                    phone
                )
            `)
            .eq('project_id', currentMaterialsProject.id)
            .order('used_in_stage', { ascending: true });
        
        if (error) throw error;
        
        if (!materials || materials.length === 0) {
            showToast('No materials in this project', 'warning');
            return;
        }
        
        // Filter items that need ordering
        const toOrder = materials.filter(m => {
            if (m.is_bespoke) {
                return m.status !== 'ordered' && m.status !== 'received';
            }
            // Stock items - check if reserved
            return m.quantity_reserved < m.quantity_needed;
        });
        
        if (toOrder.length === 0) {
            showToast('All materials are already reserved or ordered!', 'success');
            return;
        }
        
        // Group by supplier
        const bySupplier = {};
        
        toOrder.forEach(m => {
            const supplierName = m.suppliers?.name || 'No Supplier';
            const supplierId = m.supplier_id || 'none';
            
            if (!bySupplier[supplierId]) {
                bySupplier[supplierId] = {
                    name: supplierName,
                    email: m.suppliers?.email || null,
                    phone: m.suppliers?.phone || null,
                    items: []
                };
            }
            
            const qtyToOrder = m.is_bespoke ? 
                m.quantity_needed : 
                (m.quantity_needed - m.quantity_reserved);
            
            if (qtyToOrder > 0) {
                bySupplier[supplierId].items.push({
                    name: m.is_bespoke ? `[BESPOKE] ${m.custom_name}` : m.stock_items?.name,
                    itemNumber: m.stock_items?.item_number || '-',
                    size: m.is_bespoke ? m.custom_description : m.stock_items?.size,
                    quantity: qtyToOrder,
                    unit: m.is_bespoke ? m.custom_unit : m.stock_items?.unit,
                    stage: m.used_in_stage
                });
            }
        });
        
        // Generate PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const margin = 15;
        let y = margin;
        
        // Header
        doc.setFillColor(39, 39, 42);
        doc.rect(0, 0, 210, 35, 'F');
        
        doc.setTextColor(246, 173, 85);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('SHOPPING LIST', margin, 20);
        
        doc.setTextColor(200, 200, 200);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Project: ${currentMaterialsProject.projectNumber} - ${currentMaterialsProject.name}`, margin, 28);
        
        y = 45;
        
        // Summary
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.text(`Items to order: ${toOrder.length} | Suppliers: ${Object.keys(bySupplier).length} | Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, y);
        y += 10;
        
        // Render by supplier
        Object.values(bySupplier).forEach(supplier => {
            if (supplier.items.length === 0) return;
            
            // Check if need new page
            if (y > 240) {
                doc.addPage();
                y = margin;
            }
            
            // Supplier header
            doc.setFillColor(45, 45, 48);
            doc.rect(margin, y, 180, 12, 'F');
            doc.setTextColor(246, 173, 85);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(supplier.name.toUpperCase(), margin + 3, y + 5);
            
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            const contactInfo = [supplier.email, supplier.phone].filter(Boolean).join(' | ');
            if (contactInfo) {
                doc.text(contactInfo, margin + 3, y + 10);
            }
            y += 16;
            
            // Table header
            doc.setFillColor(55, 55, 58);
            doc.rect(margin, y, 180, 7, 'F');
            doc.setTextColor(180, 180, 180);
            doc.setFontSize(8);
            doc.text('Item', margin + 2, y + 5);
            doc.text('Item No.', margin + 70, y + 5);
            doc.text('Size', margin + 95, y + 5);
            doc.text('Qty', margin + 140, y + 5);
            doc.text('Stage', margin + 160, y + 5);
            y += 10;
            
            // Items
            doc.setTextColor(220, 220, 220);
            
            supplier.items.forEach((item, index) => {
                if (y > 280) {
                    doc.addPage();
                    y = margin;
                }
                
                if (index % 2 === 0) {
                    doc.setFillColor(40, 40, 43);
                    doc.rect(margin, y - 4, 180, 7, 'F');
                }
                
                const truncName = (item.name || '').length > 35 ? item.name.substring(0, 32) + '...' : (item.name || '');
                const truncSize = (item.size || '').length > 22 ? item.size.substring(0, 19) + '...' : (item.size || '-');
                
                doc.text(truncName, margin + 2, y);
                doc.text(item.itemNumber || '-', margin + 70, y);
                doc.text(truncSize, margin + 95, y);
                doc.text(`${item.quantity} ${item.unit || ''}`, margin + 140, y);
                doc.text(item.stage || '', margin + 160, y);
                
                y += 7;
            });
            
            y += 8;
        });
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Shopping List - ${currentMaterialsProject.projectNumber} | Page ${i} of ${pageCount}`, margin, 290);
        }
        
        // Save
        const filename = `${currentMaterialsProject.projectNumber.replace(/\//g, '-')}-shopping-list.pdf`;
        doc.save(filename);
        
        showToast('Shopping list PDF generated', 'success');
        
    } catch (error) {
        showToast('Error generating shopping list: ' + error.message, 'error');
    }
}

// ========== BESPOKE IMAGE HANDLING ==========

// Image preview dla bespoke
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('bespokeImageUpload');
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    document.getElementById('bespokeImagePreviewImg').src = event.target.result;
                    document.getElementById('bespokeImagePreview').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// Upload bespoke image do Supabase Storage
async function uploadBespokeImage(file) {
    if (!file) return null;
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `bespoke-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = fileName;
        
        const { data, error } = await supabaseClient.storage
            .from('stock-images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        // Pobierz publiczny URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('stock-images')
            .getPublicUrl(filePath);
        
        return publicUrl;
        
    } catch (error) {
        console.error('Error uploading bespoke image:', error);
        throw error;
    }
}

// Helper: Usuń plik z Supabase Storage na podstawie URL
async function deleteFileFromStorage(bucketName, fileUrl) {
    if (!fileUrl) return;
    
    try {
        // Wyciągnij nazwę pliku z URL
        const urlParts = fileUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        const { error } = await supabaseClient.storage
            .from(bucketName)
            .remove([fileName]);
        
        if (error) throw error;
        
    } catch (error) {
        console.error(`Error deleting file from ${bucketName}:`, error);
        throw error;
    }
}