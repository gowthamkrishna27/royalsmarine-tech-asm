require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const API = process.env.API_PREFIX || '/api/v1';

// Security & middleware
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://royalsmarine.vercel.app',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin) ||
      (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    ) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(apiLimiter);

// Static uploads (restrict to authenticated users via nginx in production)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use(`${API}/auth`, require('./routes/auth'));
app.use(`${API}/users`, require('./routes/users'));
app.use(`${API}/clients`, require('./routes/clients'));
app.use(`${API}/visits`, require('./routes/visits'));
app.use(`${API}/followups`, require('./routes/followups'));
app.use(`${API}/master`, require('./routes/brands'));
app.use(`${API}/billing`, require('./routes/billing'));
app.use(`${API}/dashboard`, require('./routes/dashboard'));
app.use(`${API}/reports`, require('./routes/reports'));
app.use(`${API}/notifications`, require('./routes/notifications'));
app.use(`${API}/audit-logs`, require('./routes/auditLogs'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use(errorHandler);

// Cron jobs
require('./jobs/followupJob');

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  logger.info(`Royals Marine API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  try {
    const sequelize = require('./config/database');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await sequelize.query('DROP TABLE IF EXISTS visit_brands;');
    await sequelize.query('DROP TABLE IF EXISTS visit_categories;');
    await sequelize.query('DROP TABLE IF EXISTS client_brands;');
    await sequelize.query('DROP TABLE IF EXISTS client_categories;');
    await sequelize.query('DROP TABLE IF EXISTS products;');
    await sequelize.query('DROP TABLE IF EXISTS brands;');
    await sequelize.query('DROP TABLE IF EXISTS categories;');

    // Rename clients table to farmers if clients is a base table
    const [clientTable] = await sequelize.query(`
      SELECT TABLE_TYPE FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'clients'
    `);
    const [farmerTable] = await sequelize.query(`
      SELECT TABLE_TYPE FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'farmers'
    `);

    if (clientTable.length && clientTable[0].TABLE_TYPE === 'BASE TABLE' && !farmerTable.length) {
      await sequelize.query('RENAME TABLE clients TO farmers;');
      logger.info('Renamed clients table to farmers.');
    }
    await sequelize.query('CREATE OR REPLACE VIEW clients AS SELECT * FROM farmers;');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    logger.info('Database tables verified: farmers table active with compatibility view.');
  } catch (err) {
    logger.warn('Table cleanup note: ' + err.message);
  }
});

module.exports = app;
