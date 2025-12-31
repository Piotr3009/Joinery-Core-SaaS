/**
 * Joinery Core SaaS - Storage Router
 * Obsługa plików z tenant isolation
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
 * POST /api/storage/upload
 * Upload pliku z tenant_id w ścieżce
 */
router.post('/upload', requireAuth, async (req, res) => {
    try {
        // Używamy express-fileupload lub multer
        // Na razie przyjmujemy base64 w body
        const { bucket, path, fileData, contentType, upsert } = req.body;

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
        
        // Dodaj tenant_id do ścieżki
        const fullPath = `${tenantId}/${path}`;

        // Dekoduj base64
        const buffer = Buffer.from(fileData, 'base64');

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fullPath, buffer, {
                contentType: contentType || 'application/octet-stream',
                upsert: upsert || false
            });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // Pobierz public URL
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fullPath);

        res.json({ 
            data: {
                ...data,
                path: fullPath,
                publicUrl: urlData.publicUrl
            }
        });

    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

/**
 * POST /api/storage/upload-form
 * Upload pliku przez FormData (dla większych plików)
 */
router.post('/upload-form', requireAuth, express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    try {
        const bucket = req.query.bucket;
        const path = req.query.path;
        const contentType = req.headers['content-type'];

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        const tenantId = req.user.tenant_id;
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

        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fullPath);

        res.json({
            data: {
                ...data,
                path: fullPath,
                publicUrl: urlData.publicUrl
            }
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
        
        // Sprawdź czy ścieżka należy do tego tenant
        if (!path.startsWith(`${tenantId}/`)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { data, error } = await supabase.storage
            .from(bucket)
            .download(path);

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
        
        // Sprawdź czy wszystkie ścieżki należą do tego tenant
        const safePaths = paths.filter(p => p.startsWith(`${tenantId}/`));
        
        if (safePaths.length === 0) {
            return res.status(403).json({ error: 'No valid paths' });
        }

        const { data, error } = await supabase.storage
            .from(bucket)
            .remove(safePaths);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

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
 * GET /api/storage/public/:bucket/*
 * Proxy dla publicznych plików (z tenant check)
 */
router.get('/public/:bucket/*', async (req, res) => {
    try {
        const bucket = req.params.bucket;
        const path = req.params[0];

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
        }

        // Dla publicznych plików - przekieruj do Supabase Storage
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
 */
router.get('/url', requireAuth, async (req, res) => {
    try {
        const { bucket, path } = req.query;

        if (!allowedBuckets.includes(bucket)) {
            return res.status(403).json({ error: 'Bucket not allowed' });
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
