const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/iem_admission_db',
  jwtSecret: process.env.JWT_SECRET || 'iem_admission_portal_jwt_secret_key_2026_super_secure',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || './uploads/documents'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES, 10) || 5 * 1024 * 1024, // 5MB
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  paymentGateway: process.env.PAYMENT_GATEWAY || 'sandbox',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'admissions@iem.edu'
};
