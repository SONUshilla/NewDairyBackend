import express from "express";
import passport from "passport";
import moment from "moment";
import db from "../db/db.js";
import {createMorningEntries,getMorningEntriesByDate,getSumOfMorningEntriesByDate} from "../Models/morningModel.js";
import {createEveningEntries,getEveningEntriesByDate,getSumOfEveningEntriesByDate} from "../Models/eveningModel.js";

const router = express.Router();

router.post('/entries/morning', passport.authenticate('jwt', { session: false }), async (req, res) => {
    // Access the values submitted from the form
    const { date, weight, fat, price, snf, animalType } = req.body;
    const issnf = snf === "" ? null : snf;
    try{
        await createMorningEntries(date,weight,fat,price,req.user.id,req.user.id,issnf,animalType);
        res.status(200).send("Morning entry created successfully.");
   }
      catch(error) {
        console.error("Error inserting data:", error);
        res.status(500).send("Error inserting data");
      };
  });


  router.post('/entries/evening', passport.authenticate('jwt', { session: false }), async (req, res) => {
    // Access the values submitted from the form
    const { date, weight, fat, price, snf, animalType } = req.body;
    const issnf = snf === "" ? null : snf;
    try{
        await createEveningEntries(date,weight,fat,price,req.user.id,req.user.id,issnf,animalType);
        res.status(200).send("Morning entry created successfully.");
   }
     catch(error) {
       console.error("Error inserting data:", error);
       res.status(500).send("Error inserting data");
     };
  });

router.post('/showEntries', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const { startDate, endDate } = req.body;
    const userId = req.user.id; // Get user ID
    console.log(startDate,endDate);
    console.log("one time");
    try {
      
      const morningEntries = await getMorningEntriesByDate(userId,startDate,endDate);
      const eveningEntries = await getEveningEntriesByDate(userId,startDate,endDate);
      const morningTotal = await getSumOfMorningEntriesByDate(userId,startDate,endDate);
      const eveningTotal = await getSumOfEveningEntriesByDate(userId,startDate,endDate);
      res.send({ morningEntries, eveningEntries, morningTotal, eveningTotal });
    } catch (error) {
      // Handle error
      console.error('Error executing query:', error);
      res.status(500).send('Internal Server Error');
    }
  });

router.post("/deleteEntry", async (req, res) => {
    const { itemId, time } = req.body.data;
    console.log(time,itemId);
    try {
     
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
  export default router;