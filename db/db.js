import pkg from 'pg';
const { Pool } = pkg;


// ✅ Replace this with your actual Supabase database password
const connectionString = 'postgresql://postgres.ebxdyaymxnmtstmtkazo:Sonu@9728229828@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
''
const db = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.on('connect', () => console.log('✅ Connected to Supabase PostgreSQL'));
db.on('error', (err) => console.error('🔥 PostgreSQL pool error:', err));

export default db;

