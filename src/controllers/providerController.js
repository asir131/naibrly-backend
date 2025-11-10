const ServiceProvider = require("../models/ServiceProvider");

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
