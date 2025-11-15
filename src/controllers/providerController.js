const ServiceProvider = require("../models/ServiceProvider");
const ProviderServiceFeedback = require("../models/ProviderServiceFeedback");
const Customer = require("../models/Customer");

// Update provider's bundle capacity
exports.updateProviderCapacity = async (req, res) => {
  try {
    const { maxBundleCapacity } = req.body;

    if (maxBundleCapacity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Max bundle capacity is required",
      });
    }

    if (maxBundleCapacity < 1 || maxBundleCapacity > 10) {
      return res.status(400).json({
        success: false,
        message: "Bundle capacity must be between 1 and 10 people",
      });
    }

    // Update provider's own capacity
    const provider = await ServiceProvider.findByIdAndUpdate(
      req.user._id,
      { maxBundleCapacity },
      { new: true, runValidators: true }
    ).select("-password");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    res.json({
      success: true,
      message: `Your bundle capacity updated to ${maxBundleCapacity} people successfully`,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          maxBundleCapacity: provider.maxBundleCapacity,
        },
      },
    });
  } catch (error) {
    console.error("Update provider capacity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update bundle capacity",
      error: error.message,
    });
  }
};

// Get provider's bundle capacity
exports.getProviderCapacity = async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.user._id).select(
      "maxBundleCapacity businessNameRegistered servicesProvided"
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    res.json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          maxBundleCapacity: provider.maxBundleCapacity,
          servicesProvided: provider.servicesProvided,
        },
      },
    });
  } catch (error) {
    console.error("Get provider capacity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bundle capacity",
      error: error.message,
    });
  }
};

// Public: list all services for a provider
exports.getProviderServices = async (req, res) => {
  try {
    const { providerId } = req.params;

    const provider = await ServiceProvider.findById(providerId).select(
      "businessNameRegistered servicesProvided rating totalReviews"
    );

    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    res.json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
        },
        services: provider.servicesProvided,
      },
    });
  } catch (error) {
    console.error("Get provider services error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch services", error: error.message });
  }
};

// Public: get a specific service, other services, and feedback
exports.getProviderServiceDetailWithFeedback = async (req, res) => {
  try {
    const { providerId, serviceName } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const provider = await ServiceProvider.findById(providerId).select(
      "businessNameRegistered servicesProvided rating totalReviews"
    );
    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    const selectedService = provider.servicesProvided.find((s) => s.name === serviceName);
    if (!selectedService) {
      return res.status(404).json({ success: false, message: "Service not found for this provider" });
    }

    const otherServices = provider.servicesProvided.filter((s) => s.name !== serviceName);

    // Feedback aggregation & list
    const [feedback, total, agg] = await Promise.all([
      ProviderServiceFeedback.find({ provider: providerId, serviceName })
        .populate("customer", "firstName lastName profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ProviderServiceFeedback.countDocuments({ provider: providerId, serviceName }),
      ProviderServiceFeedback.aggregate([
        { $match: { provider: new (require("mongoose").Types.ObjectId)(providerId), serviceName } },
        { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
      ]),
    ]);

    const averageRating = agg.length ? Number(agg[0].avgRating.toFixed(2)) : 0;

    res.json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
        },
        selectedService,
        otherServices,
        feedback: {
          list: feedback,
          pagination: {
            current: parseInt(page),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
          aggregates: {
            averageRating,
            totalReviews: total,
          },
        },
      },
    });
  } catch (error) {
    console.error("Get provider service details error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch service details", error: error.message });
  }
};

// Public: get provider + selected service details by query params (clean endpoint)
exports.getProviderServiceDetailsByQuery = async (req, res) => {
  try {
    const { providerId, serviceName, page = 1, limit = 10 } = req.query;

    if (!providerId || !serviceName) {
      return res.status(400).json({ success: false, message: "providerId and serviceName are required" });
    }

    // Reuse logic from the path-param handler
    req.params = { providerId, serviceName };
    req.query = { page, limit };
    return exports.getProviderServiceDetailWithFeedback(req, res);
  } catch (error) {
    console.error("Get provider service details by query error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch service details", error: error.message });
  }
};

// Authenticated customer: add feedback for a provider service
exports.addProviderServiceFeedback = async (req, res) => {
  try {
    const { providerId, serviceName } = req.params;
    const { rating, comment } = req.body;

    if (rating === undefined || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    // Validate provider and service
    const provider = await ServiceProvider.findById(providerId).select("servicesProvided");
    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }
    const hasService = provider.servicesProvided.some((s) => s.name === serviceName);
    if (!hasService) {
      return res.status(404).json({ success: false, message: "Service not found for this provider" });
    }

    // Optional: ensure customer exists
    const customer = await Customer.findById(req.user._id).select("_id");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const doc = await ProviderServiceFeedback.create({
      provider: providerId,
      customer: req.user._id,
      serviceName,
      rating,
      comment: comment || "",
    });

    await doc.populate("customer", "firstName lastName profileImage");

    res.status(201).json({ success: true, message: "Feedback submitted", data: { feedback: doc } });
  } catch (error) {
    console.error("Add provider service feedback error:", error);
    res.status(500).json({ success: false, message: "Failed to submit feedback", error: error.message });
  }
};
