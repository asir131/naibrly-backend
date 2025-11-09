const BundleSettings = require("../models/BundleSettings");

// Get bundle settings
exports.getBundleSettings = async (req, res) => {
  try {
    const settings = await BundleSettings.findOne();

    res.json({
      success: true,
      data: { settings },
    });
  } catch (error) {
    console.error("Get bundle settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bundle settings",
      error: error.message,
    });
  }
};

// Update bundle discount (Admin only)
exports.updateBundleDiscount = async (req, res) => {
  try {
    const { bundleDiscount } = req.body;

    if (bundleDiscount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Bundle discount is required",
      });
    }

    if (bundleDiscount < 0 || bundleDiscount > 50) {
      return res.status(400).json({
        success: false,
        message: "Bundle discount must be between 0% and 50%",
      });
    }

    let settings = await BundleSettings.findOne();

    if (!settings) {
      settings = new BundleSettings();
    }

    settings.bundleDiscount = bundleDiscount;
    settings.updatedBy = req.user._id;

    await settings.save();

    res.json({
      success: true,
      message: `Bundle discount updated to ${bundleDiscount}% successfully`,
      data: { settings },
    });
  } catch (error) {
    console.error("Update bundle discount error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update bundle discount",
      error: error.message,
    });
  }
};

// Update bundle capacity (Admin only)
exports.updateBundleCapacity = async (req, res) => {
  try {
    const { maxParticipants } = req.body;

    if (maxParticipants === undefined) {
      return res.status(400).json({
        success: false,
        message: "Max participants is required",
      });
    }

    if (maxParticipants < 2 || maxParticipants > 10) {
      return res.status(400).json({
        success: false,
        message: "Max participants must be between 2 and 10",
      });
    }

    let settings = await BundleSettings.findOne();

    if (!settings) {
      settings = new BundleSettings();
    }

    settings.maxParticipants = maxParticipants;
    settings.updatedBy = req.user._id;

    await settings.save();

    res.json({
      success: true,
      message: `Bundle capacity updated to ${maxParticipants} participants successfully`,
      data: { settings },
    });
  } catch (error) {
    console.error("Update bundle capacity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update bundle capacity",
      error: error.message,
    });
  }
};

// Update all bundle settings (Admin only)
exports.updateBundleSettings = async (req, res) => {
  try {
    const { maxParticipants, bundleDiscount, bundleExpiryHours } = req.body;

    let settings = await BundleSettings.findOne();

    if (!settings) {
      settings = new BundleSettings();
    }

    // Validate maxParticipants
    if (maxParticipants !== undefined) {
      if (maxParticipants < 2 || maxParticipants > 10) {
        return res.status(400).json({
          success: false,
          message: "Max participants must be between 2 and 10",
        });
      }
      settings.maxParticipants = maxParticipants;
    }

    // Validate bundleDiscount
    if (bundleDiscount !== undefined) {
      if (bundleDiscount < 0 || bundleDiscount > 50) {
        return res.status(400).json({
          success: false,
          message: "Bundle discount must be between 0% and 50%",
        });
      }
      settings.bundleDiscount = bundleDiscount;
    }

    if (bundleExpiryHours !== undefined) {
      settings.bundleExpiryHours = bundleExpiryHours;
    }

    settings.updatedBy = req.user._id;

    await settings.save();

    res.json({
      success: true,
      message: "Bundle settings updated successfully",
      data: { settings },
    });
  } catch (error) {
    console.error("Update bundle settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update bundle settings",
      error: error.message,
    });
  }
};
