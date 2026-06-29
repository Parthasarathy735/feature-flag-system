const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');

const authRoutes = require('./routes/auth');
const organizationRoutes = require('./routes/organizations');
const flagRoutes = require('./routes/flags');

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/flags', flagRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

db.init().then(() => {
  app.listen(config.PORT, () => {
    console.log(`Feature flag backend listening on http://localhost:${config.PORT}`);
    console.log(`Super admin login -> username: ${config.SUPER_ADMIN.username}, password: ${config.SUPER_ADMIN.password}`);
  });
});
