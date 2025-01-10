import db from "../db/db.js";

const createMorningEntries=async (date, weight, fat, price, user_id)=>{
        const total = weight * price;
        await db.query(
          "INSERT INTO morning (date, weight, fat, price, total, user_id) VALUES ($1, $2, $3, $4, $5, $6)",
          [date, weight, fat, price, total, user_id]
        );
        return true; // Acknowledge success
    
}

const getMorningEntriesByDate=async (userId,startDate,endDate)=>{
    const result = await db.query(
        "SELECT * FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3 order by date",[userId,startDate,endDate]);
        return result.rows;
}

const getSumOfMorningEntriesByDate= async(userId,startDate,endDate)=>{
    const morningSum = await db.query("SELECT SUM(weight) AS totalWeight, COUNT(date) AS totalDate, SUM(total) AS totalMoney from morning WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
    return morningSum.rows[0];
}

// Get morning entry totals before the start date
 const getMorningTotalsBeforeStart = async (userId, startDate) => {
        // Query to retrieve total sum of price from morning entries before the start date
    const mBeforeStart = "select sum(total) as totalmorning from morning where user_id=$1 and date < $2";
    const result = await db.query(mBeforeStart, [userId, startDate]);
    return result.rows[0]; 
  };
const getMorningSumOfTotalAfterDate= async(userId,startDate)=>{

}

export {
    createMorningEntries,
    getMorningEntriesByDate,
    getMorningSumOfTotalAfterDate,
    getMorningTotalsBeforeStart,
    getSumOfMorningEntriesByDate
}