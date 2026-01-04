// db.js - Updated configuration
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  
  // Enhanced SSL configuration for Render
  ssl: {
    rejectUnauthorized: false,
    // Add these for better compatibility
    sslmode: 'require'
  },
  
  // Adjusted timeout settings for Render
  max: 20,               // Increase max connections
  min: 2,                // Keep some minimum connections
  idleTimeoutMillis: 60000,  // Increase idle timeout to 60s
  connectionTimeoutMillis: 15000,  // Connection timeout to 15s
  query_timeout: 10000,  // Query timeout
  statement_timeout: 10000, // Statement timeout
  keepAlive: true,       // Enable TCP keepalive
  keepAliveInitialDelayMillis: 30000, // Send keepalive after 30s
});

// Enhanced error handling
pool.on('connect', () => console.log('✅ DB connected'));
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client:', err.message, err.stack);
});
pool.on('remove', () => console.log('🔌 Client removed from pool'));

const db = {
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`📊 Executed query in ${duration}ms`);
      return res;
    } catch (error) {
      console.error('❌ Query error:', error.message, text);
      throw error;
    }
  },
  
  // With retry logic for transient failures
  queryWithRetry: async (text, params, maxRetries = 2) => {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await db.query(text, params);
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          console.log(`🔄 Retrying query (attempt ${i + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * i)); // Exponential backoff
        }
      }
    }
    throw lastError;
  },
  
  getClient: async () => {
    const client = await pool.connect();
    const release = client.release;
    // Set a timeout to prevent client from being stuck
    const timeout = setTimeout(() => {
      console.error('⚠️ Client held for too long, forcing release');
      client.release();
    }, 30000); // 30 second timeout
    
    // Override release method to clear timeout
    client.release = () => {
      clearTimeout(timeout);
      release.apply(client);
    };
    return client;
  },
};

export default db;