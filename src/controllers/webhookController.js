const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const MoneyRequest = require("../models/MoneyRequest");
const ServiceProvider = require("../models/ServiceProvider");

const handleStripeWebhook = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];

    console.log("🔔 Webhook received - Headers:", {
      "stripe-signature": sig ? "present" : "missing",
      "content-type": req.headers["content-type"],
      "content-length": req.headers["content-length"],
    });

    // Check if body exists and is a Buffer
    if (!req.body || !Buffer.isBuffer(req.body)) {
      console.error("❌ No webhook payload or payload is not a Buffer");
      console.error("❌ Body type:", typeof req.body);
      console.error("❌ Body:", req.body);
      return res.status(400).send("No webhook payload was provided.");
    }

    console.log("✅ Raw body received, length:", req.body.length);

    let event;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("❌ STRIPE_WEBHOOK_SECRET is not set");
      return res.status(400).send("Webhook secret not configured");
    }

    try {
      // Construct the event using the raw body
      event = stripe.webhooks.constructEvent(
        req.body, // This should be the raw Buffer
        sig,
        webhookSecret
      );
      console.log("✅ Webhook signature verified:", event.type);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        console.log("💰 Processing checkout.session.completed");
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case "payment_intent.succeeded":
        console.log("✅ Processing payment_intent.succeeded");
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        console.log("❌ Processing payment_intent.payment_failed");
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        console.log(`⚡ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("❌ Unexpected error in webhook handler:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

// Enhanced webhook handler
const handleCheckoutSessionCompleted = async (session) => {
  try {
    const {
      metadata,
      id,
      amount_total,
      customer,
      payment_intent,
      payment_status,
    } = session;

    console.log("💰 Checkout session completed webhook received:", {
      sessionId: id,
      moneyRequestId: metadata?.moneyRequestId,
      amount: amount_total / 100,
      paymentStatus: payment_status,
    });

    if (!metadata?.moneyRequestId) {
      console.error("❌ No moneyRequestId in metadata");
      return;
    }

    const moneyRequest = await MoneyRequest.findById(metadata.moneyRequestId)
      .populate("customer", "firstName lastName email")
      .populate("provider", "businessNameRegistered email");

    if (!moneyRequest) {
      console.error("❌ Money request not found:", metadata.moneyRequestId);
      return;
    }

    console.log("📋 Current money request status:", moneyRequest.status);

    // Only update if payment is actually paid and request is not already paid
    if (payment_status === "paid" && moneyRequest.status !== "paid") {
      console.log("🔄 Updating money request to paid status...");

      moneyRequest.status = "paid";
      moneyRequest.paymentDetails = {
        ...moneyRequest.paymentDetails,
        paidAt: new Date(),
        transactionId: id,
        paymentIntentId: payment_intent,
        stripeCustomerId: customer,
        amountReceived: amount_total / 100,
        status: "completed",
      };

      // Update status history
      if (
        moneyRequest.statusHistory &&
        Array.isArray(moneyRequest.statusHistory)
      ) {
        moneyRequest.statusHistory.push({
          status: "paid",
          timestamp: new Date(),
          note: "Payment completed via Stripe Checkout",
          changedBy: moneyRequest.customer?._id || moneyRequest.customer,
          changedByRole: "customer",
        });
      }

      await moneyRequest.save();
      console.log("✅ Money request saved with paid status");

      // Update provider's earnings
      if (moneyRequest.provider) {
        await ServiceProvider.findByIdAndUpdate(
          moneyRequest.provider._id || moneyRequest.provider,
          {
            $inc: {
              totalEarnings: moneyRequest.commission?.providerAmount || 0,
              completedRequests: 1,
            },
          }
        );
        console.log(
          `💰 Provider earnings updated: +$${
            moneyRequest.commission?.providerAmount || 0
          }`
        );
      }

      console.log(
        `✅ Payment completed and saved for money request: ${moneyRequest._id}`
      );
    } else {
      console.log(`⚠️ Not updating money request because:`, {
        paymentStatus: payment_status,
        currentMoneyRequestStatus: moneyRequest.status,
        shouldUpdate:
          payment_status === "paid" && moneyRequest.status !== "paid",
      });
    }
  } catch (error) {
    console.error("❌ Error handling checkout session completed:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
  }
};

// Enhanced test webhook endpoint
const testWebhook = async (req, res) => {
  try {
    const { moneyRequestId, eventType = "checkout.session.completed" } =
      req.body;

    console.log("🧪 Manual webhook test:", { eventType, moneyRequestId });

    if (eventType === "checkout.session.completed") {
      // Check if money request exists first
      const existingRequest = await MoneyRequest.findById(
        moneyRequestId
      ).populate("customer provider");

      if (!existingRequest) {
        return res.status(404).json({
          success: false,
          message: "Money request not found",
          data: {
            moneyRequestId,
            existing: false,
          },
        });
      }

      console.log("📋 Current money request status:", existingRequest.status);

      // Create mock session data
      const mockSession = {
        id: "test_session_" + Date.now(),
        payment_status: "paid",
        metadata: {
          moneyRequestId: moneyRequestId,
        },
        amount_total: Math.round(existingRequest.totalAmount * 100), // Convert to cents
        customer: "test_customer_" + Date.now(),
        payment_intent: "test_pi_" + Date.now(),
        object: "checkout.session",
      };

      console.log("🔄 Processing test webhook...");
      await handleCheckoutSessionCompleted(mockSession);

      // Fetch updated money request
      const updatedRequest = await MoneyRequest.findById(
        moneyRequestId
      ).populate("customer provider");

      console.log("📋 Updated money request status:", updatedRequest.status);

      res.json({
        success: true,
        message: `Test webhook '${eventType}' processed successfully`,
        data: {
          before: {
            status: existingRequest.status,
            paymentDetails: existingRequest.paymentDetails,
          },
          after: {
            status: updatedRequest.status,
            paymentDetails: updatedRequest.paymentDetails,
          },
          mockSession: {
            id: mockSession.id,
            payment_status: mockSession.payment_status,
            metadata: mockSession.metadata,
          },
          changed: existingRequest.status !== updatedRequest.status,
        },
      });
    } else {
      res.json({
        success: true,
        message: `Test event type '${eventType}' not implemented for testing`,
        data: { eventType },
      });
    }
  } catch (error) {
    console.error("Test webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Test webhook failed",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Handle successful payment intent
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    console.log("💳 Payment intent succeeded:", {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error("❌ Error handling payment intent succeeded:", error);
  }
};

// Handle failed payment
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    console.log("❌ Payment intent failed:", {
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message,
    });
  } catch (error) {
    console.error("❌ Error handling payment intent failed:", error);
  }
};

module.exports = {
  handleStripeWebhook,
  testWebhook,
  handleCheckoutSessionCompleted,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
};
