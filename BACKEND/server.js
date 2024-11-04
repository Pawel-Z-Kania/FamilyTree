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

app.post('/api/family-members', (req, res) => {
  const { newFamilyMember, relative } = req.body;
  const { first_name, last_name, parent_marriage_id, marriage_id } = newFamilyMember;

  const { first_name: relativeFirstName, last_name: relativeLastName, parent_marriage_id: relativeParentMarriageId, marriage_id: relativeMarriageId } = relative;

  pool.query(
    'UPDATE family_members SET parent_marriage_id = $1, marriage_id = $2 WHERE first_name = $3 AND last_name = $4 RETURNING *',
    [relativeParentMarriageId, relativeMarriageId, relativeFirstName, relativeLastName],
    (err, relativeResults) => {
      if (err) {
        res.status(500).send(err);
      } else {
        pool.query(
          'INSERT INTO family_members (first_name, last_name, parent_marriage_id, marriage_id) VALUES ($1, $2, $3, $4) RETURNING *',
          [first_name, last_name, parent_marriage_id, marriage_id],
          (err, newMemberResults) => {
            if (err) {
              res.status(500).send(err);
            } else {
              res.status(201).json({ newFamilyMember: newMemberResults.rows[0], relative: relativeResults.rows[0] });
            }
          }
        );
      }
    }
  );
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});