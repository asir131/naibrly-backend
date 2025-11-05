const express = require('express');
const {
    selectRole,
    registerCustomer,
    registerProvider,
    login,
    getMe
} = require('../controllers/authController');
const { uploadProfileImage, uploadBusinessLogo } = require('../config/cloudinary');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Role selection
router.post('/select-role', selectRole);

// Customer registration with file upload
router.post(
    '/register/customer',
    uploadProfileImage.single('profileImage'),
    registerCustomer
);

// Service Provider registration with file uploads
router.post(
    '/register/provider',
    uploadBusinessLogo.fields([
        { name: 'profileImage', maxCount: 1 },
        { name: 'businessLogo', maxCount: 1 }
    ]),
    registerProvider
);

// Login
router.post('/login', login);

// Get current user
router.get('/me', auth, getMe);

module.exports = router;