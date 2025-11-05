const express = require('express');
const {
    createServiceRequest,
    getCustomerRequests,
    getProviderRequests,
    updateRequestStatus,
    cancelRequest,
    addReview,
    getProvidersByService,
    testProviderServices
} = require('../controllers/serviceRequestController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Test route for debugging
router.get('/test-provider/:providerId', testProviderServices);

// Customer routes
router.post('/', auth, createServiceRequest);
router.get('/customer/my-requests', auth, getCustomerRequests);
router.patch('/:requestId/cancel', auth, cancelRequest);
router.post('/:requestId/review', auth, addReview);

// Provider routes
router.get('/provider/my-requests', auth, getProviderRequests);
router.patch('/:requestId/status', auth, updateRequestStatus);

// Public routes (for browsing providers)
router.get('/providers', getProvidersByService);

module.exports = router;