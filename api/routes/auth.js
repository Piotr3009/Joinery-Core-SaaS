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

        // 3. Utwórz profil użytkownika
        const { error: profileError } = await supabaseService
            .from('user_profiles')
            .insert({
                id: userId,
                tenant_id: org.id,
                email: email,
                full_name: ownerName || email.split('@')[0],
                role: 'owner'
            });

        if (profileError) {
            // Rollback
            await supabaseService.from('organizations').delete().eq('id', org.id);
            await supabaseService.auth.admin.deleteUser(userId);
            return res.status(400).json({ error: 'Failed to create user profile' });
        }

        // 4. Utwórz domyślne ustawienia firmy
        await supabaseService
            .from('company_settings')
            .insert({
                tenant_id: org.id,
                company_name: companyName
            });

        // 5. Utwórz domyślne fazy produkcji
        const defaultPhases = [
            { phase_key: 'siteSurvey', phase_name: 'Site Survey', phase_color: '#5e4e81', phase_order: 1, phase_type: 'production' },
            { phase_key: 'md', phase_name: 'Manufacturing Drawings', phase_color: '#5a2cdb', phase_order: 2, phase_type: 'production' },
            { phase_key: 'order', phase_name: 'Order Materials', phase_color: '#af72ba', phase_order: 3, phase_type: 'production' },
            { phase_key: 'timber', phase_name: 'Timber Production', phase_color: '#547d56', phase_order: 4, phase_type: 'production' },
            { phase_key: 'orderGlazing', phase_name: 'Order Glazing', phase_color: '#79a4cf', phase_order: 5, phase_type: 'production' },
            { phase_key: 'orderSpray', phase_name: 'Order Spray Materials', phase_color: '#eb86d8', phase_order: 6, phase_type: 'production' },
            { phase_key: 'spray', phase_name: 'Spraying', phase_color: '#e99f62', phase_order: 7, phase_type: 'production' },
            { phase_key: 'glazing', phase_name: 'Glazing', phase_color: '#485d68', phase_order: 8, phase_type: 'production' },
            { phase_key: 'qc', phase_name: 'QC & Packing', phase_color: '#63a3ab', phase_order: 9, phase_type: 'production' },
            { phase_key: 'dispatch', phase_name: 'Dispatch/Installation', phase_color: '#02802a', phase_order: 10, phase_type: 'production' },
            { phase_key: 'initialContact', phase_name: 'Initial Contact', phase_color: '#8b5a3c', phase_order: 1, phase_type: 'pipeline' },
            { phase_key: 'quote', phase_name: 'Quote', phase_color: '#4a90e2', phase_order: 2, phase_type: 'pipeline' },
            { phase_key: 'depositReceived', phase_name: 'Deposit Received', phase_color: '#1a5d1a', phase_order: 3, phase_type: 'pipeline' }
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

module.exports = router;
