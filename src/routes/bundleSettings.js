const express = require("express");
const {
  getBundleSettings,
  updateBundleSettings,
  updateBundleDiscount,
  updateBundleCapacity,
} = require("../controllers/bundleSettingsController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Public route to get settings
router.get("/", getBundleSettings);

// Admin routes
router.put("/update", auth, authorize("admin"), updateBundleSettings);
router.put("/update-discount", auth, authorize("admin"), updateBundleDiscount);
router.put("/update-capacity", auth, authorize("admin"), updateBundleCapacity);

module.exports = router;
