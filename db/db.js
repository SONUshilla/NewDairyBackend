import pg from 'pg';
const { Pool } = pg;

// NOTE: I changed port 5432 to 6543 (Session Mode)
// Always use environment variables for secrets in production!
const connectionString = "postgresql://postgres.ebxdyaymxnmtstmtkazo:Sonu%409728229828@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

if (!connectionString) {
  console.error('Missing DATABASE_URL / SUPABASE_DB_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  // Fix 1: Supabase REQUIRES SSL. Force it to true.
  ssl: { 
    rejectUnauthorized: false 
  },
  // Fix 2: Lower max connections on free tier to avoid hitting limits
  max: 15, 
  // Fix 3: Increase connection timeout to handle "cold starts"
  connectionTimeoutMillis: 10000, // 10 seconds
  idleTimeoutMillis: 30000,
});

export default pool;