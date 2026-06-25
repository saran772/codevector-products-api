const pool = require('./db');
require('dotenv').config();

const TOTAL_PRODUCTS = 200000;
const BATCH_SIZE = 1000; // Insert 1000 at a time
const CATEGORIES = [
  'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports',
  'Toys', 'Food & Drink', 'Beauty', 'Art & Crafts', 'Furniture',
  'Jewelry', 'Automotive', 'Office Supplies', 'Pet Supplies', 'Music',
  'Movies', 'Games', 'Outdoors', 'Baby Products', 'Health & Medicine',
  'Tools', 'Industrial', 'Grocery', 'Kitchen', 'Bedding'
];

async function generateProducts() {
  const client = await pool.connect();

  try {
    console.log('🗑️  Dropping existing products table...');
    await client.query('DROP TABLE IF EXISTS products CASCADE');

    console.log('📝 Creating products table...');
    await client.query(`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('🚀 Generating and inserting 200,000 products in batches...');
    
    let productsInserted = 0;
    const startTime = Date.now();

    // Generate products in batches
    for (let batch = 0; batch < Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE); batch++) {
      const batchStart = batch * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_PRODUCTS);
      const batchSize = batchEnd - batchStart;

      // Build large VALUES clause with multiple records
      const values = [];
      const placeholders = [];
      let paramCount = 1;

      for (let i = batchStart; i < batchEnd; i++) {
        const name = `Product ${i + 1}`;
        const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        const price = (Math.random() * 1000 + 10).toFixed(2);
        const createdAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
        const updatedAt = new Date(createdAt.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);

        placeholders.push(
          `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4})`
        );
        
        values.push(name, category, price, createdAt, updatedAt);
        paramCount += 5;
      }

      const query = `
        INSERT INTO products (name, category, price, created_at, updated_at)
        VALUES ${placeholders.join(', ')}
      `;

      await client.query(query, values);
      productsInserted = batchEnd;

      // Progress indicator
      if ((batch + 1) % 10 === 0) {
        console.log(`  ✓ ${productsInserted}/${TOTAL_PRODUCTS} products inserted`);
      }
    }

    console.log('📊 Creating indexes for fast queries...');
    
    // Index for category + id DESC (most common query pattern)
    await client.query(`
      CREATE INDEX idx_category_id_desc 
      ON products(category, id DESC)
    `);

    // Index for created_at DESC (for sorting by newest)
    await client.query(`
      CREATE INDEX idx_created_at_desc 
      ON products(created_at DESC)
    `);

    // Index for id (for cursor pagination)
    await client.query(`
      CREATE INDEX idx_id_desc 
      ON products(id DESC)
    `);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n✅ Seed completed successfully!');
    console.log(`   📈 Total products: ${productsInserted}`);
    console.log(`   ⏱️  Time taken: ${duration}s`);
    console.log(`   📚 Categories: ${CATEGORIES.length}`);
    console.log('\n💾 Ready to query! Start the server with: npm start');

  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

generateProducts();
