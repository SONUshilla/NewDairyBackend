import pkg from 'pg';
const { Pool } = pkg;

const connectionString = 'postgresql://postgres.ebxdyaymxnmtstmtkazo:Sonu%409728229828@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

const db = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,                    // max clients in pool
  idleTimeoutMillis: 20000,   // release idle clients after 20s
  connectionTimeoutMillis: 5000 // fail fast if can't connect
});

db.on('connect', () => console.log('✅ Connected to Supabase PostgreSQL'));
db.on('error', (err) => console.error('🔥 PostgreSQL pool error:', err));
db.on('acquire', () => console.log('Client acquired'));
db.on('remove', () => console.log('Client removed'));

export default db;
