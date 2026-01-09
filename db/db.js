import pg from 'pg';
import dotenv from 'dotenv'; // Make sure to use dotenv for security

dotenv.config();

const { Pool } = pg;

// Use process.env in production
const connectionString = process.env.DATABASE_URL || "postgresql://postgres.ebxdyaymxnmtstmtkazo:Sonu%409728229828@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString,
  // 1. SSL is required for Supabase
  ssl: { 
    rejectUnauthorized: false 
  },
  // 2. Reduce max connections.
  // Since you are using Port 6543 (Session Mode), each connection here = 1 real connection.
  // Supabase Free Tier has a limit of about 20-60 connections.
  // Set this to 5 or 10 to leave room for other tools (like Supabase Studio).
  max: 10, 
  
  // 3. The "Cold Start" Timeout
  // How long to wait for a new connection before throwing an error.
  connectionTimeoutMillis: 10000, 
  
  // 4. Idle Timeout
  // Close connections if they haven't been used for 20 seconds.
  // This helps release connections back to Supabase.
  idleTimeoutMillis: 20000,

  // 5. CRITICAL FIX: TCP Keep-Alive
  // This prevents the "Connection terminated" error by keeping the socket active
  // even when no queries are running.
  keepAlive: true, 
});

// 6. Global Error Handler (Prevents app crash)
// Without this, if a connection breaks in the background, your whole Node app crashes.
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Do not exit the process here; the pool will just replace the dead client.
});

export default pool;