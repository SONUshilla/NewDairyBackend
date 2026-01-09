// dbWrapper.js - Smart wrapper that maintains db.query() interface
import pg from 'pg';
const { Pool } = pg;

// Configuration for Supabase
const getPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL || 
    "postgresql://postgres.ebxdyaymxnmtstmtkazo:Sonu%409728229828@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
  
  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5, // Keep it low for free tier
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Enable keepalive to prevent timeouts
    keepAlive: true,
    // Close and reopen connections periodically
    maxLifetimeMillis: 1800000, // 30 minutes
  };
};

class DatabaseWrapper {
  constructor() {
    this.pool = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.init();
  }

  init() {
    try {
      const config = getPoolConfig();
      this.pool = new Pool(config);
      
      this.pool.on('connect', () => {
        console.log('✅ Database connected');
        this.reconnectAttempts = 0; // Reset on successful connection
      });

      this.pool.on('error', (err) => {
        console.error('❌ Database pool error:', err.message);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.init(), 5000);
        }
      });

      // Test connection immediately
      this.testConnection();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  async testConnection() {
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connection test successful');
      client.release();
    } catch (err) {
      console.error('❌ Database connection test failed:', err.message);
    }
  }

  async query(text, params) {
    let client;
    try {
      client = await this.pool.connect();
      const result = await client.query(text, params);
      return result;
    } catch (err) {
      console.error('Query error:', err.message);
      throw err;
    } finally {
      if (client) client.release();
    }
  }

  async connect() {
    return this.pool.connect();
  }

  async end() {
    return this.pool.end();
  }
}

// Create singleton instance
const db = new DatabaseWrapper();

// Export with the same interface as before
export default db;