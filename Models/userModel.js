import db from "../db/db.js";


// Function to find user by username
export const findUserByUsername = async (username) => {
    const result = await db.query('SELECT * FROM users WHERE username=$1', [username]);
    return result.rows[0];
};

// Function to create a new user
export const createUser = async (username, hashedPassword, role = 'user') => {
    const result = await db.query(
        'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *',
        [username, hashedPassword, role]
    );

    return result.rows[0];
};

// Function to check if a user exists by email
export const findUserByEmail = async (email) => {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [email]);
    return result.rows[0];
};

export const insertGoogleUserInfo = async (name, email, image, userId) => {
    const query = `
      INSERT INTO usersInfo (name, email, image, userid) 
      VALUES ($1, $2, $3, $4)
    `;
    const values = [name, email, image, userId];
    return db.query(query, values);
  };
  
  // Function to insert user info for manual registration
  export const insertManualUserInfo = async (name, userId) => {
    const query = `
      INSERT INTO usersInfo (name, userid) 
      VALUES ($1, $2)
    `;
    const values = [name, userId];
    return db.query(query, values);
  };

// Function to retrieve user details by ID
export const findUserById = async (id) => {
    const result = await db.query('SELECT * FROM users WHERE id=$1', [id]);
    return result.rows[0];
};
export const findUserRole = async (id) => {
  const result = await db.query('SELECT role FROM users WHERE id=$1', [id]);
  return result.rows[0];
};
export const getUserName = async (id) => {
  const result = await db.query('SELECT name FROM usersinfo WHERE userid=$1', [id]);
  return result.rows[0].name || " ";
};

export const getUsersInfo = async (parentUserId) => {
  const query = `
    SELECT 
      u.id AS id, 
      u.username AS username, 
      ui.name AS name,
      ui.email AS email,
      ui.mobile_number AS mobile_number,
      ui.image AS profile_img
    FROM users u
    JOIN usersInfo ui ON u.id = ui.userid
    WHERE u.user_id = $1; -- Adjust as needed
  `;
  const result = await db.query(query, [parentUserId]);
  return result.rows;
};

