const express = require("express");
const router = express.Router();

// Import controllers properly
const {
  createMoneyRequest,
  getProviderMoneyRequests,
  getCustomerMoneyRequests,
  getMoneyRequest,
  acceptMoneyRequest,
  cancelMoneyRequest,
  processPayment,
  completePayment,
  raiseDispute,
  resolveDispute,
  getMoneyRequestStats,
  handlePaymentSuccess,
  handlePaymentCancel,
  testPaymentWebhook,
  checkPaymentStatus,
} = require("../controllers/moneyRequestController");

const { auth, authorize } = require("../middleware/auth");

// Provider routes
router.post("/create", auth, authorize("provider"), createMoneyRequest);
router.get("/provider", auth, authorize("provider"), getProviderMoneyRequests);

// Customer routes
router.get("/customer", auth, authorize("customer"), getCustomerMoneyRequests);
router.patch(
  "/:moneyRequestId/accept",
  auth,
  authorize("customer"),
  acceptMoneyRequest
);
router.patch(
  "/:moneyRequestId/cancel",
  auth,
  authorize("customer"),
  cancelMoneyRequest
);
router.post(
  "/:moneyRequestId/pay",
  auth,
  authorize("customer"),
  processPayment
);
router.post(
  "/:moneyRequestId/complete-payment",
  auth,
  authorize("customer"),
  completePayment
);
router.get(
  "/payment/success",
  auth,
  authorize("customer"),
  handlePaymentSuccess
);
router.get("/payment/cancel", auth, authorize("customer"), handlePaymentCancel);

// Both provider and customer can get details and raise disputes
router.get("/:moneyRequestId", auth, getMoneyRequest);
router.post(
  "/:moneyRequestId/dispute",
  auth,
  authorize("provider", "customer"),
  raiseDispute
);
router.get("/stats/summary", auth, getMoneyRequestStats);

// Admin routes
router.patch(
  "/:moneyRequestId/resolve-dispute",
  auth,
  authorize("admin"),
  resolveDispute
);

router.get(
  "/:moneyRequestId/status",
  auth,
  authorize("customer", "provider"),
  checkPaymentStatus
);

// Test webhook (for development only)
router.post(
  "/:moneyRequestId/test-webhook",
  auth,
  authorize("admin"),
  testPaymentWebhook
);

module.exports = router;
