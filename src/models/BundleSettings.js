const mongoose = require("mongoose");

const bundleSettingsSchema = new mongoose.Schema(
  {
    // Bundle capacity set by admin
    maxParticipants: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
    // Bundle discount set by admin
    bundleDiscount: {
      type: Number,
      default: 5,
      min: 0,
      max: 50,
    },
    bundleExpiryHours: {
      type: Number,
      default: 24,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("BundleSettings", bundleSettingsSchema);
