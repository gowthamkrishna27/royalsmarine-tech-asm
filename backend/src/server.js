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
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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
app.use(`${API}/opportunities`, require('./routes/opportunities'));
app.use(`${API}/master`, require('./routes/brands'));
app.use(`${API}/quotations`, require('./routes/quotations'));
app.use(`${API}/purchase-orders`, require('./routes/purchaseOrders'));
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
app.listen(PORT, () => {
  logger.info(`Rupa CRM API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
