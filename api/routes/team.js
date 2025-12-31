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

        // Policz aktywnych członków (kolumna 'active')
        const { count, error: countError } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('active', true);

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

        // Domyślnie tylko aktywni (kolumna 'active' nie 'is_active')
        if (include_inactive !== 'true') {
            query = query.eq('active', true);
        }

        const { data, error } = await query.order('name');

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
 * UWAGA: holidays dostępne przez /api/team/:id/holidays (FK: employee_id)
 */
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
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

        // 2. Policz aktualnych członków (tylko aktywnych - kolumna 'active')
        const { count, error: countError } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('active', true);

        if (countError) {
            console.error('Count error:', countError);
            return res.status(500).json({ error: 'Failed to count team members' });
        }

        // 3. Sprawdź limit
        const maxMembers = org.max_team_members || 5;
        if (count >= maxMembers) {
            return res.status(403).json({ 
                error: 'Team member limit reached',
                message: `Your plan allows ${maxMembers} team members. Please upgrade to add more.`,
                current: count,
                limit: maxMembers,
                upgrade_required: true
            });
        }

        // 4. WHITELIST pól - według schematu DB
        const allowedFields = [
            'name', 'email', 'phone', 'department', 'role', 
            'hourly_rate', 'contract_type', 'salary_type', 'start_date', 'notes',
            'job_type', 'color', 'color_code', 'address', 'emergency_contact',
            'holiday_allowance', 'blood_type', 'allergies', 'medical_notes'
        ];
        
        const memberData = { tenant_id: tenantId, active: true };
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
        // WHITELIST pól - według schematu DB
        const allowedFields = [
            'name', 'email', 'phone', 'department', 'role', 
            'hourly_rate', 'contract_type', 'salary_type', 'start_date', 'end_date', 'notes',
            'job_type', 'color', 'color_code', 'address', 'emergency_contact',
            'holiday_allowance', 'holiday_used', 'holiday_remaining',
            'blood_type', 'allergies', 'medical_notes', 'special_care_notes',
            'active', 'archived', 'departure_reason', 'departure_notes'
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
 * Usuń członka zespołu (soft delete)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        // Soft delete - ustaw active = false
        const { data, error } = await supabase
            .from('team_members')
            .update({ 
                active: false,
                archived: true,
                archived_date: new Date().toISOString(),
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
 * Schemat: employee_id, date_from, date_to
 */
router.get('/:id/holidays', async (req, res) => {
    try {
        const { year } = req.query;

        let query = supabase
            .from('employee_holidays')
            .select('*')
            .eq('employee_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id);

        if (year) {
            query = query.gte('date_from', `${year}-01-01`).lte('date_to', `${year}-12-31`);
        }

        const { data, error } = await query.order('date_from', { ascending: false });

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
 * Schemat: employee_id, date_from, date_to, holiday_type, status, notes
 */
router.post('/:id/holidays', requireAdmin, async (req, res) => {
    try {
        // Whitelist pól według schematu DB
        const allowedFields = ['date_from', 'date_to', 'holiday_type', 'status', 'notes'];
        const holidayData = {
            employee_id: req.params.id,
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
 * Schemat: team_member_id, period_type, period_start, period_end, gross_amount, notes
 */
router.get('/:id/wages', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('wages')
            .select('*')
            .eq('team_member_id', req.params.id)
            .eq('tenant_id', req.user.tenant_id)
            .order('period_start', { ascending: false });

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
 * SECURITY: Whitelist pól według schematu DB
 * Schemat: team_member_id, period_type, period_start, period_end, gross_amount, notes
 */
router.post('/:id/wages', requireAdmin, async (req, res) => {
    try {
        // Whitelist pól według schematu DB
        const allowedFields = [
            'period_type', 'period_start', 'period_end', 'gross_amount', 'notes'
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

/**
 * POST /api/team/invite
 * Wyślij zaproszenie do pracownika
 */
router.post('/invite', async (req, res) => {
    try {
        const { teamMemberId, email, role } = req.body;
        const tenantId = req.user.tenant_id;
        
        // Sprawdź czy user ma uprawnienia (admin lub manager)
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Only admin or manager can invite users' });
        }
        
        if (!teamMemberId || !email || !role) {
            return res.status(400).json({ error: 'Missing required fields: teamMemberId, email, role' });
        }
        
        // Walidacja roli
        const validRoles = ['admin', 'manager', 'worker', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be: admin, manager, worker, or viewer' });
        }
        
        // Sprawdź czy team_member istnieje i należy do tego tenanta
        const { data: teamMember, error: tmError } = await supabase
            .from('team_members')
            .select('id, name, email')
            .eq('id', teamMemberId)
            .eq('tenant_id', tenantId)
            .single();
        
        if (tmError || !teamMember) {
            return res.status(404).json({ error: 'Team member not found' });
        }
        
        // Sprawdź czy email nie jest już zarejestrowany
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const emailExists = existingUser.users.some(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (emailExists) {
            return res.status(400).json({ error: 'This email is already registered in the system' });
        }
        
        // Utwórz użytkownika z tymczasowym hasłem i wyślij invite
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
        
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                full_name: teamMember.name,
                invited: true
            }
        });
        
        if (authError) {
            console.error('Auth create error:', authError);
            return res.status(400).json({ error: authError.message });
        }
        
        // Utwórz user_profile
        const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
                id: authUser.user.id,
                tenant_id: tenantId,
                email: email,
                full_name: teamMember.name,
                role: role,
                team_member_id: teamMemberId
            });
        
        if (profileError) {
            // Rollback - usuń auth user
            await supabase.auth.admin.deleteUser(authUser.user.id);
            console.error('Profile create error:', profileError);
            return res.status(400).json({ error: 'Failed to create user profile' });
        }
        
        // Aktualizuj team_member z emailem (jeśli był inny)
        await supabase
            .from('team_members')
            .update({ email: email })
            .eq('id', teamMemberId);
        
        // Wyślij email z resetem hasła (żeby user mógł ustawić własne)
        const { error: resetError } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
                redirectTo: `${process.env.FRONTEND_URL || 'https://joinerycore.com'}/set-password.html`
            }
        });
        
        if (resetError) {
            console.error('Reset link error:', resetError);
            // Nie zwracamy błędu - user został utworzony
        }
        
        res.json({ 
            success: true, 
            message: `Invitation sent to ${email}`,
            userId: authUser.user.id
        });
        
    } catch (err) {
        console.error('Invite error:', err);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

module.exports = router;