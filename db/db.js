// db.js
import pkg from 'pg';
const { Pool } = pkg;

// Parse DATABASE_URL for better configuration
const connectionString = process.env.DATABASE_URL;

// Extract project reference for Supabase pooler
let supabaseConfig = {};
try {
  const url = new URL(connectionString);
  const hostname = url.hostname;
  
  // Check if it's direct Supabase URL or pooler
  if (hostname.includes('supabase.co')) {
    const projectRef = hostname.split('.')[1]; // Get project ref from db.[ref].supabase.co
    
    // Alternative pooler URL (recommended)
    const poolerUrl = connectionString.replace(
      `db.${projectRef}.supabase.co:5432`,
      `aws-0-${process.env.SUPABASE_REGION || 'ap-south-1'}.pooler.supabase.com:6543`
    );
    
    console.log(`🔗 Using Supabase project: ${projectRef}`);
    
    supabaseConfig = {
      ssl: { rejectUnauthorized: false },
      sslmode: 'require',
      application_name: 'render_app'
    };
  }
} catch (e) {
  console.log('⚠️ Could not parse database URL');
}

const pool = new Pool({
  connectionString: connectionString,
  
  // Essential SSL settings for Supabase on Render
  ssl: supabaseConfig.ssl || { rejectUnauthorized: false },
  
  // **CRITICAL: Connection settings for Render + Supabase**
  max: 5,                     // Reduced from 10! Supabase free tier has limits
  min: 1,
  idleTimeoutMillis: 10000,   // How long a client can be idle
  connectionTimeoutMillis: 5000, // Timeout for new connections (shorter!)
  query_timeout: 10000,       // Query timeout
  statement_timeout: 10000,   // Statement timeout
  
  // Keepalive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  
  // Allow exit on idle
  allowExitOnIdle: true,
  
  // Pool behavior
  maxUses: 7500,              // Close connections after 7500 uses
});

// Enhanced event listeners
pool.on('connect', (client) => {
  console.log('✅ New client connected to pool');
  // Set statement timeout for this connection
  client.query('SET statement_timeout = 10000');
});

pool.on('acquire', (client) => {
  console.log('🔑 Client acquired from pool');
});

pool.on('release', (err, client) => {
  if (err) {
    console.error('❌ Error releasing client:', err.message);
  } else {
    console.log('🔄 Client released back to pool');
  }
});

pool.on('remove', (client) => {
  console.log('🗑️ Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('💥 Unexpected pool error:', err.message);
  // Don't crash on pool errors
});

// Export with enhanced error handling
const db = {
  query: async (text, params, options = {}) => {
    const start = Date.now();
    const client = await pool.connect();
    
    try {
      // Set query timeout if specified
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }
      
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      console.log(`📊 Query "${text.substring(0, 50)}..." took ${duration}ms`);
      return result;
    } catch (error) {
      console.error('❌ Query failed:', {
        query: text,
        params: params ? params.map(p => typeof p === 'string' ? p.substring(0, 20) : p) : null,
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Re-throw with context
      error.query = text;
      throw error;
    } finally {
      // Always release client
      client.release();
    }
  },
  
  // Simple query without transaction (for quick operations)
  simpleQuery: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (error) {
      console.error('❌ Simple query error:', error.message);
      throw error;
    }
  },
  
  // Get client for transactions
  getClient: async () => {
    const client = await pool.connect();
    
    // Set reasonable timeouts
    await client.query('SET statement_timeout = 10000');
    await client.query('SET idle_in_transaction_session_timeout = 10000');
    
    return client;
  },
  
  // Health check
  checkHealth: async () => {
    try {
      await pool.query('SELECT 1');
      return { status: 'healthy', poolSize: pool.totalCount, idle: pool.idleCount };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  },
  
  // Close pool (for graceful shutdown)
  close: () => pool.end()
};

// Health check interval (every 30 seconds)
setInterval(async () => {
  const health = await db.checkHealth();
  console.log(`🏥 Database health: ${health.status} (${health.poolSize} clients)`);
}, 30000);

export default db;