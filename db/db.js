// dbWrapper.js
import pg from 'pg';
const { Pool } = pg;

const getPoolConfig = () => {
  const connectionString = "postgresql://mydbuser:mypassword@72.61.115.157:5432/mydatabase";
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL env var');
  }

  return {
    connectionString,
    max: parseInt(process.env.DB_MAX_CLIENTS || '6', 10), // tune per environment
    idleTimeoutMillis: 30000, // 30s
    connectionTimeoutMillis: 10000, // 10s
    // socket keepalive is enabled by PG client when pool.connect() used; additional options not required here
  };
};

class DatabaseWrapper {
  constructor() {
    this.pool = new Pool(getPoolConfig());
    this._attachPoolListeners();
    // start lightweight keepalive
    this._startHeartbeat();
  }

  _attachPoolListeners() {
    this.pool.on('connect', () => {
      console.log('✅ Database connected');
    });

    this.pool.on('error', (err) => {
      // This event is for idle client errors — log and let the pool manage reconnection
      console.error('❌ Database pool error:', err && err.message ? err.message : err);
    });
  }

  _startHeartbeat() {
    // Run a tiny query periodically to keep connections warm and detect broken sockets.
    const intervalMs = parseInt(process.env.DB_HEARTBEAT_MS || '60000', 10); // 60s
    this._heartbeat = setInterval(async () => {
      try {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();
      } catch (err) {
        console.warn('DB heartbeat failed:', err && err.message ? err.message : err);
      }
    }, intervalMs);
    if (this._heartbeat.unref) this._heartbeat.unref(); // allow process to exit
  }

  async query(text, params) {
    const client = await this.pool.connect();
    try {
      return await client.query(text, params);
    } catch (err) {
      // Convert common transient errors to a clearer message
      console.error('Query error:', err.message || err);
      throw err;
    } finally {
      client.release();
    }
  }

  async connect() {
    return this.pool.connect();
  }

  async end() {
    clearInterval(this._heartbeat);
    return this.pool.end();
  }
}

const db = new DatabaseWrapper();
export default db;