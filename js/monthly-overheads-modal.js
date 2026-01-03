// ========================================
// MONTHLY OVERHEADS MODAL - Dynamic Management
// ========================================

let currentOverheadItems = {
    property: [],
    operations: [],
    admin: [],
    financial: [],
    machinery: [],
    other: []
};

let categoryExpanded = {
    property: false,
    operations: false,
    admin: false,
    financial: false,
    machinery: false,
    other: false
};

// Open modal
function openMonthlySettingsModal() {
    document.getElementById('monthlySettingsModal').classList.add('active');
    
    const input = document.getElementById('settingsMonth');
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Set value (Flatpickr will be initialized by MutationObserver in menu.js)
    if (input._flatpickr) {
        input._flatpickr.setDate(currentMonth);
    } else {
        input.value = currentMonth;
    }
    
    // Small delay to let Flatpickr initialize
    setTimeout(() => loadMonthOverheads(), 100);
}

// Close modal
function closeMonthlySettingsModal() {
    document.getElementById('monthlySettingsModal').classList.remove('active');
}

// Load overhead data for selected month
async function loadMonthOverheads() {
    const month = document.getElementById('settingsMonth').value;
    
    if (!month) {
        showToast('Please select a month', 'warning');
        return;
    }
    
    try {
        // Load overhead items from database
        const { data, error } = await supabaseClient
            .from('overhead_items')
            .select('*')
            .eq('month', month)
            .order('category', { ascending: true })
            .order('item_name', { ascending: true });
        
        if (error) throw error;
        
        // Reset current items
        currentOverheadItems = {
            property: [],
            operations: [],
            admin: [],
            financial: [],
            machinery: [],
            other: []
        };
        
        // Group by category
        if (data && data.length > 0) {
            data.forEach(item => {
                if (currentOverheadItems[item.category]) {
                    currentOverheadItems[item.category].push(item);
                }
            });
        }
        
        // Render all categories
        renderAllCategories();
        calculateTotals();
        
    } catch (err) {
        console.error('Error loading overheads:', err);
        showToast('Error loading: ' + err.message, 'error');
    }
}

// Render all categories
function renderAllCategories() {
    renderCategoryItems('property');
    renderCategoryItems('operations');
    renderCategoryItems('admin');
    renderCategoryItems('financial');
    renderCategoryItems('machinery');
    renderCategoryItems('other');
}

// Render items for a category
function renderCategoryItems(category) {
    const container = document.getElementById(`${category}Items`);
    const items = currentOverheadItems[category];
    
    // Clear existing items (except the add button)
    const addButton = container.querySelector('.add-item-btn');
    container.innerHTML = '';
    
    // Render items
    items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'display: grid; grid-template-columns: 1.8fr 0.8fr 40px; gap: 10px; margin-bottom: 8px; align-items: center;';
        
        itemDiv.innerHTML = `
            <input type="text" 
                   value="${item.item_name}" 
                   onchange="updateItemName('${category}', ${index}, this.value)"
                   placeholder="Item name"
                   style="padding: 8px 10px; background: #18181b; border: 1px solid #3f3f46; color: #d4d4d8; border-radius: 2px; font-size: 12px;">
            <input type="number" 
                   value="${item.amount}" 
                   onchange="updateItemAmount('${category}', ${index}, this.value)"
                   step="0.01"
                   min="0"
                   placeholder="0.00"
                   style="padding: 8px 10px; background: #18181b; border: 1px solid #3f3f46; color: #d4d4d8; border-radius: 2px; font-size: 12px; font-family: monospace;">
            <button onclick="deleteItem('${category}', ${index})" 
                    style="padding: 8px; background: #dc2626; border: 1px solid #b91c1c; color: white; border-radius: 2px; cursor: pointer; font-size: 12px; transition: all 0.2s;">
                ×
            </button>
        `;
        
        container.appendChild(itemDiv);
    });
    
    // Re-add the add button
    if (addButton) {
        container.appendChild(addButton);
    }
}

// Add new item to category
function addOverheadItem(category) {
    currentOverheadItems[category].push({
        id: null, // Will be generated on save
        month: document.getElementById('settingsMonth').value,
        category: category,
        item_name: '',
        amount: 0,
        notes: null
    });
    
    renderCategoryItems(category);
    calculateTotals();
}

// Update item name
function updateItemName(category, index, newName) {
    if (currentOverheadItems[category][index]) {
        currentOverheadItems[category][index].item_name = newName;
    }
}

// Update item amount
function updateItemAmount(category, index, newAmount) {
    if (currentOverheadItems[category][index]) {
        currentOverheadItems[category][index].amount = parseFloat(newAmount) || 0;
        calculateTotals();
    }
}

// Delete item
function deleteItem(category, index) {
    if (confirm('Delete this item?')) {
        currentOverheadItems[category].splice(index, 1);
        renderCategoryItems(category);
        calculateTotals();
    }
}

// Toggle category expand/collapse
function toggleCategory(category) {
    const itemsDiv = document.getElementById(`${category}Items`);
    const toggleIcon = document.getElementById(`${category}Toggle`);
    
    if (categoryExpanded[category]) {
        // Collapse
        itemsDiv.style.display = 'none';
        toggleIcon.textContent = '▶';
        categoryExpanded[category] = false;
    } else {
        // Expand
        itemsDiv.style.display = 'block';
        toggleIcon.textContent = '▼';
        categoryExpanded[category] = true;
    }
}

// Calculate totals
function calculateTotals() {
    const categories = ['property', 'operations', 'admin', 'financial', 'machinery', 'other'];
    let grandTotal = 0;
    
    categories.forEach(category => {
        const items = currentOverheadItems[category];
        const categoryTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        
        // Update category total display
        document.getElementById(`${category}Total`).textContent = `£${categoryTotal.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        grandTotal += categoryTotal;
    });
    
    // Update grand total
    document.getElementById('totalOverheadsCost').textContent = `£${grandTotal.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Save all overhead items
async function saveMonthlyOverheads() {
    const month = document.getElementById('settingsMonth').value;
    
    if (!month) {
        showToast('Please select a month', 'warning');
        return;
    }
    
    try {
        // Collect all items from all categories
        const allItems = [];
        
        Object.keys(currentOverheadItems).forEach(category => {
            currentOverheadItems[category].forEach(item => {
                // Only save items with names
                if (item.item_name && item.item_name.trim() !== '') {
                    allItems.push({
                        month: month,
                        category: category,
                        item_name: item.item_name.trim(),
                        amount: parseFloat(item.amount) || 0,
                        notes: item.notes || null
                    });
                }
            });
        });
        
        if (allItems.length === 0) {
            showToast('Please add at least one overhead item', 'warning');
            return;
        }
        
        // Check for duplicates within the same category
        const itemKeys = new Set();
        for (const item of allItems) {
            const key = `${item.month}-${item.category}-${item.item_name}`;
            if (itemKeys.has(key)) {
                showToast(`Duplicate item found: "${item.item_name}" in ${item.category}. Each item name must be unique within its category.`, 'info');
                return;
            }
            itemKeys.add(key);
        }
        
        // Delete existing items for this month first
        const { error: deleteError } = await supabaseClient
            .from('overhead_items')
            .delete()
            .eq('month', month);
        
        if (deleteError) throw deleteError;
        
        // Insert all new items
        const { error: insertError } = await supabaseClient
            .from('overhead_items')
            .insert(allItems);
        
        if (insertError) throw insertError;
        
        // Calculate total and update monthly_overheads table
        const total = allItems.reduce((sum, item) => sum + item.amount, 0);
        const year = parseInt(month.split('-')[0]);
        
        const { error: updateError } = await supabaseClient
            .from('monthly_overheads')
            .upsert({
                month: month,
                year: year,
                overheads_value: total
            }, { onConflict: 'month' });
        
        if (updateError) throw updateError;
        
        // Mark as confirmed for this month (disable 1st day reminder)
        if (typeof markOverheadsConfirmed === 'function') {
            markOverheadsConfirmed();
        }
        
        showToast('Monthly overheads saved successfully!', 'success');
        closeMonthlySettingsModal();
        
        // Refresh accounting data
        if (typeof refreshAccountingData === 'function') {
            await refreshAccountingData();
        }
        
    } catch (err) {
        console.error('Error saving overheads:', err);
        showToast('Error saving: ' + err.message, 'error');
    }
}

// Copy from previous month
async function copyFromPreviousMonth() {
    const currentMonth = document.getElementById('settingsMonth').value;
    
    if (!currentMonth) {
        showToast('Please select a month first', 'warning');
        return;
    }
    
    if (!confirm('Copy all overhead items from previous month?')) {
        return;
    }
    
    try {
        // Calculate previous month
        const [year, month] = currentMonth.split('-').map(Number);
        const prevDate = new Date(year, month - 2, 1); // month-2 bo month jest 1-indexed, a chcemy poprzedni
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Load previous month data
        const { data: prevData, error: loadError } = await supabaseClient
            .from('overhead_items')
            .select('*')
            .eq('month', prevMonth);
        
        if (loadError) throw loadError;
        
        if (!prevData || prevData.length === 0) {
            showToast(`No data found for previous month (${prevMonth})`, 'info');
            return;
        }
        
        // Delete current month data first
        const { error: deleteError } = await supabaseClient
            .from('overhead_items')
            .delete()
            .eq('month', currentMonth);
        
        if (deleteError) throw deleteError;
        
        // Insert copied data with new month
        const copiedItems = prevData.map(item => ({
            month: currentMonth,
            category: item.category,
            item_name: item.item_name,
            amount: item.amount,
            notes: item.notes || null
        }));
        
        const { error: insertError } = await supabaseClient
            .from('overhead_items')
            .insert(copiedItems);
        
        if (insertError) throw insertError;
        
        showToast(`Copied ${copiedItems.length} items from ${prevMonth}`, 'success');
        loadMonthOverheads();
        
    } catch (err) {
        console.error('Error copying from previous month:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Modal click outside to close
    window.onclick = function(event) {
        const modal = document.getElementById('monthlySettingsModal');
        if (event.target === modal) {
            closeMonthlySettingsModal();
        }
    };
});