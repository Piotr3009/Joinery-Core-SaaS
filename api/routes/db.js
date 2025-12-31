/**
 * Joinery Core SaaS - Database Query Router
 * Generyczny endpoint do wykonywania zapytań z tenant isolation
 * 
 * SECURITY:
 * - Role-based permission checks
 * - Tenant isolation per table
 * - Allowlist tables only
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

// Singleton Supabase client (performance)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.use(requireAuth);

// ==================== ROLE PERMISSIONS ====================
const ROLE_PERMISSIONS = {
    owner: { canSelect: true, canInsert: true, canUpdate: true, canDelete: true },
    admin: { canSelect: true, canInsert: true, canUpdate: true, canDelete: true },
    manager: { canSelect: true, canInsert: true, canUpdate: true, canDelete: false },
    worker: { canSelect: true, canInsert: false, canUpdate: true, canDelete: false },
    viewer: { canSelect: true, canInsert: false, canUpdate: false, canDelete: false }
};

// Tables that workers CAN update (limited write access)
const WORKER_WRITABLE_TABLES = [
    'project_phases', 'pipeline_phases',  // Update phase status
    'project_spray_items',                 // Update spray status
    'project_important_notes_reads'        // Mark notes as read
];

// Tables that workers CAN insert into
const WORKER_INSERTABLE_TABLES = [
    'project_important_notes_reads'
];

// ==================== TENANT ID MAPPING ====================
// Some tables use different column for tenant isolation
const TENANT_COLUMN_MAP = {
    'organizations': 'id',           // organizations.id = tenant_id
    'user_profiles': 'tenant_id',    // standard
    // All other tables use 'tenant_id' by default
};

function getTenantColumn(table) {
    return TENANT_COLUMN_MAP[table] || 'tenant_id';
}

// ==================== PERMISSION CHECK ====================
function checkPermission(role, operation, table) {
    const normalizedRole = (role || 'viewer').toLowerCase();
    const perms = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS.viewer;
    
    switch (operation) {
        case 'select':
            return perms.canSelect;
        case 'insert':
            // Workers can only insert to specific tables
            if (normalizedRole === 'worker') {
                return WORKER_INSERTABLE_TABLES.includes(table);
            }
            return perms.canInsert;
        case 'update':
            // Workers can only update specific tables
            if (normalizedRole === 'worker') {
                return WORKER_WRITABLE_TABLES.includes(table);
            }
            return perms.canUpdate;
        case 'delete':
            return perms.canDelete;
        case 'upsert':
            // Upsert = insert or update
            if (normalizedRole === 'worker') {
                return WORKER_WRITABLE_TABLES.includes(table);
            }
            return perms.canInsert || perms.canUpdate;
        default:
            return false;
    }
}

// ==================== ALLOWED TABLES ====================
const ALLOWED_TABLES = [
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
            maybeSingle,
            count,
            data,
            onConflict
        } = req.body;

        const tenantId = req.user.tenant_id;
        const userRole = req.user.role;

        // Walidacja podstawowa
        if (!table || !operation) {
            return res.status(400).json({ error: 'Missing table or operation' });
        }

        // Sprawdź czy tabela jest dozwolona
        if (!ALLOWED_TABLES.includes(table)) {
            return res.status(403).json({ error: 'Access to this table is not allowed' });
        }

        // SECURITY: Sprawdź uprawnienia roli
        if (!checkPermission(userRole, operation, table)) {
            console.warn(`Permission denied: ${userRole} tried ${operation} on ${table}`);
            return res.status(403).json({ 
                error: `Permission denied: ${operation} on ${table} requires higher privileges` 
            });
        }

        // Pobierz odpowiednią kolumnę tenant
        const tenantColumn = getTenantColumn(table);

        let query;
        let result;

        switch (operation) {
            case 'select':
                query = supabase.from(table).select(select, count ? { count } : undefined);
                
                // Filtruj po tenant (używając odpowiedniej kolumny)
                query = query.eq(tenantColumn, tenantId);
                
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
                
                // Single or maybeSingle
                if (single) {
                    if (maybeSingle) {
                        query = query.maybeSingle();
                    } else {
                        query = query.single();
                    }
                }
                
                result = await query;
                break;

            case 'insert':
                // Dodaj tenant_id do danych (tylko jeśli tabela używa tenant_id)
                let insertData;
                if (tenantColumn === 'tenant_id') {
                    insertData = Array.isArray(data) 
                        ? data.map(d => ({ ...d, tenant_id: tenantId }))
                        : { ...data, tenant_id: tenantId };
                } else {
                    // Dla tabel jak organizations - nie dodawaj tenant_id
                    insertData = data;
                }
                
                query = supabase.from(table).insert(insertData);
                
                if (select) {
                    query = query.select(select);
                }
                
                if (single) {
                    if (maybeSingle) {
                        query = query.maybeSingle();
                    } else {
                        query = query.single();
                    }
                }
                
                result = await query;
                break;

            case 'update':
                query = supabase.from(table).update(data);
                
                // Filtruj po tenant
                query = query.eq(tenantColumn, tenantId);
                
                // Aplikuj filtry
                query = applyFilters(query, filters);
                
                if (select) {
                    query = query.select(select);
                }
                
                if (single) {
                    if (maybeSingle) {
                        query = query.maybeSingle();
                    } else {
                        query = query.single();
                    }
                }
                
                result = await query;
                break;

            case 'delete':
                query = supabase.from(table).delete();
                
                // Filtruj po tenant
                query = query.eq(tenantColumn, tenantId);
                
                // Aplikuj filtry
                query = applyFilters(query, filters);
                
                result = await query;
                break;

            case 'upsert':
                // Dodaj tenant_id do danych
                let upsertData;
                if (tenantColumn === 'tenant_id') {
                    upsertData = Array.isArray(data)
                        ? data.map(d => ({ ...d, tenant_id: tenantId }))
                        : { ...data, tenant_id: tenantId };
                } else {
                    upsertData = data;
                }
                
                // Build upsert options
                const upsertOptions = {};
                if (onConflict) {
                    upsertOptions.onConflict = onConflict;
                }
                
                query = supabase.from(table).upsert(upsertData, upsertOptions);
                
                if (select) {
                    query = query.select(select);
                }
                
                if (single) {
                    if (maybeSingle) {
                        query = query.maybeSingle();
                    } else {
                        query = query.single();
                    }
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
