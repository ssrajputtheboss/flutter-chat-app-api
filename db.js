const Pool = require('pg').Pool;
require('dotenv').config();
const pool = new Pool({
  user:process.env.DBUSER,
  password:process.env.DBPASS,
  port: 5432,
  database: process.env.DBNAME
});

module.exports = pool;
