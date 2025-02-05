import pg from 'pg';

const { Client } = pg;


const connectionString = 'postgresql://dairy_ltja_user:vDoTh92nydbOgJNnENMpN1hhkxeom2vy@dpg-cuhln59u0jms73abslr0-a.oregon-postgres.render.com/Dairy';

const db = new Client({
   connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,  // Necessary for some managed database services; however, for production use, set up proper certificates.
  },/*
    database:"DAIRY",
    user:"postgres",
    host:"localhost",
    password:"Sonu@123",*/
   
});

db.connect()
    .then(() => console.log("Connected to the database"))
    .catch(err => console.error("Connection error", err.stack));

export default db;