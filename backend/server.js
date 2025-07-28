// server.js or index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/db');
const { responseBody } = require('./config/responseBody');
const messageRoutes = require('./routes/messageRoutes');
require('dotenv').config();

const client = require('prom-client');
const register = new client.Registry();
register.setDefaultLabels({ app: 'hellodoc' });
client.collectDefaultMetrics({ register });

const PORT = process.env.PORT || 8080;
const app = express();


connectDB();


app.use(helmet());


app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// JSON and Cookie Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Content Security Policy Headers
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// Allow modifying req.query for later middleware
app.use((req, res, next) => {
  const descriptor = Object.getOwnPropertyDescriptor(req, 'query') || {};
  Object.defineProperty(req, 'query', {
    ...descriptor,
    value: req.query,
    writable: true
  });
  next();
});

// Sanitize and clean input
app.use(mongoSanitize());
app.use(xssClean());

// Route Files
const authRoutes = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const patientRoutes = require('./routes/patientRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/messages', messageRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('HelloDoc Backend API');
});

// Prometheus Metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Global error handler (e.g., Multer upload errors)
app.use((err, req, res, next) => {
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json(
      responseBody(400, 'Only JPG, JPEG, PNG, or PDF files are allowed', null)
    );
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json(
      responseBody(400, 'Only one file can be uploaded at a time', null)
    );
  }

  if (err.name === 'MulterError') {
    return res.status(400).json(
      responseBody(400, `Upload error: ${err.message}`, null)
    );
  }

  return res.status(500).json(
    responseBody(500, 'Unexpected server error', null)
  );
});

module.exports = app;
