/**
 * Joinery Core SaaS - Pipeline Routes
 * CRUD dla projektów pipeline (pre-production)
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
 * GET /api/pipeline
 * Lista projektów pipeline
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pipeline_projects')
            .select(`
                *,
                clients:client_id (id, name, company),
                pipeline_phases (*)
            `)
            .eq('tenant_id', req.user.tenant_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ projects: data });

    } catch (err) {
        console.error('Get pipeline error:', err);
        res.status(500).json({ error: 'Failed to get pipeline projects' });
    }
});

/**
 * GET /api/pipeline/:id
 * Szczegóły projektu pipeline
 */
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pipeline_projects')
            .select(`
                *,
                clients:client_id (*),
                pipeline_phases (*),
                project_files (*)
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
        console.error('Get pipeline project error:', err);
        res.status(500).json({ error: 'Failed to get project' });
    }
});

/**
 * POST /api/pipeline
 * Utwórz nowy projekt pipeline
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
                .from('pipeline_projects')
                .select('project_number')
                .eq('tenant_id', req.user.tenant_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const year = new Date().getFullYear();
            let nextNum = 1;
            
            if (lastProject && lastProject.project_number) {
                const match = lastProject.project_number.match(/PL(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            
            projectData.project_number = `PL${String(nextNum).padStart(3, '0')}/${year}`;
        }

        const { data, error } = await supabase
            .from('pipeline_projects')
            .insert(projectData)
            .select()
            .single();

        if (error) throw error;

        // Utwórz domyślne fazy pipeline
        const { data: phases } = await supabase
            .from('custom_phases')
            .select('*')
            .eq('tenant_id', req.user.tenant_id)
            .eq('phase_type', 'pipeline')
            .order('phase_order');

        if (phases && phases.length > 0) {
            const pipelinePhases = phases.map(phase => ({
                tenant_id: req.user.tenant_id,
                pipeline_project_id: data.id,
                phase_key: phase.phase_key,
                status: 'notStarted'
            }));

            await supabase.from('pipeline_phases').insert(pipelinePhases);
        }

        res.status(201).json({ project: data });

    } catch (err) {
        console.error('Create pipeline project error:', err);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

/**
 * PUT /api/pipeline/:id
 * Aktualizuj projekt pipeline
 */
router.put('/:id', async (req, res) => {
    try {
        const { id, tenant_id, created_at, ...updateData } = req.body;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('pipeline_projects')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ project: data });

    } catch (err) {
        console.error('Update pipeline project error:', err);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

/**
 * DELETE /api/pipeline/:id
 * Usuń projekt pipeline
 */
router.delete('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        const tenantId = req.user.tenant_id;

        // Usuń powiązane dane
        await supabase.from('pipeline_phases').delete().eq('pipeline_project_id', projectId).eq('tenant_id', tenantId);
        await supabase.from('project_files').delete().eq('pipeline_project_id', projectId).eq('tenant_id', tenantId);

        const { error } = await supabase
            .from('pipeline_projects')
            .delete()
            .eq('id', projectId)
            .eq('tenant_id', tenantId);

        if (error) throw error;

        res.json({ message: 'Project deleted' });

    } catch (err) {
        console.error('Delete pipeline project error:', err);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

/**
 * POST /api/pipeline/:id/convert
 * Konwertuj projekt pipeline na produkcję
 */
router.post('/:id/convert', async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        // Pobierz projekt pipeline
        const { data: pipelineProject, error: fetchError } = await supabase
            .from('pipeline_projects')
            .select('*')
            .eq('id', req.params.id)
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError || !pipelineProject) {
            return res.status(404).json({ error: 'Pipeline project not found' });
        }

        // Generuj nowy numer projektu produkcyjnego
        const { data: lastProd } = await supabase
            .from('projects')
            .select('project_number')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const year = new Date().getFullYear();
        let nextNum = 1;
        if (lastProd && lastProd.project_number) {
            const match = lastProd.project_number.match(/PR(\d+)/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        const newProjectNumber = `PR${String(nextNum).padStart(3, '0')}/${year}`;

        // Utwórz projekt produkcyjny
        const { id, project_number, ...projectData } = pipelineProject;
        const { data: newProject, error: createError } = await supabase
            .from('projects')
            .insert({
                ...projectData,
                project_number: newProjectNumber,
                pipeline_project_id: id, // Zachowaj referencję
                converted_from_pipeline: true
            })
            .select()
            .single();

        if (createError) throw createError;

        // Utwórz fazy produkcyjne
        const { data: phases } = await supabase
            .from('custom_phases')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('phase_type', 'production')
            .order('phase_order');

        if (phases && phases.length > 0) {
            const projectPhases = phases.map(phase => ({
                tenant_id: tenantId,
                project_id: newProject.id,
                phase_key: phase.phase_key,
                status: 'notStarted'
            }));

            await supabase.from('project_phases').insert(projectPhases);
        }

        // Przenieś pliki
        await supabase
            .from('project_files')
            .update({ 
                production_project_id: newProject.id,
                pipeline_project_id: null
            })
            .eq('pipeline_project_id', id)
            .eq('tenant_id', tenantId);

        // Usuń projekt pipeline
        await supabase.from('pipeline_phases').delete().eq('pipeline_project_id', id);
        await supabase.from('pipeline_projects').delete().eq('id', id);

        res.json({ 
            message: 'Project converted to production',
            project: newProject
        });

    } catch (err) {
        console.error('Convert pipeline error:', err);
        res.status(500).json({ error: 'Failed to convert project' });
    }
});

/**
 * PUT /api/pipeline/:id/phase/:phaseKey
 * Aktualizuj status fazy pipeline
 */
router.put('/:id/phase/:phaseKey', async (req, res) => {
    try {
        const { status, notes } = req.body;

        const { data, error } = await supabase
            .from('pipeline_phases')
            .update({
                status,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('pipeline_project_id', req.params.id)
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

module.exports = router;
