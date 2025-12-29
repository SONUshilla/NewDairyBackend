import pg from 'pg';

const { Client } = pg;

// ✅ Replace this with your actual Supabase database password
const connectionString = 'postgresql://postgres.ebxdyaymxnmtstmtkazo:Sonu@9728229828@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

const db = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Needed for Supabase's SSL requirement
  },
});

db.connect()
  .then(() => console.log("✅ Connected to Supabase PostgreSQL"))
  .catch(err => console.error("❌ Connection error:", err.stack));

export default db;
