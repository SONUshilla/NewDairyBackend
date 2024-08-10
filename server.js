import express from 'express';
import env from 'dotenv';
import pg from 'pg';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import GoogleStrategy from 'passport-google-oauth2';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import moment from "moment";

const { Client } = pg;
env.config();

const app = express();
const port = 5000;

const connectionString = 'postgresql://dairy_database_user:NPzyWdk0jGDiKdAsWS8RGA0fLcJBveKB@dpg-cqqdf0l6l47c73asm0c0-a.oregon-postgres.render.com:5432/DAIRY';

const db = new Client({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false,  // Necessary for some managed database services; however, for production use, set up proper certificates.
    },
});

db.connect()
    .then(() => console.log("Connected to the database"))
    .catch(err => console.error("Connection error", err.stack));

// Middleware setup
app.use(cors({
  origin: 'https://newdairyfrontend.onrender.com',
  credentials: true, // This allows cookies and other credentials to be included in requests
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// JWT strategy setup
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: 'your_jwt_secret', // Replace with your actual secret key
};

passport.use(new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE user_id=$1', [jwt_payload.id]);
        const user = result.rows[0];
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
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username=$1', [username]);
        const user = result.rows[0];
        if (user && await bcrypt.compare(password, user.password)) {
            const payload = { id: user.user_id };
            const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1h' }); // Replace with your actual secret key
            res.json({ token });
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (err) {
        res.status(500).send('Error logging in');
    }
});

// Protected endpoint
app.get('/check-session', passport.authenticate('jwt', { session: false }), (req, res) => {
    res.sendStatus(200);
});


passport.use("google", new GoogleStrategy({
  clientID: process.env.SECRET_CLIENT_ID,
  clientSecret: process.env.SECRET_CLIENT_SECRET,
  callbackURL: "http://localhost:5000/auth/google/home",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const newUser = await db.query("SELECT * FROM users WHERE username = $1", [profile.email]);
    if (newUser.rows.length === 0) {
      const userIdResult = await db.query(
        "INSERT INTO users (username, password, role, user_id) VALUES ($1, $2, $3, $4) RETURNING user_id",
        [profile.email, "google", "user", null]
      );
      const userId = userIdResult.rows[0].id;
      await db.query(
        "INSERT INTO usersInfo (name, email, image, userId) VALUES ($1, $2, $3, $4)",
        [profile.displayName, profile.email, profile.photos[0].value, userId]
      );
      const insertedUser = await db.query("SELECT * FROM users WHERE username = $1", [profile.email]);
      insertedUser.rows[0].user_id = insertedUser.rows[0].id; // Ensure user_id is accessible
      return done(null, insertedUser.rows[0]);
    } else {
      newUser.rows[0].user_id = newUser.rows[0].id; // Ensure user_id is accessible
      return done(null, newUser.rows[0]);
    }
  } catch (error) {
    return done(error);
  }
}));

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get("/authTrue", (req, res) => {
  console.log("Authentication process complete");
  res.redirect(`${process.env.URL}`);
});

app.get("/auth/google/home", passport.authenticate("google", {
  successRedirect: "/authTrue",
  failureRedirect: "/login",
}));


app.post('/register', async (req, res, next) => {
  const { username, password } = req.body;

  try {
    const existingUser = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *', [username, hashedPassword]);
    const user = result.rows[0];
    await db.query(
      "INSERT INTO usersInfo (name, userId) VALUES ($1, $2)",
      [username, user.user_id]
    );
    const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1h' }); // Replace with your actual secret key
    res.status(201).json({ message: 'User registered successfully', token });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.get('/user-profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const profile = await db.query("SELECT * FROM usersinfo WHERE userid = $1", [req.user.user_id]);
    const userProfile = profile.rows[0];
    res.status(200).json({ userProfile });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



app.post('/logout', (req, res) => {
  // With JWT, logout is typically handled client-side by deleting the token
  res.sendStatus(200);
});

app.get('/adminAuth', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {


    // Query the database to get the role
    const response = await db.query('SELECT role FROM users WHERE user_id=$1', [req.user.user_id]);
    
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



app.post('/entries/morning', passport.authenticate('jwt', { session: false }), (req, res) => {
  // Access the values submitted from the form
  const { date, weight, fat, price } = req.body;
  console.log(date);
  const sqlDate = moment(date).format('YYYY-MM-DD');

  db.query("INSERT INTO morning (date, weight, fat, price,total, user_id) VALUES ($1, $2, $3, $4, $5,$6)", [sqlDate, weight, fat, price,weight*price, req.user.user_id])
    .then(result => {
      console.log("Data inserted successfully");
      res.status(200).send("data inserting successfully");
    })
    .catch(error => {
      console.error("Error inserting data:", error);
      res.status(500).send("Error inserting data");
    });
});
app.post('/entries/evening', passport.authenticate('jwt', { session: false }), (req, res) => {
  // Access the values submitted from the form
  const { date, weight, fat, price } = req.body;
  
  const sqlDate = moment(date).format('YYYY-MM-DD');
  
  db.query("INSERT INTO evening (date, weight, fat, price,total, user_id) VALUES ($1, $2, $3, $4, $5,$6)", [sqlDate, weight, fat, price,weight*price, req.user.user_id])
    .then(result => {
      console.log("Data inserted successfully");
      res.status(200).send("Data inserted successfully");
    })
    .catch(error => {
      console.error("Error inserting data:", error);
      res.status(500).send("Error inserting data");
    });
});

//admin
app.post('/admin/entries/morning', passport.authenticate('jwt', { session: false }), (req, res) => {
  // Access the values submitted from the form
  const { date, weight, fat, price ,userId} = req.body;
  console.log("admin morning");
  const sqlDate = moment(date).format('YYYY-MM-DD');

  db.query("INSERT INTO morning (date, weight, fat, price,total, user_id) VALUES ($1, $2, $3, $4, $5,$6)", [sqlDate, weight, fat, price,weight*price, userId])
    .then(result => {
      console.log("Data inserted successfully");
      res.status(200).send("data inserting successfully");
    })
    .catch(error => {
      console.error("Error inserting data:", error);
      res.status(500).send("Error inserting data");
    });
});
app.post('/admin/entries/evening', (req, res) => {
  // Access the values submitted from the form
  const { date, weight, fat, price ,userId} = req.body;
  console.log("admin evening");
  const sqlDate = moment(date).format('YYYY-MM-DD');
  
  db.query("INSERT INTO evening (date, weight, fat, price,total, user_id) VALUES ($1, $2, $3, $4, $5,$6)", [sqlDate, weight, fat, price,weight*price, userId])
    .then(result => {
      console.log("Data inserted successfully");
      res.status(200).send("Data inserted successfully");
    })
    .catch(error => {
      console.error("Error inserting data:", error);
      res.status(500).send("Error inserting data");
    });
});

app.post('/admin/showEntries', async (req, res) => {
  const { startDate, endDate,userId } = req.body;
console.log("request is here");
  try {
    const morningData = await db.query("SELECT * FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
    const eveningData = await db.query("SELECT * FROM evening WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
    const morningSum = await db.query("SELECT SUM(weight) AS totalWeight, COUNT(date) AS totalDate, SUM(total) AS totalMoney from morning WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
    const eveningSum = await db.query("SELECT SUM(weight) AS totalWeight, COUNT(date) AS totalDate, SUM(total) AS totalMoney from evening WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);

    const morningEntries = morningData.rows;
    const eveningEntries = eveningData.rows;
    const morningTotal = morningSum.rows[0];
    const eveningTotal = eveningSum.rows[0];

    res.send({ morningEntries, eveningEntries, morningTotal, eveningTotal });
  } catch (error) {
    // Handle error
    console.error('Error executing query:', error);
    res.status(500).send('Internal Server Error');
  }
});
//admin balance 
app.post('/admin/balanceSheet', passport.authenticate('jwt', { session: false }), (req, res) => {
  const { startDate, endDate,userId } = req.body;
  const morningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3`;
  const eveningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM evening WHERE user_id = $1 AND date BETWEEN $2 AND $3`;
  const borrowQuery = `SELECT date, item, quantity, price, money FROM borrow WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date`;

  let results = {};

  // Execute all queries
  Promise.all([
    db.query(morningQuery, [userId, startDate, endDate]),
    db.query(eveningQuery, [userId, startDate, endDate]),
    db.query(borrowQuery, [userId, startDate, endDate])
  ])
    .then(([morningResults, eveningResults, borrowResults]) => {
      results.morning=morningResults.rows[0];
      results.evening=eveningResults.rows[0];
      results.borrow = borrowResults.rows;
      
      // Send the results as a response
      res.status(200).json(results);
    })
    .catch(error => {
      console.error('Error executing queries:', error);
      res.status(500).json({ error: 'An error occurred while fetching data.' });
    });
});



//
app.post('/admin/showBalance', passport.authenticate('jwt', { session: false }), (req, res) => {
  const { startDate, endDate,userId } = req.body;
  
  if (userId) {
    // Queries
    const morningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3`;
    const eveningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM evening WHERE user_id = $1 AND date BETWEEN $2 AND $3`;
    const feedQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney FROM borrow WHERE item = 'Feed' AND user_id = $1 AND date BETWEEN $2 AND $3`;
    const moneyReceivedQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney FROM borrow WHERE item = 'Money' AND user_id = $1 AND money > 0 AND date BETWEEN $2 AND $3`;
    const moneyGivenQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney FROM borrow WHERE item = 'Money' AND user_id = $1 AND money < 0 AND date BETWEEN $2 AND $3`;
    const gheeQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney FROM borrow WHERE item = 'Ghee' AND user_id = $1 AND date BETWEEN $2 AND $3`;

    const bBeforeStart = `SELECT SUM(money) AS totalMoney FROM borrow WHERE user_id = $1 AND date < $2`;
    const mBeforeStart = `SELECT SUM(total) AS totalmorning FROM morning WHERE user_id = $1 AND date < $2`;
    const eBeforeStart = `SELECT SUM(total) AS totalevening FROM evening WHERE user_id = $1 AND date < $2`;

    let results = {};

    // Execute all queries
    Promise.all([
      db.query(morningQuery, [userId, startDate, endDate]),
      db.query(eveningQuery, [userId, startDate, endDate]),
      db.query(feedQuery, [userId, startDate, endDate]),
      db.query(moneyReceivedQuery, [userId, startDate, endDate]),
      db.query(moneyGivenQuery, [userId, startDate, endDate]),
      db.query(gheeQuery, [userId, startDate, endDate]),
      db.query(bBeforeStart, [userId, startDate]),
      db.query(mBeforeStart, [userId, startDate]),
      db.query(eBeforeStart, [userId, startDate])
    ]).then(([morningResults, eveningResults, feedResults, moneyReceivedResults, moneyGivenResults, gheeResults, bBeforeStartResults, mBeforeStartResults, eBeforeStartResults]) => {
      // Combine results
      results.milk = {
        totalMilk: ((parseFloat(morningResults.rows[0].totalmilk) || 0) + (parseFloat(eveningResults.rows[0].totalmilk) || 0)),
        total: ((parseFloat(morningResults.rows[0].total) || 0) + (parseFloat(eveningResults.rows[0].total) || 0))
      };

      results.feed = {
        totalQuantity: parseFloat(feedResults.rows[0].totalquantity) || 0,
        totalMoney: parseFloat(feedResults.rows[0].totalmoney) || 0
      };
      results.moneyReceivedResults = {
        totalQuantity: parseFloat(moneyReceivedResults.rows[0].totalquantity) || 0,
        totalMoney: parseFloat(moneyReceivedResults.rows[0].totalmoney) || 0
      };
      results.moneyGivenResults = {
        totalQuantity: parseFloat(moneyGivenResults.rows[0].totalquantity) || 0,
        totalMoney: parseFloat(moneyGivenResults.rows[0].totalmoney) || 0
      };
      results.ghee = {
        totalQuantity: parseFloat(gheeResults.rows[0].totalquantity) || 0,
        totalMoney: parseFloat(gheeResults.rows[0].totalmoney) || 0
      };

      const totalBeforeStart = (
        (parseFloat(mBeforeStartResults.rows[0].totalmorning) || 0) +
        (parseFloat(eBeforeStartResults.rows[0].totalevening) || 0) -
        (parseFloat(bBeforeStartResults.rows[0].totalmoney) || 0)
      );

      results.Before = {
        total: totalBeforeStart
      };

      // Send response with combined results
      res.status(200).json(results);
    }).catch(err => {
      console.error('Error executing queries:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  } else {
    res.redirect(`${process.env.URL}/login`);
  }
});

 // admin add user 
 const saltRounds = 10; // Number of salt rounds for bcrypt
 
 // Assuming db.query and other necessary imports are already present
 
 app.post('/addUser', passport.authenticate('jwt', { session: false }), async (req, res) => {
   const adminUserId = req.user.user_id; // Assuming req.user.user_id contains the user ID of the admin
   const { mobileEmail, name, password } = req.body; // Assuming the request body contains mobileEmail, name, and password
 
   try {
     // Check if the role of the admin user is 'admin'
     const adminUser = await db.query("SELECT role FROM users WHERE user_id = $1", [adminUserId]);
     if (adminUser.rows.length === 0 || adminUser.rows[0].role !== 'admin') {
       return res.status(403).json({ error: 'You are not authorized to add users.' });
     }
 
     // Hash the password
     const hashedPassword = await bcrypt.hash(password, saltRounds);
 
     // Insert into users table with hashed password
     const userInsertResult = await db.query("INSERT INTO users (username, password, role, userId) VALUES ($1, $2, $3, $4) RETURNING user_id", [mobileEmail, hashedPassword, 'associated user', adminUserId]);
     const userId = userInsertResult.rows[0].user_id;
 
     // Insert into usersInfo table
     await db.query("INSERT INTO usersInfo (userid, name) VALUES ($1, $2)", [userId, name]);
 
     // Send a success response
     return res.status(200).json({ message: 'User added successfully.' });
   } catch (error) {
     console.error('Error adding user:', error);
     return res.status(500).json({ error: 'Internal server error.' });
   }
 });
 
 // changing role of the user 
 app.post('/admin/associated', passport.authenticate('jwt', { session: false }),async (req, res) => {
  const { username, password } = req.body;
  const userId = req.user.user_id; // Assuming req.user.user_id contains the user ID

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


app.post('/showEntries', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user.user_id; // Get user ID
  console.log(req.user.user_id);
  try {
    const morningData = await db.query("SELECT * FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
    const eveningData = await db.query("SELECT * FROM evening WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
    const morningSum = await db.query("SELECT SUM(weight) AS totalWeight, COUNT(date) AS totalDate, SUM(total) AS totalMoney from morning WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
    const eveningSum = await db.query("SELECT SUM(weight) AS totalWeight, COUNT(date) AS totalDate, SUM(total) AS totalMoney from evening WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);

    const morningEntries = morningData.rows;
    const eveningEntries = eveningData.rows;
    const morningTotal = morningSum.rows[0];
    const eveningTotal = eveningSum.rows[0];
    console.log(morningEntries);
    res.send({ morningEntries, eveningEntries, morningTotal, eveningTotal });
  } catch (error) {
    // Handle error
    console.error('Error executing query:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.delete("/deleteEntry", async (req, res) => {
  const { itemId, time } = req.body;
  try {
    console.log(time,itemId);
    // Execute the query with the item ID
    const result = await db.query(`DELETE FROM ${time} WHERE id = $1`, [itemId]);
    // Send a success response to the client
    res.status(200).json({ message: "Entry deleted successfully" });
  } catch (error) {
    // Handle errors and send an error response
    console.error("Error deleting entry:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



app.post('/addMoney', passport.authenticate('jwt', { session: false }),(req, res) => {
  // Handle adding money here
  const moneyAmount = req.body.moneyAmount;
  const item =req.body.selectedOption;
  const date=req.body.date;
db.query("INSERT INTO borrow(date,item,money, user_id) VALUES ($1, $2, $3, $4)", [date,item,moneyAmount,req.user.user_id])
  .then(result => {
    console.log("Data inserted successfully");
    res.status(200).send("Data inserted successfully");
  })
  .catch(error => {
    console.error("Error inserting data:", error);
    res.status(500).send("Error inserting data");
  });
});

// Route to handle receiving money
app.get('/receiveMoney', passport.authenticate('jwt', { session: false }), (req, res) => {
  // Handle receiving money here
  const moneyAmount = req.body.moneyAmount;
  const item =req.body.selectedOption;
  const date=req.body.date;
 db.query("INSERT INTO borrow(date,item,money, user_id) VALUES ($1, $2, $3, $4)", [date,item,-moneyAmount,req.user.user_id])
  .then(result => {
    console.log("Data inserted successfully");
    res.status(200).send("Data inserted successfully");
  })
  .catch(error => {
    console.error("Error inserting data:", error);
    res.status(500).send("Error inserting data");
  });
});

// Route to handle items
app.post('/items', passport.authenticate('jwt', { session: false }),(req, res) => {
  // Handle items here
  const quantity = req.body.quantity;
  const price = req.body.price;
  const item =req.body.selectedOption;
  const date=req.body.date;
  db.query("INSERT INTO borrow(date,item,price,quantity,money, user_id) VALUES ($1, $2, $3, $4,$5,$6)", [date,item,price, quantity,(price*quantity),req.user.user_id])
  .then(result => {
    console.log("Data inserted successfully");
    res.status(200).send("Data inserted successfully");
  })
  .catch(error => {
    console.error("Error inserting data:", error);
    res.status(500).send("Error inserting data");
  });
});

app.post('/balanceSheet', passport.authenticate('jwt', { session: false }),(req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user.user_id;
  const morningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3`;
  const eveningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM evening WHERE user_id = $1 AND date BETWEEN $2 AND $3`;
  const borrowQuery = `SELECT date, item, quantity, price, money FROM borrow WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date`;

  let results = {};

  // Execute all queries
  Promise.all([
    db.query(morningQuery, [userId, startDate, endDate]),
    db.query(eveningQuery, [userId, startDate, endDate]),
    db.query(borrowQuery, [userId, startDate, endDate])
  ])
    .then(([morningResults, eveningResults, borrowResults]) => {
      results.morning=morningResults.rows[0];
      results.evening=eveningResults.rows[0];
      results.borrow = borrowResults.rows;
      
      // Send the results as a response
      res.status(200).json(results);
    })
    .catch(error => {
      console.error('Error executing queries:', error);
      res.status(500).json({ error: 'An error occurred while fetching data.' });
    });
});



//
app.post('/showBalance', passport.authenticate('jwt', { session: false }), (req, res) => {
  const { startDate, endDate } = req.body;
  if(req.user.user_id){
  const userId = req.user.user_id; // Accessing the user ID from req.user
  // Query to retrieve total sum of milk and total sum of all items for morning entries
  const morningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3`;

  // Query to retrieve total sum of milk and total sum of all items for evening entries
  const eveningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM evening WHERE user_id = $1 AND date BETWEEN $2 AND $3`;
  const feedQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney FROM borrow WHERE item = 'Feed' AND user_id = $1 AND date BETWEEN $2 AND $3`;

  // Query to retrieve total sum of quantity and total sum of money for money entries
  const moneyReceivedQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney 
    FROM borrow 
    WHERE item = 'Money' AND user_id = $1 AND money > 0 AND date BETWEEN $2 AND $3`;

  // Query to retrieve total sum of quantity and total sum of money for money entries
  const moneyGivenQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney 
    FROM borrow 
    WHERE item = 'Money' AND user_id = $1 AND money < 0 AND date BETWEEN $2 AND $3`;

  // Query to retrieve total sum of quantity and total sum of money for ghee entries
  const gheeQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney 
    FROM borrow 
    WHERE item = 'Ghee' AND user_id = $1 AND date BETWEEN $2 AND $3`;

    const bBeforeStart = `SELECT SUM(money) AS totalMoney 
        FROM borrow 
        WHERE user_id = $1  AND date < $2`;
    // Query to retrieve total sum of price from morning entries before the start date
  const mBeforeStart = "select sum(total) as totalmorning from morning where user_id=$1 and date < $2";

   // Query to retrieve total sum of price from evening entries before the start date
  const eBeforeStart = "select sum(total) as totalevening from morning   where user_id=$1 and date < $2";

  let results = {};

  // Execute all queries
 // Execute all queries
Promise.all([
  db.query(morningQuery, [userId, startDate, endDate]),
  db.query(eveningQuery, [userId, startDate, endDate]),
  db.query(feedQuery, [userId, startDate, endDate]),
  db.query(moneyReceivedQuery, [userId, startDate, endDate]),
  db.query(moneyGivenQuery, [userId, startDate, endDate]),
  db.query(gheeQuery, [userId, startDate, endDate]),
  db.query(bBeforeStart, [userId, startDate]),
  db.query(mBeforeStart, [userId, startDate]),
  db.query(eBeforeStart, [userId, startDate])
]).then(([morningResults, eveningResults, feedResults, moneyReceivedResults, moneyGivenResults, gheeResults, bBeforeStartResults, mBeforeStartResults, eBeforeStartResults]) => {
  // Combine results
  results.milk = {
    totalMilk: ((parseFloat(morningResults.rows[0].totalmilk) || 0) + (parseFloat(eveningResults.rows[0].totalmilk) || 0)),
    total: ((parseFloat(morningResults.rows[0].total) || 0) + (parseFloat(eveningResults.rows[0].total) || 0))
  };

  results.feed = {
    totalQuantity: parseFloat(feedResults.rows[0].totalquantity) || 0,
    totalMoney: parseFloat(feedResults.rows[0].totalmoney) || 0
  };
  results.moneyReceivedResults = {
    totalQuantity: parseFloat(moneyReceivedResults.rows[0].totalquantity) || 0,
    totalMoney: parseFloat(moneyReceivedResults.rows[0].totalmoney) || 0
  };
  results.moneyGivenResults = {
    totalQuantity: parseFloat(moneyGivenResults.rows[0].totalquantity) || 0,
    totalMoney: parseFloat(moneyGivenResults.rows[0].totalmoney) || 0
  };
  results.ghee = {
    totalQuantity: parseFloat(gheeResults.rows[0].totalquantity) || 0,
    totalMoney: parseFloat(gheeResults.rows[0].totalmoney) || 0
  };

  console.log(bBeforeStartResults.rows[0]); // Check the structure of the result
  console.log(mBeforeStartResults.rows[0]);
  console.log(eBeforeStartResults.rows[0]);

  const totalBeforeStart = (
    parseFloat(mBeforeStartResults.rows[0].totalmorning) || 0 +
    parseFloat(eBeforeStartResults.rows[0].totalevening) || 0 -
    parseFloat(bBeforeStartResults.rows[0].totalmoney)   || 0 
  );

  console.log(totalBeforeStart);

  // Add the total before start date to results.Before object
  results.Before = {
    total: totalBeforeStart
  };

  // Send response with combined results
  res.status(200).json(results);
}).catch(err => {
  console.error('Error executing queries:', err);
  res.status(500).json({ error: 'Internal server error' });
});
  }
  else{
    res.redirect(`${process.env.URL}/login`);
  }
});


app.get('/users', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const results = await db.query("SELECT u.user_id AS id, u.username AS username, ui.name AS name FROM users u JOIN usersInfo ui ON u.user_id = ui.userid WHERE u.userid = $1 AND u.role <> 'user';",[req.user.user_id]);
    res.json(results.rows); // Assuming results is an array of user data
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});




// Start the server
app.listen(5000, () => {
  console.log(`Server is running on port ${5000}`);
});
