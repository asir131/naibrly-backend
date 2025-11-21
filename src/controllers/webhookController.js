const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const MoneyRequest = require("../models/MoneyRequest");
const ServiceProvider = require("../models/ServiceProvider");

// Webhook endpoint for Stripe
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("✅ Webhook received:", event.type);

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(event.data.object);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
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

    // Only update if payment is actually paid
    if (payment_status === "paid") {
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
      moneyRequest.statusHistory.push({
        status: "paid",
        timestamp: new Date(),
        note: "Payment completed via Stripe",
        changedBy: moneyRequest.customer._id,
        changedByRole: "customer",
      });

      await moneyRequest.save();

      // Update provider's earnings
      await ServiceProvider.findByIdAndUpdate(moneyRequest.provider._id, {
        $inc: {
          totalEarnings: moneyRequest.commission.providerAmount,
          completedRequests: 1,
        },
      });

      console.log(
        `✅ Payment completed and saved for money request: ${moneyRequest._id}`
      );

      // Send notifications (you can implement this later)
      // await sendPaymentNotification(moneyRequest);
    } else {
      console.log(
        `⚠️ Payment status is ${payment_status}, not updating money request`
      );
    }
  } catch (error) {
    console.error("❌ Error handling checkout session completed:", error);
    // Don't throw error in webhook to avoid Stripe retries for non-critical errors
  }
};

// Add this to your webhook controller for testing
const testWebhook = async (req, res) => {
  try {
    // Simulate a webhook event
    const testEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "test_session_" + Date.now(),
          payment_status: "paid",
          metadata: {
            moneyRequestId: "6920d6e410c1e6e94a2e9090",
          },
          amount_total: 15000,
          customer: "test_customer",
          payment_intent: "test_pi_" + Date.now(),
        },
      },
    };

    await handleCheckoutSessionCompleted(testEvent.data.object);

    res.json({
      success: true,
      message: "Webhook test completed",
      testEvent: testEvent,
    });
  } catch (error) {
    console.error("Webhook test error:", error);
    res.status(500).json({
      success: false,
      message: "Webhook test failed",
      error: error.message,
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
};
