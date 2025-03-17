import pg from 'pg';

const { Client } = pg;


const connectionString = 'postgresql://dairy_3ofb_user:7lH5AurYCZ5Zglf3nnZLI15woiYl6QC0@dpg-cv80vaa3esus73d2veig-a.oregon-postgres.render.com/dairy_3ofb';

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