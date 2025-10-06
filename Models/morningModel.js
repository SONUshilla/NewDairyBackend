import db from "../db/db.js";

const createMorningEntries=async (date, weight, fat, price, user_id,userid,issnf,animalType)=>{
        const total = weight * price;
        await db.query(
          "INSERT INTO morning (date, weight, fat, price,total, user_id,snf,animaltype,userid) VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9)",
          [date, weight, fat, price, total, user_id,issnf,animalType,userid]
        )
        return true; // Acknowledge success
    
}

const getMorningEntriesByDate=async (userId,startDate,endDate)=>{
    const result = await db.query(
        "SELECT * FROM morning WHERE userid = $1 AND date BETWEEN $2 AND $3 order by date",[userId,startDate,endDate]);
        return result.rows;
}
const getCustomerMorningEntriesByDate=async (userId,startDate,endDate)=>{
  const result = await db.query(
      "SELECT * FROM morning WHERE user_id = $1 AND date BETWEEN $2 AND $3 order by date",[userId,startDate,endDate]);
      return result.rows;
}

export const getSumOfAdminMorningEntriesByDate= async(userId,startDate,endDate)=>{
    const morningSum = await db.query("SELECT SUM(weight) AS Weight, COUNT(date) AS Date, SUM(total) AS total from morning WHERE userid = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
    return morningSum.rows[0];
}
const getSumOfMorningEntriesByDate= async(userId,startDate,endDate)=>{
  const morningSum = await db.query("SELECT SUM(weight) AS Weight, COUNT(date) AS Date, SUM(total) AS total from morning WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
  return morningSum.rows[0];
}
// Get morning entry totals before the start date
 const getMorningTotalsBeforeStart = async (userId, startDate) => {
        // Query to retrieve total sum of price from morning entries before the start date
    const mBeforeStart = "select sum(total) as totalmorning from morning where userid=$1 and date < $2";
    const result = await db.query(mBeforeStart, [userId, startDate]);
    return result.rows[0]; 
  };

export const getCustomerMorningTotalsBeforeStart = async (userId, startDate) => {
    // Query to retrieve total sum of price from morning entries before the start date
const mBeforeStart = "select sum(total) as totalmorning from morning where user_id=$1 and date < $2";
const result = await db.query(mBeforeStart, [userId, startDate]);
return result.rows[0]; 
};
const getMorningSumOfTotalAfterDate= async(userId,startDate)=>{

}

const getMorningMilkTotal = async (userId) => {
  const query = `SELECT SUM(total) AS total FROM morning WHERE user_id = $1`;
  const result = await db.query(query, [userId]);
  return parseFloat(result.rows[0].total) || 0;
};

const getEveningMilkTotal = async (userId) => {
  const query = `SELECT SUM(total) AS total FROM evening WHERE user_id = $1`;
  const result = await db.query(query, [userId]);
  return parseFloat(result.rows[0].total) || 0;
};


const getMorningCustomers = async (adminId, date) => {
  const query = ` SELECT 
      ui.name,
      m.date,
      m.fat,
      m.weight
    FROM users u
    JOIN usersinfo ui ON ui.userid = u.id
    JOIN morning m ON m.user_id = u.id
    WHERE u.user_id = $1
      AND m.date = $2;`
  const rows = await db.query(query, [adminId, date]);
  return rows;
};
export {
    createMorningEntries,
    getMorningEntriesByDate,
    getMorningSumOfTotalAfterDate,
    getMorningTotalsBeforeStart,
    getSumOfMorningEntriesByDate,
   getEveningMilkTotal,
   getMorningMilkTotal,
    getMorningCustomers,
    getCustomerMorningEntriesByDate
}