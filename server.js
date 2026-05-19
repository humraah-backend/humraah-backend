// ====================================
// HUMRAAH BACKEND - server.js
// COMPLETE & CORRECT VERSION
// ====================================

// Load environment variables
require('dotenv').config();

// External dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Route imports
const { router: authRoutes, verifyToken } = require('./src/routes/auth');
const registrationRoutes = require('./src/routes/registration');
const matchingRoutes = require('./src/routes/matching');
const paymentRoutes = require('./src/routes/payment');
const introductionRoutes = require('./src/routes/introduction');
const adminRoutes = require('./src/routes/admin');
const decisionRoutes = require('./src/routes/decision');
const chatRoutes = require('./src/routes/chat');
const aadhaarRoutes = require('./src/routes/aadhaar');
const webhookRoutes = require('./src/routes/webhook');
const guarantorRoutes = require('./src/routes/guarantor');
const uploadRoutes = require('./src/routes/upload');

// Initialize cron jobs (matching system scheduled tasks)
require('./src/matching-cron');

// Initialize Express app
const app = express();

// ====================================
// MIDDLEWARE
// ====================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static files
app.use('/uploads', express.static('uploads'));

// ====================================
// ROUTES
// ====================================

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '✅ Humraah Backend Running',
    timestamp: new Date()
  });
});

// Authentication routes (NO token required)
app.use('/api/auth', authRoutes);

// Registration routes (some endpoints require token)
app.use('/api/registration', registrationRoutes);

// Matching routes (ALL require token - verifyToken middleware applied)
app.use('/api/matching', verifyToken, matchingRoutes);

// Payment routes (optional: add verifyToken if you want to protect them)
app.use('/api/payment', paymentRoutes);

// Introduction routes
app.use('/api/introduction', introductionRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Decision routes
app.use('/api/decision', decisionRoutes);

// Chat routes
app.use('/api/chat', chatRoutes);

// Aadhaar verification routes
app.use('/api/aadhaar', aadhaarRoutes);

// Webhook routes
app.use('/api/webhook', webhookRoutes);

// Guarantor routes
app.use('/api/guarantor', guarantorRoutes);

// Upload routes
app.use('/api/upload', uploadRoutes);

// ====================================
// ERROR HANDLING MIDDLEWARE
// ====================================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({
    success: false,
    error: err.message,
    timestamp: new Date()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// ====================================
// DATABASE CONNECTION & SERVER START
// ====================================

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/humraah')
  .then(() => {
    console.log('✅ MongoDB Connected');
    
    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║         🚀 HUMRAAH BACKEND STARTED 🚀              ║
║                                                    ║
║  Server: http://localhost:${PORT}                     ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(27)}║
║  Database: ✅ Connected                            ║
║  Auth System: ✅ Active                            ║
║  Matching Algorithm: ✅ Active                     ║
║  Cron Jobs: ✅ Active                              ║
║                                                    ║
║  Ready to accept requests!                         ║
║                                                    ║
╚════════════════════════════════════════════════════╝
      `);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });

module.exports = app;