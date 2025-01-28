import db from "../db/db.js";
import express from 'express';
import passport from 'passport';
import moment from "moment";
import {getMilkTotalForUser, getMorningTotalsBeforeStart,getSumOfMorningEntriesByDate} from "../Models/morningModel.js";
import {getEveningTotalsBeforeStart,getSumOfEveningEntriesByDate} from "../Models/eveningModel.js";
import {getFeedTotals,getGheeTotals,getMoneyGivenTotals,getMoneyReceivedTotals,getBorrowBeforeStart,getBorrowEntries, getBorrowTotalForUser} from "../Models/borrowModel.js";
import { getUsersInfo } from "../Models/userModel.js";


const router = express.Router();


router.post('/admin/entries/morning', passport.authenticate('jwt', { session: false }), (req, res) => {
    // Access the values submitted from the form
    const { date, weight, fat, price ,userId} = req.body;
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
  router.post('/admin/entries/evening', (req, res) => {
    // Access the values submitted from the form
    const { date, weight, fat, price ,userId} = req.body;
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
  
  router.post('/admin/showEntries', async (req, res) => {
    const { startDate, endDate,userId } = req.body;
    try {
      const morningData = await db.query("SELECT * FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3 order by date desc", [userId, startDate, endDate]);
      const eveningData = await db.query("SELECT * FROM evening WHERE user_id = $1 AND date BETWEEN $2 AND $3 order by date desc", [userId, startDate, endDate]);
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
  router.post('/admin/balanceSheet', passport.authenticate('jwt', { session: false }), (req, res) => {
    const { startDate, endDate,userId} = req.body;
    let borrowQuery; // Declare borrowQuery outside the conditional blocks
  if(userId=="0")
  {
    borrowQuery = `
    SELECT id,date, item, quantity, price, money, name 
    FROM borrow 
    WHERE user_id = $1 
      AND name IS NOT NULL 
      AND date BETWEEN $2 AND $3 
  `;
  }
  else{
    borrowQuery = `
    SELECT id,date, item, quantity, price, money, name 
    FROM borrow 
    WHERE user_id = $1 
      AND name IS NOT NULL 
      AND date BETWEEN $2 AND $3 
  `;
  }
    const morningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3`;
    const eveningQuery = `SELECT SUM(weight) AS totalMilk, SUM(total) AS total FROM evening WHERE user_id = $1 AND date BETWEEN $2 AND $3`;

  
    let results = {};
    const queries = [
      db.query(morningQuery, [userId, startDate, endDate]),
      db.query(eveningQuery, [userId, startDate, endDate]),
    ];
    
    // Conditionally add the borrowQuery based on the option
    if (userId=="0") {
      queries.push(db.query(borrowQuery, [req.user.id, startDate, endDate]));
     
    } else {
      queries.push(db.query(borrowQuery, [userId, startDate, endDate]));
    }
    // Execute all queries
    Promise.all(queries)
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
  router.post('/admin/showBalance', passport.authenticate('jwt', { session: false }), (req, res) => {
    const { startDate, endDate,userId } = req.body;
    if (userId) {
      let results = {};
  
      // Execute all queries
      Promise.all([
        getSumOfMorningEntriesByDate(userId,startDate,endDate),
        getSumOfEveningEntriesByDate(userId,startDate,endDate),
        getFeedTotals(userId,startDate,endDate),
        getMoneyReceivedTotals(userId,startDate,endDate),
        getMoneyGivenTotals(userId,startDate,endDate),
        getGheeTotals(userId,startDate,endDate),
        getBorrowBeforeStart(userId,startDate),
        getMorningTotalsBeforeStart(userId,startDate),
        getEveningTotalsBeforeStart(userId,startDate),
    
      ]).then(([morningResults, eveningResults, feedResults, moneyReceivedResults, moneyGivenResults, gheeResults, bBeforeStartResults, mBeforeStartResults, eBeforeStartResults]) => {
        results.milk = {
          totalMilk:
            (parseFloat(morningResults.weight) || 0) +
            (parseFloat(eveningResults.weight) || 0),
          total:
            (parseFloat(morningResults.total) || 0) +
            (parseFloat(eveningResults.total) || 0),
        };
    
        results.feed = {
          totalQuantity: parseFloat(feedResults.totalquantity) || 0,
          totalMoney: parseFloat(feedResults.totalmoney) || 0,
        };
    
        results.moneyReceived = {
          totalQuantity: parseFloat(moneyReceivedResults.totalquantity) || 0,
          totalMoney: parseFloat(moneyReceivedResults.totalmoney) || 0,
        };
    
        results.moneyGiven = {
          totalQuantity: parseFloat(moneyGivenResults.totalquantity) || 0,
          totalMoney: parseFloat(moneyGivenResults.totalmoney) || 0,
        };
    
        results.ghee = {
          totalQuantity: parseFloat(gheeResults.totalquantity) || 0,
          totalMoney: parseFloat(gheeResults.totalmoney) || 0,
        };
      
        const totalBeforeStart = (
          (parseFloat(mBeforeStartResults.totalmorning) || 0) + 
          (parseFloat(eBeforeStartResults.totalevening) || 0) +
          (parseFloat(bBeforeStartResults.totalmoney) || 0)
        );
        
        results.Before = {
          total: totalBeforeStart
        };
        console.log(results);
        res.status(200).json(results);
      }).catch(err => {
        console.error('Error executing queries:', err);
        res.status(500).json({ error: 'Internal server error' });
      });
    } else {
      res.redirect(`${process.env.URL}/login`);
    }
  });

  router.post('/admin/stockCheck', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const { startDate, endDate } = req.body;
    if (!startDate) {
        return res.status(400).json({ message: "Start date is required" });
    }
    const userId = req.user.user_id;
    
    try {
      // Fetch data from the database
      const currentUser = await db.query(`
        SELECT
            user_id,
            SUM(CASE WHEN item = 'Feed' THEN quantity ELSE 0 END) AS total_feed_quantity,
            SUM(CASE WHEN item = 'Ghee' THEN quantity ELSE 0 END) AS total_ghee_quantity,
            SUM(CASE WHEN item = 'Give Money' THEN money ELSE 0 END) AS total_money,
            SUM(CASE WHEN item = 'Receive Money' THEN money ELSE 0 END) AS total_receive_money
        FROM
            borrow
        WHERE
            user_id = $1
            AND date BETWEEN $2 AND $3
            AND name IS NULL
        GROUP BY
            user_id;
      `, [userId, startDate, endDate]);
  
      const previousUser = await db.query(`
        SELECT
            user_id,
            SUM(CASE WHEN item = 'Feed' THEN quantity ELSE 0 END) AS total_feed_quantity,
            SUM(CASE WHEN item = 'Ghee' THEN quantity ELSE 0 END) AS total_ghee_quantity,
            SUM(CASE WHEN item = 'Give Money' THEN money ELSE 0 END) AS total_money,
            SUM(CASE WHEN item = 'Receive Money' THEN money ELSE 0 END) AS total_receive_money
        FROM
            borrow
        WHERE
            user_id = $1
            AND date < $2
            AND name IS NULL
        GROUP BY
            user_id;
      `, [userId, startDate]);
  
      const currentCustomers = await db.query(`
        SELECT
            userid,
            SUM(CASE WHEN item = 'Feed' THEN quantity ELSE 0 END) AS total_feed_quantity,
            SUM(CASE WHEN item = 'Ghee' THEN quantity ELSE 0 END) AS total_ghee_quantity,
            SUM(CASE WHEN item = 'Give Money' THEN money ELSE 0 END) AS total_money,
            SUM(CASE WHEN item = 'Receive Money' THEN money ELSE 0 END) AS total_receive_money
        FROM
            borrow
        WHERE
            userid = $1
            AND date BETWEEN $2 AND $3
            AND name IS NOT NULL
        GROUP BY
            userid;
      `, [userId, startDate, endDate]);
  
      const previousCustomers = await db.query(`
        SELECT
            userid,
            SUM(CASE WHEN item = 'Feed' THEN quantity ELSE 0 END) AS total_feed_quantity,
            SUM(CASE WHEN item = 'Ghee' THEN quantity ELSE 0 END) AS total_ghee_quantity,
            SUM(CASE WHEN item = 'Give Money' THEN money ELSE 0 END) AS total_money,
            SUM(CASE WHEN item = 'Receive Money' THEN money ELSE 0 END) AS total_receive_money
        FROM
            borrow
        WHERE
            userid = $1
            AND date < $2
            AND name IS NOT NULL
        GROUP BY
            userid;
      `, [userId, startDate]);
  
      // Calculate totals
      const totalFeedQuantity = 
        (parseInt(currentUser.rows[0]?.total_feed_quantity) || 0) +
        (parseInt(previousUser.rows[0]?.total_feed_quantity) || 0) -
        (parseInt(currentCustomers.rows[0]?.total_feed_quantity) || 0) -
        (parseInt(previousCustomers.rows[0]?.total_feed_quantity) || 0);
  
      const totalGheeQuantity = 
        (parseInt(currentUser.rows[0]?.total_ghee_quantity) || 0) +
        (parseInt(previousUser.rows[0]?.total_ghee_quantity) || 0) -
        (parseInt(currentCustomers.rows[0]?.total_ghee_quantity) || 0) -
        (parseInt(previousCustomers.rows[0]?.total_ghee_quantity) || 0);
  
      const totalMoney = 
        (parseInt(currentUser.rows[0]?.total_money) || 0) +
        (parseInt(previousUser.rows[0]?.total_money) || 0) -
        (parseInt(currentCustomers.rows[0]?.total_money) || 0) -
        (parseInt(previousCustomers.rows[0]?.total_money) || 0);
  
      const totalReceiveMoney = 
        (parseInt(currentUser.rows[0]?.total_receive_money) || 0) +
        (parseInt(previousUser.rows[0]?.total_receive_money) || 0) -
        (parseInt(currentCustomers.rows[0]?.total_receive_money) || 0) -
        (parseInt(previousCustomers.rows[0]?.total_receive_money) || 0);
  
      // Prepare the response object
      const responseData = {
        feedStockAvailable: totalFeedQuantity,
        feedQuantitySold: parseFloat(currentCustomers.rows[0]?.total_feed_quantity) || 0,
        gheeStockAvailable: totalGheeQuantity,
        gheeQuantitySold: parseFloat(currentCustomers.rows[0]?.total_ghee_quantity) || 0,
        moneyAvailable: totalMoney,
        moneyGiven: parseFloat(currentCustomers.rows[0]?.total_money) || 0,
        receiveMoneyAvailable: totalReceiveMoney,
        moneyReceived: parseFloat(currentCustomers.rows[0]?.total_receive_money) || 0
      };
  
      res.json(responseData);
    } catch (error) {
      console.error('Error fetching borrow data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

router.get('/users', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
      const users = await getUsersInfo(req.user.id);
      // Step 2: Calculate additional totals for each user
      const userTotalsPromises = users.map(async (user) => {  
        // Combine the results
        const milkTotal = await getMilkTotalForUser(user.id) ;
        const borrowTotal = await  getBorrowTotalForUser(user.id);
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
  });
  

  export default router;