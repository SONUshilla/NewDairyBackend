import pg from 'pg';

const { Client } = pg;


const connectionString = 'postgresql://dairy_75zy_user:zWg9PkiwMx8k9dJxfkyu0wdl3rctcgax@dpg-d1p7ap2dbo4c73858t00-a.oregon-postgres.render.com/dairy_75zy';

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