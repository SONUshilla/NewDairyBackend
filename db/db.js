import pg from 'pg';

const { Client } = pg;


const db = new Client({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.ebxdyaymxnmtstmtkazo',
  password: 'Sonu@9728229828',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect()
  .then(() => console.log("✅ Connected to Supabase PostgreSQL"))
  .catch(err => console.error("❌ Connection error:", err.stack));

export default db;
