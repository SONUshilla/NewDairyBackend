import express from "express";
import db from "../db/db.js";
import passport from "passport";
import { insertGiveMoneyEntry, insertReceiveMoneyEntry } from "../Models/borrowModel.js";
import { getUserName } from "../Models/userModel.js";

 const router=express.Router();


router.post('/addMoney', passport.authenticate('jwt', { session: false }),async(req, res) => {
  // Handle adding money here
  const moneyAmount = req.body.moneyAmount;
  const item =req.body.selectedOption;
  const date=req.body.date;
  let name,adminId,userId;
  if (req.body.userId) {
    try {
        const name = await getUserName( req.body.userId);
        userId=req.body.userId;
        adminId=req.user.id;
        if (item === "Money Given") {
          await insertGiveMoneyEntry(date,item,moneyAmount,adminId,`${name}`,null),
          await insertReceiveMoneyEntry(date,"Money Received",moneyAmount,userId,"",adminId) 
        .then(result => {
            console.log("Data inserted successfully");
             res.status(200).send("Data inserted successfully");
          })
       .catch(error => {
            console.error("Error inserting data:", error);
            res.status(500).send("Error inserting data");
                      });
        } 
        
    
    } catch (error) {
        console.error("Error executing query:", error);
        // Handle the error appropriately, e.g., send an error response
    }
  }
  else{
    let userId1,userId2;
    userId1=req.user.id;
    userId2=null;
    await insertGiveMoneyEntry(date,item,moneyAmount,userId1,name,userId2)

        .then(result => {
            console.log("Data inserted successfully");
             res.status(200).send("Data inserted successfully");
          })
       .catch(error => {
            console.error("Error inserting data:", error);
            res.status(500).send("Error inserting data");
                      });
  }    

});

// Route to handle receiving money
router.post('/receiveMoney', passport.authenticate('jwt', { session: false }), async (req, res) => {
  // Handle receiving money here
  const moneyAmount = req.body.moneyAmount;
  const item =req.body.selectedOption;
  const date=req.body.date;
  let name,userId1,userId2;
  if (req.body.userId) {
    try {
      
        name = await getUserName(req.body.userId);
        userId1=req.body.userId;
         userId2=req.user.id;
         if (item === "Money Received") {
          await insertReceiveMoneyEntry(date,item,moneyAmount,userId2,` ${name}`),
          await insertGiveMoneyEntry(date,"Money Given",moneyAmount,userId1,"",userId2)
        .then(result => {
            console.log("Data inserted successfully");
             res.status(200).send("Data inserted successfully");
          })
       .catch(error => {
            console.error("Error inserting data:", error);
            res.status(500).send("Error inserting data");
                      });
        }
         
    } catch (error) {
        console.error("Error executing query:", error);
        // Handle the error appropriately, e.g., send an error response
    }
  }
  else{
     userId1=req.user.id;
     userId2=null;
     await insertReceiveMoneyEntry(date,item,moneyAmount,userId1,name,userId2)
  .then(result => {
    console.log("Data inserted successfully");
    res.status(200).send("Data inserted successfully");
  })
  .catch(error => {
    console.error("Error inserting data:", error);
    res.status(500).send("Error inserting data");
  });
  }
 
});

export default router;