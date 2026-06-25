const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const pool = require('./db');
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static UI files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/products', productsRouter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'CodeVector Products API',
    version: '1.0.0',
    endpoints: {
      api: {
        products: 'GET /api/products?after=<cursor>&category=<cat>&limit=20',
        categories: 'GET /api/categories',
        product: 'GET /api/products/:id',
        health: 'GET /api/health'
      },
      ui: 'GET / (open in browser)'
    },
    documentation: {
      pagination: 'Cursor-based (prevents duplicates during concurrent updates)',
      indexing: 'Optimized for fast queries with multi-column indexes',
      features: ['Filtering by category', 'Fast pagination', 'Concurrent update handling']
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     🚀 CodeVector Products API                          ║
║     Server running on port ${PORT}                            ║
║                                                          ║
║     📚 API: http://localhost:${PORT}/api/products        ║
║     🎨 UI:  http://localhost:${PORT}                     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await pool.end();
  process.exit(0);
});
