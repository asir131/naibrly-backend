const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const MoneyRequest = require("../models/MoneyRequest");
const ServiceRequest = require("../models/ServiceRequest");
const Bundle = require("../models/Bundle");
const ServiceProvider = require("../models/ServiceProvider");
const Customer = require("../models/Customer");
const {
  calculateServiceCommission,
  calculateBundleCommission,
} = require("./commissionController");

// Create money request for completed service or bundle
const createMoneyRequest = async (req, res) => {
  try {
    const { serviceRequestId, bundleId, amount, description, dueDate } =
      req.body;
    const providerId = req.user._id;

    console.log("Creating money request with data:", {
      serviceRequestId,
      bundleId,
      amount,
      providerId,
    });

    // Validate input
    if ((!serviceRequestId && !bundleId) || !amount) {
      return res.status(400).json({
        success: false,
        message: "Either serviceRequestId or bundleId and amount are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    let serviceRequest, bundle, customerId;

    // Check if it's a service request
    if (serviceRequestId) {
      serviceRequest = await ServiceRequest.findOne({
        _id: serviceRequestId,
        provider: providerId,
        status: "completed",
      }).populate("customer");

      if (!serviceRequest) {
        return res.status(404).json({
          success: false,
          message:
            "Completed service request not found or you are not the provider",
        });
      }

      customerId = serviceRequest.customer._id;

      // Check if money request already exists for this service
      const existingRequest = await MoneyRequest.findOne({
        serviceRequest: serviceRequestId,
        status: { $in: ["pending", "accepted", "paid"] },
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: "Money request already exists for this service",
        });
      }
    }

    // Check if it's a bundle
    if (bundleId) {
      bundle = await Bundle.findOne({
        _id: bundleId,
        provider: providerId,
        status: "completed",
      }).populate("creator");

      if (!bundle) {
        return res.status(404).json({
          success: false,
          message: "Completed bundle not found or you are not the provider",
        });
      }

      customerId = bundle.creator._id;

      // Check if money request already exists for this bundle
      const existingRequest = await MoneyRequest.findOne({
        bundle: bundleId,
        status: { $in: ["pending", "accepted", "paid"] },
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: "Money request already exists for this bundle",
        });
      }
    }

    // Calculate commission based on service or bundle
    let commission;
    if (serviceRequest) {
      commission = await calculateServiceCommission(amount);
    } else if (bundle) {
      commission = await calculateBundleCommission(amount);
    }

    console.log("Commission calculated:", commission);

    // Create money request
    const moneyRequest = new MoneyRequest({
      serviceRequest: serviceRequestId,
      bundle: bundleId,
      provider: providerId,
      customer: customerId,
      amount: amount,
      totalAmount: amount,
      description:
        description || `Payment for ${serviceRequest ? "service" : "bundle"}`,
      dueDate: dueDate
        ? new Date(dueDate)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      commission: {
        rate: commission.commissionRate,
        amount: commission.commissionAmount,
        providerAmount: commission.providerAmount,
      },
    });

    // Set status change info
    moneyRequest._statusChangedBy = providerId;
    moneyRequest._statusChangedByRole = "provider";

    console.log("Saving money request to database...");

    const savedRequest = await moneyRequest.save();
    console.log("Money request saved successfully:", savedRequest._id);

    await savedRequest.populate([
      { path: "customer", select: "firstName lastName email phone" },
      { path: "provider", select: "businessNameRegistered email phone" },
      { path: "serviceRequest", select: "serviceType scheduledDate" },
      { path: "bundle", select: "title category" },
    ]);

    res.status(201).json({
      success: true,
      message: "Money request created successfully",
      data: {
        moneyRequest: savedRequest,
      },
    });
  } catch (error) {
    console.error("Create money request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create money request",
      error: error.message,
    });
  }
};

// Customer accepts money request and adds tip
const acceptMoneyRequest = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;
    const { tipAmount } = req.body;
    const customerId = req.user._id;

    console.log("Accepting money request:", {
      moneyRequestId,
      tipAmount,
      customerId,
    });

    const moneyRequest = await MoneyRequest.findOne({
      _id: moneyRequestId,
      customer: customerId,
      status: "pending",
    });

    if (!moneyRequest) {
      return res.status(404).json({
        success: false,
        message: "Pending money request not found or you are not the customer",
      });
    }

    if (tipAmount && tipAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Tip amount cannot be negative",
      });
    }

    moneyRequest.tipAmount = tipAmount || 0;
    moneyRequest.totalAmount = moneyRequest.amount + moneyRequest.tipAmount;
    moneyRequest.status = "accepted";

    const commission = await calculateServiceCommission(
      moneyRequest.totalAmount
    );
    moneyRequest.commission.amount = commission.commissionAmount;
    moneyRequest.commission.providerAmount = commission.providerAmount;

    moneyRequest._statusChangedBy = customerId;
    moneyRequest._statusChangedByRole = "customer";

    console.log("Saving accepted money request...");
    await moneyRequest.save();

    await moneyRequest.populate([
      { path: "customer", select: "firstName lastName email" },
      { path: "provider", select: "businessNameRegistered email" },
    ]);

    res.json({
      success: true,
      message:
        "Money request accepted successfully" + (tipAmount ? " with tip" : ""),
      data: {
        moneyRequest,
      },
    });
  } catch (error) {
    console.error("Accept money request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept money request",
      error: error.message,
    });
  }
};

// Customer cancels money request
const cancelMoneyRequest = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;
    const customerId = req.user._id;

    console.log("Cancelling money request:", { moneyRequestId, customerId });

    const moneyRequest = await MoneyRequest.findOne({
      _id: moneyRequestId,
      customer: customerId,
      status: "pending",
    });

    if (!moneyRequest) {
      return res.status(404).json({
        success: false,
        message: "Pending money request not found or you are not the customer",
      });
    }

    // Ensure required fields are set
    moneyRequest.status = "cancelled";
    moneyRequest.totalAmount =
      moneyRequest.amount + (moneyRequest.tipAmount || 0);
    moneyRequest._statusChangedBy = customerId;
    moneyRequest._statusChangedByRole = "customer";

    console.log("Saving cancelled money request...");
    await moneyRequest.save();

    res.json({
      success: true,
      message: "Money request cancelled successfully",
      data: {
        moneyRequest,
      },
    });
  } catch (error) {
    console.error("Cancel money request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel money request",
      error: error.message,
    });
  }
};

// Get money requests for provider
const getProviderMoneyRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const providerId = req.user._id;

    const filter = { provider: providerId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [moneyRequests, total] = await Promise.all([
      MoneyRequest.find(filter)
        .populate("customer", "firstName lastName email phone profileImage")
        .populate("serviceRequest", "serviceType scheduledDate")
        .populate("bundle", "title category finalPrice")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MoneyRequest.countDocuments(filter),
    ]);

    console.log(
      `Found ${moneyRequests.length} money requests for provider ${providerId}`
    );

    res.json({
      success: true,
      data: {
        moneyRequests,
        pagination: {
          current: parseInt(page),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get provider money requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch money requests",
      error: error.message,
    });
  }
};

// Get money requests for customer
const getCustomerMoneyRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const customerId = req.user._id;

    const filter = { customer: customerId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [moneyRequests, total] = await Promise.all([
      MoneyRequest.find(filter)
        .populate("provider", "businessNameRegistered businessLogo email phone")
        .populate("serviceRequest", "serviceType scheduledDate")
        .populate("bundle", "title category finalPrice")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MoneyRequest.countDocuments(filter),
    ]);

    console.log(
      `Found ${moneyRequests.length} money requests for customer ${customerId}`
    );

    res.json({
      success: true,
      data: {
        moneyRequests,
        pagination: {
          current: parseInt(page),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get customer money requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch money requests",
      error: error.message,
    });
  }
};

// Get single money request details
const getMoneyRequest = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;

    const moneyRequest = await MoneyRequest.findById(moneyRequestId)
      .populate(
        "customer",
        "firstName lastName email phone profileImage address"
      )
      .populate(
        "provider",
        "businessNameRegistered businessLogo email phone businessAddress"
      )
      .populate("serviceRequest", "serviceType scheduledDate problem note")
      .populate("bundle", "title description category services finalPrice");

    if (!moneyRequest) {
      return res.status(404).json({
        success: false,
        message: "Money request not found",
      });
    }

    const isAuthorized =
      req.user._id.toString() === moneyRequest.provider._id.toString() ||
      req.user._id.toString() === moneyRequest.customer._id.toString() ||
      req.user.role === "admin";

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this money request",
      });
    }

    res.json({
      success: true,
      data: {
        moneyRequest,
      },
    });
  } catch (error) {
    console.error("Get money request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch money request",
      error: error.message,
    });
  }
};

// In your moneyRequestController.js - processPayment function
const processPayment = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;
    const customerId = req.user._id;

    console.log("Creating Stripe Checkout session for money request:", {
      moneyRequestId,
      customerId,
    });

    const moneyRequest = await MoneyRequest.findOne({
      _id: moneyRequestId,
      customer: customerId,
      status: "accepted",
    }).populate("customer provider");

    if (!moneyRequest) {
      return res.status(404).json({
        success: false,
        message: "Accepted money request not found or you are not the customer",
      });
    }

    // Create Stripe Checkout Session with backend success URL
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Payment for ${moneyRequest.description || "Service"}`,
              description: `Payment request from ${moneyRequest.provider.businessNameRegistered}`,
            },
            unit_amount: Math.round(moneyRequest.totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Redirect to backend endpoint instead of frontend
      success_url: `${
        process.env.CLIENT_URL || "http://localhost:5000"
      }/api/money-requests/${moneyRequestId}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.CLIENT_URL || "http://localhost:5000"
      }/api/money-requests/${moneyRequestId}/payment-canceled`,
      customer_email: moneyRequest.customer.email,
      metadata: {
        moneyRequestId: moneyRequestId.toString(),
        customerId: customerId.toString(),
        providerId: moneyRequest.provider._id.toString(),
      },
    });

    // Save session ID to money request
    moneyRequest.paymentDetails = {
      checkoutSessionId: session.id,
      sessionCreatedAt: new Date(),
      status: "checkout_pending",
    };
    await moneyRequest.save();

    console.log("Stripe Checkout session created:", session.id);

    res.json({
      success: true,
      message: "Stripe Checkout session created successfully",
      data: {
        sessionId: session.id,
        sessionUrl: session.url,
        checkoutUrl: session.url, // This is what the user should click
        moneyRequest: {
          id: moneyRequest._id,
          amount: moneyRequest.totalAmount,
          description: moneyRequest.description,
        },
        instructions: "Click the checkoutUrl to complete payment",
      },
    });
  } catch (error) {
    console.error("Stripe Checkout error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment session",
      error: error.message,
    });
  }
};

// Handle successful payment redirect
const handlePaymentSuccess = async (req, res) => {
  try {
    const { session_id, money_request_id } = req.query;
    const customerId = req.user._id;

    console.log("Payment success callback:", { session_id, money_request_id });

    // Verify the session and payment
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === "paid") {
      const moneyRequest = await MoneyRequest.findOne({
        _id: money_request_id,
        customer: customerId,
      });

      if (moneyRequest) {
        res.json({
          success: true,
          message: "Payment completed successfully!",
          data: {
            moneyRequest: {
              id: moneyRequest._id,
              status: moneyRequest.status,
              amount: moneyRequest.totalAmount,
            },
            session: {
              id: session.id,
              paymentStatus: session.payment_status,
            },
          },
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Money request not found",
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }
  } catch (error) {
    console.error("Payment success handler error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message,
    });
  }
};

// Handle canceled payment
const handlePaymentCancel = async (req, res) => {
  try {
    const { money_request_id } = req.query;
    const customerId = req.user._id;

    console.log("Payment canceled for money request:", money_request_id);

    // Update money request status
    await MoneyRequest.findOneAndUpdate(
      { _id: money_request_id, customer: customerId },
      {
        "paymentDetails.status": "checkout_canceled",
        "paymentDetails.canceledAt": new Date(),
      }
    );

    res.json({
      success: true,
      message: "Payment canceled",
      data: {
        moneyRequestId: money_request_id,
        status: "canceled",
      },
    });
  } catch (error) {
    console.error("Payment cancel handler error:", error);
    res.status(500).json({
      success: false,
      message: "Error handling payment cancellation",
      error: error.message,
    });
  }
};

// Complete payment after 3D Secure authentication
const completePayment = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;
    const customerId = req.user._id;

    const moneyRequest = await MoneyRequest.findOne({
      _id: moneyRequestId,
      customer: customerId,
      status: "accepted",
    });

    if (!moneyRequest) {
      return res.status(404).json({
        success: false,
        message: "Money request not found",
      });
    }

    res.json({
      success: true,
      message: "Payment completion endpoint - implement Stripe webhook here",
      data: {
        moneyRequestId,
      },
    });
  } catch (error) {
    console.error("Complete payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete payment",
      error: error.message,
    });
  }
};

// Raise dispute
const raiseDispute = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!["customer", "provider"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only customers or providers can raise disputes",
      });
    }

    const moneyRequest = await MoneyRequest.findOne({
      _id: moneyRequestId,
      [userRole]: userId,
      status: { $in: ["pending", "accepted"] },
    });

    if (!moneyRequest) {
      return res.status(404).json({
        success: false,
        message: "Money request not found or access denied",
      });
    }

    moneyRequest.status = "disputed";
    moneyRequest.disputeDetails = {
      reason: reason,
      raisedBy: userRole,
      description: description,
    };
    moneyRequest._statusChangedBy = userId;
    moneyRequest._statusChangedByRole = userRole;

    await moneyRequest.save();

    res.json({
      success: true,
      message: "Dispute raised successfully",
      data: {
        moneyRequest,
      },
    });
  } catch (error) {
    console.error("Raise dispute error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to raise dispute",
      error: error.message,
    });
  }
};

// Resolve dispute
const resolveDispute = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;
    const { resolution, finalAmount, status } = req.body;

    const moneyRequest = await MoneyRequest.findOne({
      _id: moneyRequestId,
      status: "disputed",
    });

    if (!moneyRequest) {
      return res.status(404).json({
        success: false,
        message: "Disputed money request not found",
      });
    }

    moneyRequest.status = status;

    if (finalAmount && finalAmount > 0) {
      moneyRequest.amount = finalAmount;
      moneyRequest.totalAmount = finalAmount + (moneyRequest.tipAmount || 0);
      const commission = await calculateServiceCommission(
        moneyRequest.totalAmount
      );
      moneyRequest.commission.amount = commission.commissionAmount;
      moneyRequest.commission.providerAmount = commission.providerAmount;
    }

    moneyRequest.disputeDetails.resolvedAt = new Date();
    moneyRequest.disputeDetails.resolution = resolution;
    moneyRequest._statusChangedBy = req.user._id;
    moneyRequest._statusChangedByRole = "admin";

    await moneyRequest.save();

    await moneyRequest.populate([
      { path: "customer", select: "firstName lastName email" },
      { path: "provider", select: "businessNameRegistered email" },
    ]);

    res.json({
      success: true,
      message: "Dispute resolved successfully",
      data: {
        moneyRequest,
      },
    });
  } catch (error) {
    console.error("Resolve dispute error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resolve dispute",
      error: error.message,
    });
  }
};

// Get money request statistics
const getMoneyRequestStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const filter =
      userRole === "provider" ? { provider: userId } : { customer: userId };

    const stats = await MoneyRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalStats = await MoneyRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const formattedStats = {
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
        };
        return acc;
      }, {}),
      totals: totalStats[0] || {
        totalRequests: 0,
        totalAmount: 0,
      },
    };

    res.json({
      success: true,
      data: {
        stats: formattedStats,
        userRole,
      },
    });
  } catch (error) {
    console.error("Get money request stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch money request statistics",
      error: error.message,
    });
  }
};

// Test payment endpoint
const testPaymentWebhook = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;

    // Simulate webhook call
    const mockSession = {
      id: "test_session_" + Date.now(),
      payment_status: "paid",
      metadata: {
        moneyRequestId: moneyRequestId,
      },
      amount_total: 15000,
      customer: "test_customer_123",
      payment_intent: "test_pi_" + Date.now(),
    };

    await handleCheckoutSessionCompleted(mockSession);

    res.json({
      success: true,
      message: "Test webhook processed successfully",
      moneyRequestId: moneyRequestId,
    });
  } catch (error) {
    console.error("Test webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Test webhook failed",
      error: error.message,
    });
  }
};
// Add this to your moneyRequestController.js
const checkPaymentStatus = async (req, res) => {
  try {
    const { moneyRequestId } = req.params;

    const moneyRequest = await MoneyRequest.findById(moneyRequestId)
      .populate("customer", "firstName lastName email")
      .populate("provider", "businessNameRegistered email");

    if (!moneyRequest) {
      return res.status(404).json({
        success: false,
        message: "Money request not found",
      });
    }

    res.json({
      success: true,
      data: {
        moneyRequest: {
          id: moneyRequest._id,
          status: moneyRequest.status,
          amount: moneyRequest.totalAmount,
          paymentDetails: moneyRequest.paymentDetails,
          customer: moneyRequest.customer,
          provider: moneyRequest.provider,
        },
      },
    });
  } catch (error) {
    console.error("Check payment status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.message,
    });
  }
};

// Export all functions
module.exports = {
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
};
