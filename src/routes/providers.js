const express = require("express");
const {
  updateProviderCapacity,
  getProviderCapacity,
  getProviderServices,
  getMyServices,
  getProviderServiceDetailWithFeedback,
  getMyServiceDetail,
  addProviderServiceFeedback,
  getProviderServiceDetailsByQuery,
  // Service Areas exports
  getProviderServiceAreas,
  getMyServiceAreas,
  addServiceArea,
  updateServiceArea,
  removeServiceArea,
  getProvidersByServiceArea,
} = require("../controllers/providerController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Provider capacity routes
router.get("/capacity", auth, authorize("provider"), getProviderCapacity);
router.put("/capacity", auth, authorize("provider"), updateProviderCapacity);

// Service routes - Public (using providerId)
router.get("/:providerId/services", getProviderServices);
router.get(
  "/:providerId/services/:serviceName",
  getProviderServiceDetailWithFeedback
);

// Service routes - Authenticated Provider (using bearer token)
router.get("/services/my-services", auth, authorize("provider"), getMyServices);
router.get(
  "/services/my-services/:serviceName",
  auth,
  authorize("provider"),
  getMyServiceDetail
);

// Public query endpoint
router.get("/service-details", getProviderServiceDetailsByQuery);

// Customer feedback on a specific provider service
router.post(
  "/:providerId/services/:serviceName/feedback",
  auth,
  authorize("customer"),
  addProviderServiceFeedback
);

// ========== SERVICE AREAS ROUTES ========== //

// Public routes for service areas (using providerId)
router.get("/:providerId/service-areas", getProviderServiceAreas);
router.get("/service-areas/zip-code/:zipCode", getProvidersByServiceArea);

// Protected provider routes for service areas management (using bearer token)
router.get(
  "/service-areas/my-areas",
  auth,
  authorize("provider"),
  getMyServiceAreas
);
router.post("/service-areas/add", auth, authorize("provider"), addServiceArea);
router.patch(
  "/service-areas/:areaId",
  auth,
  authorize("provider"),
  updateServiceArea
);
router.delete(
  "/service-areas/:areaId",
  auth,
  authorize("provider"),
  removeServiceArea
);

module.exports = router;
