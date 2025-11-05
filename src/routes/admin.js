const express = require('express');
const {
    adminLogin,
    getDashboardStats,
    getAllCustomers,
    getAllProviders,
    approveProvider,
    updateUserStatus,
    getAdminProfile
} = require('../controllers/adminController');
const { protect, adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// Admin login (public route)
router.post('/login', adminLogin);

// Protected admin routes
router.get('/dashboard/stats', adminAuth, getDashboardStats);
router.get('/customers', adminAuth, getAllCustomers);
router.get('/providers', adminAuth, getAllProviders);
router.patch('/providers/:providerId/approve', adminAuth, approveProvider);
router.patch('/users/:userId/:role/status', adminAuth, updateUserStatus);
router.get('/profile', adminAuth, getAdminProfile);
// Admin routes
// router.get('/admin/providers', protect, adminAuth, getAllProviders);
// router.patch('/admin/approve-provider/:providerId', protect, adminAuth, approveProvider)

module.exports = router;