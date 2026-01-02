/**
 * Joinery Core SaaS - API Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// === MIDDLEWARE ===
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

// Skip body parsing for upload routes - let them handle raw data
app.use((req, res, next) => {
    if (req.path.includes('/upload')) {
        next();
    } else {
        express.json({ limit: '50mb' })(req, res, next);
    }
});

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
app.use('/api/db', require('./routes/db'));
app.use('/api/storage', require('./routes/storage'));
app.use('/api/rpc', require('./routes/rpc'));
app.use('/api/bootstrap', require('./routes/bootstrap'));
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
    res.status(500).json({ error: 'Internal server error' });
});

// ///Export app dla Vercel - v2
module.exports = app; 
