/**
 * Joinery Core SaaS - Bootstrap Router
 * Jeden endpoint do załadowania wszystkich danych po loginie
 * 
 * PERFORMANCE: Zamiast 6+ requestów - 1 request
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
 * GET /api/bootstrap
 * Pobierz wszystkie dane potrzebne po zalogowaniu
 * 
 * Zwraca:
 * - user profile
 * - organization
 * - team members
 * - projects (production)
 * - project phases
 * - pipeline projects
 * - pipeline phases
 * - custom phases
 * - company settings
 */
router.get('/', async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const userId = req.user.id;

        // Wykonaj wszystkie zapytania równolegle
        const [
            profileRes,
            teamRes,
            projectsRes,
            projectPhasesRes,
            pipelineRes,
            pipelinePhasesRes,
            customPhasesRes,
            settingsRes
        ] = await Promise.all([
            // 1. User profile + organization
            supabase
                .from('user_profiles')
                .select(`
                    *,
                    organizations:tenant_id (
                        id, name, slug, plan, is_active, trial_ends_at, max_users
                    )
                `)
                .eq('id', userId)
                .single(),

            // 2. Team members
            supabase
                .from('team_members')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('full_name'),

            // 3. Active projects
            supabase
                .from('projects')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('project_number', { ascending: false }),

            // 4. Project phases (będą filtrowane po project IDs na froncie)
            supabase
                .from('project_phases')
                .select('*')
                .eq('tenant_id', tenantId),

            // 5. Pipeline projects
            supabase
                .from('pipeline_projects')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false }),

            // 6. Pipeline phases
            supabase
                .from('pipeline_phases')
                .select('*')
                .eq('tenant_id', tenantId),

            // 7. Custom phases (konfiguracja)
            supabase
                .from('custom_phases')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('order_position'),

            // 8. Company settings
            supabase
                .from('company_settings')
                .select('*')
                .eq('tenant_id', tenantId)
                .maybeSingle()
        ]);

        // Sprawdź błędy
        const errors = [];
        if (profileRes.error) errors.push(`profile: ${profileRes.error.message}`);
        if (teamRes.error) errors.push(`team: ${teamRes.error.message}`);
        if (projectsRes.error) errors.push(`projects: ${projectsRes.error.message}`);
        if (projectPhasesRes.error) errors.push(`projectPhases: ${projectPhasesRes.error.message}`);
        if (pipelineRes.error) errors.push(`pipeline: ${pipelineRes.error.message}`);
        if (pipelinePhasesRes.error) errors.push(`pipelinePhases: ${pipelinePhasesRes.error.message}`);
        if (customPhasesRes.error) errors.push(`customPhases: ${customPhasesRes.error.message}`);
        if (settingsRes.error) errors.push(`settings: ${settingsRes.error.message}`);

        if (errors.length > 0) {
            console.error('Bootstrap errors:', errors);
            // Kontynuuj mimo błędów - zwróć co się udało
        }

        // Mapuj project phases do projektów
        const projectPhasesByProject = {};
        (projectPhasesRes.data || []).forEach(phase => {
            if (!projectPhasesByProject[phase.project_id]) {
                projectPhasesByProject[phase.project_id] = [];
            }
            projectPhasesByProject[phase.project_id].push(phase);
        });

        // Mapuj pipeline phases do projektów
        const pipelinePhasesByProject = {};
        (pipelinePhasesRes.data || []).forEach(phase => {
            if (!pipelinePhasesByProject[phase.project_id]) {
                pipelinePhasesByProject[phase.project_id] = [];
            }
            pipelinePhasesByProject[phase.project_id].push(phase);
        });

        res.json({
            data: {
                user: {
                    id: profileRes.data?.id,
                    email: profileRes.data?.email,
                    full_name: profileRes.data?.full_name,
                    role: profileRes.data?.role,
                    avatar_url: profileRes.data?.avatar_url,
                    tenant_id: profileRes.data?.tenant_id
                },
                organization: profileRes.data?.organizations || null,
                team: teamRes.data || [],
                projects: projectsRes.data || [],
                projectPhases: projectPhasesByProject,
                pipeline: pipelineRes.data || [],
                pipelinePhases: pipelinePhasesByProject,
                customPhases: customPhasesRes.data || [],
                settings: settingsRes.data || {}
            },
            errors: errors.length > 0 ? errors : null
        });

    } catch (err) {
        console.error('Bootstrap error:', err);
        res.status(500).json({ error: 'Bootstrap failed' });
    }
});

/**
 * GET /api/bootstrap/minimal
 * Wersja minimalna - tylko user + role + settings
 * Do szybkiego sprawdzenia uprawnień
 */
router.get('/minimal', async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const userId = req.user.id;

        const [profileRes, settingsRes] = await Promise.all([
            supabase
                .from('user_profiles')
                .select(`
                    id, email, full_name, role, avatar_url, tenant_id,
                    organizations:tenant_id (id, name, slug, plan, is_active)
                `)
                .eq('id', userId)
                .single(),
            
            supabase
                .from('company_settings')
                .select('company_name, logo_url')
                .eq('tenant_id', tenantId)
                .maybeSingle()
        ]);

        res.json({
            data: {
                user: profileRes.data,
                organization: profileRes.data?.organizations,
                settings: settingsRes.data
            }
        });

    } catch (err) {
        console.error('Bootstrap minimal error:', err);
        res.status(500).json({ error: 'Bootstrap failed' });
    }
});

module.exports = router;
