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
 * GET /api/team/usage
 * Sprawdź aktualny usage team members vs limit
 */
router.get('/usage', async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        // Pobierz limit
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('max_team_members, plan')
            .eq('id', tenantId)
            .single();

        if (orgError) throw orgError;

        // Policz aktywnych członków
        const { count, error: countError } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('is_active', true);

        if (countError) throw countError;

        const maxMembers = org.max_team_members || 5;

        res.json({
            current: count,
            limit: maxMembers,
            remaining: Math.max(0, maxMembers - count),
            plan: org.plan,
            can_add: count < maxMembers
        });

    } catch (err) {
        console.error('Get usage error:', err);
        res.status(500).json({ error: 'Failed to get usage' });
    }
});

/**
 * GET /api/team
 * Lista członków zespołu
 * Domyślnie tylko aktywni (include_inactive=true żeby zobaczyć wszystkich)
 */
router.get('/', async (req, res) => {
    try {
        const { department, include_inactive } = req.query;

        let query = supabase
            .from('team_members')
            .select('*')
            .eq('tenant_id', req.user.tenant_id);

        if (department) {
            query = query.eq('department', department);
        }

        // Domyślnie tylko aktywni
        if (include_inactive !== 'true') {
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
 * UWAGA: wages dostępne tylko przez /api/team/:id/wages (admin only)
 */
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('team_members')
            .select(`
                *,
                employee_holidays (*)
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
 * 
 * LIMIT CHECK: Sprawdza czy organizacja nie przekroczyła max_team_members
 * SECURITY: Whitelist pól - nie pozwala na nadpisanie tenant_id
 */
router.post('/', requireAdmin, async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        // 1. Sprawdź limit organizacji
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('max_team_members')
            .eq('id', tenantId)
            .single();

        if (orgError) {
            console.error('Org lookup error:', orgError);
            return res.status(500).json({ error: 'Failed to check organization limits' });
        }

        // 2. Policz aktualnych członków (tylko aktywnych)
        const { count, error: countError } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('is_active', true);

        if (countError) {
            console.error('Count error:', countError);
            return res.status(500).json({ error: 'Failed to count team members' });
        }

        // 3. Sprawdź limit
        const maxMembers = org.max_team_members || 5; // domyślnie 5
        if (count >= maxMembers) {
            return res.status(403).json({ 
                error: 'Team member limit reached',
                message: `Your plan allows ${maxMembers} team members. Please upgrade to add more.`,
                current: count,
                limit: maxMembers,
                upgrade_required: true
            });
        }

        // 4. WHITELIST pól - bezpieczeństwo
        const allowedFields = [
            'full_name', 'email', 'phone', 'department', 'role', 
            'hourly_rate', 'employment_type', 'start_date', 'notes',
            'emergency_contact', 'emergency_phone', 'address',
            'skills', 'certifications'
        ];
        
        const memberData = { tenant_id: tenantId, is_active: true };
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                memberData[field] = req.body[field];
            }
        }

        // 5. Generuj numer pracownika z retry na conflict
        let employeeNumber;
        let retries = 3;
        
        while (retries > 0) {
            const { data: lastMember } = await supabase
                .from('team_members')
                .select('employee_number')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let nextNum = 1;
            if (lastMember && lastMember.employee_number) {
                const match = lastMember.employee_number.match(/EMP(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            
            employeeNumber = `EMP${String(nextNum).padStart(3, '0')}`;
            memberData.employee_number = employeeNumber;

            const { data, error } = await supabase
                .from('team_members')
                .insert(memberData)
                .select()
                .single();

            if (!error) {
                return res.status(201).json({ 
                    member: data,
                    usage: {
                        current: count + 1,
                        limit: maxMembers
                    }
                });
            }
            
            // Jeśli conflict na employee_number, retry
            if (error.code === '23505') {
                retries--;
                continue;
            }
            
            throw error;
        }

        return res.status(500).json({ error: 'Failed to generate unique employee number' });

    } catch (err) {
        console.error('Create team member error:', err);
        res.status(500).json({ error: 'Failed to create team member' });
    }
});

/**
 * PUT /api/team/:id
 * Aktualizuj członka zespołu
 * SECURITY: Whitelist pól
 */
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        // WHITELIST pól - bezpieczeństwo
        const allowedFields = [
            'full_name', 'email', 'phone', 'department', 'role', 
            'hourly_rate', 'employment_type', 'start_date', 'end_date', 'notes',
            'emergency_contact', 'emergency_phone', 'address',
            'skills', 'certifications', 'is_active'
        ];
        
        const updateData = { updated_at: new Date().toISOString() };
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

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
 * Admin widzi wszystko, worker tylko swoje (jeśli powiązany)
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
 * SECURITY: Tylko admin może dodawać urlopy
 */
router.post('/:id/holidays', requireAdmin, async (req, res) => {
    try {
        // Whitelist pól
        const allowedFields = ['start_date', 'end_date', 'type', 'status', 'notes', 'days_count'];
        const holidayData = {
            team_member_id: req.params.id,
            tenant_id: req.user.tenant_id
        };
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                holidayData[field] = req.body[field];
            }
        }

        const { data, error } = await supabase
            .from('employee_holidays')
            .insert(holidayData)
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
 * SECURITY: Tylko admin może usuwać urlopy
 */
router.delete('/holidays/:id', requireAdmin, async (req, res) => {
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
 * SECURITY: Whitelist pól
 */
router.post('/:id/wages', requireAdmin, async (req, res) => {
    try {
        // Whitelist pól
        const allowedFields = [
            'payment_date', 'amount', 'type', 'hours_worked', 
            'hourly_rate', 'bonus', 'deductions', 'notes', 'period_start', 'period_end'
        ];
        const wageData = {
            team_member_id: req.params.id,
            tenant_id: req.user.tenant_id
        };
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                wageData[field] = req.body[field];
            }
        }

        const { data, error } = await supabase
            .from('wages')
            .insert(wageData)
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