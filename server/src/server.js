require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const scholarshipRoutes = require('./routes/scholarshipRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// CORS configuration supporting development and configured client URL
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/prototype mode
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root info route
app.get('/', (req, res) => {
  res.json({
    project: 'SCHEME CONNECT',
    subtitle: 'Government Scheme Awareness and Eligibility Checker',
    status: 'Server active',
    apiDocumentation: {
      health: 'GET /api/health',
      allSchemes: 'GET /api/schemes',
      checkEligibility: 'POST /api/check-eligibility',
    },
  });
});

// API Routes - support both /api and root routes for deployment flexibility
app.use('/api', scholarshipRoutes);
app.use('/', scholarshipRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred.',
  });
});

// Start Server and Database Connection
async function startServer() {
  try {
    await connectDB();
    
    // Auto-seed database if empty
    try {
      const Scholarship = require('./models/Scholarship');
      const { scholarshipDataset } = require('./seed/seedScholarships');
      const count = await Scholarship.countDocuments();
      if (count === 0) {
        console.log('[Server] Database is empty. Seeding initial scholarship schemes...');
        await Scholarship.insertMany(scholarshipDataset);
        console.log(`[Server] Successfully seeded ${scholarshipDataset.length} schemes.`);
      }
    } catch (seedErr) {
      console.warn('[Server] Auto-seed check notice:', seedErr.message);
    }

    app.listen(PORT, () => {
      console.log(`[Server] Scheme Connect backend running on http://localhost:${PORT}`);
      console.log(`[Server] Allowed Client Origin: ${CLIENT_URL}`);
    });
  } catch (error) {
    console.error('[Server] Failed to initialize database connection:', error.message);
    // Still start server with fallback dataset so the website remains fully operational
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT} (Operating in fallback dataset mode)`);
    });
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
