/**
 * Joinery Core SaaS - Stock Routes
 * CRUD dla magazynu (stock items, categories, transactions)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.use(requireAuth);

// ================== CATEGORIES ==================

/**
 * GET /api/stock/categories
 * Lista kategorii
 */
router.get('/categories', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('stock_categories')
            .select('*')
            .eq('tenant_id', req.user.tenant_id)
            .order('name');

        if (error) throw error;

        res.json({ categories: data });

    } catch (err) {
        console.error('Get categories error:', err);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

/**
 * POST /api/stock/categories
 * Utwórz kategorię
 */
router.post('/categories', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('stock_categories')
            .insert({
                ...req.body,
                tenant_id: req.user.tenant_id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ category: data });

    } catch (err) {
        console.error('Create category error:', err);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

/**
 * DELETE /api/stock/categories/:id
 * Usuń kategorię
 */
router.delete('/categories/:id', async (req, res) => {
    try {
        // Sprawdź czy kategoria ma items
        const { data: items } = await supabase
            .from('stock_items')
            .select('id')
            .eq('category_id', req.params.id)
            .limit(1);

        if (items && items.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with items. Move items first.' 
            });
        }

        const { error } = await supabase
            .from('stock_categories')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        if (error) throw error;

        res.json({ message: 'Category deleted' });

    } catch (err) {
        console.error('Delete category error:', err);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// ================== ITEMS ==================

/**
 * GET /api/stock/items
 * Lista wszystkich items
 */
router.get('/items', async (req, res) => {
    try {
        const { category_id, low_stock } = req.query;

        let query = supabase
            .from('stock_items')
            .select(`
                *,
                category:category_id (id, name)
            `)
            .eq('tenant_id', req.user.tenant_id);

        if (category_id) {
            query = query.eq('category_id', category_id);
        }

        if (low_stock === 'true') {
            query = query.lte('quantity', supabase.raw('min_quantity'));
        }

        const { data, error } = await query.order('name');

        if (error) throw error;

        res.json({ items: data });

    } catch (err) {
        console.error('Get items error:', err);
        res.status(500).json({ error: 'Failed to get items' });
    }
});

/**
 * GET /api/stock/items/:id
 * Szczegóły item
 */
router.get('/items/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('stock_items')
            .select(`
                *,
                category:category_id (*),
                stock_transactions (*)
            `)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Item not found' });
            }
            throw error;
        }

        res.json({ item: data });

    } catch (err) {
        console.error('Get item error:', err);
        res.status(500).json({ error: 'Failed to get item' });
    }
});

/**
 * POST /api/stock/items
 * Utwórz nowy item
 */
router.post('/items', async (req, res) => {
    try {
        const itemData = {
            ...req.body,
            tenant_id: req.user.tenant_id
        };

        // Generuj numer item jeśli nie podano
        if (!itemData.item_number) {
            const { data: lastItem } = await supabase
                .from('stock_items')
                .select('item_number')
                .eq('tenant_id', req.user.tenant_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let nextNum = 1;
            if (lastItem && lastItem.item_number) {
                const match = lastItem.item_number.match(/STK(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            
            itemData.item_number = `STK${String(nextNum).padStart(5, '0')}`;
        }

        const { data, error } = await supabase
            .from('stock_items')
            .insert(itemData)
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ item: data });

    } catch (err) {
        console.error('Create item error:', err);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

/**
 * PUT /api/stock/items/:id
 * Aktualizuj item
 */
router.put('/items/:id', async (req, res) => {
    try {
        const { id, tenant_id, created_at, ...updateData } = req.body;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('stock_items')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ item: data });

    } catch (err) {
        console.error('Update item error:', err);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

/**
 * DELETE /api/stock/items/:id
 * Usuń item
 */
router.delete('/items/:id', async (req, res) => {
    try {
        // Usuń najpierw transakcje
        await supabase
            .from('stock_transactions')
            .delete()
            .eq('stock_item_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        const { error } = await supabase
            .from('stock_items')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        if (error) throw error;

        res.json({ message: 'Item deleted' });

    } catch (err) {
        console.error('Delete item error:', err);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// ================== TRANSACTIONS ==================

/**
 * POST /api/stock/items/:id/transaction
 * Dodaj transakcję (in/out/adjustment)
 */
router.post('/items/:id/transaction', async (req, res) => {
    try {
        const { type, quantity, notes, project_id, project_material_id } = req.body;

        // Pobierz aktualny stan
        const { data: item, error: itemError } = await supabase
            .from('stock_items')
            .select('quantity')
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .single();

        if (itemError || !item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Oblicz nową ilość
        let newQuantity = item.quantity;
        if (type === 'in' || type === 'adjustment_add') {
            newQuantity += quantity;
        } else if (type === 'out' || type === 'adjustment_remove') {
            newQuantity -= quantity;
            if (newQuantity < 0) {
                return res.status(400).json({ error: 'Insufficient stock' });
            }
        }

        // Utwórz transakcję
        const { data: transaction, error: transError } = await supabase
            .from('stock_transactions')
            .insert({
                tenant_id: req.user.tenant_id,
                stock_item_id: req.params.id,
                transaction_type: type,
                quantity: quantity,
                quantity_before: item.quantity,
                quantity_after: newQuantity,
                notes: notes,
                project_id: project_id,
                project_material_id: project_material_id,
                created_by: req.user.id
            })
            .select()
            .single();

        if (transError) throw transError;

        // Aktualizuj stan magazynowy
        await supabase
            .from('stock_items')
            .update({ 
                quantity: newQuantity,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        res.status(201).json({ 
            transaction: transaction,
            new_quantity: newQuantity
        });

    } catch (err) {
        console.error('Create transaction error:', err);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});

/**
 * GET /api/stock/items/:id/transactions
 * Historia transakcji dla item
 */
router.get('/items/:id/transactions', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('stock_transactions')
            .select('*')
            .eq('stock_item_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ transactions: data });

    } catch (err) {
        console.error('Get transactions error:', err);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

// ================== ALERTS ==================

/**
 * GET /api/stock/alerts
 * Lista items z niskim stanem
 */
router.get('/alerts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('stock_items')
            .select(`
                *,
                category:category_id (name)
            `)
            .eq('tenant_id', req.user.tenant_id)
            .filter('quantity', 'lte', supabase.rpc('get_min_quantity'))
            .order('quantity');

        // Alternatywnie, jeśli powyższe nie działa:
        const { data: items, error: itemsError } = await supabase
            .from('stock_items')
            .select(`
                *,
                category:category_id (name)
            `)
            .eq('tenant_id', req.user.tenant_id);

        if (itemsError) throw itemsError;

        // Filtruj w JS
        const lowStock = items.filter(item => item.quantity <= (item.min_quantity || 0));

        res.json({ alerts: lowStock });

    } catch (err) {
        console.error('Get alerts error:', err);
        res.status(500).json({ error: 'Failed to get stock alerts' });
    }
});

module.exports = router;
