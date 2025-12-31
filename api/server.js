/**
 * Joinery Core SaaS - API Server
 * Ten serwer jest pośrednikiem między frontendem a Supabase
 * Trzyma klucze bezpiecznie i sprawdza tenant_id
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// === SUPABASE CLIENT ===
// Service role - pełny dostęp (tylko backend!)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// === MIDDLEWARE ===
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
}

// === HEALTH CHECK ===
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Joinery Core API is running',
        version: '1.0.0'
    });
});

// === ROUTES ===
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/pipeline', require('./routes/pipeline'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/team', require('./routes/team'));
app.use('/api/stock', require('./routes/stock'));

// === 404 HANDLER ===
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// === ERROR HANDLER ===
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error(err.stack);
    
    // Nie ujawniaj szczegółów błędu w produkcji
    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'Internal server error' });
    } else {
        res.status(500).json({ 
            error: 'Internal server error',
            message: err.message,
            stack: err.stack
        });
    }
});

// === START SERVER ===
app.listen(PORT, () => {
    console.log(`🚀 Joinery Core API running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, supabase };
