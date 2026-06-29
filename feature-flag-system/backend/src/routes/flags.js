const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireRole('org_admin'), (req, res) => {
  const flags = db.query(
    'SELECT id, org_id, key, description, enabled, created_at, updated_at FROM feature_flags WHERE org_id = ? ORDER BY created_at DESC',
    [req.user.orgId]
  );
  return res.json({ flags: flags.map(toFlagJson) });
});

router.post('/', authenticate, requireRole('org_admin'), (req, res) => {
  const { key, description, enabled } = req.body || {};

  if (!key || !key.trim()) {
    return res.status(400).json({ error: 'Feature key is required.' });
  }

  const normalizedKey = key.trim();
  const existing = db.queryOne(
    'SELECT id FROM feature_flags WHERE org_id = ? AND key = ?',
    [req.user.orgId, normalizedKey]
  );
  if (existing) {
    return res.status(409).json({ error: 'A flag with this key already exists for your organization.' });
  }

  db.run(
    `INSERT INTO feature_flags (org_id, key, description, enabled)
     VALUES (?, ?, ?, ?)`,
    [req.user.orgId, normalizedKey, description || null, enabled ? 1 : 0]
  );

  const flag = db.queryOne(
    'SELECT id, org_id, key, description, enabled, created_at, updated_at FROM feature_flags WHERE org_id = ? AND key = ?',
    [req.user.orgId, normalizedKey]
  );

  return res.status(201).json({ flag: toFlagJson(flag) });
});

router.put('/:id', authenticate, requireRole('org_admin'), (req, res) => {
  const { id } = req.params;
  const { description, enabled } = req.body || {};

  const flag = db.queryOne('SELECT * FROM feature_flags WHERE id = ? AND org_id = ?', [id, req.user.orgId]);
  if (!flag) {
    return res.status(404).json({ error: 'Flag not found.' });
  }

  const nextDescription = description !== undefined ? description : flag.description;
  const nextEnabled = enabled !== undefined ? (enabled ? 1 : 0) : flag.enabled;

  db.run(
    `UPDATE feature_flags SET description = ?, enabled = ?, updated_at = datetime('now')
     WHERE id = ? AND org_id = ?`,
    [nextDescription, nextEnabled, id, req.user.orgId]
  );

  const updated = db.queryOne('SELECT * FROM feature_flags WHERE id = ? AND org_id = ?', [id, req.user.orgId]);
  return res.json({ flag: toFlagJson(updated) });
});

router.delete('/:id', authenticate, requireRole('org_admin'), (req, res) => {
  const { id } = req.params;

  const flag = db.queryOne('SELECT id FROM feature_flags WHERE id = ? AND org_id = ?', [id, req.user.orgId]);
  if (!flag) {
    return res.status(404).json({ error: 'Flag not found.' });
  }

  db.run('DELETE FROM feature_flags WHERE id = ? AND org_id = ?', [id, req.user.orgId]);
  return res.status(204).send();
});

router.get('/check', (req, res) => {
  const { orgId, key } = req.query;

  if (!orgId || !key) {
    return res.status(400).json({ error: 'orgId and key query parameters are required.' });
  }

  const org = db.queryOne('SELECT id FROM organizations WHERE id = ?', [orgId]);
  if (!org) {
    return res.status(404).json({ error: 'Organization not found.' });
  }

  const flag = db.queryOne(
    'SELECT enabled FROM feature_flags WHERE org_id = ? AND key = ?',
    [orgId, key.trim()]
  );

  if (!flag) {
    return res.status(404).json({ error: `No flag named "${key}" exists for this organization.` });
  }

  return res.json({ key: key.trim(), enabled: Boolean(flag.enabled) });
});

function toFlagJson(row) {
  return { ...row, enabled: Boolean(row.enabled) };
}

module.exports = router;
