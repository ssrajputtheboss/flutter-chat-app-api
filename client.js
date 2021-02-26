const Client = require('pg').Client;

const client = new Client({
  user:"postgres",
  password:"password",
  port: 5432,
  database: "whatsappdata"
});

module.exports = client;
