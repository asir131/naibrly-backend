const ServiceProvider = require("../models/ServiceProvider");

// Update provider's ZIP code
exports.updateProviderZipCode = async (req, res) => {
  try {
    const { zipCode } = req.body;

    if (!zipCode) {
      return res.status(400).json({
        success: false,
        message: "ZIP code is required",
      });
    }

    // Basic ZIP code validation (US format)
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(zipCode)) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid ZIP code format (e.g., 12345 or 12345-6789)",
      });
    }

    const provider = await ServiceProvider.findByIdAndUpdate(
      req.user._id,
      {
        "businessAddress.zipCode": zipCode,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    res.json({
      success: true,
      message: "ZIP code updated successfully",
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          businessAddress: provider.businessAddress,
        },
      },
    });
  } catch (error) {
    console.error("Update provider ZIP code error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update ZIP code",
      error: error.message,
    });
  }
};

// Get provider's current ZIP code
exports.getProviderZipCode = async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.user._id).select(
      "businessAddress.zipCode businessNameRegistered"
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
          zipCode: provider.businessAddress.zipCode,
        },
      },
    });
  } catch (error) {
    console.error("Get provider ZIP code error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ZIP code",
      error: error.message,
    });
  }
};
