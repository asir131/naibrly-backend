

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
require('dotenv').config();

const connectDB = require('./config/database');

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));




// Session middleware
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
// Import and use routes
let authRoutes, userRoutes, registrationRoutes;

try {
  authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('Auth routes loaded successfully');
} catch (error) {
  console.error('Error loading auth routes:', error.message);
}

try {
  userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
  console.log('User routes loaded successfully');
} catch (error) {
  console.error('Error loading user routes:', error.message);
}



// // Create SuperAdmin function
// const createSuperAdmin = async () => {
//   try {
//     const User = require('./models/User');
//     const bcrypt = require('bcryptjs');
    
//     const existingSuperAdmin = await User.findOne({ role: 'superAdmin' });
    
//     if (!existingSuperAdmin) {
//       const hashedPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12);
      
//       await User.create({
//         role: 'superAdmin',
//         email: process.env.SUPERADMIN_EMAIL,
//         password: hashedPassword,
//         firstName: 'Super',
//         lastName: 'Admin',
//         isVerified: true,
//         isRegistrationComplete: true,
//         isActive: true
//       });
      
//       console.log('SuperAdmin created successfully');
//     } else {
//       console.log('SuperAdmin already exists');
//     }
//   } catch (error) {
//     console.error('Error creating superAdmin:', error.message);
//   }
// };

// // Call this function after database connection
// createSuperAdmin();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
  }
  
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Export app and server WITHOUT starting the server
module.exports = { app, server };