const express = require("express");
const {
  createBundle,
  joinBundle,
  getProviderAvailableBundles,
  getCustomerBundles,
  getBundleDetails,
  providerAcceptBundle,
  providerDeclineBundle,
  getProviderAcceptedBundles,
  getBundlesInCustomerArea,
  joinBundleViaShareToken,
} = require("../controllers/bundleController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Customer routes
router.post("/create", auth, createBundle);
router.post("/:bundleId/join", auth, joinBundle);
router.post("/share/:shareToken/join", auth, joinBundleViaShareToken);
router.get("/customer/my-bundles", auth, getCustomerBundles);
router.get("/customer/nearby", auth, getBundlesInCustomerArea);
router.get("/:bundleId", auth, getBundleDetails);

// Provider routes
router.get(
  "/provider/available",
  auth,
  authorize("provider"),
  getProviderAvailableBundles
);
router.get(
  "/provider/accepted",
  auth,
  authorize("provider"),
  getProviderAcceptedBundles
);
router.post(
  "/:bundleId/provider/accept",
  auth,
  authorize("provider"),
  providerAcceptBundle
);
router.post(
  "/:bundleId/provider/decline",
  auth,
  authorize("provider"),
  providerDeclineBundle
);

module.exports = router;
