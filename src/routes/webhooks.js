// routes/webhooks.js
const express = require("express");
const {
  handleStripeWebhook,
  testWebhook,
} = require("../controllers/webhookController");

const router = express.Router();

// Webhook endpoint (must be before body parser)
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Test webhook endpoint
router.post("/stripe/test", testWebhook);

module.exports = router;
