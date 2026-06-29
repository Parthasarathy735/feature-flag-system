const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

const router = express.Router();

function sign(payload) {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
}


router.post('/super-admin/login', (req, res) => {
  const { username, password } = req.body || {};

  if (username === config.SUPER_ADMIN.username && password === config.SUPER_ADMIN.password) {
    const token = sign({ role: 'super_admin', username });
    return res.json({ token, user: { role: 'super_admin', username } });
  }

  return res.status(401).json({ error: 'Invalid super admin credentials.' });
});

router.post('/org-admin/signup', (req, res) => {
  const { orgId, name, email, password } = req.body || {};

  if (!orgId || !email || !password) {
    return res.status(400).json({ error: 'orgId, email and password are required.' });
  }

  const org = db.queryOne('SELECT id FROM organizations WHERE id = ?', [orgId]);
  if (!org) {
    return res.status(404).json({ error: 'Organization not found.' });
  }

  const existing = db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (org_id, role_id, name, email, password_hash)
     VALUES (?, (SELECT id FROM roles WHERE name = 'org_admin'), ?, ?, ?)`,
    [orgId, name || null, email, passwordHash]
  );

  const user = db.queryOne('SELECT id, org_id, name, email FROM users WHERE email = ?', [email]);
  const token = sign({ sub: user.id, role: 'org_admin', orgId: user.org_id, email: user.email });

  return res.status(201).json({
    token,
    user: { id: user.id, role: 'org_admin', orgId: user.org_id, name: user.name, email: user.email },
  });
});

router.post('/org-admin/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  const user = db.queryOne(
    `SELECT u.id, u.org_id, u.name, u.email, u.password_hash
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = ? AND r.name = 'org_admin'`,
    [email]
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = sign({ sub: user.id, role: 'org_admin', orgId: user.org_id, email: user.email });

  return res.json({
    token,
    user: { id: user.id, role: 'org_admin', orgId: user.org_id, name: user.name, email: user.email },
  });
});

module.exports = router;
