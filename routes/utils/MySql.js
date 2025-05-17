const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  connectionLimit: 4,
  host: process.env.host,
  user: process.env.user,
  password: process.env.db_password,
  database: process.env.database
});

module.exports = {
  connection: () => pool.getConnection(),
  pool
}; 
