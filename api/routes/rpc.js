/**
 * Joinery Core SaaS - RPC Router
 * Obsługa wywołań funkcji bazodanowych (RPC)
 * 
 * SECURITY: Role-based access control per function
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Dozwolone funkcje RPC z wymaganymi rolami
const allowedFunctions = {
    'safe_upsert_project_phases': ['admin', 'manager'],
    'safe_upsert_pipeline_phases': ['admin', 'manager']
};

// Helper: normalizuj rolę
function normalizeRole(role) {
    const r = String(role || '').toLowerCase();
    return r;
}

// Helper: sprawdź czy rola ma dostęp do funkcji
function canCallFunction(functionName, userRole) {
    const allowedRoles = allowedFunctions[functionName];
    if (!allowedRoles) return false;
    
    const role = normalizeRole(userRole);
    return allowedRoles.includes(role);
}

router.use(requireAuth);

/**
 * POST /api/rpc
 * Wywołaj funkcję RPC z tenant isolation
 */
router.post('/', async (req, res) => {
    try {
        const { function: functionName, params } = req.body;
        
        console.log('📥 RPC Request:', functionName);
        console.log('📥 RPC Params:', JSON.stringify(params, null, 2));
        
        if (!functionName) {
            return res.status(400).json({ error: 'Function name required' });
        }
        
        // Sprawdź czy funkcja jest dozwolona
        if (!allowedFunctions[functionName]) {
            return res.status(403).json({ error: 'Function not allowed' });
        }
        
        // SECURITY: Sprawdź czy rola ma dostęp do tej funkcji
        if (!canCallFunction(functionName, req.user.role)) {
            console.warn(`RPC denied: ${req.user.role} tried to call ${functionName}`);
            return res.status(403).json({ 
                error: `Permission denied: ${functionName} requires higher privileges` 
            });
        }
        
        const tenantId = req.user.tenant_id;
        
        // Dodaj tenant_id do parametrów
        const paramsWithTenant = {
            ...params,
            p_tenant_id: tenantId
        };
        
        console.log('📤 Calling Supabase RPC with:', JSON.stringify(paramsWithTenant, null, 2));
        
        // Wywołaj funkcję RPC
        const { data, error } = await supabase.rpc(functionName, paramsWithTenant);
        
        console.log('📥 RPC Response:', { data, error });
        
        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({ error: error.message, code: error.code });
        }
        
        res.json({ data });
        
    } catch (err) {
        console.error('RPC Error:', err);
        res.status(500).json({ error: 'RPC call failed' });
    }
});

module.exports = router;