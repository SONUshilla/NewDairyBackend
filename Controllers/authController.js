import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import pg from 'pg';
import axios from "axios";
import {
   findUserById,
  findUserByUsername,
  findUserByEmail,
  insertGoogleUserInfo,
  insertManualUserInfo,
  createUser } from '../Models/userModel.js';


const { Client } = pg;

const router = express.Router();

// JWT strategy setup
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: 'your_jwt_secret', // Replace with your actual secret key
  };
  passport.use(new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
    
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
  }));





// Login endpoint
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await findUserByUsername(username);
        if (user && await bcrypt.compare(password, user.password)) {
            const payload = { id: user.id };
            const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '100h' }); // Replace with your actual secret key
            res.json({ token });
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (err) {
        console.log(err);
        res.status(500).send('Error logging in');
    }
});

router.post('/auth/google/callback', async (req, res) => {
    const { idToken, user,role} = req.body;
 
    try {
      // Verify the Google ID token
      const response = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`);
      const googleData = response.data;
  
      if (googleData.email !== user.email) {
        return res.status(400).json({ error: 'Email mismatch' });
      }
  
      // Check if the user already exists in your database
      const existingUser = await findUserByEmail(user.email);
      console.log(existingUser);
      let userId;
      if (!existingUser) {
        // Insert the new user into the users table
        const insertUserResult = await createUser(user.email, "google", role);
        userId = insertUserResult.id;
        // Insert the user info into the usersInfo table
      await insertGoogleUserInfo(user.name, user.email, user.picture, userId);
      } else {
        userId = existingUser.id;
      }
  
      const payload = { id:userId };
      const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1h' }); // Replace with your actual secret key
      console.log(token);
      // Return the JWT and user information to the frontend
      res.json({token});
    } catch (error) {
      console.error('Error during Google authentication:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
  }));
  
  router.get("/authTrue", (req, res) => {
    console.log("Authentication process complete");
    res.redirect(`${process.env.URL}`);
  });
  
  router.get("/auth/google/home", passport.authenticate("google", {
    successRedirect: "/authTrue",
    failureRedirect: "/login",
  }));
  
  
  router.post('/register', async (req, res, next) => {
    const { name,username, password ,role} = req.body;
  {console.log(name,username,password)}
    try {
      const existingUser = findUserByUsername(username);
  
      if (existingUser.length > 0) {
        return res.status(400).json({ message: 'Username already taken' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await createUser(username, hashedPassword,role);
      insertManualUserInfo(name, user.id);
      const payload = { id:user.id };
      const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1h' }); // Replace with your actual secret key
      res.status(201).json({ message: 'User registered successfully', token });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  router.post('/logout', (req, res) => {
    // With JWT, logout is typically handled client-side by deleting the token
    res.sendStatus(200);
  });


  export default router;