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

// Behind reverse proxies (Render, Cloudflare, etc.) trust the first proxy hop
app.set('trust proxy', 1);

// Security & middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Parse all configured origins from environment variables (handles comma-separated lists)
const parseOrigins = (val) => {
  if (!val) return [];
  return String(val)
    .split(',')
    .map(url => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);
};

const configuredOrigins = [
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.ADMIN_URL),
  ...parseOrigins(process.env.CLIENT_URL),
  ...parseOrigins(process.env.ALLOWED_ORIGINS),
  ...parseOrigins(process.env.CORS_ORIGIN),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://royalsmarine.vercel.app',
  'https://royalsmarine.pages.dev',
];

const isOriginAllowed = (origin) => {
  if (!origin) return true; // allow mobile apps, curl, server-to-server
  const cleanOrigin = origin.trim().replace(/\/+$/, '');

  // Wildcard configured in environment
  if (configuredOrigins.includes('*')) return true;

  // Exact match in configured origins
  if (configuredOrigins.includes(cleanOrigin)) return true;

  // Localhost / 127.0.0.1 with any port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)) return true;

  // Vercel deployments (*.vercel.app)
  if (/^https?:\/\/([a-z0-9-]+\.)*vercel\.app(:[0-9]+)?$/i.test(cleanOrigin)) return true;

  // Cloudflare Pages (*.pages.dev)
  if (/^https?:\/\/([a-z0-9-]+\.)*pages\.dev(:[0-9]+)?$/i.test(cleanOrigin)) return true;

  // Netlify deployments (*.netlify.app)
  if (/^https?:\/\/([a-z0-9-]+\.)*netlify\.app(:[0-9]+)?$/i.test(cleanOrigin)) return true;

  // Render & Railway deployments
  if (/^https?:\/\/([a-z0-9-]+\.)*onrender\.com(:[0-9]+)?$/i.test(cleanOrigin)) return true;
  if (/^https?:\/\/([a-z0-9-]+\.)*up\.railway\.app(:[0-9]+)?$/i.test(cleanOrigin)) return true;

  // Custom domains for Royals Marine & Rupa Enterprises
  if (/^https?:\/\/([a-z0-9-]+\.)*royalsmarine\.(com|in|org|net)(:[0-9]+)?$/i.test(cleanOrigin)) return true;
  if (/^https?:\/\/([a-z0-9-]+\.)*rupaenterprises\.com(:[0-9]+)?$/i.test(cleanOrigin)) return true;

  // Allow in development / test environments
  if (process.env.NODE_ENV !== 'production') return true;

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    // Return false without throwing Error so Express does not crash into a 500
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  // Omitting hardcoded allowedHeaders lets cors dynamically reflect Access-Control-Request-Headers,
  // preventing preflight rejections from Cache-Control, Pragma, or custom headers.
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
// Health check (placed before rate limiter so uptime monitors & health checks never consume rate limits)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

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
    // Ensure ponds columns (dealer_name, doc, doc_date) exist
    try {
      const [pondCols] = await sequelize.query('DESCRIBE ponds;');
      const colNames = pondCols.map(c => c.Field);
      if (!colNames.includes('dealer_name')) {
        await sequelize.query('ALTER TABLE ponds ADD COLUMN dealer_name VARCHAR(200) NULL;');
        logger.info('Added dealer_name column to ponds table.');
      }
      if (!colNames.includes('doc')) {
        await sequelize.query('ALTER TABLE ponds ADD COLUMN doc INT NULL;');
        logger.info('Added doc column to ponds table.');
      }
      if (!colNames.includes('doc_date')) {
        await sequelize.query('ALTER TABLE ponds ADD COLUMN doc_date DATE NULL;');
        logger.info('Added doc_date column to ponds table.');
      }
    } catch (colErr) {
      logger.warn('Ponds column verify note: ' + colErr.message);
    }

    // Ensure followups columns (test_required, test_details, tank_id) exist
    try {
      const [fCols] = await sequelize.query('DESCRIBE followups;');
      const fColNames = fCols.map(c => c.Field);
      if (!fColNames.includes('test_required')) {
        await sequelize.query('ALTER TABLE followups ADD COLUMN test_required TINYINT(1) DEFAULT 0;');
        logger.info('Added test_required column to followups table.');
      }
      if (!fColNames.includes('test_details')) {
        await sequelize.query('ALTER TABLE followups ADD COLUMN test_details JSON NULL;');
        logger.info('Added test_details column to followups table.');
      }
      if (!fColNames.includes('tank_id')) {
        await sequelize.query('ALTER TABLE followups ADD COLUMN tank_id INT NULL;');
        logger.info('Added tank_id column to followups table.');
      }
    } catch (fColErr) {
      logger.warn('Followups column verify note: ' + fColErr.message);
    }

  } catch (err) {
    logger.warn('Table cleanup note: ' + err.message);
  }
});

module.exports = app;
