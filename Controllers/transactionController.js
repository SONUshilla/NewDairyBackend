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
        if (item === "Give Money") {
          await insertGiveMoneyEntry(date,item,moneyAmount,adminId,`money given to ${name}`,null),
          await insertReceiveMoneyEntry(date,"Receive Money",moneyAmount,userId,"Money recieved from dairy",adminId) 
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
         if (item === "Receive Money") {
          await insertReceiveMoneyEntry(date,item,moneyAmount,userId2,`money received from ${name}`),
          await insertGiveMoneyEntry(date,"Give Money",moneyAmount,userId1,"Money given to Dairy",userId2)
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