/**
 * Joinery Core SaaS - Projects Routes
 * CRUD dla projektów produkcyjnych (production projects)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Wszystkie endpointy wymagają autoryzacji
router.use(requireAuth);

/**
 * GET /api/projects
 * Lista wszystkich projektów dla tenant
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select(`
                *,
                clients:client_id (id, name, company),
                project_phases (*),
                project_materials (*)
            `)
            .eq('tenant_id', req.user.tenant_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ projects: data });

    } catch (err) {
        console.error('Get projects error:', err);
        res.status(500).json({ error: 'Failed to get projects' });
    }
});

/**
 * GET /api/projects/:id
 * Szczegóły pojedynczego projektu
 */
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select(`
                *,
                clients:client_id (*),
                project_phases (*),
                project_materials (*),
                project_files (*),
                project_elements (*),
                project_spray_settings (*),
                project_spray_items (*),
                project_blockers (*),
                project_alerts (*)
            `)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Project not found' });
            }
            throw error;
        }

        res.json({ project: data });

    } catch (err) {
        console.error('Get project error:', err);
        res.status(500).json({ error: 'Failed to get project' });
    }
});

/**
 * POST /api/projects
 * Utwórz nowy projekt
 */
router.post('/', async (req, res) => {
    try {
        const projectData = {
            ...req.body,
            tenant_id: req.user.tenant_id
        };

        // Generuj numer projektu jeśli nie podano
        if (!projectData.project_number) {
            const { data: lastProject } = await supabase
                .from('projects')
                .select('project_number')
                .eq('tenant_id', req.user.tenant_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const year = new Date().getFullYear();
            let nextNum = 1;
            
            if (lastProject && lastProject.project_number) {
                const match = lastProject.project_number.match(/PR(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            
            projectData.project_number = `PR${String(nextNum).padStart(3, '0')}/${year}`;
        }

        const { data, error } = await supabase
            .from('projects')
            .insert(projectData)
            .select()
            .single();

        if (error) throw error;

        // Utwórz domyślne fazy dla projektu
        const { data: phases } = await supabase
            .from('custom_phases')
            .select('*')
            .eq('tenant_id', req.user.tenant_id)
            .eq('phase_type', 'production')
            .order('phase_order');

        if (phases && phases.length > 0) {
            const projectPhases = phases.map(phase => ({
                tenant_id: req.user.tenant_id,
                project_id: data.id,
                phase_key: phase.phase_key,
                status: 'notStarted'
            }));

            await supabase.from('project_phases').insert(projectPhases);
        }

        res.status(201).json({ project: data });

    } catch (err) {
        console.error('Create project error:', err);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

/**
 * PUT /api/projects/:id
 * Aktualizuj projekt
 */
router.put('/:id', async (req, res) => {
    try {
        // Usuń pola których nie można aktualizować
        const { id, tenant_id, created_at, ...updateData } = req.body;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('projects')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Project not found' });
            }
            throw error;
        }

        res.json({ project: data });

    } catch (err) {
        console.error('Update project error:', err);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

/**
 * DELETE /api/projects/:id
 * Usuń projekt
 */
router.delete('/:id', async (req, res) => {
    try {
        // Najpierw usuń powiązane dane
        const projectId = req.params.id;
        const tenantId = req.user.tenant_id;

        // Usuń w odpowiedniej kolejności (FK)
        await supabase.from('project_spray_items').delete().eq('project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_spray_settings').delete().eq('project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_elements').delete().eq('project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_files').delete().eq('production_project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_materials').delete().eq('project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_phases').delete().eq('project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_blockers').delete().eq('project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_alerts').delete().eq('project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_dispatch_items').delete().eq('project_id', projectId).eq('tenant_id', tenantId);

        // Usuń projekt
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId)
            .eq('tenant_id', tenantId);

        if (error) throw error;

        res.json({ message: 'Project deleted successfully' });

    } catch (err) {
        console.error('Delete project error:', err);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

/**
 * PUT /api/projects/:id/phase/:phaseKey
 * Aktualizuj status fazy projektu
 */
router.put('/:id/phase/:phaseKey', async (req, res) => {
    try {
        const { status, start_date, end_date, assigned_to, notes } = req.body;

        const { data, error } = await supabase
            .from('project_phases')
            .update({
                status,
                start_date,
                end_date,
                assigned_to,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('project_id', req.params.id)
            .eq('phase_key', req.params.phaseKey)
            .eq('tenant_id', req.user.tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ phase: data });

    } catch (err) {
        console.error('Update phase error:', err);
        res.status(500).json({ error: 'Failed to update phase' });
    }
});

/**
 * POST /api/projects/:id/archive
 * Archiwizuj projekt (przenieś do archived_projects)
 */
router.post('/:id/archive', async (req, res) => {
    try {
        const { archive_type } = req.body; // 'completed' lub 'failed'
        const projectId = req.params.id;
        const tenantId = req.user.tenant_id;

        // Pobierz projekt
        const { data: project, error: fetchError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError || !project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Utwórz kopię w archived_projects
        const { id, ...projectData } = project;
        const { data: archived, error: archiveError } = await supabase
            .from('archived_projects')
            .insert({
                ...projectData,
                original_id: id,
                archive_type: archive_type || 'completed',
                archived_at: new Date().toISOString()
            })
            .select()
            .single();

        if (archiveError) throw archiveError;

        // Kopiuj fazy, materiały, pliki do archived tables
        const { data: phases } = await supabase.from('project_phases').select('*').eq('project_id', projectId);
        const { data: materials } = await supabase.from('project_materials').select('*').eq('project_id', projectId);
        const { data: files } = await supabase.from('project_files').select('*').eq('production_project_id', projectId);

        if (phases?.length) {
            await supabase.from('archived_project_phases').insert(
                phases.map(p => ({ ...p, archived_project_id: archived.id }))
            );
        }
        if (materials?.length) {
            await supabase.from('archived_project_materials').insert(
                materials.map(m => ({ ...m, archived_project_id: archived.id }))
            );
        }
        if (files?.length) {
            await supabase.from('archived_project_files').insert(
                files.map(f => ({ ...f, archived_project_id: archived.id }))
            );
        }

        // Usuń oryginalny projekt
        await supabase.from('project_spray_items').delete().eq('project_id', projectId);
        await supabase.from('project_spray_settings').delete().eq('project_id', projectId);
        await supabase.from('project_elements').delete().eq('project_id', projectId);
        await supabase.from('project_files').delete().eq('production_project_id', projectId);
        await supabase.from('project_materials').delete().eq('project_id', projectId);
        await supabase.from('project_phases').delete().eq('project_id', projectId);
        await supabase.from('project_blockers').delete().eq('project_id', projectId);
        await supabase.from('project_alerts').delete().eq('project_id', projectId);
        await supabase.from('projects').delete().eq('id', projectId);

        res.json({ message: 'Project archived', archived_project: archived });

    } catch (err) {
        console.error('Archive project error:', err);
        res.status(500).json({ error: 'Failed to archive project' });
    }
});

module.exports = router;
