const express = require("express");
const { auth } = require("../middleware/auth");
const { adminAuth } = require("../middleware/adminAuth");
const { uploadInsuranceDocument } = require("../config/cloudinary");
const {
  submitVerification,
  getVerificationStatus,
  getAllVerifications,
  reviewVerification,
  deleteVerification,
} = require("../controllers/verificationController");

const router = express.Router();

// Provider routes
router.post(
  "/submit",
  auth,
  uploadInsuranceDocument.single("insuranceDocument"),
  submitVerification
);

router.get("/status", auth, getVerificationStatus);
router.delete("/delete", auth, deleteVerification);

// Admin routes
router.get("/admin/all", adminAuth, getAllVerifications);
router.patch("/admin/:verificationId/review", adminAuth, reviewVerification);

module.exports = router;
