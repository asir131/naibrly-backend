const express = require("express");
const {
  updateProviderZipCode,
  getProviderZipCode,
} = require("../controllers/zipController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Provider ZIP code routes
router.get("/provider/zip", auth, authorize("provider"), getProviderZipCode);
router.put("/provider/zip", auth, authorize("provider"), updateProviderZipCode);

module.exports = router;
