/**
 * Joinery Core SaaS - RPC Router
 * Obsługa wywołań funkcji bazodanowych (RPC)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Dozwolone funkcje RPC
const allowedFunctions = [
    'safe_upsert_project_phases',
    'safe_upsert_pipeline_phases'
];

router.use(requireAuth);

/**
 * POST /api/rpc
 * Wywołaj funkcję RPC z tenant isolation
 */
router.post('/', async (req, res) => {
    try {
        const { function: functionName, params } = req.body;
        
        if (!functionName) {
            return res.status(400).json({ error: 'Function name required' });
        }
        
        // Sprawdź czy funkcja jest dozwolona
        if (!allowedFunctions.includes(functionName)) {
            return res.status(403).json({ error: 'Function not allowed' });
        }
        
        const tenantId = req.user.tenant_id;
        
        // Dodaj tenant_id do parametrów
        const paramsWithTenant = {
            ...params,
            p_tenant_id: tenantId
        };
        
        // Wywołaj funkcję RPC
        const { data, error } = await supabase.rpc(functionName, paramsWithTenant);
        
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
