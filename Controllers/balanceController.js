import express from "express";
import passport from "passport";
import { findUserRole } from "../Models/userModel.js";
import {getMorningTotalsBeforeStart,getSumOfMorningEntriesByDate} from "../Models/morningModel.js";
import {getEveningTotalsBeforeStart,getSumOfEveningEntriesByDate} from "../Models/eveningModel.js";
import {getFeedTotals,getGheeTotals,getMoneyGivenTotals,getMoneyReceivedTotals,getBorrowBeforeStart,getBorrowEntries} from "../Models/borrowModel.js";

const router = express.Router();

router.post('/showBalance', passport.authenticate('jwt', { session: false }), (req, res) => {
    const { startDate, endDate } = req.body;
    if(req.user.id){
    const userId = req.user.id; // Accessing the user ID from req.user
 
  
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
  console.log(moneyGivenResults,moneyReceivedResults);
    results.milk = {
      totalMilk:
        (parseFloat(morningResults.totalweight) || 0) +
        (parseFloat(eveningResults.totalweight) || 0),
      total:
        (parseFloat(morningResults.totalmoney) || 0) +
        (parseFloat(eveningResults.totalmoney) || 0),
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
    }
    else{
      res.redirect(`${process.env.URL}/login`);
    }
  });

  router.post('/balanceSheet', passport.authenticate('jwt', { session: false }),async (req, res) => {
    const { startDate, endDate } = req.body;
    const userId = req.user.id;
    const Role=findUserRole(userId);
    let results = {};
    console.log("requests are coming here");
    // Execute all queries
    Promise.all([
     getSumOfMorningEntriesByDate(userId, startDate, endDate),
     getSumOfEveningEntriesByDate(userId, startDate, endDate),
     getBorrowEntries(userId,startDate,endDate,Role)
    ])
      .then(([morningResults, eveningResults, borrowResults]) => {
        results.morning=morningResults;
        results.evening=eveningResults;
        results.borrow = borrowResults;
        // Send the results as a response
        res.status(200).json(results);
     
      })
      .catch(error => {
        console.error('Error executing queries:', error);
        res.status(500).json({ error: 'An error occurred while fetching data.' });
      });
  });
  
  export default router;
  
  