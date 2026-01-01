/**
 * Joinery Core SaaS - Auth Routes
 * Rejestracja, logowanie, profil, zmiana hasła
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

// Supabase clients
const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const supabaseService = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/auth/register
 * Rejestracja nowej organizacji + pierwszego użytkownika (owner)
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, companyName, companySlug, ownerName } = req.body;

        // Walidacja
        if (!email || !password || !companyName || !companySlug) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Sprawdź czy slug jest unikalny
        const { data: existingOrg } = await supabaseService
            .from('organizations')
            .select('id')
            .eq('slug', companySlug.toLowerCase())
            .single();

        if (existingOrg) {
            return res.status(400).json({ error: 'Company URL already taken' });
        }

        // 1. Utwórz użytkownika w auth
        const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        const userId = authData.user.id;

        // 2. Utwórz organizację
        const { data: org, error: orgError } = await supabaseService
            .from('organizations')
            .insert({
                name: companyName,
                slug: companySlug.toLowerCase(),
                owner_email: email,
                plan: 'trial',
                max_users: 5,
                trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 dni
            })
            .select()
            .single();

        if (orgError) {
            // Rollback - usuń użytkownika
            await supabaseService.auth.admin.deleteUser(userId);
            return res.status(400).json({ error: 'Failed to create organization' });
        }

        // 3. Utwórz profil użytkownika (bez team_member_id na razie)
        const { error: profileError } = await supabaseService
            .from('user_profiles')
            .insert({
                id: userId,
                tenant_id: org.id,
                email: email,
                full_name: ownerName || email.split('@')[0],
                role: 'admin'
            });

        if (profileError) {
            // Rollback
            await supabaseService.from('organizations').delete().eq('id', org.id);
            await supabaseService.auth.admin.deleteUser(userId);
            return res.status(400).json({ error: 'Failed to create user profile' });
        }

        // 3b. Utwórz pierwszego pracownika (team_member)
        const { data: teamMember, error: teamError } = await supabaseService
            .from('team_members')
            .insert({
                tenant_id: org.id,
                name: ownerName || email.split('@')[0],
                email: email,
                department: 'office',
                role: 'Admin',
                employee_number: '001',
                active: true,
                start_date: new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

        if (teamError) {
            console.error('Failed to create team member:', teamError);
            // Nie robimy rollback - team_member nie jest krytyczny
        }

        // 3c. Powiąż user_profiles z team_member
        if (teamMember) {
            await supabaseService
                .from('user_profiles')
                .update({ team_member_id: teamMember.id })
                .eq('id', userId);
        }

        // 4. Utwórz domyślne ustawienia firmy
        await supabaseService
            .from('company_settings')
            .insert({
                tenant_id: org.id,
                company_name: companyName
            });

        // 5. Utwórz domyślne fazy produkcji
        // WAŻNE: używamy name, color - zgodnie ze schematem frontendu
        const defaultPhases = [
            { phase_key: 'siteSurvey', name: 'Site Survey', color: '#5e4e81', order_position: 1, phase_type: 'production' },
            { phase_key: 'md', name: 'Manufacturing Drawings', color: '#5a2cdb', order_position: 2, phase_type: 'production' },
            { phase_key: 'order', name: 'Order Materials', color: '#af72ba', order_position: 3, phase_type: 'production' },
            { phase_key: 'timber', name: 'Timber Production', color: '#547d56', order_position: 4, phase_type: 'production' },
            { phase_key: 'orderGlazing', name: 'Order Glazing', color: '#79a4cf', order_position: 5, phase_type: 'production' },
            { phase_key: 'orderSpray', name: 'Order Spray Materials', color: '#eb86d8', order_position: 6, phase_type: 'production' },
            { phase_key: 'spray', name: 'Spraying', color: '#e99f62', order_position: 7, phase_type: 'production' },
            { phase_key: 'glazing', name: 'Glazing', color: '#485d68', order_position: 8, phase_type: 'production' },
            { phase_key: 'qc', name: 'QC & Packing', color: '#63a3ab', order_position: 9, phase_type: 'production' },
            { phase_key: 'dispatch', name: 'Dispatch/Installation', color: '#02802a', order_position: 10, phase_type: 'production' },
            { phase_key: 'initialContact', name: 'Initial Contact', color: '#8b5a3c', order_position: 1, phase_type: 'pipeline' },
            { phase_key: 'quote', name: 'Quote', color: '#4a90e2', order_position: 2, phase_type: 'pipeline' },
            { phase_key: 'depositReceived', name: 'Deposit Received', color: '#1a5d1a', order_position: 3, phase_type: 'pipeline' }
        ];

        await supabaseService
            .from('custom_phases')
            .insert(defaultPhases.map(p => ({ ...p, tenant_id: org.id })));

        res.status(201).json({
            message: 'Registration successful',
            organization: {
                id: org.id,
                name: org.name,
                slug: org.slug
            },
            user: {
                id: userId,
                email: email
            }
        });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/login
 * Logowanie użytkownika
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Logowanie przez Supabase Auth
        const { data, error } = await supabaseAuth.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Pobierz profil i organizację
        const { data: profile } = await supabaseService
            .from('user_profiles')
            .select(`
                *,
                organizations:tenant_id (
                    id, name, slug, plan, is_active, trial_ends_at
                )
            `)
            .eq('id', data.user.id)
            .single();

        if (!profile) {
            return res.status(403).json({ error: 'User profile not found' });
        }

        // Sprawdź czy organizacja jest aktywna
        if (!profile.organizations.is_active) {
            return res.status(403).json({ error: 'Organization is deactivated' });
        }

        res.json({
            session: data.session,
            user: {
                id: data.user.id,
                email: data.user.email,
                full_name: profile.full_name,
                role: profile.role,
                tenant_id: profile.tenant_id
            },
            organization: profile.organizations
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/logout
 * Wylogowanie użytkownika
 */
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            await supabaseAuth.auth.signOut();
        }
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * GET /api/auth/me
 * Pobierz dane zalogowanego użytkownika
 */
router.get('/me', requireAuth, async (req, res) => {
    try {
        const { data: profile } = await supabaseService
            .from('user_profiles')
            .select(`
                *,
                organizations:tenant_id (
                    id, name, slug, plan, is_active, trial_ends_at, max_users
                )
            `)
            .eq('id', req.user.id)
            .single();

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json({
            user: {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                role: profile.role,
                avatar_url: profile.avatar_url,
                tenant_id: profile.tenant_id
            },
            organization: profile.organizations
        });

    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

/**
 * PUT /api/auth/me
 * Aktualizuj profil użytkownika
 */
router.put('/me', requireAuth, async (req, res) => {
    try {
        const { full_name, avatar_url } = req.body;

        const { data, error } = await supabaseService
            .from('user_profiles')
            .update({ full_name, avatar_url, updated_at: new Date().toISOString() })
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Failed to update profile' });
        }

        res.json({ message: 'Profile updated', profile: data });

    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * POST /api/auth/change-password
 * Zmień hasło (currentPassword opcjonalne - dla reset password flow)
 */
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword, password } = req.body;
        
        // Akceptuj zarówno newPassword jak i password
        const passwordToSet = newPassword || password;

        if (!passwordToSet) {
            return res.status(400).json({ error: 'New password required' });
        }

        // Jeśli podano currentPassword, weryfikuj
        if (currentPassword) {
            const { error: verifyError } = await supabaseAuth.auth.signInWithPassword({
                email: req.user.email,
                password: currentPassword
            });

            if (verifyError) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
        }

        // Zmień hasło
        const { error: updateError } = await supabaseService.auth.admin.updateUserById(
            req.user.id,
            { password: passwordToSet }
        );

        if (updateError) {
            return res.status(400).json({ error: 'Failed to change password' });
        }

        res.json({ message: 'Password changed successfully', user: { id: req.user.id } });

    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

/**
 * POST /api/auth/forgot-password
 * Wyślij email do resetowania hasła
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL}/reset-password`
        });

        // Zawsze zwracaj sukces (bezpieczeństwo - nie ujawniaj czy email istnieje)
        res.json({ message: 'If email exists, reset link has been sent' });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to send reset email' });
    }
});

/**
 * POST /api/auth/refresh
 * Odśwież token dostępu używając refresh token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        // Użyj Supabase do odświeżenia sesji
        const { data, error } = await supabaseAuth.auth.refreshSession({
            refresh_token
        });

        if (error) {
            console.error('Token refresh error:', error);
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        res.json({
            session: data.session,
            user: data.user
        });

    } catch (err) {
        console.error('Refresh error:', err);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

module.exports = router;