const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /products
 * 
 * Cursor-based pagination endpoint that handles concurrent updates correctly.
 * 
 * Query parameters:
 * - after: cursor ID to fetch products after (for pagination)
 * - category: filter by category
 * - limit: number of products to return (default: 20, max: 100)
 * 
 * Response: { products: [...], nextCursor: "...", hasMore: true }
 * 
 * WHY CURSOR-BASED?
 * - Offset-based pagination (OFFSET/LIMIT) breaks when data changes
 * - If 50 new products are added while browsing, you might see duplicates or miss products
 * - Cursor-based uses ID position, which stays consistent even during concurrent updates
 */
router.get('/', async (req, res) => {
  try {
    const { after, category, limit = 20 } = req.query;

    // Validate limit
    const queryLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    // Build the query
    let query = 'SELECT id, name, category, price, created_at, updated_at FROM products WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Apply category filter if provided
    if (category && category.trim()) {
      query += ` AND category = $${paramCount}`;
      params.push(category.trim());
      paramCount++;
    }

    // Apply cursor: fetch products with ID less than the cursor
    // This ensures even if new products are added, you won't see duplicates
    if (after) {
      const afterId = parseInt(after);
      if (!isNaN(afterId)) {
        query += ` AND id < $${paramCount}`;
        params.push(afterId);
        paramCount++;
      }
    }

    // Order by ID descending (newest/highest IDs first) and get one extra to check hasMore
    query += ` ORDER BY id DESC LIMIT $${paramCount}`;
    params.push(queryLimit + 1);

    const result = await pool.query(query, params);
    const rows = result.rows;

    // Determine if there are more products
    const hasMore = rows.length > queryLimit;
    const products = rows.slice(0, queryLimit);

    // The next cursor is the ID of the last product in this batch
    const nextCursor = products.length > 0 
      ? products[products.length - 1].id.toString()
      : null;

    // Get total count for stats (optional, can be slow for 200k+ records)
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
        totalCount // Only included on first request (no after, no category)
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
 * 
 * Get all available categories with product count
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
 * 
 * Get a single product by ID
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
