/**
 * Joinery Core SaaS - Auth Middleware
 * Weryfikuje token JWT i wyciąga tenant_id
 */

const { createClient } = require('@supabase/supabase-js');

// Singleton Supabase clients (performance - nie twórz w każdym request)
const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const supabaseService = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware sprawdzający autoryzację
 * Wyciąga user_id i tenant_id z tokena
 */
async function requireAuth(req, res, next) {
    try {
        // Pobierz token z headera
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.split(' ')[1];

        // Weryfikuj token w Supabase
        const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Pobierz profil użytkownika z tenant_id (używając singleton service client)
        const { data: profile, error: profileError } = await supabaseService
            .from('user_profiles')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(403).json({ error: 'User profile not found' });
        }

        // Dodaj dane do request
        req.user = {
            id: user.id,
            email: user.email,
            tenant_id: profile.tenant_id,
            role: profile.role
        };

        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}

/**
 * Middleware sprawdzający czy user jest adminem organizacji
 */
async function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
}

/**
 * Middleware sprawdzający czy user jest właścicielem organizacji
 * (teraz równoważne z requireAdmin - dla kompatybilności)
 */
async function requireOwner(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
}

module.exports = {
    requireAuth,
    requireAdmin,
    requireOwner
};