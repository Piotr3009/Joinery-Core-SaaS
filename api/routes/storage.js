/**
 * Joinery Core SaaS - Storage Router
 * Obsługa plików z tenant isolation
 * 
 * LIMITS: Sprawdza max_storage_mb przed uploadem
 * 
 * DIRECT UPLOAD: Używa signed URL do bezpośredniego uploadu do Supabase
 * (omija limit Vercel 4.5MB)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Dozwolone buckety
const allowedBuckets = [
    'project-documents',
    'stock-images',
    'stock-documents', 
    'equipment-images',
    'equipment-documents',
    'company-assets'
];

/**
 * Helper: Sprawdź czy tenant ma miejsce na plik
 */
async function checkStorageLimit(tenantId, fileSizeBytes) {
    const { data: org, error } = await supabase
        .from('organizations')
        .select('max_storage_mb, current_storage_bytes')
        .eq('id', tenantId)
        .single();
    
    if (error) {
        console.error('Storage limit check error:', error);
        return { allowed: false, error: 'Failed to check storage limit' };
    }
    
    const maxBytes = (org.max_storage_mb || 500) * 1024 * 1024; // MB to bytes
    const currentBytes = org.current_storage_bytes || 0;
    const newTotal = currentBytes + fileSizeBytes;
    
    if (newTotal > maxBytes) {
        return { 
            allowed: false, 
            error: 'Storage limit exceeded',
            current_mb: Math.round(currentBytes / 1048576 * 100) / 100,
            max_mb: org.max_storage_mb,
            file_mb: Math.round(fileSizeBytes / 1048576 * 100) / 100,
            upgrade_required: true
        };
    }
    
    return { 
        allowed: true,
        current_mb: Math.round(currentBytes / 1048576 * 100) / 100,
        max_mb: org.max_storage_mb,
        remaining_mb: Math.round((maxBytes - currentBytes) / 1048576 * 100) / 100
    };
}

/**
 * Helper: Aktualizuj current_storage_bytes po upload/delete
 */
async function updateStorageUsage(tenantId, deltaBytes) {
    const { error } = await supabase.rpc('update_tenant_storage_usage', { 
        p_tenant_id: tenantId 
    });
    
    if (error) {
        console.error('Failed to update storage usage:', error);
    }
}

/**
 * GET /api/storage/usage
 * Sprawdź aktualny usage storage
 */
router.get('/usage', requireAuth, async (req, res) => {
    try {
        const { data: org, error } = await supabase
            .from('organizations')
            .select('max_storage_mb, current_storage_bytes, plan')
            .eq('id', req.user.tenant_id)
            .single();
        
        if (error) throw error;
        
        const currentMb = Math.round((org.current_storage_bytes || 0) / 1048576 * 100) / 100;
        const maxMb = org.max_storage_mb || 500;
        
        res.json({
            current_mb: currentMb,
            max_mb: maxMb,
            remaining_mb: Math.round((maxMb - currentMb) * 100) / 100,
            percent_used: Math.round((currentMb / maxMb) * 100),
            plan: org.plan
        });
        
    } catch (err) {
        console.error('Storage usage error:', err);
        res.status(500).json({ error: 'Failed to get storage usage' });
    }
});

// ============================================================
// DIRECT UPLOAD - omija limit Vercel 4.5MB
// ============================================================

/**
 * POST /api/storage/request-upload
 * Krok 1: Sprawdza limit i tworzy signed upload URL
 * Frontend używa tego URL do direct upload do Supabase
 */
router.post('/request-upload', requireAuth, async (req, res) => {
    try {
        const { bucket, path, fileSize, contentType } = req.body;
        const tenantId = req.user.tenant_id;

        console.log('📤 [REQUEST-UPLOAD] Start');
        console.log('   → Tenant:', tenantId);
        console.log('   → Bucket:', bucket);
        console.log('   → Path:', path);
        console.log('   → File size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');

        // Walidacja bucketa
        if (!allowedBuckets.includes(bucket)) {
            console.log('   ❌ Bucket not allowed:', bucket);
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        // Sprawdź limit storage
        console.log('   → Checking storage limit...');
        const limitCheck = await checkStorageLimit(tenantId, fileSize);
        console.log('   → Limit check result:', JSON.stringify(limitCheck));

        if (!limitCheck.allowed) {
            console.log('   ❌ Storage limit exceeded');
            return res.status(403).json(limitCheck);
        }

        // Pełna ścieżka z tenant_id
        const fullPath = `${tenantId}/${path}`;
        console.log('   → Full path:', fullPath);

        // Utwórz signed upload URL (ważny 1 godzinę)
        console.log('   → Creating signed upload URL...');
        const { data: signedData, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUploadUrl(fullPath);

        if (signedError) {
            console.log('   ❌ Signed URL error:', signedError);
            return res.status(400).json({ error: signedError.message });
        }

        console.log('   ✅ Signed URL created successfully');
        console.log('   → Token (first 20 chars):', signedData.token?.substring(0, 20) + '...');

        res.json({
            success: true,
            signedUrl: signedData.signedUrl,
            token: signedData.token,
            path: signedData.path,
            fullPath: fullPath,
            bucket: bucket,
            storage: limitCheck
        });

    } catch (err) {
        console.error('❌ [REQUEST-UPLOAD] Error:', err);
        res.status(500).json({ error: 'Failed to create upload URL' });
    }
});

/**
 * POST /api/storage/confirm-upload
 * Krok 3: Po udanym uploadzie - aktualizuj storage usage
 */
router.post('/confirm-upload', requireAuth, async (req, res) => {
    try {
        const { bucket, fullPath, fileSize } = req.body;
        const tenantId = req.user.tenant_id;

        console.log('✅ [CONFIRM-UPLOAD] Start');
        console.log('   → Tenant:', tenantId);
        console.log('   → Bucket:', bucket);
        console.log('   → Path:', fullPath);
        console.log('   → File size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');

        // Weryfikuj że plik faktycznie istnieje w storage
        console.log('   → Verifying file exists...');
        const folderPath = fullPath.split('/').slice(0, -1).join('/');
        const fileName = fullPath.split('/').pop();
        
        const { data: fileData, error: fileError } = await supabase.storage
            .from(bucket)
            .list(folderPath, {
                search: fileName
            });

        if (fileError) {
            console.log('   ⚠️ Could not verify file:', fileError.message);
            // Kontynuuj mimo błędu weryfikacji
        } else {
            const found = fileData?.some(f => f.name === fileName);
            console.log('   → File verification result:', found ? 'Found ✅' : 'Not found ⚠️');
        }

        // Aktualizuj storage usage
        console.log('   → Updating storage usage...');
        await updateStorageUsage(tenantId, fileSize);

        // Pobierz public URL
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fullPath);

        console.log('   ✅ Upload confirmed successfully');
        console.log('   → Public URL:', urlData.publicUrl?.substring(0, 60) + '...');

        // Pobierz aktualny stan storage
        const { data: org } = await supabase
            .from('organizations')
            .select('max_storage_mb, current_storage_bytes')
            .eq('id', tenantId)
            .single();

        const currentMb = Math.round((org?.current_storage_bytes || 0) / 1048576 * 100) / 100;
        const maxMb = org?.max_storage_mb || 500;

        res.json({
            success: true,
            publicUrl: urlData.publicUrl,
            path: fullPath,
            storage: {
                current_mb: currentMb,
                max_mb: maxMb,
                remaining_mb: Math.round((maxMb - currentMb) * 100) / 100
            }
        });

    } catch (err) {
        console.error('❌ [CONFIRM-UPLOAD] Error:', err);
        res.status(500).json({ error: 'Failed to confirm upload' });
    }
});

// ============================================================
// LEGACY UPLOAD ENDPOINTS (zachowane dla kompatybilności)
// ============================================================

/**
 * POST /api/storage/upload
 * Upload pliku z tenant_id w ścieżce
 */
router.post('/upload', requireAuth, async (req, res) => {
    try {
        const { bucket, path, fileData, contentType, upsert } = req.body;

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        
        // Dekoduj base64
        const buffer = Buffer.from(fileData, 'base64');
        const fileSize = buffer.length;
        
        // SPRAWDŹ LIMIT STORAGE
        const limitCheck = await checkStorageLimit(tenantId, fileSize);
        if (!limitCheck.allowed) {
            return res.status(403).json(limitCheck);
        }
        
        // Dodaj tenant_id do ścieżki
        const fullPath = `${tenantId}/${path}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fullPath, buffer, {
                contentType: contentType || 'application/octet-stream',
                upsert: upsert || false
            });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // Aktualizuj storage usage
        await updateStorageUsage(tenantId, fileSize);

        // Pobierz public URL
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fullPath);

        res.json({ 
            data: {
                ...data,
                path: fullPath,
                publicUrl: urlData.publicUrl,
                size: fileSize
            },
            storage: limitCheck
        });

    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

/**
 * POST /api/storage/upload-form
 * Upload pliku przez FormData (dla większych plików)
 * UWAGA: Ten endpoint ma limit Vercel 4.5MB - używaj direct upload dla większych plików
 */
router.post('/upload-form', requireAuth, express.raw({ type: '*/*', limit: '99mb' }), async (req, res) => {
    try {
        const bucket = req.query.bucket;
        const path = req.query.path;
        const contentType = req.headers['content-type'];

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        const fileSize = req.body.length;
        
        // SPRAWDŹ LIMIT STORAGE
        const limitCheck = await checkStorageLimit(tenantId, fileSize);
        if (!limitCheck.allowed) {
            return res.status(403).json(limitCheck);
        }
        
        const fullPath = `${tenantId}/${path}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fullPath, req.body, {
                contentType: contentType,
                upsert: req.query.upsert === 'true'
            });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // Aktualizuj storage usage
        await updateStorageUsage(tenantId, fileSize);

        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fullPath);

        res.json({
            data: {
                ...data,
                path: fullPath,
                publicUrl: urlData.publicUrl,
                size: fileSize
            },
            storage: limitCheck
        });

    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

/**
 * GET /api/storage/download
 * Pobierz plik
 */
router.get('/download', requireAuth, async (req, res) => {
    try {
        const { bucket, path } = req.query;

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        
        // Dodaj tenant_id do ścieżki (tak jak przy upload)
        const fullPath = `${tenantId}/${path}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .download(fullPath);

        if (error) {
            return res.status(404).json({ error: error.message });
        }

        // Zwróć plik
        const buffer = await data.arrayBuffer();
        res.send(Buffer.from(buffer));

    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed' });
    }
});

/**
 * POST /api/storage/remove
 * Usuń pliki
 */
router.post('/remove', requireAuth, async (req, res) => {
    try {
        const { bucket, paths } = req.body;

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        
        // Dodaj tenant_id do każdej ścieżki (tak jak przy upload)
        const fullPaths = paths.map(p => `${tenantId}/${p}`);

        const { data, error } = await supabase.storage
            .from(bucket)
            .remove(fullPaths);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // Aktualizuj storage usage (przelicz od nowa)
        await updateStorageUsage(tenantId, 0);

        res.json({ data });

    } catch (err) {
        console.error('Remove error:', err);
        res.status(500).json({ error: 'Remove failed' });
    }
});

/**
 * GET /api/storage/list
 * Lista plików w folderze
 */
router.get('/list', requireAuth, async (req, res) => {
    try {
        const { bucket, path = '' } = req.query;

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        const fullPath = path ? `${tenantId}/${path}` : tenantId;

        const { data, error } = await supabase.storage
            .from(bucket)
            .list(fullPath);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ data });

    } catch (err) {
        console.error('List error:', err);
        res.status(500).json({ error: 'List failed' });
    }
});

/**
 * POST /api/storage/signed-url
 * Stwórz signed URL
 */
router.post('/signed-url', requireAuth, async (req, res) => {
    try {
        const { bucket, path, expiresIn = 3600 } = req.body;

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        
        // Sprawdź czy ścieżka należy do tego tenant
        if (!path.startsWith(`${tenantId}/`)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ data });

    } catch (err) {
        console.error('Signed URL error:', err);
        res.status(500).json({ error: 'Failed to create signed URL' });
    }
});

/**
 * GET /api/storage/file/:bucket/*
 * Public access do plików (bez auth) - przekierowanie do Supabase
 * Pliki są "ukryte" przez tenant_id w ścieżce (jak stary system)
 */
router.get('/file/:bucket/*', async (req, res) => {
    try {
        const bucket = req.params.bucket;
        const path = req.params[0];

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        // Przekieruj do Supabase Storage public URL
        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
        res.redirect(publicUrl);

    } catch (err) {
        console.error('File URL error:', err);
        res.status(500).json({ error: 'Failed to get file' });
    }
});

/**
 * GET /api/storage/public/:bucket/*
 * Proxy dla plików z tenant isolation
 * SECURITY: Wymaga auth i tenant check
 */
router.get('/public/:bucket/*', requireAuth, async (req, res) => {
    try {
        const bucket = req.params.bucket;
        const path = req.params[0];

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        
        // SECURITY: Sprawdź czy ścieżka należy do tego tenant
        if (!path.startsWith(`${tenantId}/`)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Przekieruj do Supabase Storage (lub użyj signed URL dla prywatnych)
        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
        res.redirect(publicUrl);

    } catch (err) {
        console.error('Public URL error:', err);
        res.status(500).json({ error: 'Failed to get public URL' });
    }
});

/**
 * GET /api/storage/url
 * Pobierz public URL dla pliku
 * SECURITY: Wymaga tenant check
 */
router.get('/url', requireAuth, async (req, res) => {
    try {
        const { bucket, path } = req.query;

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        
        // SECURITY: Sprawdź czy ścieżka należy do tego tenant
        if (!path.startsWith(`${tenantId}/`)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

        res.json({ data });

    } catch (err) {
        console.error('URL error:', err);
        res.status(500).json({ error: 'Failed to get URL' });
    }
});

module.exports = router;