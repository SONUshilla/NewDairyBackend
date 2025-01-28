import db from "../db/db.js";

 
export const getBorrowEntries = async (userId, startDate, endDate, isAssociatedUser) => {
    try {
     
  
      // Construct the query with the condition
      const borrowQuery = `
        SELECT id, date, item, quantity, price, money, name
        FROM borrow
        WHERE user_id = $1 AND date BETWEEN $2 AND $3
        ORDER BY date
      `;
  
      // Execute the query with parameterized values
      const results = await db.query(borrowQuery, [userId, startDate, endDate]);
      // Return rows from the results
      return results.rows;
    } catch (error) {
      console.error("Error fetching borrow entries:", error);
      throw error; // Let the caller handle the error
    }
  };
 


// Get totals for "Feed" entries
export const getFeedTotals = async (userId, startDate, endDate) => {
    const feedQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney FROM borrow WHERE item = 'Feed' AND user_id = $1 AND date BETWEEN $2 AND $3`;
 
  const result = await db.query(feedQuery, [userId, startDate, endDate]);
  return result.rows[0];
};

// Get totals for "Receive Money" entries
export const getMoneyReceivedTotals = async (userId, startDate, endDate) => {
    const moneyReceivedQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney 
    FROM borrow 
    WHERE item = 'Money Received' AND user_id = $1  AND date BETWEEN $2 AND $3`;

  const result = await db.query(moneyReceivedQuery, [userId, startDate, endDate]);
  return result.rows[0];
};

// Get totals for "Give Money" entries
export const getMoneyGivenTotals = async (userId, startDate, endDate) => {
    const moneyGivenQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney 
    FROM borrow 
    WHERE item = 'Money Given' AND user_id = $1 AND date BETWEEN $2 AND $3`;
  const result = await db.query(moneyGivenQuery, [userId, startDate, endDate]);
  return result.rows[0];
};

// Get totals for "Ghee" entries
export const getGheeTotals = async (userId, startDate, endDate) => {
    const gheeQuery = `SELECT SUM(quantity) AS totalQuantity, SUM(money) AS totalMoney 
    FROM borrow 
    WHERE item = 'Ghee' AND user_id = $1 AND date BETWEEN $2 AND $3`;
  const result = await db.query(gheeQuery, [userId, startDate, endDate]);
  return result.rows[0];
};

// Get balances from borrow table before the start date
export const getBorrowBeforeStart = async (userId, startDate) => {
    const bBeforeStart = `SELECT SUM(CASE WHEN item = 'Money Given' THEN money WHEN item IN ('Money Recieved', 'Ghee','Feed') THEN -money  ELSE 0 END) AS totalMoney 
    FROM borrow 
    WHERE user_id = $1 
    AND date < $2`;
  const result = await db.query(bBeforeStart, [userId, startDate]);
  return result.rows[0]; 
};

const insertGiveMoneyEntry = async (date, item, moneyAmount, senderId, name,receiverId=null) => {
    try {

      console.log("1234")
      await db.query(
        "INSERT INTO borrow(date, item, money, user_id, name,userid) VALUES ($1, $2, $3, $4, $5,$6)",
        [date, item, moneyAmount, senderId, name,receiverId]
      );
    } catch (error) {
      console.error("Error inserting 'Money Given' entry:", error);      throw error; // Let the caller handle the error
    }
  };

  const insertReceiveMoneyEntry = async (date, item, moneyAmount, receiverId, name,senderId=null) => {
    try {
      await db.query(
        "INSERT INTO borrow(date, item, money, user_id, name, userid) VALUES ($1, $2, $3, $4, $5, $6)",
        [date, item, moneyAmount, receiverId, name, senderId]
      );
    } catch (error) {
      console.error("Error inserting 'Money Recieved' entry:", error);
      throw error; // Let the caller handle the error
    }
  };

  const getBorrowTotalForUser = async (userId) => {
    const query = `
      SELECT COALESCE(SUM(money), 0) AS money
      FROM borrow
      WHERE user_id = $1;
    `;
    const result = await db.query(query, [userId]);
    return parseFloat(result.rows[0].money) || 0;
  };

  const insertBorrowEntry = async (
    date,
    item,
    price,
    quantity,
    userId1,
    name,
    userId2 = null
  ) => {
    try {
      await db.query(
        "INSERT INTO borrow(date, item, price, quantity, money, user_id, name, userid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          date,
          item,
          price,
          quantity,
          price * quantity, // Calculate the money by multiplying price * quantity
          userId1, // User ID who is borrowing
          name, // User's name
          userId2, // Optional second user ID
        ]
      );
    } catch (error) {
      console.error("Error inserting Borrow entry:", error);
      throw error; // Let the caller handle the error
    }
  };
  
  export { insertGiveMoneyEntry,
    insertReceiveMoneyEntry,
    getBorrowTotalForUser,
    insertBorrowEntry
   };


