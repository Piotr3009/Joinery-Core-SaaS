// ========== BOM EDITOR - WITH SPRAY ITEMS & ADDITIONAL ELEMENTS ==========

let lastElementValues = {};
let editingElementId = null;
let currentSprayItems = [];

// Helper: escape HTML to prevent XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const BOM_FIELDS = {
    sash: {
        label: 'Sash Windows',
        prefix: 'W',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '800' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '1200' },
            { row: 3, id: 'sash_box', label: 'Sash Box', type: 'select', options: ['Standard', 'Slim'] },
            { row: 3, id: 'opening_type', label: 'Opening Type', type: 'select', options: ['Both Sash', 'Bottom Only', 'Fix'] },
            { row: 3, id: 'bars', label: 'Bars', type: 'select', options: ['Yes', 'No'] },
            { row: 3, id: 'trickle_vent', label: 'Trickle Vent', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure'] },
            { row: 4, id: 'glass_thickness', label: 'Glass Thickness', type: 'text', placeholder: '16 / 24 / 28 / Other' },
            { row: 4, id: 'ironmongery', label: 'Ironmongery', type: 'select', options: ['Chrome', 'Satin', 'Brass', 'Antique Brass', 'Other'] },
        ]
    },
    casement: {
        label: 'Casement Windows',
        prefix: 'W',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '800' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '1200' },
            { row: 3, id: 'opening_type', label: 'Opening Type', type: 'select', options: ['Left Hung', 'Right Hung', 'Top Hung', 'Fix'] },
            { row: 3, id: 'bars', label: 'Bars', type: 'select', options: ['Yes', 'No'] },
            { row: 3, id: 'trickle_vent', label: 'Trickle Vent', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure'] },
            { row: 4, id: 'glass_thickness', label: 'Glass Thickness', type: 'text', placeholder: '16 / 24 / 28 / Other' },
            { row: 4, id: 'ironmongery', label: 'Ironmongery', type: 'select', options: ['Chrome', 'Satin', 'Brass', 'Antique Brass', 'Other'] },
        ]
    },
    internalDoors: {
        label: 'Internal Doors',
        prefix: 'D',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '826' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2040' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '44' },
            { row: 3, id: 'door_type', label: 'Door Type', type: 'select', options: ['Single', 'Double', 'Sliding', 'Pocket'] },
            { row: 3, id: 'door_handing', label: 'Opening', type: 'select', options: ['LH', 'RH'] },
            { row: 3, id: 'fire_rating', label: 'Fire Rating', type: 'select', options: ['NFR', 'FD30', 'FD60'] },
            { row: 3, id: 'intumescent_set', label: 'Intumescent Set', type: 'select', options: ['Yes', 'No'], conditionalOn: 'fire_rating', showWhen: ['FD30', 'FD60'] },
            { row: 4, id: 'self_closer', label: 'Self Closer', type: 'select', options: ['Integrated', 'External', 'No Selfcloser'], conditionalOn: 'fire_rating', showWhen: ['FD30', 'FD60'] },
            { row: 4, id: 'glazed', label: 'Glazed', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure', 'Pyroguard 30', 'Pyroguard 60'], conditionalOn: 'glazed', showWhen: ['Yes'] },
            { row: 4, id: 'ironmongery_hinges', label: 'Ironmongery/Hinges', type: 'select', options: ['Chrome', 'Satin', 'Brass', 'Antique Brass', 'Other'] },
            { row: 5, id: 'locks_qty', label: 'Number of Locks', type: 'select', options: ['1', '2', '3'] },
            { row: 5, id: 'lock_1', label: 'Lock 1', type: 'select', options: ['Latch', 'Bathroom', 'Eurocylinder', 'Nightlatch', 'Deadlock', 'Magnetic Lock', 'Electric Lock'] },
            { row: 5, id: 'lock_2', label: 'Lock 2', type: 'select', options: ['Latch', 'Bathroom', 'Eurocylinder', 'Nightlatch', 'Deadlock', 'Magnetic Lock', 'Electric Lock'], conditionalOn: 'locks_qty', showWhen: ['2', '3'] },
            { row: 5, id: 'lock_3', label: 'Lock 3', type: 'select', options: ['Latch', 'Bathroom', 'Eurocylinder', 'Nightlatch', 'Deadlock', 'Magnetic Lock', 'Electric Lock'], conditionalOn: 'locks_qty', showWhen: ['3'] },
        ]
    },
    internalDoorsAdditional: {
        label: 'Internal Door Additional',
        prefix: 'IDA',
        isAdditional: true,
        hasQty: true,
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '70' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2100' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '18' },
            { row: 3, id: 'item_type', label: 'Item Type', type: 'select', options: ['Architrave', 'Door Lining', 'Casing', 'Fanlight Frame', 'Sidelight Frame', 'Other'] },
            { row: 3, id: 'material', label: 'Material', type: 'text', placeholder: 'e.g. Softwood, MDF' },
        ]
    },
    externalDoors: {
        label: 'External Doors',
        prefix: 'ED',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '900' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2100' },
            { row: 3, id: 'external_door_type', label: 'Door Type', type: 'select', options: ['Single Door', 'French Doors', 'By-fold Doors'] },
            { row: 3, id: 'door_handing', label: 'Opening', type: 'select', options: ['LH', 'RH'] },
            { row: 3, id: 'threshold', label: 'Threshold', type: 'select', options: ['Standard', 'Low', 'Flush'] },
            { row: 4, id: 'glazed', label: 'Glazed', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure'], conditionalOn: 'glazed', showWhen: ['Yes'] },
            { row: 4, id: 'glass_thickness', label: 'Glass Thickness', type: 'text', placeholder: '16 / 24 / 28 / Other', conditionalOn: 'glazed', showWhen: ['Yes'] },
            { row: 4, id: 'locks', label: 'Locks', type: 'select', options: ['Multipoint', 'Eurocylinder', 'Other'] },
            { row: 4, id: 'ironmongery_hinges', label: 'Ironmongery/Hinges', type: 'select', options: ['Chrome', 'Satin', 'Brass', 'Antique Brass', 'Other'] },
        ]
    },
    kitchen: {
        label: 'Kitchen',
        prefix: 'K',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '600' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '720' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '560' },
            { row: 3, id: 'unit_type', label: 'Unit Type', type: 'select', options: ['Base', 'Wall', 'Tall', 'Drawer'] },
            { row: 3, id: 'front_style', label: 'Front Style', type: 'select', options: ['Flat', 'Shaker'] },
            { row: 3, id: 'front_material', label: 'Front Material', type: 'select', options: ['MDF 25', 'MDF 18', 'Veneer', 'Other'] },
            { row: 4, id: 'carcass_material', label: 'Carcass Material', type: 'text', placeholder: 'e.g. 18mm MFC White' },
            { row: 4, id: 'handle_type', label: 'Handle Type', type: 'select', options: ['Handleless J Type', 'Push to Open', 'Handle'] },
            { row: 4, id: 'soft_close', label: 'Soft Close', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'worktop', label: 'Worktop', type: 'text', placeholder: 'e.g. Quartz 30mm' },
        ]
    },
    kitchenAdditional: {
        label: '+ Kitchen Additional',
        prefix: 'KA',
        isAdditional: true,
        hasQty: true,
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '2400' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '600' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '18' },
            { row: 3, id: 'item_type', label: 'Item Type', type: 'select', options: ['Side Panel', 'End Panel', 'Plinth', 'Cornice', 'Pelmet', 'Filler', 'Decor Panel', 'Other'] },
            { row: 3, id: 'material', label: 'Material', type: 'text', placeholder: 'e.g. MDF 18mm' },
        ]
    },
    wardrobe: {
        label: 'Wardrobe',
        prefix: 'WR',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '2400' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2200' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '600' },
            { row: 3, id: 'wardrobe_shape', label: 'Shape', type: 'select', options: ['Straight', 'L Shape', 'Sloped (Attic)'] },
            { row: 3, id: 'door_style', label: 'Door Style', type: 'select', options: ['Sliding', 'Hinged'] },
            { row: 3, id: 'front_style', label: 'Front Style', type: 'select', options: ['Flat', 'Shaker'] },
            { row: 4, id: 'front_material', label: 'Front Material', type: 'select', options: ['MDF 25', 'MDF 18', 'Veneer', 'Other'] },
            { row: 4, id: 'carcass_material', label: 'Carcass Material', type: 'text', placeholder: 'e.g. 18mm MFC White' },
            { row: 4, id: 'handle_type', label: 'Handle Type', type: 'select', options: ['Handleless J Type', 'Push to Open', 'Handle'] },
            { row: 4, id: 'internal_layout', label: 'Internal Layout', type: 'text', placeholder: 'e.g. 2 rails, 3 shelves' },
            { row: 4, id: 'mirror', label: 'Mirror', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'soft_close', label: 'Soft Close', type: 'select', options: ['Yes', 'No'] },
        ]
    },
    wardrobeAdditional: {
        label: '+ Wardrobe Additional',
        prefix: 'WA',
        isAdditional: true,
        hasQty: true,
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '2400' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '600' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '18' },
            { row: 3, id: 'item_type', label: 'Item Type', type: 'select', options: ['Side Panel', 'Top Panel', 'Plinth', 'Cornice', 'Filler', 'Internal Shelf', 'Drawer Front', 'Other'] },
            { row: 3, id: 'material', label: 'Material', type: 'text', placeholder: 'e.g. MDF 18mm' },
        ]
    },
    partition: {
        label: 'Partition Wall',
        prefix: 'P',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '3000' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2400' },
            { row: 3, id: 'panel_type', label: 'Panel Type', type: 'select', options: ['Solid', 'Glazed', 'Mixed'] },
            { row: 3, id: 'frame_material', label: 'Frame Material', type: 'text', placeholder: 'e.g. Oak, Aluminium' },
            { row: 3, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure'], conditionalOn: 'panel_type', showWhen: ['Glazed', 'Mixed'] },
            { row: 3, id: 'glass_thickness', label: 'Glass Thickness', type: 'text', placeholder: '10mm laminated', conditionalOn: 'panel_type', showWhen: ['Glazed', 'Mixed'] },
            { row: 4, id: 'door_included', label: 'Door Included', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'door_handing', label: 'Door Handing', type: 'select', options: ['Left', 'Right'], conditionalOn: 'door_included', showWhen: ['Yes'] },
            { row: 4, id: 'door_lock', label: 'Door Lock', type: 'select', options: ['Latch', 'Bathroom', 'Eurocylinder'], conditionalOn: 'door_included', showWhen: ['Yes'] },
            { row: 4, id: 'acoustic_rating', label: 'Acoustic Rating', type: 'text', placeholder: 'e.g. 42dB' },
        ]
    },
    doorAdditional: {
        label: '+ Door Additional',
        prefix: 'DA',
        isAdditional: true,
        hasQty: true,
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '70' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2100' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '18' },
            { row: 3, id: 'item_type', label: 'Item Type', type: 'select', options: ['Architrave', 'Door Lining', 'Threshold', 'Casing', 'Fanlight Frame', 'Sidelight Frame', 'Other'] },
            { row: 3, id: 'material', label: 'Material', type: 'text', placeholder: 'e.g. Softwood, MDF' },
        ]
    },
    windowAdditional: {
        label: '+ Window Additional',
        prefix: 'XA',
        isAdditional: true,
        hasQty: true,
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '1200' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '300' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '25' },
            { row: 3, id: 'item_type', label: 'Item Type', type: 'select', options: ['Internal Sill', 'External Sill', 'Casing', 'Architrave', 'Trim', 'Other'] },
            { row: 3, id: 'material', label: 'Material', type: 'text', placeholder: 'e.g. Oak, MDF' },
        ]
    },
    externalSpray: {
        label: 'External Spray',
        prefix: 'S',
        hasQty: true,
        fields: [
            { row: 3, id: 'item_type', label: 'Item Type', type: 'select', options: ['Doors', 'Windows', 'Furniture', 'Kitchen Fronts', 'Other'] },
            { row: 3, id: 'substrate', label: 'Substrate', type: 'select', options: ['Timber', 'MDF', 'Veneer', 'Primed', 'Other'] },
            { row: 4, id: 'paint_system', label: 'Paint System', type: 'text', placeholder: 'e.g. Teknos, Dulux' },
            { row: 4, id: 'sheen_level', label: 'Sheen Level (%)', type: 'text', placeholder: 'e.g. 10%, 30%' },
            { row: 4, id: 'num_coats', label: 'Coats', type: 'select', options: ['1', '2', '3'] },
        ]
    },
    other: {
        label: 'Other',
        prefix: 'X',
        hasQty: true,
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '500' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '400' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '' },
            { row: 3, id: 'material', label: 'Material', type: 'text', placeholder: 'e.g. Steel, Wood' },
            { row: 4, id: 'custom_field_1', label: 'Custom Field 1', type: 'text', placeholder: '' },
            { row: 4, id: 'custom_field_2', label: 'Custom Field 2', type: 'text', placeholder: '' },
            { row: 4, id: 'custom_field_3', label: 'Custom Field 3', type: 'text', placeholder: '' },
        ]
    },
    additionalProject: {
        label: '+ Additional Project Items',
        prefix: 'ADD',
        isAdditional: true,
        hasQty: true,
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '' },
            { row: 3, id: 'item_type', label: 'Item Type', type: 'text', placeholder: 'e.g. Shelf, Bracket, Trim' },
            { row: 3, id: 'material', label: 'Material', type: 'text', placeholder: 'e.g. MDF, Oak' },
        ]
    }
};

const inputStyle = 'width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; color: #e8e2d5;';
const selectStyle = 'width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; color: #e8e2d5;';
const labelStyle = 'font-size: 10px; color: #888; display: block; margin-bottom: 4px;';

function openBomModal() {
    document.getElementById('psBomModal').classList.add('active');
    renderBomTable();
    const projectType = projectData.project?.type;
    const typeSelect = document.getElementById('bomElementType');
    if (projectType && BOM_FIELDS[projectType]) {
        typeSelect.value = projectType;
        onElementTypeChange();
    }
}

function closeBomModal() {
    document.getElementById('psBomModal').classList.remove('active');
    cancelBomEdit();
    checkAllItems();
    updateProgress();
    generatePreview();
}

function onElementTypeChange() {
    const type = document.getElementById('bomElementType').value;
    const container = document.getElementById('bomFormContainer');
    const placeholder = document.getElementById('bomFormPlaceholder');
    if (!type) {
        container.style.display = 'none';
        placeholder.style.display = 'block';
        return;
    }
    container.style.display = 'block';
    placeholder.style.display = 'none';
    renderBomForm(type);
}

function renderBomForm(type) {
    const config = BOM_FIELDS[type];
    if (!config) return;
    
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`bomFormRow${i}`).innerHTML = '';
    }
    
    const spraySection = document.getElementById('bomSpraySection');
    if (spraySection) spraySection.style.display = 'none';
    currentSprayItems = [];
    
    // Check if type has dimensions in row 2
    const hasDimensions = config.fields.some(f => f.row === 2 && ['width', 'height', 'depth'].includes(f.id));
    
    const row1 = document.getElementById('bomFormRow1');
    if (hasDimensions) {
        // Compact layout: ID | Name | W | H | D | Qty (all in one row)
        const projectPrefix = (projectData.project?.project_number || '').split('/')[0] || 'XXX';
        row1.style.gridTemplateColumns = config.hasQty ? '100px 1fr 70px 70px 70px 50px' : '100px 1fr 70px 70px 70px';
        row1.innerHTML = `
            <div><label style="${labelStyle}">ID</label><div style="display: flex; align-items: center; gap: 2px;"><span style="color: #4a9eff; font-size: 12px;">${projectPrefix}-</span><input type="text" id="bomFieldId" placeholder="${config.prefix}-001" style="${inputStyle}; flex: 1;"></div></div>
            <div><label style="${labelStyle}">Name *</label><input type="text" id="bomFieldName" placeholder="e.g. Living Room" style="${inputStyle}"></div>
            <div><label style="${labelStyle}">W (mm)</label><input type="number" id="bomField_width" placeholder="600" style="${inputStyle}"></div>
            <div><label style="${labelStyle}">H (mm)</label><input type="number" id="bomField_height" placeholder="720" style="${inputStyle}"></div>
            <div><label style="${labelStyle}">D (mm)</label><input type="number" id="bomField_depth" placeholder="560" style="${inputStyle}"></div>
            ${config.hasQty ? `<div><label style="${labelStyle}">Qty</label><input type="number" id="bomFieldQty" value="1" min="1" style="${inputStyle}"></div>` : ''}
        `;
    } else {
        // Standard layout without dimensions
        const projectPrefix = (projectData.project?.project_number || '').split('/')[0] || 'XXX';
        row1.style.gridTemplateColumns = config.hasQty ? '100px 1fr 60px' : '100px 1fr';
        row1.innerHTML = `
            <div><label style="${labelStyle}">ID</label><div style="display: flex; align-items: center; gap: 2px;"><span style="color: #4a9eff; font-size: 12px;">${projectPrefix}-</span><input type="text" id="bomFieldId" placeholder="${config.prefix}-001" style="${inputStyle}; flex: 1;"></div></div>
            <div><label style="${labelStyle}">Name *</label><input type="text" id="bomFieldName" placeholder="e.g. Living Room" style="${inputStyle}"></div>
            ${config.hasQty ? `<div><label style="${labelStyle}">Qty</label><input type="number" id="bomFieldQty" value="1" min="1" style="${inputStyle}"></div>` : ''}
        `;
    }
    
    const rows = { 2: [], 3: [], 4: [], 5: [] };
    config.fields.forEach(field => { 
        // Skip width/height/depth from row 2 if we moved them to row 1
        if (hasDimensions && field.row === 2 && ['width', 'height', 'depth'].includes(field.id)) return;
        if (rows[field.row]) rows[field.row].push(field); 
    });
    
    [2, 3, 4, 5].forEach(rowNum => {
        const rowEl = document.getElementById(`bomFormRow${rowNum}`);
        const fields = rows[rowNum];
        if (fields.length === 0) { if (rowNum !== 5) rowEl.style.display = 'none'; return; }
        rowEl.style.display = 'grid';
        rowEl.style.gridTemplateColumns = `repeat(${Math.min(fields.length, 4)}, 1fr)`;
        rowEl.innerHTML = fields.map(field => {
            const conditionalAttr = field.conditionalOn ? `data-conditional-on="${field.conditionalOn}" data-show-when="${field.showWhen.join(',')}"` : '';
            if (field.type === 'select') {
                return `<div class="bom-field-wrapper" ${conditionalAttr}><label style="${labelStyle}">${field.label}</label><select id="bomField_${field.id}" style="${selectStyle}" onchange="onBomFieldChange('${field.id}')"><option value="">-- Select --</option>${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select></div>`;
            } else {
                return `<div class="bom-field-wrapper" ${conditionalAttr}><label style="${labelStyle}">${field.label}</label><input type="${field.type}" id="bomField_${field.id}" placeholder="${field.placeholder || ''}" style="${inputStyle}"></div>`;
            }
        }).join('');
    });
    
    // Row 5 - hide if no fields (colour removed - now in spray items)
    const row5 = document.getElementById('bomFormRow5');
    if (rows[5].length === 0) {
        row5.style.display = 'none';
    }
    
    // Row 6 - Only Description (colour removed - now in spray items)
    const row6 = document.getElementById('bomFormRow6');
    row6.innerHTML = `<div><label style="${labelStyle}">Description (optional)</label><input type="text" id="bomField_description" placeholder="Additional notes or specifications" style="${inputStyle}"></div>`;
    
    if (!config.isAdditional && spraySection) {
        spraySection.style.display = 'block';
        renderSprayItemsTable();
    }
    
    applyLastValues(type);
    updateConditionalFields();
}

function onBomFieldChange(fieldId) { updateConditionalFields(); }

function updateConditionalFields() {
    const wrappers = document.querySelectorAll('.bom-field-wrapper[data-conditional-on]');
    wrappers.forEach(wrapper => {
        const conditionalOn = wrapper.dataset.conditionalOn;
        const showWhen = wrapper.dataset.showWhen.split(',');
        const conditionalField = document.getElementById(`bomField_${conditionalOn}`);
        if (conditionalField) {
            wrapper.style.display = showWhen.includes(conditionalField.value) ? 'block' : 'none';
        }
    });
}

function applyLastValues(type) {
    const lastValues = lastElementValues[type];
    if (!lastValues) return;
    Object.keys(lastValues).forEach(key => {
        if (key === 'element_id' || key === 'name') return;
        const field = document.getElementById(`bomField_${key}`);
        if (field && lastValues[key]) field.value = lastValues[key];
    });
    ['width', 'height', 'depth'].forEach(dim => {
        const field = document.getElementById(`bomField_${dim}`);
        if (field && lastValues[dim]) field.value = lastValues[dim];
    });
    updateConditionalFields();
}

function saveLastValues(type, data) { lastElementValues[type] = { ...data }; }

// ========== SPRAY ITEMS ==========
function renderSprayItemsTable() {
    const container = document.getElementById('sprayItemsContainer');
    if (!container) return;
    
    // Check if colours are defined
    const colours = typeof sprayColours !== 'undefined' ? sprayColours : [];
    
    if (colours.length === 0) {
        container.innerHTML = `<div style="color: #f59e0b; font-size: 12px; padding: 15px; text-align: center; background: #3d3000; border-radius: 6px; border: 1px solid #f59e0b;">
            ⚠️ <strong>Define colours first!</strong><br>
            <span style="font-size: 11px;">Go to Spray Section in checklist and add colours before adding spray items.</span>
        </div>`;
        return;
    }
    
    if (currentSprayItems.length === 0) {
        container.innerHTML = `<div style="color: #666; font-size: 11px; padding: 10px; text-align: center;">No spray items. Click "+ Add Item" to add.</div>`;
        return;
    }
    
    // Build colour options
    const colourOptions = colours.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead><tr style="background: #2a2a3a;">
                <th style="padding: 6px; border: 1px solid #3e3e42;">#</th>
                <th style="padding: 6px; border: 1px solid #3e3e42;">Name/Type</th>
                <th style="padding: 6px; border: 1px solid #3e3e42;">W</th>
                <th style="padding: 6px; border: 1px solid #3e3e42;">H</th>
                <th style="padding: 6px; border: 1px solid #3e3e42;">D</th>
                <th style="padding: 6px; border: 1px solid #3e3e42;">Colour</th>
                <th style="padding: 6px; border: 1px solid #3e3e42;">Notes</th>
                <th style="padding: 6px; border: 1px solid #3e3e42; width: 50px;"></th>
            </tr></thead>
            <tbody>${currentSprayItems.map((item, idx) => {
                const projectNum = projectData.project?.project_number || '';
                const shortProjectNum = projectNum.split('/')[0] || 'XXX';
                const elementCode = document.getElementById('bomFieldId')?.value || 'X';
                const selectedColour = item.colour || '';
                return `
                <tr>
                    <td style="padding: 4px; border: 1px solid #3e3e42; color: #4a9eff;">${shortProjectNum}-${elementCode}-${idx + 1}</td>
                    <td style="padding: 4px; border: 1px solid #3e3e42;"><input type="text" value="${escapeHtml(item.name)}" onchange="updateSprayItem(${idx}, 'name', this.value)" style="width: 100%; padding: 4px; background: #1e1e1e; border: 1px solid #3e3e42; color: #e8e2d5; font-size: 11px;" placeholder="e.g. Drawer Front"></td>
                    <td style="padding: 4px; border: 1px solid #3e3e42;"><input type="number" value="${item.width || ''}" onchange="updateSprayItem(${idx}, 'width', this.value)" style="width: 60px; padding: 4px; background: #1e1e1e; border: 1px solid #3e3e42; color: #e8e2d5; font-size: 11px;"></td>
                    <td style="padding: 4px; border: 1px solid #3e3e42;"><input type="number" value="${item.height || ''}" onchange="updateSprayItem(${idx}, 'height', this.value)" style="width: 60px; padding: 4px; background: #1e1e1e; border: 1px solid #3e3e42; color: #e8e2d5; font-size: 11px;"></td>
                    <td style="padding: 4px; border: 1px solid #3e3e42;"><input type="number" value="${item.depth || ''}" onchange="updateSprayItem(${idx}, 'depth', this.value)" style="width: 50px; padding: 4px; background: #1e1e1e; border: 1px solid #3e3e42; color: #e8e2d5; font-size: 11px;"></td>
                    <td style="padding: 4px; border: 1px solid #3e3e42;">
                        <select onchange="updateSprayItem(${idx}, 'colour', this.value)" style="width: 100%; padding: 4px; background: #1e1e1e; border: 1px solid #3e3e42; color: #e8e2d5; font-size: 11px;">
                            <option value="">-- Select --</option>
                            ${colours.map(c => `<option value="${escapeHtml(c)}" ${selectedColour === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                        </select>
                    </td>
                    <td style="padding: 4px; border: 1px solid #3e3e42;"><input type="text" value="${escapeHtml(item.notes)}" onchange="updateSprayItem(${idx}, 'notes', this.value)" style="width: 100%; padding: 4px; background: #1e1e1e; border: 1px solid #3e3e42; color: #e8e2d5; font-size: 11px;" placeholder="both sides"></td>
                    <td style="padding: 4px; border: 1px solid #3e3e42; text-align: center;"><button onclick="removeSprayItem(${idx})" style="background: #ef4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">✕</button></td>
                </tr>
            `}).join('')}</tbody>
        </table>
    `;
}

function addSprayItem() {
    // Check if colours are defined
    const colours = typeof sprayColours !== 'undefined' ? sprayColours : [];
    if (colours.length === 0) {
        showToast('Define colours in Spray Section first!', 'error');
        return;
    }
    
    // Kopiuj wartości z poprzedniego wiersza (colour, notes) lub ustaw pierwszy kolor
    const lastItem = currentSprayItems.length > 0 ? currentSprayItems[currentSprayItems.length - 1] : null;
    currentSprayItems.push({ 
        name: '', 
        width: null, 
        height: null, 
        depth: null, 
        colour: lastItem?.colour || colours[0] || '', 
        notes: lastItem?.notes || '' 
    });
    renderSprayItemsTable();
}

function updateSprayItem(index, field, value) {
    if (currentSprayItems[index]) {
        currentSprayItems[index][field] = (field === 'width' || field === 'height' || field === 'depth') ? (value ? parseInt(value) : null) : value;
    }
}

function removeSprayItem(index) {
    currentSprayItems.splice(index, 1);
    renderSprayItemsTable();
}

function addMultipleSprayItems() {
    // Check if colours are defined
    const colours = typeof sprayColours !== 'undefined' ? sprayColours : [];
    if (colours.length === 0) {
        showToast('Define colours in Spray Section first!', 'error');
        return;
    }
    
    const qty = parseInt(prompt('How many spray items to add?', '4'));
    if (qty && qty > 0 && qty <= 20) {
        // Kopiuj wartości z ostatniego istniejącego wiersza
        const lastItem = currentSprayItems.length > 0 ? currentSprayItems[currentSprayItems.length - 1] : null;
        for (let i = 0; i < qty; i++) {
            currentSprayItems.push({ 
                name: '', 
                width: null, 
                height: null, 
                depth: null, 
                colour: lastItem?.colour || colours[0] || '', 
                notes: lastItem?.notes || '' 
            });
        }
        renderSprayItemsTable();
    }
}

function collectFormData() {
    const type = document.getElementById('bomElementType').value;
    const config = BOM_FIELDS[type];
    if (!config) return null;
    const data = {
        project_id: projectId,
        element_type: type,
        element_id: document.getElementById('bomFieldId')?.value.trim() || null,
        name: document.getElementById('bomFieldName')?.value.trim() || null,
        qty: config.hasQty ? (parseInt(document.getElementById('bomFieldQty')?.value) || 1) : 1,
        description: document.getElementById('bomField_description')?.value.trim() || null,
        sort_order: editingElementId ? undefined : projectData.elements.length
    };
    config.fields.forEach(field => {
        const fieldEl = document.getElementById(`bomField_${field.id}`);
        if (fieldEl) data[field.id] = field.type === 'number' ? (parseInt(fieldEl.value) || null) : (fieldEl.value.trim() || null);
    });
    return data;
}

async function saveBomElement() {
    const type = document.getElementById('bomElementType').value;
    if (!type) { showToast('Please select element type', 'warning'); return; }
    const data = collectFormData();
    if (!data.name) { showToast('Name is required', 'warning'); return; }
    Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
    
    // Wyczyść pola warunkowe gdy warunek nie jest spełniony
    if (type === 'internalDoors') {
        // Locks
        const locksQty = parseInt(data.locks_qty) || 0;
        if (locksQty < 2) data.lock_2 = null;
        if (locksQty < 3) data.lock_3 = null;
        // Fire rating
        if (data.fire_rating !== 'FD30' && data.fire_rating !== 'FD60') {
            data.intumescent_set = null;
            data.self_closer = null;
        }
        // Glazed
        if (data.glazed !== 'Yes') {
            data.glass_type = null;
        }
    }
    
    if (type === 'externalDoors') {
        // Glazed
        if (data.glazed !== 'Yes') {
            data.glass_type = null;
            data.glass_thickness = null;
        }
    }
    
    if (type === 'partition') {
        // Panel type
        if (data.panel_type !== 'Glazed' && data.panel_type !== 'Mixed') {
            data.glass_type = null;
            data.glass_thickness = null;
        }
        // Door included
        if (data.door_included !== 'Yes') {
            data.door_handing = null;
            data.door_lock = null;
        }
    }
    
    try {
        let elementId = editingElementId;
        if (editingElementId) {
            const { error } = await supabaseClient.from('project_elements').update(data).eq('id', editingElementId);
            if (error) throw error;
            const index = projectData.elements.findIndex(e => e.id === editingElementId);
            if (index !== -1) projectData.elements[index] = { ...projectData.elements[index], ...data };
            showToast('Element updated!', 'success');
        } else {
            const { data: newData, error } = await supabaseClient.from('project_elements').insert(data).select().single();
            if (error) throw error;
            elementId = newData.id;
            projectData.elements.push(newData);
            showToast('Element added!', 'success');
            saveLastValues(type, data);
        }
        
        if (currentSprayItems.length > 0 && elementId) await saveSprayItems(elementId, data.element_id);
        
        const config = BOM_FIELDS[type];
        if (config?.isAdditional && elementId) await saveAdditionalAsSprayItem(elementId, data);
        
        if (!editingElementId) {
            clearBomFormPartial();
            currentSprayItems = [];
            renderSprayItemsTable();
        } else {
            cancelBomEdit();
        }
        renderBomTable();
    } catch (err) {
        console.error('Error saving element:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function saveSprayItems(elementId, elementCode) {
    if (!elementId) return;
    
    // Jeśli brak spray items, tylko usuń stare
    if (currentSprayItems.length === 0) {
        await supabaseClient.from('project_spray_items').delete().eq('element_id', elementId);
        return;
    }
    
    // Get project prefix
    const projectNum = projectData.project?.project_number || '';
    const projectPrefix = projectNum.split('/')[0] || '';
    
    try {
        // 1. Pobierz IDs starych rekordów PRZED insertem
        const { data: oldItems } = await supabaseClient
            .from('project_spray_items')
            .select('id')
            .eq('element_id', elementId);
        const oldIds = (oldItems || []).map(i => i.id);
        
        // 2. Insert nowe rekordy - z pełnym numerem projektu
        const sprayItemsData = currentSprayItems.map((item, idx) => ({
            project_id: projectId,
            element_id: elementId,
            item_type: item.name || 'Item',
            name: projectPrefix && elementCode 
                ? `${projectPrefix}-${elementCode}-${idx + 1} ${item.name || 'Item'}` 
                : `${elementCode || 'EL'} - ${item.name || 'Item ' + (idx + 1)}`,
            width: item.width,
            height: item.height,
            depth: item.depth,
            colour: item.colour,
            notes: item.notes,
            sort_order: idx
        }));
        const { error } = await supabaseClient.from('project_spray_items').insert(sprayItemsData);
        if (error) throw error;
        
        // 3. Dopiero po SUKCESIE insertu - usuń stare
        if (oldIds.length > 0) {
            await supabaseClient.from('project_spray_items').delete().in('id', oldIds);
        }
    } catch (err) {
        console.error('Error saving spray items:', err);
        showToast('Warning: Spray items may not have saved', 'warning');
    }
}

async function saveAdditionalAsSprayItem(elementId, elementData) {
    try {
        // Sprawdź czy już istnieje spray item dla tego elementu
        const { data: existing } = await supabaseClient
            .from('project_spray_items')
            .select('id')
            .eq('element_id', elementId)
            .limit(1);
        
        const sprayItemData = {
            project_id: projectId,
            element_id: elementId,
            item_type: elementData.item_type || elementData.name,
            name: `${elementData.element_id || 'ADD'} - ${elementData.name}`,
            width: elementData.width,
            height: elementData.height,
            depth: elementData.depth,
            colour: elementData.colour,
            notes: elementData.description,
            sort_order: 0
        };
        
        if (existing && existing.length > 0) {
            // Update istniejącego
            const { error } = await supabaseClient
                .from('project_spray_items')
                .update(sprayItemData)
                .eq('id', existing[0].id);
            if (error) throw error;
        } else {
            // Insert nowego
            const { error } = await supabaseClient
                .from('project_spray_items')
                .insert(sprayItemData);
            if (error) throw error;
        }
    } catch (err) {
        console.error('Error saving additional as spray item:', err);
    }
}

async function loadSprayItems(elementId) {
    if (!elementId) return;
    try {
        const { data, error } = await supabaseClient.from('project_spray_items').select('*').eq('element_id', elementId).order('sort_order');
        if (error) throw error;
        currentSprayItems = (data || []).map(item => ({ id: item.id, name: item.item_type || '', width: item.width, height: item.height, depth: item.depth, colour: item.colour, notes: item.notes }));
        renderSprayItemsTable();
    } catch (err) {
        console.error('Error loading spray items:', err);
    }
}

function clearBomFormPartial() {
    document.getElementById('bomFieldId').value = '';
    document.getElementById('bomFieldName').value = '';
    document.getElementById('bomFieldId').focus();
}

async function editBomElement(elementId) {
    const element = projectData.elements.find(e => e.id === elementId);
    if (!element) return;
    editingElementId = elementId;
    const typeSelect = document.getElementById('bomElementType');
    typeSelect.value = element.element_type || 'other';
    onElementTypeChange();
    await loadSprayItems(elementId);
    setTimeout(() => {
        const idField = document.getElementById('bomFieldId');
        const nameField = document.getElementById('bomFieldName');
        const qtyField = document.getElementById('bomFieldQty');
        if (idField) idField.value = element.element_id || '';
        if (nameField) nameField.value = element.name || '';
        if (qtyField) qtyField.value = element.qty || 1;
        const config = BOM_FIELDS[element.element_type];
        if (config) {
            config.fields.forEach(field => {
                const fieldEl = document.getElementById(`bomField_${field.id}`);
                if (fieldEl && element[field.id] !== undefined) fieldEl.value = element[field.id] || '';
            });
        }
        const description = document.getElementById('bomField_description');
        if (description) description.value = element.description || '';
        updateConditionalFields();
        document.getElementById('bomFormTitle').textContent = '✏️ Edit Element';
        document.getElementById('bomSaveBtn').textContent = 'Update Element';
        document.getElementById('bomCancelBtn').style.display = 'inline-block';
    }, 50);
}

function cancelBomEdit() {
    editingElementId = null;
    currentSprayItems = [];
    document.getElementById('bomFormTitle').textContent = '➕ Add New Element';
    document.getElementById('bomSaveBtn').textContent = '+ Add Element';
    document.getElementById('bomCancelBtn').style.display = 'none';
    const type = document.getElementById('bomElementType').value;
    if (type) renderBomForm(type);
}

async function deleteBomElement(elementId) {
    if (!confirm('Delete this element?')) return;
    try {
        const { error } = await supabaseClient.from('project_elements').delete().eq('id', elementId);
        if (error) throw error;
        projectData.elements = projectData.elements.filter(e => e.id !== elementId);
        renderBomTable();
        showToast('Element deleted', 'success');
    } catch (err) {
        console.error('Error deleting element:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

function renderBomTable() {
    const tbody = document.getElementById('bomTableBody');
    const emptyMsg = document.getElementById('bomEmpty');
    if (projectData.elements.length === 0) { tbody.innerHTML = ''; emptyMsg.style.display = 'block'; return; }
    emptyMsg.style.display = 'none';
    tbody.innerHTML = projectData.elements.map((el) => {
        const config = BOM_FIELDS[el.element_type] || BOM_FIELDS.other;
        const typeLabel = config?.label || el.element_type || 'Other';
        const isAdditional = config?.isAdditional;
        let sizeStr = '-';
        if (el.width && el.height) { sizeStr = `${el.width} x ${el.height}`; if (el.depth) sizeStr += ` x ${el.depth}`; }
        let details = escapeHtml(getElementDetails(el));
        const projectPrefix = (projectData.project?.project_number || '').split('/')[0] || '';
        const fullElementId = projectPrefix ? `${projectPrefix}-${el.element_id || '-'}` : (el.element_id || '-');
        return `
            <tr style="border-bottom: 1px solid #3e3e42; ${isAdditional ? 'background: #1a2a1a;' : ''}">
                <td style="padding: 10px; color: ${isAdditional ? '#22c55e' : '#4a9eff'}; font-weight: 600;">${escapeHtml(fullElementId)}</td>
                <td style="padding: 10px;"><span style="background: ${isAdditional ? '#22c55e' : '#3e3e42'}; color: ${isAdditional ? '#000' : '#fff'}; padding: 2px 8px; border-radius: 4px; font-size: 10px;">${escapeHtml(typeLabel)}</span></td>
                <td style="padding: 10px;"><div style="color: #e8e2d5;">${escapeHtml(el.name)}</div>${el.description ? `<div style="font-size: 10px; color: #888; margin-top: 2px;">${escapeHtml(el.description)}</div>` : ''}</td>
                <td style="padding: 10px; text-align: center;">${sizeStr}</td>
                <td style="padding: 10px; font-size: 11px; color: #888;">${details}</td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="editBomElement('${el.id}')" style="background: #4a9eff; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 5px;">Edit</button>
                    <button onclick="deleteBomElement('${el.id}')" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function getElementDetails(el) {
    const parts = [];
    switch (el.element_type) {
        case 'sash': if (el.sash_box) parts.push(el.sash_box); if (el.opening_type) parts.push(el.opening_type); if (el.bars === 'Yes') parts.push('Bars'); if (el.glass_type) parts.push(el.glass_type); break;
        case 'casement': if (el.opening_type) parts.push(el.opening_type); if (el.bars === 'Yes') parts.push('Bars'); if (el.glass_type) parts.push(el.glass_type); break;
        case 'internalDoors': if (el.door_type) parts.push(el.door_type); if (el.fire_rating && el.fire_rating !== 'NFR') parts.push(el.fire_rating); if (el.door_handing) parts.push(el.door_handing); if (el.lock_1) parts.push(el.lock_1); if (el.lock_2) parts.push(el.lock_2); if (el.lock_3) parts.push(el.lock_3); if (el.self_closer && el.self_closer !== 'No Selfcloser') parts.push('Closer: ' + el.self_closer); break;
        case 'externalDoors': if (el.external_door_type) parts.push(el.external_door_type); if (el.threshold) parts.push(el.threshold); break;
        case 'kitchen': if (el.unit_type) parts.push(el.unit_type); if (el.front_style) parts.push(el.front_style); if (el.handle_type) parts.push(el.handle_type); break;
        case 'kitchenAdditional': case 'wardrobeAdditional': case 'doorAdditional': case 'windowAdditional': case 'internalDoorsAdditional': case 'additionalProject': if (el.item_type) parts.push(el.item_type); if (el.material) parts.push(el.material); if (el.qty > 1) parts.push(`Qty: ${el.qty}`); break;
        case 'wardrobe': if (el.wardrobe_shape) parts.push(el.wardrobe_shape); if (el.door_style) parts.push(el.door_style); break;
        case 'partition': if (el.panel_type) parts.push(el.panel_type); if (el.door_included === 'Yes') parts.push('With Door'); break;
        case 'externalSpray': if (el.qty > 1) parts.push(`Qty: ${el.qty}`); if (el.item_type) parts.push(el.item_type); if (el.sheen_level) parts.push(el.sheen_level); break;
        default: if (el.material) parts.push(el.material); if (el.qty > 1) parts.push(`Qty: ${el.qty}`);
    }
    return parts.join(' • ') || '-';
}

function clearBomForm() {
    document.getElementById('bomElementType').value = '';
    onElementTypeChange();
    editingElementId = null;
    currentSprayItems = [];
}