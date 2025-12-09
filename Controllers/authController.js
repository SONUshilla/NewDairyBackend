import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pg from 'pg';
import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();

import { findUserRole } from "../Models/userModel.js";
import {
  findUserById,
  findUserByUsername,
  findUserByEmail,
  insertGoogleUserInfo,
  insertManualUserInfo,
  createUser
} from '../Models/userModel.js';

const router = express.Router();

/* ========================
   JWT Strategy for Protected Routes
   ======================== */
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: 'your_jwt_secret', // Replace with your actual secret key
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
    try {
      const user = await findUserById(jwt_payload.id);
      if (user) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (err) {
      return done(err, false);
    }
  })
);

/* ========================
   Google Strategy Setup
   ======================== */
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.SECRET_CLIENT_ID, // Your Google Client ID
//       clientSecret: process.env.SECRET_CLIENT_SECRET, // Your Google Client Secret
//       callbackURL: "/auth/google/home", // Callback URL configured in your Google API Console
//       passReqToCallback: true, 
//     },
//     async (req,accessToken, refreshToken, profile, done) => {
//       try {
//         const email = profile.emails[0].value;
//         let user = await findUserByEmail(email);
//         const role = req.query.state; // ← This is where the role lives now
//         if (!user) {
//           // Create the user if not found
//           const newUser = await createUser(email, "google", role); // Adjust role as needed
//           await insertGoogleUserInfo(profile.displayName, email, profile.photos[0].value, newUser.id);
//           user = newUser;
//         }

//         // Continue with Passport callback
//         return done(null, user);
//       } catch (error) {
//         return done(error, null);
//       }
//     }
//   )
// );

/* ========================
   Local Login Endpoint (JWT Issuance)
   ======================== */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findUserByUsername(username);
    if (user && await bcrypt.compare(password, user.password)) {
      const payload = { id: user.id };
      const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '30d' });
      res.json({ token });
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error logging in');
  }
});

/* ========================
   Google Authentication Endpoints
   ======================== */
   router.post("/auth/google", async (req, res) => {
    try {
      const { token } = req.body;
  
      // Verify Google token
      const googleRes = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
      );
  
      const email = googleRes.data.email;
      const name = googleRes.data.name;
      const picture = googleRes.data.picture;
  
      let user = await findUserByEmail(email);
  
      if (!user) {
        // New user → ask role
        return res.status(200).json({ needRole: true, email, name, picture });
      }
  
      // Existing user → login directly
      const jwtToken = jwt.sign({ id: user.id }, "your_jwt_secret", {
        expiresIn: "30d",
      });
  
      return res.status(200).json({ token: jwtToken });
    } catch (error) {
      console.error("Google auth error:", error);
      return res.status(500).json({ error: "Google authentication failed" });
    }
  });

  

  router.post("/auth/google/set-role", async (req, res) => {
    try {
      const { token, role } = req.body;
  
      const googleRes = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
      );
  
      const email = googleRes.data.email;
      const name = googleRes.data.name;
      const picture = googleRes.data.picture;
  
      let existing = await findUserByEmail(email);
  
      if (existing) {
        return res.status(400).json({ error: "User already exists" });
      }
  
      // Create new user
      const newUser = await createUser(email, "google", role);
      await insertGoogleUserInfo(name, email, picture, newUser.id);
  
      // Issue your JWT
      const jwtToken = jwt.sign({ id: newUser.id }, "your_jwt_secret", {
        expiresIn: "100h",
      });
  
      res.status(200).json({ token: jwtToken });
    } catch (error) {
      console.error("Google role set error:", error);
      res.status(500).json({ error: "Failed creating user" });
    }
  });

  
// Initiate Google OAuth flow
// router.get('/auth/google', (req, res, next) => {
//   const role = req.query.role || 'admin'; // fallback if role is missing
//   passport.authenticate('google', {
//     scope: ['profile', 'email'],
//     state: role,
//   })(req, res, next);
// });


// Callback route after Google has authenticated the user
// Callback route after Google auth
// router.get(
//   '/auth/google/home',
//   passport.authenticate('google', { 
//     failureRedirect: `${process.env.ORIGIN}/login?error=authentication_failed`,
//     session: false 
//   }),
//   (req, res) => {
//     const payload = { id: req.user.id };
//     const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1h' });

//     // Detect if login is from mobile app
//     if (req.query.source === 'mobile') {
//       // Redirect back to app
//       res.redirect(`myapp://auth/callback?token=${token}`);
//     } else {
//       // Normal website login
//       res.redirect(`${process.env.ORIGIN}/auth/callback?token=${token}`);
//     }
//   }
// );

/* ========================
   Registration Endpoint (Manual Signup)
   ======================== */
router.post('/register', async (req, res) => {
  const { name, username, password, role } = req.body;
  console.log(name, username, password, role);
  try {
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser(username, hashedPassword, role);
    await insertManualUserInfo(name, user.id,username);

    const payload = { id: user.id };
    const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '30d' });
    res.status(201).json({ message: 'User registered successfully', token });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/* ========================
   Protected Route to Get User Role
   ======================== */
router.get(
  '/user/role/',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const role = await findUserRole(req.user.id);
      res.status(200).json({ role });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/* ========================
   Logout Endpoint (Client-side Token Removal)
   ======================== */
router.post('/logout', (req, res) => {
  // With JWT, logout is typically handled client-side by deleting the token.
  res.sendStatus(200);
});

export default router;
