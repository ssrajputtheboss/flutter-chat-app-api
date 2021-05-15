const Client = require('pg').Client;
require('dotenv').config();
const client = new Client({
  user:"postgres",
  password:process.env.DBPASS,
  port: 5432,
  database: process.env.DBNAME
});

module.exports = client;
