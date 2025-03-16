const express = require('express');
const dotenv = require('dotenv');
const { app, server } = require('./app');

dotenv.config();

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on:`);
  console.log(`- http://localhost:${PORT}`);
  console.log(`- http://127.0.0.1:${PORT}`);
});
