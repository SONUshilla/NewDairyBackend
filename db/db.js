import pg from 'pg';

const { Client } = pg;


const connectionString = 'postgresql://dairy_zdbz_user:rViDK8o73s8xSCOu0ATjEUpQRslNKh23@dpg-cttqq5lumphs73ehaqlg-a.oregon-postgres.render.com/DAIRY';

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