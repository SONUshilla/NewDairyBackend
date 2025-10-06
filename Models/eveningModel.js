import db from "../db/db.js";


const createEveningEntries=async (date, weight, fat, price, user_id,userid,issnf,animalType)=>{
  const total = weight * price;
  await db.query(
    "INSERT INTO evening (date, weight, fat, price,total, user_id,snf,animaltype,userid) VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9)",
    [date, weight, fat, price, total, user_id,issnf,animalType,userid]
  )
  return true; // Acknowledge success

}
  

const getEveningEntriesByDate=async (userId,startDate,endDate)=>{
    const result = await db.query(
        "SELECT * FROM evening WHERE userid = $1 AND date BETWEEN $2 AND $3 order by date",[userId,startDate,endDate]);
        return result.rows;
}
const getSumOfEveningEntriesByDate= async(userId,startDate,endDate)=>{
  const eveningSum = await db.query("SELECT SUM(weight) AS Weight, COUNT(date) AS Date, SUM(total) AS total from evening WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, startDate, endDate]);
  return eveningSum.rows[0];
}

// Get evening entry totals before the start date
const getEveningTotalsBeforeStart = async (userId, startDate) => {
    // Query to retrieve total sum of price from evening entries before the start date
    const eBeforeStart = "select sum(total) as totalevening from evening   where userid=$1 and date < $2";
  const result = await db.query(eBeforeStart, [userId, startDate]);
  return result.rows[0]; 
};

export const getCustomerEveningTotalsBeforeStart = async (userId, startDate) => {
  // Query to retrieve total sum of price from evening entries before the start date
  const eBeforeStart = "select sum(total) as totalevening from evening   where user_id=$1 and date < $2";
const result = await db.query(eBeforeStart, [userId, startDate]);
return result.rows[0]; 
};

const getEveningSumOfTotalAfterDate = async (userId, startDate) => {};

const getEveningCustomers = async (adminId, date) => {
  const query = ` SELECT 
  ui.name,
  m.date,
  m.fat,
  m.weight
FROM users u
JOIN usersinfo ui ON ui.userid = u.id
JOIN evening m ON m.user_id = u.id
WHERE u.user_id = $1
  AND m.date = $2;`;
  const rows = await db.query(query, [adminId, date]);
  return rows;
};
export {
  createEveningEntries,
  getEveningEntriesByDate,
  getEveningSumOfTotalAfterDate,
  getEveningTotalsBeforeStart,
  getSumOfEveningEntriesByDate,
  getEveningCustomers,
};