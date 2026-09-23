'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Initialize DB (runs schema migration on startup)
require('./database');

const patientsRouter = require('./routes/patients');
const vapiRouter = require('./routes/vapi');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve the patient dashboard (bonus UI)
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Patient Registration System',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────
app.use('/patients', patientsRouter);
app.use('/vapi', vapiRouter);

// ─────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    data: null,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` },
  });
});

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  res.status(500).json({
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
});

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Patient Registration System — API Server   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  🚀 Server running on port ${PORT}`);
  console.log(`  📋 Patients API:  http://localhost:${PORT}/patients`);
  console.log(`  🔊 Vapi Webhook:  http://localhost:${PORT}/vapi/webhook`);
  console.log(`  🖥️  Dashboard:     http://localhost:${PORT}`);
  console.log(`  ❤️  Health check:  http://localhost:${PORT}/health`);
  console.log('');
});

module.exports = app;
