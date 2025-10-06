import express from "express";
import passport from "passport";
import { findUserRole, getUsersInfo } from "../Models/userModel.js";
import {
  getMorningEntriesByDate,
  getMorningTotalsBeforeStart,
  getSumOfMorningEntriesByDate,
  getCustomerMorningTotalsBeforeStart
} from "../Models/morningModel.js";
import {
  getEveningEntriesByDate,
  getEveningTotalsBeforeStart,
  getSumOfEveningEntriesByDate,
  getCustomerEveningTotalsBeforeStart
} from "../Models/eveningModel.js";
import {
  getFeedTotals,
  getGheeTotals,
  getMoneyGivenTotals,
  getMoneyReceivedTotals,
  getBorrowBeforeStart,
  getBorrowEntries,
  getCustomerBorrowBeforeStart
} from "../Models/borrowModel.js";

const router = express.Router();

router.post(
  "/showBalance",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    const { startDate, endDate } = req.body;
    const role = req.user.role;
    const userId = req.user.id;

    if (!userId) {
      return res.redirect(`${process.env.URL}/login`);
    }

    let results = {};

    // decide which "before start" functions to call
    let borrowBeforeFn, morningBeforeFn, eveningBeforeFn;
    if (role === "admin") {
      borrowBeforeFn = getBorrowBeforeStart;
      morningBeforeFn = getMorningTotalsBeforeStart;
      eveningBeforeFn = getEveningTotalsBeforeStart;
    } else {
      borrowBeforeFn = getCustomerBorrowBeforeStart;
      morningBeforeFn = getCustomerMorningTotalsBeforeStart;
      eveningBeforeFn = getCustomerEveningTotalsBeforeStart;
    }

    Promise.all([
      getSumOfMorningEntriesByDate(userId, startDate, endDate),
      getSumOfEveningEntriesByDate(userId, startDate, endDate),
      getFeedTotals(userId, startDate, endDate),
      getMoneyReceivedTotals(userId, startDate, endDate),
      getMoneyGivenTotals(userId, startDate, endDate),
      getGheeTotals(userId, startDate, endDate),
      borrowBeforeFn(userId, startDate),
      morningBeforeFn(userId, startDate),
      eveningBeforeFn(userId, startDate),
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

          results.Before = { total: totalBeforeStart };

          console.log("Morning Total:", mBeforeStartResults.totalmorning);
          console.log("Evening Total:", eBeforeStartResults.totalevening);
          console.log("Borrow Total:", bBeforeStartResults.totalmoney);

          res.status(200).json(results);
        }
      )
      .catch((err) => {
        console.error("Error executing queries:", err);
        res.status(500).json({ error: "Internal server error" });
      });
  }
);


router.post(
  "/balanceSheet",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const userId = req.user.id;

      if (!userId) return res.redirect(`${process.env.URL}/login`);

      const Role = await findUserRole(userId);

      let morningEntries = [];
      let eveningEntries = [];
      let borrowEntries = [];

      if (Role.role === "admin") {
        // Admin: fetch all entries where userid = admin id
        morningEntries = await getMorningEntriesByDate(userId, startDate, endDate);
        eveningEntries = await getEveningEntriesByDate(userId, startDate, endDate);
        borrowEntries = await getBorrowEntries(userId, startDate, endDate, Role);
      } else {
        // Non-admin: fetch customer entries
        morningEntries = await getSumOfMorningEntriesByDate(userId, startDate, endDate);
        eveningEntries = await getSumOfEveningEntriesByDate(userId, startDate, endDate);
        borrowEntries = await getBorrowEntries(userId, startDate, endDate, Role);
      }

      // Aggregate totals (works for admin and non-admin)
      const sumEntries = (entries) => {
        if (!Array.isArray(entries)) return entries; // for non-admin sum objects
        return entries.reduce(
          (acc, entry) => {
            acc.weight += parseFloat(entry.weight) || 0;
            acc.total += parseFloat(entry.total) || 0;
            return acc;
          },
          { weight: 0, total: 0 }
        );
      };

      const morningTotals = sumEntries(morningEntries);
      const eveningTotals = sumEntries(eveningEntries);

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
    } catch (error) {
      console.error("Error fetching balance sheet:", error);
      res.status(500).json({ error: "An error occurred while fetching data." });
    }
  }
);


export default router;
