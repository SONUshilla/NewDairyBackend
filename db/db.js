import pg from 'pg';
const { Client } = pg;

// Replace with your actual Supabase password
const connectionString = process.env.DATABASE_URL;

const db = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required by Supabase
  },
});

db.connect()
  .then(() => console.log('✅ Connected to Supabase PostgreSQL'))
  .catch(err => console.error('❌ Connection error:', err.stack));

export default db;
