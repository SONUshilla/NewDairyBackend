import express from 'express';
import env from 'dotenv';
import pg from 'pg';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import GoogleStrategy from 'passport-google-oauth2';
import bodyParser from 'body-parser';
import cors from 'cors';
import authController from "./Controllers/authController.js";
import adminController from "./Controllers/adminController.js";
import entryController from "./Controllers/entryController.js";
import balanceController from "./Controllers/balanceController.js";
import transactionController from "./Controllers/transactionController.js";
import moment from "moment";
import axios from "axios";
import db from "./db/db.js";
import bcrypt from "bcrypt";
import { insertBorrowEntry } from './Models/borrowModel.js';
import { getMorningCustomers } from './Models/morningModel.js';
import { getEveningCustomers } from './Models/eveningModel.js';
import multer from 'multer';
import  path from"path";



const { Client } = pg;
env.config();

const app = express();
const port = 5000;


// Middleware setup
app.use(cors({
  origin: process.env.ORIGIN ,
  credentials: true, // This allows cookies and other credentials to be included in requests
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());



app.use(authController);
app.use(adminController);
app.use(entryController);
app.use(balanceController);
app.use(transactionController);

// Protected endpoint
app.get('/check-session', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.sendStatus(200);
});


app.get('/arrived-customers',passport.authenticate('jwt', { session: false }), async (req, res) => {
  // Extract the date from the query string and adminId from the authenticated user
  const { date } = req.query;
  
  const adminId =  req.user.id;  // req.user should be set by your auth middleware
  if (!adminId || !date) {
    return res.status(400).json({ error: 'Missing adminId or date query parameter.' });
  }

  try {
    // Execute both queries concurrently
    const [morningData, eveningData] = await Promise.all([
      getMorningCustomers(adminId, date),
      getEveningCustomers(adminId, date)
    ]);

    res.json({
      morning: morningData.rows,
      evening: eveningData.rows,
    });
  } catch (error) {
    console.error('Error fetching measurements:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/user-profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    console.log(req.user.id);
    const profile = await db.query("SELECT * FROM usersinfo WHERE userid = $1", [req.user.id]);
    const userProfile = profile.rows[0];
    res.status(200).json({ userProfile });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});




app.get('/adminAuth', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {


    // Query the database to get the role
    const response = await db.query('SELECT role FROM users WHERE id=$1', [req.user.id]);
    console.log(req.user.id);

    // Ensure the response and rows are not empty
    if (response && response.rows && response.rows.length > 0) {
      const userRole = response.rows[0].role;

      // Check the role and respond accordingly
      if (userRole === 'admin') {
        res.status(200).json({ message: 'Admin authenticated' });
      } else if (userRole === 'user' || userRole === 'both') {
        res.status(205).json({ message: 'User authenticated' });
      } else {
        res.status(403).json({ message: 'User is not an admin' });
      }
    } else {
      // Handle the case where no user was found
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    // Handle any errors that occur during the query
    console.error('Database query error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});






 const saltRounds = 10; // Number of salt rounds for bcrypt
 
 // Assuming db.query and other necessary imports are already present
 const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // folder to store images
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ dest: 'temp/' }); // temp folder for upload

app.enable('trust proxy');
import cloudinary from './cloudinary.js';

app.post(
  '/addUser',
  passport.authenticate('jwt', { session: false }),
  upload.single('image'),
  async (req, res) => {
    const adminUserId = req.user.id;
    const { mobileNumber, name, password } = req.body;
    const image = req.file;

    try {
      // Check if requester is admin
      const adminUser = await db.query(
        "SELECT role FROM users WHERE id = $1",
        [adminUserId]
      );
      if (adminUser.rows.length === 0 || adminUser.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'You are not authorized to add users.' });
      }

      // 🔹 Check if mobile number already exists (username = mobile)
      const existingUser = await db.query(
        "SELECT id FROM users WHERE username = $1",
        [mobileNumber]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Mobile number already exists.' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert into users table
      const userInsertResult = await db.query(
        "INSERT INTO users (username, password, role, user_id) VALUES ($1, $2, $3, $4) RETURNING id",
        [mobileNumber, hashedPassword, 'associated user', adminUserId]
      );
      const userId = userInsertResult.rows[0].id;

      // Upload image if provided
      let imageUrl = null;
      if (image) {
        const uploadResult = await cloudinary.uploader.upload(image.path, {
          folder: 'dairy_users'
        });
        imageUrl = uploadResult.secure_url;
      }

      // Insert into usersInfo table
      await db.query(
        "INSERT INTO usersInfo (userid, name, image, mobile_number) VALUES ($1, $2, $3, $4)",
        [userId, name, imageUrl, mobileNumber]
      );

      return res.status(200).json({ message: 'User added successfully.' });
    } catch (error) {
      console.error('Error adding user:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// Reset Password Route
app.post(
  '/user/resetpassword',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    const adminUserId = req.user.id; // The ID of the logged-in admin
    const { userId, username, newPassword } = req.body;
    console.log("Reset Password Request:", req.body);
    try {
      // Check if the logged-in user is an admin
      const adminUser = await db.query(
        "SELECT role FROM users WHERE id = $1",
        [adminUserId]
      );

      if (adminUser.rows.length === 0 || adminUser.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'You are not authorized to reset passwords.' });
      }

      // Ensure the user exists
      const targetUser = await db.query(
        "SELECT id FROM users WHERE id = $1 AND username = $2",
        [userId, username]
      );
      console.log("Target User:", targetUser.rows);
      if (targetUser.rows.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update the password in DB
      await db.query(
        "UPDATE users SET password = $1 WHERE id = $2",
        [hashedPassword, userId]
      );

      res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }
);



app.put(
  '/editUser/:id',
  passport.authenticate('jwt', { session: false }),
  upload.single('image'),
  async (req, res) => {
    const adminUserId = req.user.id;
    const userIdToUpdate = req.params.id;
    const { name, mobileNumber } = req.body;
    const image = req.file;

    try {
      const adminUser = await db.query(
        "SELECT role FROM users WHERE id = $1",
        [adminUserId]
      );
      if (adminUser.rows.length === 0 || adminUser.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'You are not authorized to edit users.' });
      }

      let imageUrl = null;
      if (image) {
        const uploadResult = await cloudinary.uploader.upload(image.path, {
          folder: 'dairy_users'
        });
        imageUrl = uploadResult.secure_url;
      }

      const query = `
        UPDATE usersInfo
        SET name = $1, mobile_number = $2, image = COALESCE($3, image)
        WHERE userid = $4
      `;
      const values = [name, mobileNumber, imageUrl, userIdToUpdate];
      await db.query(query, values);

      const updatedUserRes = await db.query(
        `SELECT u.id, u.username, ui.name, ui.mobile_number, ui.image AS profile_img
         FROM users u
         JOIN usersInfo ui ON u.id = ui.userid
         WHERE u.id = $1`,
        [userIdToUpdate]
      );

      if (updatedUserRes.rows.length === 0) {
        return res.status(404).json({ error: 'User not found after update.' });
      }

      return res.status(200).json({
        message: 'User updated successfully.',
        user: updatedUserRes.rows[0]
      });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);




 // changing role of the user 
 app.post('/admin/associated', passport.authenticate('jwt', { session: false }),async (req, res) => {
  const { username, password } = req.body;
  const userId = req.user.id; // Assuming req.user.user_id contains the user ID

  try {
    // Fetch user from the database by username
    const user = await db.query("SELECT * FROM users WHERE username = $1", [username]);

    // If user not found or password doesn't match, return error
    if (user.rows.length === 0 || !(await bcrypt.compare(password, user.rows[0].password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // If username and password match, update user's role to "both"
    await db.query("UPDATE users SET role = 'both', user_id = $1 WHERE user_id = $2", [user.rows[0].id, userId]);
    return res.status(200).json({ message: 'User login successful' });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// admin registeration 
app.post('/register-admin', async (req, res) => {
  const { name, contact, dairyNumber, address, password, confirmPassword} = req.body;
console.log("req here");

 
  try {
    // Check if mobile number or email already exists
    const checkUserResult = await db.query("SELECT COUNT(*) FROM users WHERE username = $1", [contact]);
    const userCount = parseInt(checkUserResult.rows[0].count);

    if (userCount > 0) {
      return res.status(403).json({ error: 'Mobile number or email already exists. Please use a different one.' });
    }


    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the number of salt rounds

    // Start a database transaction
    await db.query('BEGIN');

    // Insert into users table with role 'admin'
    const userInsertResult = await db.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING user_id", [contact, hashedPassword, 'admin']);
    const userId = userInsertResult.rows[0].user_id;

    // Insert into userInfo table
    await db.query("INSERT INTO usersinfo (userId, name, dairy_number, address,mobile_number) VALUES ($1, $2, $3, $4,$5)", [userId, name, dairyNumber, address,contact]);

    // Commit the transaction
    await db.query('COMMIT');

    // Send success response
    console.log("req here 1");
    return res.status(200).json({ message: 'Admin registered successfully' });
  } catch (error) {
    // Rollback the transaction in case of error
    await db.query('ROLLBACK');
    console.error('Error registering admin:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

//bothAuth
// Middleware function to check if user's role is "both"
const checkBothRole = async (req, res, next) => {
  try {
    // Fetch user's role from the database
    const user = await db.query("SELECT role FROM users where user_id = $1", [req.user.user_id]);

    // If user's role is not "both", send an error response
    if (user.rows.length === 0 || user.rows[0].role !== 'both') {
      return res.status(403).json({ error: 'You do not have permission to access this route' });
    }

    // If user's role is "both", continue to the next middleware
    next();
  } catch (error) {
    console.error('Error checking user role:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Route to handle both authentication
app.get('/bothAuth',checkBothRole, passport.authenticate('jwt', { session: false }),async (req, res) => {
  try {
    // Fetch the user_id from the users table
    const user = await db.query("SELECT user_id FROM users where user_id = $1", [req.user.user_id]);
    const user_id = user.rows[0].user_id; // Extract user_id from the query result

    // If user's role is "both", send the user's ID
    return res.status(200).json({ user_id });
  } catch (error) {
    console.error('Error fetching user_id:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});









// Route to handle items
app.post('/items', passport.authenticate('jwt', { session: false }),async (req, res) => {
  const quantity = req.body.quantity;
  const price = req.body.price;
  const item =req.body.selectedOption;
  const date=req.body.date;
  const userId1=req.body.userId || null;
 const userId2=req.user.id;
 try { if (req.body.userId) {
    
        const nameQuery = await db.query(`SELECT name FROM usersinfo WHERE userid = $1`, [req.body.userId]);
        const name = nameQuery.rows[0]?.name;
   
        if (item) {
          await insertBorrowEntry(date,item,price ,quantity,userId2,name);
          await insertBorrowEntry(date,item,price,quantity,userId1,"Dairy",userId2);
          res.status(200).send("Data inserted successfully");
        }

    }
  else{ 
  await insertBorrowEntry(date,item,(price * quantity),quantity,userId2," ").then(result => {;
    res.status(200).send("Data inserted successfully");
  })
  }}
  catch (error) {
    console.error("Error executing query:", error);
    // Handle the error appropriately, e.g., send an error response
}
});


//


app.post("/singleUser", passport.authenticate('jwt', { session: false }), async(req,res)=>{
  const userId=req.body.userId || req.user.user_id;
    const query = `
      SELECT 
        u.id AS id, 
        u.username AS username, 
        ui.name AS name,
        ui.email AS email,
        ui.mobile_number AS mobile_number,
        ui.image AS profile_img
      FROM users u
      JOIN usersInfo ui ON u.id = ui.userid
      WHERE u.id = $1;
    `;
    const results = await db.query(query, [userId]);
    const users = results.rows;
  console.log(users)

    res.json([results.rows[0]]);
});


app.get("/prompt",passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const userId = req.user?.id; // replace with actual auth

    // 1. Get user info
    const userResult = await db.query(
      `SELECT id, joining_date FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.json({ showFeedback: false });
    }

    const user = userResult.rows[0];
    const today = new Date();
    const joiningDate = new Date(user.joining_date);

    // 2. Check feedback table (last_shown + already submitted)
    const feedbackResult = await db.query(
      `SELECT last_shown, rating, feedback 
       FROM feedback 
       WHERE user_id = $1 
       ORDER BY submitted_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (feedbackResult.rows.length > 0) {
      const fb = feedbackResult.rows[0];

      // Block if already submitted feedback
      if (fb.rating || fb.feedback) {
        return res.json({ showFeedback: false });
      }

      // Block if shown in the last 2 days
      if (fb.last_shown) {
        const lastShown = new Date(fb.last_shown);
        const diffDays =
          (today.getTime() - lastShown.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 2) {
          return res.json({ showFeedback: false });
        }
      }
    }

    // 3. Condition A: Joined within last 1 day
    const daysSinceJoining =
      (today.getTime() - joiningDate.getTime()) / (1000 * 60 * 60 * 24);

    let showFeedback = false;
    if (daysSinceJoining >= 1) {
      showFeedback = true;
    } else {
      // 4. Condition B: Entry count in morning/evening > 2
      const morningRes = await db.query(
        `SELECT COUNT(*) AS count FROM morning WHERE user_id = $1`,
        [userId]
      );
      const eveningRes = await db.query(
        `SELECT COUNT(*) AS count FROM evening WHERE user_id = $1`,
        [userId]
      );

      const morningCount = parseInt(morningRes.rows[0].count, 10);
      const eveningCount = parseInt(eveningRes.rows[0].count, 10);

      if (morningCount > 2 || eveningCount > 2) {
        showFeedback = true;
      }
    }

    // 5. Update last_shown if showing
    if (showFeedback) {
      await db.query(
        `INSERT INTO feedback (user_id, last_shown) 
         VALUES ($1, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET last_shown = NOW()`,
        [userId]
      );
    }

    res.json({ showFeedback });
  } catch (error) {
    console.error("Error checking feedback prompt:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/feedback
app.post(
  "/api/feedback",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { rating, feedback } = req.body;

      if (!rating && !feedback) {
        return res.status(400).json({ error: "Rating or feedback is required" });
      }

      // Update the existing feedback row for this user
      const result = await db.query(
        `UPDATE feedback
         SET rating = $1,
             feedback = $2,
             submitted_at = NOW()
         WHERE user_id = $3
         RETURNING id, user_id, rating, feedback, submitted_at, last_shown`,
        [rating, feedback, userId]
      );

      if (result.rows.length === 0) {
        // fallback: if no prompt row exists, insert a fresh one
        const insertRes = await db.query(
          `INSERT INTO feedback (user_id, rating, feedback, submitted_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING id, user_id, rating, feedback, submitted_at, last_shown`,
          [userId, rating, feedback]
        );
        return res.json({ success: true, feedback: insertRes.rows[0] });
      }

      res.json({ success: true, feedback: result.rows[0] });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);





// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`); // Displays the IP address and port
});
