const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const { initializeAdmin } = require('./controllers/adminController');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize admin user on server start
initializeAdmin();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));

// Add these routes if you have them
app.use('/api/service-requests', require('./routes/serviceRequests'));
app.use('/api/auth/password-reset', require('./routes/passwordReset'));
app.use('/api/verify-information', require('./routes/verification'));
app.use('/api/upload', require('./routes/upload'));

// Test routes
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Naibrly API is working!' 
    });
});

app.get('/api/debug/test', (req, res) => {
  res.json({ message: 'Debug route works!' });
});

app.post('/api/debug/test-post', (req, res) => {
  res.json({ 
    message: 'POST debug route works!',
    body: req.body 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'production' ? {} : err.message
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        requestedUrl: req.originalUrl
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Admin username: ${process.env.ADMIN_USERNAME}`);
});