import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import passport from "passport";
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from "passport-google-oauth2";
import bodyParser from "body-parser";
import session from "express-session";
import cors from 'cors';
import helmet from "helmet";
import bcrypt from "bcrypt";

dotenv.config();

const { Client } = pg;

// Create a new PostgreSQL client instance with explicit connection parameters
const db = new Client({
  user: 'postgres',
  host: 'localhost',
  password: "Sonu@123",
  database: 'DAIRY',
  port: 5432,
});

db.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Error connecting to PostgreSQL database', err));

// Configure Express app
const app = express();
app.use(bodyParser.json({ limit: "10mb" })); // Adjust the limit as needed
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: 'https://login-front-ar4e.onrender.com/',
  credentials: true,
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type,userid'
}));
app.use(session({
  secret: 'your_secret_key', // replace with your own secret key
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true if using https
}));
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());

console.log("for commit");

// Passport Local Strategy
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    // Replace with your actual database query
    const userQuery = 'SELECT * FROM users WHERE username = $1';
    const result = await db.query(userQuery, [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (passwordMatch) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Incorrect credentials.' });
      }
    } else {
      return done(null, false, { message: 'User not found.' });
    }
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((user, done) => {
    done(null, user.id);
  });

// Routes
app.post('/login', passport.authenticate('local'), (req, res) => {
  res.status(200).send({ message: 'Logged in successfully', userId: req.user.id });
});

app.get('/check-session', (req, res) => {
  if (req.isAuthenticated()) {
    res.status(200).send({ message: 'Session active' });
  } else {
    res.status(401).send({ message: 'No active session' });
  }
});

app.post('/logout', (req, res) => {
  req.logout(err => {
    if (err) { return next(err); }
    res.status(200).send({ message: 'Logged out successfully' });
  });
});

// Start the server
const port = 5000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
