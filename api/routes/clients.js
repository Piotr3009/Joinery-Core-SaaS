/**
 * Joinery Core SaaS - Clients Routes
 * CRUD dla klientów
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
 * GET /api/clients
 * Lista wszystkich klientów
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('tenant_id', req.user.tenant_id)
            .order('name');

        if (error) throw error;

        res.json({ clients: data });

    } catch (err) {
        console.error('Get clients error:', err);
        res.status(500).json({ error: 'Failed to get clients' });
    }
});

/**
 * GET /api/clients/:id
 * Szczegóły klienta
 */
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clients')
            .select(`
                *,
                projects (*),
                pipeline_projects (*)
            `)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Client not found' });
            }
            throw error;
        }

        res.json({ client: data });

    } catch (err) {
        console.error('Get client error:', err);
        res.status(500).json({ error: 'Failed to get client' });
    }
});

/**
 * POST /api/clients
 * Utwórz nowego klienta
 */
router.post('/', async (req, res) => {
    try {
        const clientData = {
            ...req.body,
            tenant_id: req.user.tenant_id
        };

        // Generuj numer klienta jeśli nie podano
        if (!clientData.client_number) {
            const { data: lastClient } = await supabase
                .from('clients')
                .select('client_number')
                .eq('tenant_id', req.user.tenant_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let nextNum = 1;
            if (lastClient && lastClient.client_number) {
                const match = lastClient.client_number.match(/CL(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            
            clientData.client_number = `CL${String(nextNum).padStart(4, '0')}`;
        }

        const { data, error } = await supabase
            .from('clients')
            .insert(clientData)
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ client: data });

    } catch (err) {
        console.error('Create client error:', err);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

/**
 * PUT /api/clients/:id
 * Aktualizuj klienta
 */
router.put('/:id', async (req, res) => {
    try {
        const { id, tenant_id, created_at, ...updateData } = req.body;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Client not found' });
            }
            throw error;
        }

        res.json({ client: data });

    } catch (err) {
        console.error('Update client error:', err);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

/**
 * DELETE /api/clients/:id
 * Usuń klienta
 */
router.delete('/:id', async (req, res) => {
    try {
        // Sprawdź czy klient ma projekty
        const { data: projects } = await supabase
            .from('projects')
            .select('id')
            .eq('client_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .limit(1);

        if (projects && projects.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete client with active projects. Archive or delete projects first.' 
            });
        }

        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        if (error) throw error;

        res.json({ message: 'Client deleted successfully' });

    } catch (err) {
        console.error('Delete client error:', err);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

/**
 * GET /api/clients/:id/projects
 * Lista projektów klienta
 */
router.get('/:id/projects', async (req, res) => {
    try {
        const { data: production } = await supabase
            .from('projects')
            .select('*')
            .eq('client_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .order('created_at', { ascending: false });

        const { data: pipeline } = await supabase
            .from('pipeline_projects')
            .select('*')
            .eq('client_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .order('created_at', { ascending: false });

        res.json({ 
            production_projects: production || [],
            pipeline_projects: pipeline || []
        });

    } catch (err) {
        console.error('Get client projects error:', err);
        res.status(500).json({ error: 'Failed to get client projects' });
    }
});

module.exports = router;
