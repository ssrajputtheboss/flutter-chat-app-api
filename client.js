const Client = require('pg').Client;
require('dotenv').config();
const client = new Client({
  host:process.env.DBHOST,
  user:process.env.DBUSER,
  password:process.env.DBPASS,
  port: 5432,
  database: process.env.DBNAME
});

module.exports = client;
