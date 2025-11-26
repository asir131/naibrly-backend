const WithdrawalRequest = require("../models/WithdrawalRequest");
const ServiceProvider = require("../models/ServiceProvider");

// Provider: create withdrawal request
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const providerId = req.user._id;
    const { amount, notes } = req.body;

    if (amount === undefined || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    if (provider.availableBalance < Number(amount)) {
      return res.status(400).json({
        success: false,
        message: "Insufficient available balance",
        data: { availableBalance: provider.availableBalance },
      });
    }

    // Move funds from available to pending
    provider.availableBalance -= Number(amount);
    provider.pendingPayout += Number(amount);
    await provider.save();

    const withdrawal = await WithdrawalRequest.create({
      provider: providerId,
      amount: Number(amount),
      status: "pending",
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request created",
      data: {
        withdrawal,
        balances: {
          availableBalance: provider.availableBalance,
          pendingPayout: provider.pendingPayout,
        },
      },
    });
  } catch (error) {
    console.error("Create withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create withdrawal",
      error: error.message,
    });
  }
};

// Provider: list own withdrawals
exports.getMyWithdrawals = async (req, res) => {
  try {
    const providerId = req.user._id;
    const withdrawals = await WithdrawalRequest.find({ provider: providerId })
      .sort({ createdAt: -1 })
      .lean();

    const provider = await ServiceProvider.findById(providerId).select(
      "availableBalance pendingPayout totalEarnings"
    );

    res.json({
      success: true,
      data: {
        withdrawals,
        balances: {
          availableBalance: provider?.availableBalance || 0,
          pendingPayout: provider?.pendingPayout || 0,
          totalEarnings: provider?.totalEarnings || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get provider withdrawals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawals",
      error: error.message,
    });
  }
};

// Admin: list all withdrawals
exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await WithdrawalRequest.find()
      .populate("provider", "businessNameRegistered email availableBalance pendingPayout")
      .populate("processedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: { withdrawals, total: withdrawals.length },
    });
  } catch (error) {
    console.error("Get all withdrawals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawals",
      error: error.message,
    });
  }
};

// Admin: approve withdrawal (mark paid)
exports.approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { payoutReference, notes } = req.body || {};
    const adminId = req.user._id;

    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: "Withdrawal not found" });
    }
    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending withdrawals can be approved",
      });
    }

    const provider = await ServiceProvider.findById(withdrawal.provider);
    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    // Move from pendingPayout to paid (deduct pending)
    provider.pendingPayout = Math.max(
      0,
      provider.pendingPayout - withdrawal.amount
    );
    await provider.save();

    withdrawal.status = "paid";
    withdrawal.processedBy = adminId;
    withdrawal.processedAt = new Date();
    withdrawal.payoutReference = payoutReference;
    if (notes) withdrawal.notes = notes;
    await withdrawal.save();

    res.json({
      success: true,
      message: "Withdrawal approved and marked as paid",
      data: {
        withdrawal,
        balances: {
          availableBalance: provider.availableBalance,
          pendingPayout: provider.pendingPayout,
        },
      },
    });
  } catch (error) {
    console.error("Approve withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve withdrawal",
      error: error.message,
    });
  }
};

// Admin: reject withdrawal (refund to available balance)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { notes } = req.body || {};
    const adminId = req.user._id;

    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: "Withdrawal not found" });
    }
    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending withdrawals can be rejected",
      });
    }

    const provider = await ServiceProvider.findById(withdrawal.provider);
    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    // Refund pending amount back to available
    provider.pendingPayout = Math.max(
      0,
      provider.pendingPayout - withdrawal.amount
    );
    provider.availableBalance += withdrawal.amount;
    await provider.save();

    withdrawal.status = "rejected";
    withdrawal.processedBy = adminId;
    withdrawal.processedAt = new Date();
    if (notes) withdrawal.notes = notes;
    await withdrawal.save();

    res.json({
      success: true,
      message: "Withdrawal rejected and amount returned to available balance",
      data: {
        withdrawal,
        balances: {
          availableBalance: provider.availableBalance,
          pendingPayout: provider.pendingPayout,
        },
      },
    });
  } catch (error) {
    console.error("Reject withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject withdrawal",
      error: error.message,
    });
  }
};
