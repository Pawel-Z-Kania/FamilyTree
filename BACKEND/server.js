// backend/server.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/family-members', (req, res) => {
  pool.query('SELECT * FROM family_members', (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(results.rows);
    }
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});