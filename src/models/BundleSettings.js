const mongoose = require("mongoose");

const bundleSettingsSchema = new mongoose.Schema(
  {
    bundleDiscount: {
      type: Number,
      default: 5,
      min: 0,
      max: 50,
      required: true,
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
