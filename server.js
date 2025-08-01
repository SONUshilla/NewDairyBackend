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

const upload = multer({ storage });
app.use("/uploads", express.static("uploads"));
app.enable('trust proxy');
app.post(
  '/addUser',
  passport.authenticate('jwt', { session: false }),
  upload.single('image'),
  async (req, res) => {
    const adminUserId = req.user.id;
    const { mobileNumber, name, password } = req.body;
    const image = req.file;

    try {
      const adminUser = await db.query(
        "SELECT role FROM users WHERE id = $1",
        [adminUserId]
      );

      if (adminUser.rows.length === 0 || adminUser.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'You are not authorized to add users.' });
      }

      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const userInsertResult = await db.query(
        "INSERT INTO users (username, password, role, user_id) VALUES ($1, $2, $3, $4) RETURNING id",
        [mobileNumber, hashedPassword, 'associated user', adminUserId]
      );
      const userId = userInsertResult.rows[0].id;

      // Always generate HTTPS URLs in production
      let imageUrl = null;
      if (image) {
        const base = process.env.BASE_URL || `https://${req.get('host')}`;
        imageUrl = `${base}/uploads/${image.filename}`;
      }

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
      // Check admin role
      const adminUser = await db.query(
        "SELECT role FROM users WHERE id = $1",
        [adminUserId]
      );
      if (adminUser.rows.length === 0 || adminUser.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'You are not authorized to edit users.' });
      }

      // Prepare image URL (or null)
      const imageUrl = image
        ? `${req.protocol}://${req.get("host")}/uploads/${image.filename}`
        : null;

      // Always keep placeholders consistent
      const query = `
        UPDATE usersInfo
        SET name = $1, mobile_number = $2, image = COALESCE($3, image)
        WHERE userid = $4
      `;

      const values = [name, mobileNumber, imageUrl, userIdToUpdate];

      await db.query(query, values);

      // Fetch updated user
      const updatedUserRes = await db.query(
        `SELECT u.id, 
                u.username, 
                ui.name, 
                ui.mobile_number, 
                ui.image AS profile_img
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
  // Handle items here
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
          await insertBorrowEntry(date,item,(price * quantity),quantity,userId2,name);
          await insertBorrowEntry(date,item,(price * quantity),quantity,userId1,"Dairy",userId2);
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
  if (userId === req.user.user_id) {
    const query = `
      SELECT 
        u.user_id AS id, 
        u.username AS username, 
        ui.name AS name
      FROM users u
      JOIN usersInfo ui ON u.user_id = ui.userid
      WHERE u.user_id = $1;
    `;
    const results = await db.query(query, [userId]);
    const users = results.rows;

    const result = {
      ...users[0],  // Assuming you want to merge the first user object with the total value.
      total: "--"
    };

    res.json([result]);
  }
  else if(userId==="0")
  {
    const result = {
      name: "All customers",
      total: "--",
      username: ""
    };
    console.log(result);
    res.json([result]);
  } 
  else
  {try {
    const query = `
      SELECT 
        u.user_id AS id, 
        u.username AS username, 
        ui.name AS name
      FROM users u
      JOIN usersInfo ui ON u.user_id = ui.userid
      WHERE u.user_id=$1  
    `;
    const results = await db.query(query,[userId]);
    const users = results.rows;

    // Step 2: Calculate additional totals for each user
    const userTotalsPromises = users.map(async (user) => {
      // Fetch milk and borrow totals for the current user
      const milkResult = await db.query(
        `SELECT COALESCE(SUM(m.total), 0) + COALESCE(SUM(e.total), 0) AS total
         FROM morning m
         LEFT JOIN evening e ON m.user_id = e.user_id
         WHERE m.user_id = $1 OR e.user_id = $2;`,
        [user.id, user.id]
      );

      const borrowResult = await db.query(
        `SELECT COALESCE(SUM(money), 0) AS money
         FROM borrow
         WHERE user_id = $1;`,
        [user.id]
      );

      // Combine the results
      const milkTotal = parseFloat(milkResult.rows[0].total) || 0;
      const borrowTotal = parseFloat(borrowResult.rows[0].money) || 0;
      const total = milkTotal + borrowTotal;

      return {
        ...user,
        total
      };
    });

    // Wait for all promises to resolve
    const usersWithTotals = await Promise.all(userTotalsPromises);
    res.json(usersWithTotals);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
});







// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`); // Displays the IP address and port
});
