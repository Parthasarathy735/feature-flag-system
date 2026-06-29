require('dotenv').config({ quiet: true });

module.exports = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: '8h',

  SUPER_ADMIN: {
    username: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
  },

  DB_FILE: process.env.DB_FILE || require('path').join(__dirname, '..', 'data', 'app.sqlite'),
};
