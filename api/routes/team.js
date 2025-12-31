/**
 * Joinery Core SaaS - Team Routes
 * CRUD dla członków zespołu
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.use(requireAuth);

/**
 * GET /api/team
 * Lista członków zespołu
 */
router.get('/', async (req, res) => {
    try {
        const { department, active_only } = req.query;

        let query = supabase
            .from('team_members')
            .select('*')
            .eq('tenant_id', req.user.tenant_id);

        if (department) {
            query = query.eq('department', department);
        }

        if (active_only === 'true') {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query.order('full_name');

        if (error) throw error;

        res.json({ team: data });

    } catch (err) {
        console.error('Get team error:', err);
        res.status(500).json({ error: 'Failed to get team' });
    }
});

/**
 * GET /api/team/:id
 * Szczegóły członka zespołu
 */
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('team_members')
            .select(`
                *,
                employee_holidays (*),
                wages (*)
            `)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Team member not found' });
            }
            throw error;
        }

        res.json({ member: data });

    } catch (err) {
        console.error('Get team member error:', err);
        res.status(500).json({ error: 'Failed to get team member' });
    }
});

/**
 * POST /api/team
 * Dodaj członka zespołu
 */
router.post('/', requireAdmin, async (req, res) => {
    try {
        const memberData = {
            ...req.body,
            tenant_id: req.user.tenant_id
        };

        // Generuj numer pracownika jeśli nie podano
        if (!memberData.employee_number) {
            const { data: lastMember } = await supabase
                .from('team_members')
                .select('employee_number')
                .eq('tenant_id', req.user.tenant_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let nextNum = 1;
            if (lastMember && lastMember.employee_number) {
                const match = lastMember.employee_number.match(/EMP(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            
            memberData.employee_number = `EMP${String(nextNum).padStart(3, '0')}`;
        }

        const { data, error } = await supabase
            .from('team_members')
            .insert(memberData)
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ member: data });

    } catch (err) {
        console.error('Create team member error:', err);
        res.status(500).json({ error: 'Failed to create team member' });
    }
});

/**
 * PUT /api/team/:id
 * Aktualizuj członka zespołu
 */
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { id, tenant_id, created_at, ...updateData } = req.body;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('team_members')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ member: data });

    } catch (err) {
        console.error('Update team member error:', err);
        res.status(500).json({ error: 'Failed to update team member' });
    }
});

/**
 * DELETE /api/team/:id
 * Usuń członka zespołu
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        // Soft delete - ustaw is_active = false
        const { data, error } = await supabase
            .from('team_members')
            .update({ 
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Team member deactivated', member: data });

    } catch (err) {
        console.error('Delete team member error:', err);
        res.status(500).json({ error: 'Failed to delete team member' });
    }
});

// ================== HOLIDAYS ==================

/**
 * GET /api/team/:id/holidays
 * Lista urlopów pracownika
 */
router.get('/:id/holidays', async (req, res) => {
    try {
        const { year } = req.query;

        let query = supabase
            .from('employee_holidays')
            .select('*')
            .eq('team_member_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        if (year) {
            query = query.gte('start_date', `${year}-01-01`).lte('end_date', `${year}-12-31`);
        }

        const { data, error } = await query.order('start_date', { ascending: false });

        if (error) throw error;

        res.json({ holidays: data });

    } catch (err) {
        console.error('Get holidays error:', err);
        res.status(500).json({ error: 'Failed to get holidays' });
    }
});

/**
 * POST /api/team/:id/holidays
 * Dodaj urlop
 */
router.post('/:id/holidays', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employee_holidays')
            .insert({
                ...req.body,
                team_member_id: req.params.id,
                tenant_id: req.user.tenant_id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ holiday: data });

    } catch (err) {
        console.error('Create holiday error:', err);
        res.status(500).json({ error: 'Failed to create holiday' });
    }
});

/**
 * DELETE /api/team/holidays/:id
 * Usuń urlop
 */
router.delete('/holidays/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('employee_holidays')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        if (error) throw error;

        res.json({ message: 'Holiday deleted' });

    } catch (err) {
        console.error('Delete holiday error:', err);
        res.status(500).json({ error: 'Failed to delete holiday' });
    }
});

// ================== WAGES ==================

/**
 * GET /api/team/:id/wages
 * Lista wynagrodzeń pracownika
 */
router.get('/:id/wages', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('wages')
            .select('*')
            .eq('team_member_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .order('payment_date', { ascending: false });

        if (error) throw error;

        res.json({ wages: data });

    } catch (err) {
        console.error('Get wages error:', err);
        res.status(500).json({ error: 'Failed to get wages' });
    }
});

/**
 * POST /api/team/:id/wages
 * Dodaj wypłatę
 */
router.post('/:id/wages', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('wages')
            .insert({
                ...req.body,
                team_member_id: req.params.id,
                tenant_id: req.user.tenant_id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ wage: data });

    } catch (err) {
        console.error('Create wage error:', err);
        res.status(500).json({ error: 'Failed to create wage record' });
    }
});

module.exports = router;
