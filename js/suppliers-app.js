// ========== SUPPLIERS MANAGEMENT ==========

let suppliers = [];

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    await loadSuppliers();
});

// Load suppliers
async function loadSuppliers() {
    try {
        const { data, error } = await supabaseClient
            .from('suppliers')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        suppliers = data || [];
        
        renderSuppliersTable();
        
    } catch (err) {
        showToast('Error loading suppliers', 'error');
    }
}

// Render suppliers table
function renderSuppliersTable() {
    const container = document.getElementById('suppliersContainer');
    
    if (suppliers.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666; background: #2d2d30; border-radius: 5px;">
                <div style="font-size: 48px; margin-bottom: 15px;">🚚</div>
                <div style="font-size: 18px;">No suppliers found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Supplier" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; background: #2d2d30; border-radius: 5px; overflow: hidden;">
            <thead style="background: #252526;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">CONTACT</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">EMAIL</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">PHONE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">WEBSITE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${suppliers.map(supplier => createSupplierRow(supplier)).join('')}
            </tbody>
        </table>
    `;
}

// Create supplier row
function createSupplierRow(supplier) {
    // Fix website URL - ensure it has protocol
    let websiteUrl = supplier.website;
    if (websiteUrl) {
        // If doesn't start with http:// or https://, add https://
        if (!/^https?:\/\//i.test(websiteUrl)) {
            websiteUrl = 'https://' + websiteUrl;
        }
    }
    
    return `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${supplier.name}</div>
                ${supplier.notes ? `<div style="font-size: 11px; color: #999; margin-top: 3px;">${supplier.notes}</div>` : ''}
            </td>
            <td style="padding: 12px; color: #e8e2d5;">
                ${supplier.contact_person || '-'}
            </td>
            <td style="padding: 12px;">
                ${supplier.email ? `<a href="mailto:${supplier.email}" style="color: #4CAF50; text-decoration: none;">${supplier.email}</a>` : '-'}
            </td>
            <td style="padding: 12px; color: #e8e2d5;">
                ${supplier.phone || '-'}
            </td>
            <td style="padding: 12px;">
                ${websiteUrl ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" style="color: #2196F3; text-decoration: none;">🔗 Visit</a>` : '-'}
            </td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="editSupplier('${supplier.id}')" class="toolbar-btn" style="padding: 6px 12px; font-size: 11px;">✏️ Edit</button>
            </td>
        </tr>
    `;
}

// Open add modal
function openAddSupplierModal() {
    document.getElementById('supplierModalTitle').textContent = 'Add Supplier';
    document.getElementById('supplierId').value = '';
    document.getElementById('supplierName').value = '';
    document.getElementById('supplierContact').value = '';
    document.getElementById('supplierEmail').value = '';
    document.getElementById('supplierPhone').value = '';
    document.getElementById('supplierWebsite').value = '';
    document.getElementById('supplierNotes').value = '';
    
    document.getElementById('deleteSupplierBtn').style.display = 'none';
    document.getElementById('supplierModal').classList.add('active');
}

// Edit supplier
function editSupplier(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
        showToast('Supplier not found', 'info');
        return;
    }
    
    document.getElementById('supplierModalTitle').textContent = 'Edit Supplier';
    document.getElementById('supplierId').value = supplier.id;
    document.getElementById('supplierName').value = supplier.name || '';
    document.getElementById('supplierContact').value = supplier.contact_person || '';
    document.getElementById('supplierEmail').value = supplier.email || '';
    document.getElementById('supplierPhone').value = supplier.phone || '';
    document.getElementById('supplierWebsite').value = supplier.website || '';
    document.getElementById('supplierNotes').value = supplier.notes || '';
    
    document.getElementById('deleteSupplierBtn').style.display = 'block';
    document.getElementById('supplierModal').classList.add('active');
}

// Save supplier
async function saveSupplier() {
    const id = document.getElementById('supplierId').value;
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
        const supplierData = {
            name,
            contact_person: contact || null,
            email: email || null,
            phone: phone || null,
            website: website || null,
            notes: notes || null
        };
        
        if (id) {
            // Update existing
            const { error } = await supabaseClient
                .from('suppliers')
                .update(supplierData)
                .eq('id', id);
            
            if (error) throw error;
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('suppliers')
                .insert([supplierData]);
            
            if (error) throw error;
        }
        
        closeModal('supplierModal');
        await loadSuppliers();
        
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Delete supplier
async function deleteSupplier() {
    const id = document.getElementById('supplierId').value;
    const supplier = suppliers.find(s => s.id === id);
    
    if (!confirm(`Delete supplier "${supplier.name}"?`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('suppliers')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        closeModal('supplierModal');
        await loadSuppliers();
        
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ========== PERMISSIONS: READ-ONLY FOR MANAGER/WORKER ==========
window.addEventListener("permissionsLoaded", function() {
    if (!window.currentUserRole) return;
    
    
    // Manager/Worker/Viewer = read-only mode (for Suppliers - TYLKO Worker i Viewer, Manager ma full access)
    if (window.currentUserRole === "worker" || window.currentUserRole === "viewer") {
        // Hide action buttons
        const buttonsToHide = [
            "button[onclick*=\"openAddSupplierModal\"]",
            ".action-btn.edit",
            ".action-btn.delete"
        ];
        
        buttonsToHide.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => btn.style.display = "none");
        });
        
    }
});