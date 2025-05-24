import pg from 'pg';

const { Client } = pg;


const connectionString = 'postgresql://dairy_database_cwd2_user:FSHPXTG49XgUo0eZFVj3Up0cZAJOKjTj@dpg-d0om6bemcj7s73dak9k0-a.oregon-postgres.render.com/dairy_database_cwd2';

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