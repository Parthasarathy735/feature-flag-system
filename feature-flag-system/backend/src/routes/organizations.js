const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/public', (req, res) => {
  const orgs = db.query('SELECT id, name FROM organizations ORDER BY name ASC');
  return res.json({ organizations: orgs });
});

router.post('/', authenticate, requireRole('super_admin'), (req, res) => {
  const { name } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Organization name is required.' });
  }

  const existing = db.queryOne('SELECT id FROM organizations WHERE name = ?', [name.trim()]);
  if (existing) {
    return res.status(409).json({ error: 'An organization with this name already exists.' });
  }

  db.run('INSERT INTO organizations (name) VALUES (?)', [name.trim()]);
  const org = db.queryOne('SELECT id, name, created_at FROM organizations WHERE name = ?', [name.trim()]);

  return res.status(201).json({ organization: org });
});

router.get('/', authenticate, requireRole('super_admin'), (req, res) => {
  const orgs = db.query(`
    SELECT
      o.id, o.name, o.created_at,
      (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.org_id = o.id AND r.name = 'org_admin') AS admin_count,
      (SELECT COUNT(*) FROM feature_flags f WHERE f.org_id = o.id) AS flag_count
    FROM organizations o
    ORDER BY o.created_at DESC
  `);
  return res.json({ organizations: orgs });
});

module.exports = router;
