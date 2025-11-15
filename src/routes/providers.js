const express = require("express");
const {
  updateProviderCapacity,
  getProviderCapacity,
  getProviderServices,
  getProviderServiceDetailWithFeedback,
  addProviderServiceFeedback,
} = require("../controllers/providerController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Provider capacity routes
router.get("/capacity", auth, authorize("provider"), getProviderCapacity);
router.put("/capacity", auth, authorize("provider"), updateProviderCapacity);

// Public service browsing
router.get("/:providerId/services", getProviderServices);
router.get("/:providerId/services/:serviceName", getProviderServiceDetailWithFeedback);
router.get("/service-details", require("../controllers/providerController").getProviderServiceDetailsByQuery);

// Customer feedback on a specific provider service
router.post(
  "/:providerId/services/:serviceName/feedback",
  auth,
  authorize("customer"),
  addProviderServiceFeedback
);

module.exports = router;
