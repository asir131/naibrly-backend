const express = require('express');
const {
    getAllUsers,
    getUserProfile,
    updateUserProfile
} = require('../controllers/userController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Admin routes
router.get('/', auth, authorize('admin'), getAllUsers);

// User routes
router.get('/profile', auth, getUserProfile);
router.put('/profile', auth, updateUserProfile);

module.exports = router;