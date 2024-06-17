import { compare } from "bcrypt";
import express from "express";
import env from "dotenv";
import pg from "pg";
import moment from "moment";
import passport  from "passport";
import { Strategy as LocalStrategy } from 'passport-local';
import GoogleStrategy from "passport-google-oauth2";
import bodyParser from "body-parser";
import session from "express-session";
import cors from 'cors';
import helmet from "helmet";
import bcrypt from "bcrypt";
import multer from "multer";
import { createWorker } from "tesseract.js";
import tesseract from "node-tesseract-ocr";

const { Client } = pg;
env.config();

// Create a new PostgreSQL client instance with connection string
const db = new Client({
  connectionString: process.env.POSTGRES_CONNECTION_STRING, // Use environment variable for connection string
  ssl: {
    rejectUnauthorized: false // Add this line to allow connection to Render's PostgreSQL with SSL
  }
});

db.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Error connecting to PostgreSQL database', err));

// Configure Express app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'somevalue' }));
app.use(cors());
app.use(helmet());
app.use(bodyParser.json({ limit: "10mb" })); // Adjust the limit as needed
// Middleware to parse JSON bodies
app.use(express.json());
app.use(session({
  secret: process.env.TOP_SECRET, // Secret key used to sign the session ID cookie
  resave: true, // Don't save session if unmodified
  saveUninitialized: true, // Don't create session until something is stored
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    secure: false, // Set to true if using HTTPS
    httpOnly: true, // Cookie accessible only by the web server
  }
}));
console.log("for commit");
// Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());
// Enable CORS
app.use(cors({
  origin: 'http://localhost:3000'
}));
app.use(helmet({
  contentSecurityPolicy: {
      directives: {
          defaultSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          // Add other directives as needed
      }
  }
}));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});
app.post('/entries/morning', (req, res) => {
  // Access the values submitted from the form
  const { date, weight, fat, price } = req.body;
  console.log(date);
  const sqlDate = moment(date).format('YYYY-MM-DD');

  db.query("INSERT INTO morning (date, weight, fat, price,total, user_id) VALUES ($1, $2, $3, $4, $5,$6)", [sqlDate, weight, fat, price,weight*price, req.user.id])
    .then(result => {
      console.log("Data inserted successfully");
      res.status(200).send("data inserting successfully");
    })
    .catch(error => {
      console.error("Error inserting data:", error);
      res.status(500).send("Error inserting data");
    });
});
app.post('/entries/evening', (req, res) => {
  // Access the values submitted from the form
  const { date, weight, fat, price } = req.body;
  
  const sqlDate = moment(date).format('YYYY-MM-DD');
  
  db.query("INSERT INTO evening (date, weight, fat, price,total, user_id) VALUES ($1, $2, $3, $4, $5,$6)", [sqlDate, weight, fat, price,weight*price, req.user.id])
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
app.post('/admin/entries/morning', (req, res) => {
  // Access the values submitted from the form
  const { date, weight, fat, price ,userId} = req.body;
  console.log("admin morning");
  const sqlDate = moment(date).format('YYYY-MM-DD');

  db.query("INSERT INTO morning (date, weight, fat, price,total, user_id) VALUES ($1, $2, $3, $4, $5,$6)", [sqlDate, weight, fat, price,weight*price, req.user.id])
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
  
  db.query("INSERT INTO evening (date, weight, fat, price,total, user_id) VALUES ($1, $2, $3, $4, $5,$6)", [sqlDate, weight, fat, price,weight*price, req.user.id])
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
app.post("/admin/balanceSheet", (req, res) => {
  const { startDate, endDate,userId } = req.body;
  console.log(req.user.id);
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
app.post('/admin/showBalance', (req, res) => {
  const { startDate, endDate,userId } = req.body;
  console.log(req.user.id);

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

  let results = {};

  // Execute all queries
  Promise.all([
    db.query(morningQuery, [userId, startDate, endDate]),
    db.query(eveningQuery, [userId, startDate, endDate]),
    db.query(feedQuery, [userId, startDate, endDate]),
    db.query(moneyReceivedQuery, [userId, startDate, endDate]),
    db.query(moneyGivenQuery, [userId, startDate, endDate]),
    db.query(gheeQuery, [userId, startDate, endDate])
  ]).then(([morningResults, eveningResults, feedResults, moneyReceivedResults, moneyGivenResults, gheeResults]) => {
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

    // Send response with combined results
    res.status(200).json(results);
  }).catch(err => {
    console.error('Error executing queries:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
});
 // admin add user 
 const saltRounds = 10; // Number of salt rounds for bcrypt
 
 // Assuming db.query and other necessary imports are already present
 
 app.post('/adduser', async (req, res) => {
   const adminUserId = req.user.id; // Assuming req.user.id contains the user ID of the admin
   const { mobileEmail, name, password } = req.body; // Assuming the request body contains mobileEmail, name, and password
 
   try {
     // Check if the role of the admin user is 'admin'
     const adminUser = await db.query("SELECT role FROM users WHERE id = $1", [adminUserId]);
     if (adminUser.rows.length === 0 || adminUser.rows[0].role !== 'admin') {
       return res.status(403).json({ error: 'You are not authorized to add users.' });
     }
 
     // Hash the password
     const hashedPassword = await bcrypt.hash(password, saltRounds);
 
     // Insert into users table with hashed password
     const userInsertResult = await db.query("INSERT INTO users (username, password, role, user_id) VALUES ($1, $2, $3, $4) RETURNING id", [mobileEmail, hashedPassword, 'associated user', adminUserId]);
     const userId = userInsertResult.rows[0].id;
 
     // Insert into usersInfo table
     await db.query("INSERT INTO usersInfo (userId, name) VALUES ($1, $2)", [userId, name]);
 
     // Send a success response
     return res.status(200).json({ message: 'User added successfully.' });
   } catch (error) {
     console.error('Error adding user:', error);
     return res.status(500).json({ error: 'Internal server error.' });
   }
 });
 
 // changing role of the user 
 app.post('/admin/associated', async (req, res) => {
  const { username, password } = req.body;
  const userId = req.user.id; // Assuming req.user.id contains the user ID

  try {
    // Fetch user from the database by username
    const user = await db.query("SELECT * FROM users WHERE username = $1", [username]);

    // If user not found or password doesn't match, return error
    if (user.rows.length === 0 || !(await bcrypt.compare(password, user.rows[0].password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // If username and password match, update user's role to "both"
    await db.query("UPDATE users SET role = 'both', user_id = $1 WHERE id = $2", [user.rows[0].id, userId]);
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
    const userInsertResult = await db.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id", [contact, hashedPassword, 'admin']);
    const userId = userInsertResult.rows[0].id;

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
    const user = await db.query("SELECT role FROM users WHERE id = $1", [req.user.id]);

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
app.get('/bothAuth', checkBothRole, async (req, res) => {
  try {
    // Fetch the user_id from the users table
    const user = await db.query("SELECT user_id FROM users WHERE id = $1", [req.user.id]);
    const user_id = user.rows[0].user_id; // Extract user_id from the query result

    // If user's role is "both", send the user's ID
    return res.status(200).json({ user_id });
  } catch (error) {
    console.error('Error fetching user_id:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/showEntries', async (req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user.id; // Get user ID

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
// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({ storage: storage });

const worker = createWorker();

app.post('/recognize-text', upload.single('image'), async (req, res) => {
  try {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(req.file.path);
    res.send(text);
    await worker.terminate();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error recognizing text');
  }
});

app.post("/addMoney", (req, res) => {
  // Handle adding money here
  const moneyAmount = req.body.moneyAmount;
  const item =req.body.selectedOption;
  const date=req.body.date;
db.query("INSERT INTO borrow(date,item,money, user_id) VALUES ($1, $2, $3, $4)", [date,item,moneyAmount,req.user.id])
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
app.post("/receiveMoney", (req, res) => {
  // Handle receiving money here
  const moneyAmount = req.body.moneyAmount;
  const item =req.body.selectedOption;
  const date=req.body.date;
 db.query("INSERT INTO borrow(date,item,money, user_id) VALUES ($1, $2, $3, $4)", [date,item,-moneyAmount,req.user.id])
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
app.post("/items", (req, res) => {
  // Handle items here
  const quantity = req.body.quantity;
  const price = req.body.price;
  const item =req.body.selectedOption;
  const date=req.body.date;
  db.query("INSERT INTO borrow(date,item,price,quantity,money, user_id) VALUES ($1, $2, $3, $4,$5,$6)", [date,item,price, quantity,(price*quantity),req.user.id])
  .then(result => {
    console.log("Data inserted successfully");
    res.status(200).send("Data inserted successfully");
  })
  .catch(error => {
    console.error("Error inserting data:", error);
    res.status(500).send("Error inserting data");
  });
});

app.post("/balanceSheet", (req, res) => {
  const { startDate, endDate } = req.body;
  console.log(req.user.id);
  const userId = req.user.id;
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
app.post('/showBalance', (req, res) => {
  const { startDate, endDate } = req.body;
  console.log(req.user.id);
  console.log(startDate);
  if(req.user.id){
  const userId = req.user.id; // Accessing the user ID from req.user

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
    res.redirect("http://localhost:3000/login");
  }
});


app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));


app.get("/authTrue", (req, res) => {
  console.log("Authentication process complete");
  res.redirect("http://localhost:3000");
});
app.get("/auth/google/home", passport.authenticate("google", {
  successRedirect: "/authTrue",
  failureRedirect: "/login",
}));


passport.use("local", new LocalStrategy(async (username, password, done) => {
  try {
    console.log(username);
    const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0]; // Access the first row
    if (!user) {
      return done(null, false, { message: 'Incorrect username.' });
    }

    const passwordMatch = await compare(password, user.password);

    if (!passwordMatch) {
      console.log(user);
      return done(null, false, { message: 'Incorrect password.' });
    }
    console.log("user mached");
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.use("google", new GoogleStrategy({
  clientID: process.env.SECRET_CLIENT_ID,
  clientSecret: process.env.SECRET_CLIENT_SECRET,
  callbackURL: "http://localhost:5000/auth/google/home",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
}, async (accessToken, refreshToken, profile, done) => {
  console.log(profile);
  try {
    const newUser = await db.query("SELECT * FROM users WHERE username = $1", [profile.email]);
    if (newUser.rows.length === 0) {
         // Insert into users table
         const userIdResult = await db.query(
          "INSERT INTO users (username, password, role, user_id) VALUES ($1, $2, $3, $4) RETURNING id",
          [profile.email, "google", "user", null]
        );
        const userId = userIdResult.rows[0].id;
      
        // Insert into userInfo table
        await db.query(
          "INSERT INTO usersInfo (name, email, image, userId) VALUES ($1, $2, $3, $4)",
          [profile.displayName, profile.email, profile.photos[0].value, userId]
        );
  
   
  
      // Fetch the newly inserted user and pass it to done callback
      const insertedUser = await db.query("SELECT * FROM users WHERE username = $1", [profile.email]);
      return done(null, insertedUser.rows[0]); // Pass the user object to done callback
    } else {
      return done(null, newUser.rows[0]); // Pass the user object to done callback
    }
  } catch (error) {
    return done(error);
  }
  
}));
 // Route to get user profile
// Route to get user profile
app.get('/user-profile', async(req, res) => {
  // Check if user is logged in
  if (req.user) {
    // User is logged in, extract user profile from req.user
    const profile=await db.query("select * from usersinfo where userid=$1",[req.user.id])
    const userProfile = profile.rows[0];
    
    // Send user profile data in the response
    res.status(200).json({ userProfile });
  } else {
    // User is not logged in, handle this case (redirect to login page, etc.)
    console.log("User is not logged in");
    res.status(401).json({ error: 'Unauthorized' });
  }
});


// Route to check session status
app.get('/check-session', (req, res) => {
  if (req.isAuthenticated()) {
    res.sendStatus(200);
    console.log("hello");
  } else {
    console.log("galat");
    res.sendStatus(401);
  }
   // Send 200 OK status
});
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      // Authentication failed, check if it's due to incorrect username or password
      if (info && info.message === 'Incorrect password.') {
        return res.status(401).json({ message: 'Incorrect password.' });
      }
      // If not, assume incorrect username
      return res.status(401).json({ message: 'Incorrect username.' });
    }
    // Authentication succeeded, log the user in
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      console.log("Authentication succeeded");
      // Send success response
      res.status(200).json({ type: user.type, message: 'Authentication succeeded' });
    });
  })(req, res, next);
});
// Assuming you're using Express.js
app.get('/adminAuth', (req, res) => {
  // Check if the user is authenticated
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  // Check if the user's type is not "normal"
  if (req.user.role == 'admin') {
    // User is an admin, send a success response
    return res.status(200).json({ message: 'Admin authenticated' });
  }else if (req.user.role === 'user' || req.user.role === 'both') {
    // User is either a user or both, send a success response
    return res.status(205).json({ message: 'user' });
  }else {
    // User is not an admin, send an error response
    return res.status(403).json({ message: 'User is not an admin' });
  }
});

// Route to register a new user
app.post('/register', async (req, res, next) => {
  const { username, password } = req.body;

  try {
    // Check if username already exists in the database
    const existingUser = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    if (existingUser.rows.length > 0) {
      // If the username already exists, send a message
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Hash the password before storing it in the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database with the hashed password
    const result = await db.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *', [username, hashedPassword]);
    const user = result.rows[0];

    // Authenticate the user using Passport's login method
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      // Send a success response
      return res.status(201).json({ message: 'User registered and authenticated successfully' });
    });
  } catch (error) {
    // Log the error for debugging
    console.error('Error registering user:', error);
    // Send an error response
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/logout', (req, res) => {
  try {
    // Passport's logout function removes the req.user property and clears the login session (if any)
    req.logout(() => {});

    // Send a 200 OK response to indicate successful logout
    res.sendStatus(200);
  } catch (error) {
    // If an error occurs during logout, handle it here
    console.error('Error occurred during logout:', error);
    res.status(500).send('An error occurred during logout');
  }
});

app.get('/users', async (req, res) => {
  try {
    const results = await db.query("SELECT u.id AS id, u.username AS username, ui.name AS name FROM users u JOIN usersInfo ui ON u.user_id = ui.userId WHERE ui.userid = $1 AND u.role <> 'user';",[req.user.id]);
    res.json(results.rows); // Assuming results is an array of user data
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


passport.serializeUser((user, done) => {
  done(null, user); // Serialize user id into the session
});
passport.deserializeUser((user, done) => {
  done(null, user); // Serialize user id into the session
});


// OCR route handler
app.post("/ocr", async (req, res) => {
  try {
    // Check if request contains image data
    if (!req.body.imageData) {
      return res.status(400).json({ error: "No image data provided" });
    }

    // Configuration for OCR
    const config = {
      lang: "eng",
      oem: 1,
      psm: 3,
    };

    // Perform OCR on the image data
    const text = await tesseract.recognize(Buffer.from(req.body.imageData, "base64"), config);
    
    // Send back the recognized text
    res.json({ text });
  } catch (error) {
    console.error("Error performing OCR:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// Start the server
app.listen(5000, () => {
  console.log(`Server is running on port ${5000}`);
});