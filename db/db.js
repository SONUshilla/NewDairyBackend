import pg from 'pg';
const { Pool } = pg;
const connectionString = "postgresql://postgres.ebxdyaymxnmtstmtkazo:Sonu%409728229828@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
if (!connectionString) {
  console.error('Missing DATABASE_URL / SUPABASE_DB_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => console.log('✅ Postgres pool connected'));
pool.on('error', (err) => console.error('❌ Unexpected Postgres error', err));

export default pool;