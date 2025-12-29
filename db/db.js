import pkg from 'pg';
const { Pool } = pkg;

// ✅ Replace this with your actual Supabase database password
const connectionString = 'postgresql://postgres.ebxdyaymxnmtstmtkazo:Sonu@9728229828@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';


const db = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Optional: Test connection
db.connect()
  .then(client => {
    console.log("✅ Connected to Supabase PostgreSQL");
    client.release(); // release the client back to the pool
  })
  .catch(err => console.error("❌ Connection error:", err.stack));

export default db;

