const Pool = require('pg').Pool;
require('dotenv').config();
const pool = new Pool({
  user:"postgres",
  password:process.env.DBPASS,
  port: 5432,
  database: process.env.DBNAME
});

module.exports = pool;
