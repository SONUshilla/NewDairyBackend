// db.js
import pkg from 'pg';
const { Pool } = pkg;

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  
  // CRITICAL: Add SSL for Render
  ssl: {
    rejectUnauthorized: false
  },
  
  // Connection pool settings
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Add debugging
pool.on('connect', () => console.log('✅ DB connected'));
pool.on('error', (err) => console.error('❌ DB error:', err.message));

// Create db object with query method
const db = {
  query: (text, params) => pool.query(text, params),
  
  // Optional: Add helper methods if needed
  getClient: () => pool.connect(),
};

// Export as default
export default db;