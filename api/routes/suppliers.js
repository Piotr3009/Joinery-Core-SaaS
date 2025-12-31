/**
 * Joinery Core SaaS - Suppliers Routes
 * CRUD dla dostawców
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

/**
 * GET /api/suppliers
 * Lista dostawców
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('tenant_id', req.user.tenant_id)
            .order('name');

        if (error) throw error;

        res.json({ suppliers: data });

    } catch (err) {
        console.error('Get suppliers error:', err);
        res.status(500).json({ error: 'Failed to get suppliers' });
    }
});

/**
 * GET /api/suppliers/:id
 * Szczegóły dostawcy
 */
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('suppliers')
            .select(`
                *,
                stock_orders (*)
            `)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Supplier not found' });
            }
            throw error;
        }

        res.json({ supplier: data });

    } catch (err) {
        console.error('Get supplier error:', err);
        res.status(500).json({ error: 'Failed to get supplier' });
    }
});

/**
 * POST /api/suppliers
 * Utwórz dostawcę
 */
router.post('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('suppliers')
            .insert({
                ...req.body,
                tenant_id: req.user.tenant_id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ supplier: data });

    } catch (err) {
        console.error('Create supplier error:', err);
        res.status(500).json({ error: 'Failed to create supplier' });
    }
});

/**
 * PUT /api/suppliers/:id
 * Aktualizuj dostawcę
 */
router.put('/:id', async (req, res) => {
    try {
        const { id, tenant_id, created_at, ...updateData } = req.body;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('suppliers')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ supplier: data });

    } catch (err) {
        console.error('Update supplier error:', err);
        res.status(500).json({ error: 'Failed to update supplier' });
    }
});

/**
 * DELETE /api/suppliers/:id
 * Usuń dostawcę
 */
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        if (error) throw error;

        res.json({ message: 'Supplier deleted' });

    } catch (err) {
        console.error('Delete supplier error:', err);
        res.status(500).json({ error: 'Failed to delete supplier' });
    }
});

module.exports = router;
