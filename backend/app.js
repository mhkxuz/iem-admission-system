const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const config = require('./config/config');
const ApiResponse = require('./utils/api-response');
const errorHandler = require('./middleware/error.middleware');
const authRoutes = require('./routes/auth.routes');
const applicationRoutes = require('./routes/application.routes');
const documentRoutes = require('./routes/document.routes');
const adminRoutes = require('./routes/admin.routes');
const sessionRoutes = require('./routes/session.routes');
const programmeRoutes = require('./routes/programme.routes');
const feeRoutes = require('./routes/fee.routes');
const meritRoutes = require('./routes/merit.routes');
const paymentRoutes = require('./routes/payment.routes');
const reportRoutes = require('./routes/report.routes');

const app = express();

// Enable CORS
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Logging middleware
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = mongoose.connection.readyState;
  const isHealthy = dbState === 1;

  return ApiResponse.success(
    res,
    'IEM Admission System API is running smoothly',
    {
      service: 'IEM Admission System Backend',
      status: isHealthy ? 'healthy' : 'degraded',
      database: dbStatusMap[dbState] || 'unknown',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv
    },
    isHealthy ? 200 : 503
  );
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/programmes', programmeRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/merit', meritRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/reports', reportRoutes);

// Catch-all for undefined routes
app.use('*', (req, res) => {
  return ApiResponse.error(res, `Endpoint not found: ${req.method} ${req.originalUrl}`, 404);
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
