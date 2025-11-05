const express = require('express');
const {
    selectRole,
    registerCustomer,
    registerProvider,
    login,
    getMe
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/select-role', selectRole);
router.post('/register/customer', registerCustomer);
router.post('/register/provider', registerProvider);
router.post('/login', login);

// Protected routes
router.get('/me', auth, getMe);

module.exports = router;