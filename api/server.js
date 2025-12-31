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
app.use(cors()); // Pozwala na zapytania z frontendu
app.use(express.json()); // Parsuje JSON w body

// === HEALTH CHECK ===
// Prosty endpoint do sprawdzenia czy serwer działa
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Joinery Core API is running'
    });
});

// === ROUTES ===
// Tu będziemy dodawać kolejne endpointy
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/projects', require('./routes/projects'));
// app.use('/api/stock', require('./routes/stock'));

// === ERROR HANDLER ===
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// === START SERVER ===
app.listen(PORT, () => {
    console.log(`🚀 Joinery Core API running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, supabase };
