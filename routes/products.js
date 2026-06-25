const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /products
 * 
 * Compound cursor-based pagination that handles concurrent updates correctly.
 * Sorts by updated_at DESC (newest first), then id DESC as tiebreaker.
 * 
 * Query parameters:
 * - after: cursor in format "TIMESTAMP_ID" (e.g., "2026-06-25T14:20:31Z_1234")
 * - category: filter by category
 * - limit: number of products to return (default: 20, max: 100)
 */
router.get('/', async (req, res) => {
  try {
    const { after, category, limit = 20 } = req.query;
    const queryLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    let query = 'SELECT id, name, category, price, created_at, updated_at FROM products WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Apply category filter if provided
    if (category && category.trim()) {
      query += ` AND category = $${paramCount}`;
      params.push(category.trim());
      paramCount++;
    }

    // Parse compound cursor if provided (format: "TIMESTAMP_ID")
    if (after) {
      const parts = after.split('_');
      if (parts.length === 2) {
        const cursorUpdatedAt = parts[0];
        const cursorId = parseInt(parts[1]);
        
        if (!isNaN(cursorId)) {
          // Compound cursor: (updated_at, id) < (cursor_updated_at, cursor_id)
          query += ` AND (updated_at, id) < ($${paramCount}, $${paramCount + 1})`;
          params.push(cursorUpdatedAt, cursorId);
          paramCount += 2;
        }
      }
    }

    // Sort by updated_at DESC (newest first), then id DESC as tiebreaker
    query += ` ORDER BY updated_at DESC, id DESC LIMIT $${paramCount}`;
    params.push(queryLimit + 1);

    const result = await pool.query(query, params);
    const rows = result.rows;

    // Determine if there are more products
    const hasMore = rows.length > queryLimit;
    const products = rows.slice(0, queryLimit);

    // Create next cursor: "TIMESTAMP_ID"
    const nextCursor = products.length > 0 
      ? `${products[products.length - 1].updated_at.toISOString()}_${products[products.length - 1].id}`
      : null;

    // Get total count
    let totalCount = null;
    if (!after && !category) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM products');
      totalCount = parseInt(countResult.rows[0].count);
    }

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          nextCursor,
          hasMore,
          limit: queryLimit,
          returned: products.length
        },
        totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

/**
 * GET /products/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM products
      GROUP BY category
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

/**
 * GET /products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

module.exports = router;