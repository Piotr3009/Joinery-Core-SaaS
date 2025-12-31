/**
 * Joinery Core SaaS - Database Query Router
 * Generyczny endpoint do wykonywania zapytań z tenant isolation
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
 * POST /api/db/query
 * Wykonuje zapytanie do bazy z automatycznym tenant_id
 */
router.post('/query', async (req, res) => {
    try {
        const { 
            operation, // 'select', 'insert', 'update', 'delete', 'upsert'
            table,
            select = '*',
            filters = [],
            order,
            limit,
            range,
            single,
            count,
            data
        } = req.body;

        const tenantId = req.user.tenant_id;

        // Walidacja
        if (!table || !operation) {
            return res.status(400).json({ error: 'Missing table or operation' });
        }

        // Lista dozwolonych tabel (bezpieczeństwo)
        const allowedTables = [
            'organizations', 'clients', 'suppliers', 'team_members', 'user_profiles',
            'projects', 'pipeline_projects', 'archived_projects',
            'project_phases', 'pipeline_phases', 'custom_phases',
            'project_materials', 'project_files', 'project_elements',
            'project_spray_settings', 'project_spray_items',
            'project_alerts', 'project_blockers', 'project_dispatch_items',
            'project_important_notes_reads',
            'stock_categories', 'stock_items', 'stock_transactions', 'stock_orders',
            'production_sheets', 'production_sheet_attachments', 'production_sheet_checklist',
            'machines', 'machine_service_history', 'machine_documents',
            'vans', 'van_documents', 'small_tools',
            'archived_project_files', 'archived_project_materials', 'archived_project_phases',
            'employee_holidays', 'wages', 'monthly_overheads', 'overhead_items',
            'today_events', 'company_settings'
        ];

        if (!allowedTables.includes(table)) {
            return res.status(403).json({ error: 'Access to this table is not allowed' });
        }

        let query;
        let result;

        switch (operation) {
            case 'select':
                query = supabase.from(table).select(select, count ? { count } : undefined);
                
                // Zawsze filtruj po tenant_id
                query = query.eq('tenant_id', tenantId);
                
                // Aplikuj filtry
                query = applyFilters(query, filters);
                
                // Order
                if (order) {
                    query = query.order(order.column, { ascending: order.ascending });
                }
                
                // Limit
                if (limit) {
                    query = query.limit(limit);
                }
                
                // Range
                if (range) {
                    query = query.range(range.from, range.to);
                }
                
                // Single
                if (single) {
                    query = query.single();
                }
                
                result = await query;
                break;

            case 'insert':
                // Dodaj tenant_id do danych
                const insertData = Array.isArray(data) 
                    ? data.map(d => ({ ...d, tenant_id: tenantId }))
                    : { ...data, tenant_id: tenantId };
                
                query = supabase.from(table).insert(insertData);
                
                if (select) {
                    query = query.select(select);
                }
                
                if (single) {
                    query = query.single();
                }
                
                result = await query;
                break;

            case 'update':
                query = supabase.from(table).update(data);
                
                // Zawsze filtruj po tenant_id
                query = query.eq('tenant_id', tenantId);
                
                // Aplikuj filtry
                query = applyFilters(query, filters);
                
                if (select) {
                    query = query.select(select);
                }
                
                if (single) {
                    query = query.single();
                }
                
                result = await query;
                break;

            case 'delete':
                query = supabase.from(table).delete();
                
                // Zawsze filtruj po tenant_id
                query = query.eq('tenant_id', tenantId);
                
                // Aplikuj filtry
                query = applyFilters(query, filters);
                
                result = await query;
                break;

            case 'upsert':
                const upsertData = Array.isArray(data)
                    ? data.map(d => ({ ...d, tenant_id: tenantId }))
                    : { ...data, tenant_id: tenantId };
                
                query = supabase.from(table).upsert(upsertData);
                
                if (select) {
                    query = query.select(select);
                }
                
                if (single) {
                    query = query.single();
                }
                
                result = await query;
                break;

            default:
                return res.status(400).json({ error: 'Invalid operation' });
        }

        if (result.error) {
            console.error('DB Query Error:', result.error);
            return res.status(400).json({ error: result.error.message, code: result.error.code });
        }

        res.json({ data: result.data, count: result.count });

    } catch (err) {
        console.error('DB Query Error:', err);
        res.status(500).json({ error: 'Database query failed' });
    }
});

/**
 * Helper - aplikuje filtry do query
 */
function applyFilters(query, filters) {
    for (const filter of filters) {
        switch (filter.type) {
            case 'eq':
                query = query.eq(filter.column, filter.value);
                break;
            case 'neq':
                query = query.neq(filter.column, filter.value);
                break;
            case 'gt':
                query = query.gt(filter.column, filter.value);
                break;
            case 'gte':
                query = query.gte(filter.column, filter.value);
                break;
            case 'lt':
                query = query.lt(filter.column, filter.value);
                break;
            case 'lte':
                query = query.lte(filter.column, filter.value);
                break;
            case 'like':
                query = query.like(filter.column, filter.value);
                break;
            case 'ilike':
                query = query.ilike(filter.column, filter.value);
                break;
            case 'is':
                query = query.is(filter.column, filter.value);
                break;
            case 'in':
                query = query.in(filter.column, filter.value);
                break;
            case 'contains':
                query = query.contains(filter.column, filter.value);
                break;
            case 'or':
                query = query.or(filter.value);
                break;
            case 'not':
                query = query.not(filter.column, filter.operator, filter.value);
                break;
            case 'filter':
                query = query.filter(filter.column, filter.operator, filter.value);
                break;
        }
    }
    return query;
}

module.exports = router;
