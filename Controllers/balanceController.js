import express from "express";
import passport from "passport";
import { findUserRole, getUsersInfo } from "../Models/userModel.js";
import {
  getMorningEntriesByDate,
  getMorningTotalsBeforeStart,
  getSumOfMorningEntriesByDate,
} from "../Models/morningModel.js";
import {
  getEveningEntriesByDate,
  getEveningTotalsBeforeStart,
  getSumOfEveningEntriesByDate,
} from "../Models/eveningModel.js";
import {
  getFeedTotals,
  getGheeTotals,
  getMoneyGivenTotals,
  getMoneyReceivedTotals,
  getBorrowBeforeStart,
  getBorrowEntries,
} from "../Models/borrowModel.js";

const router = express.Router();
router.post(
  "/showBalance",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    const { startDate, endDate } = req.body;
    if (req.user.id) {
      const userId = req.user.id; // Accessing the user ID from req.user

      let results = {};

      // Execute all queries
      Promise.all([
        getSumOfMorningEntriesByDate(userId, startDate, endDate),
        getSumOfEveningEntriesByDate(userId, startDate, endDate),
        getFeedTotals(userId, startDate, endDate),
        getMoneyReceivedTotals(userId, startDate, endDate),
        getMoneyGivenTotals(userId, startDate, endDate),
        getGheeTotals(userId, startDate, endDate),
        getBorrowBeforeStart(userId, startDate),
        getMorningTotalsBeforeStart(userId, startDate),
        getEveningTotalsBeforeStart(userId, startDate),
      ])
        .then(
          ([
            morningResults,
            eveningResults,
            feedResults,
            moneyReceivedResults,
            moneyGivenResults,
            gheeResults,
            bBeforeStartResults,
            mBeforeStartResults,
            eBeforeStartResults,
          ]) => {
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
              totalQuantity:
                parseFloat(moneyReceivedResults.totalquantity) || 0,
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

            const totalBeforeStart =
              (parseFloat(mBeforeStartResults.totalmorning) || 0) +
              (parseFloat(eBeforeStartResults.totalevening) || 0) +
              (parseFloat(bBeforeStartResults.totalmoney) || 0);

            results.Before = {
              total: totalBeforeStart,
            };
            console.log("1234", results);
            res.status(200).json(results);
          }
        )
        .catch((err) => {
          console.error("Error executing queries:", err);
          res.status(500).json({ error: "Internal server error" });
        });
    } else {
      res.redirect(`${process.env.URL}/login`);
    }
  }
);

router.post(
  "/balanceSheet",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const userId = req.user.id;
      const Role = await findUserRole(userId);
      const users = await getUsersInfo(userId);

      if (Role.role === "admin") {
        // Arrays to store all entries
        let allMorningEntries = [];
        let allEveningEntries = [];

        // Process all users' entries in parallel
        const userPromises = users.map(async (user) => {
          const morningEntries = await getMorningEntriesByDate(
            user.id,
            startDate,
            endDate
          );
          const eveningEntries = await getEveningEntriesByDate(
            user.id,
            startDate,
            endDate
          );
          return { morningEntries, eveningEntries };
        });

        const userResults = await Promise.all(userPromises);

        // Aggregate all entries
        userResults.forEach(({ morningEntries, eveningEntries }) => {
          allMorningEntries = [...allMorningEntries, ...morningEntries];
          allEveningEntries = [...allEveningEntries, ...eveningEntries];
        });

        // Process borrow entries
        const borrowEntries = await getBorrowEntries(
          userId,
          startDate,
          endDate,
          Role
        );

        const morningTotals = allMorningEntries.reduce(
          (acc, entry) => {
            acc.weight += parseFloat(entry.weight) || 0;
            acc.total += parseFloat(entry.total) || 0;
            return acc;
          },
          { weight: 0, total: 0 }
        );

        const eveningTotals = allEveningEntries.reduce(
          (acc, entry) => {
            acc.weight += parseFloat(entry.weight) || 0;
            acc.total += parseFloat(entry.total) || 0;
            return acc;
          },
          { weight: 0, total: 0 }
        );

        const results = {
          morning: morningTotals,
          evening: eveningTotals,
          difference: {
            weight: Math.abs(morningTotals.weight - eveningTotals.weight),
            total: Math.abs(morningTotals.total - eveningTotals.total),
          },
          borrow: borrowEntries,
        };

        res.status(200).json(results);
      } else {
        let results = {};
        // Execute all queries
        Promise.all([
          getSumOfMorningEntriesByDate(userId, startDate, endDate),
          getSumOfEveningEntriesByDate(userId, startDate, endDate),
          getBorrowEntries(userId, startDate, endDate, Role),
        ]).then(([morningResults, eveningResults, borrowResults]) => {
          results.morning = morningResults;
          results.evening = eveningResults;
          results.borrow = borrowResults;
          // Send the results as a response
          res.status(200).json(results);
        });
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred while fetching data." });
    }
  }
);

export default router;
