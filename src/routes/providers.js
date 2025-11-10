const express = require("express");
const {
  updateProviderCapacity,
  getProviderCapacity,
} = require("../controllers/providerController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Provider capacity routes
router.get("/capacity", auth, authorize("provider"), getProviderCapacity);
router.put("/capacity", auth, authorize("provider"), updateProviderCapacity);

module.exports = router;
