const Verification = require("../models/Verification");
const ServiceProvider = require("../models/ServiceProvider");
const { cloudinary } = require("../config/cloudinary");

exports.submitVerification = async (req, res) => {
  try {
    console.log("🔄 Starting verification submission...");
    console.log("📦 Request body:", req.body);
    console.log("📁 Request files:", req.files);

    const { einNumber, firstName, lastName, businessRegisteredCountry } =
      req.body;

    // Validation - check all required fields
    if (!einNumber || !firstName || !lastName || !businessRegisteredCountry) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        message: "EIN Number, first name, last name, and country are required",
        missingFields: {
          einNumber: !einNumber,
          firstName: !firstName,
          lastName: !lastName,
          businessRegisteredCountry: !businessRegisteredCountry,
        },
      });
    }

    // Check if files are uploaded
    if (!req.files) {
      console.log("❌ No files uploaded");
      return res.status(400).json({
        success: false,
        message:
          "All documents are required: insurance document, ID card front, and ID card back",
      });
    }

    const insuranceDocument = req.files["insuranceDocument"]?.[0];
    const idCardFront = req.files["idCardFront"]?.[0];
    const idCardBack = req.files["idCardBack"]?.[0];

    console.log("📄 File details:", {
      insurance: insuranceDocument?.originalname,
      idFront: idCardFront?.originalname,
      idBack: idCardBack?.originalname,
    });

    if (!insuranceDocument || !idCardFront || !idCardBack) {
      console.log("❌ Missing required files");
      return res.status(400).json({
        success: false,
        message:
          "All documents are required: insurance document, ID card front, and ID card back",
        missing: {
          insuranceDocument: !insuranceDocument,
          idCardFront: !idCardFront,
          idCardBack: !idCardBack,
        },
      });
    }

    // Check if provider exists
    const provider = await ServiceProvider.findById(req.user._id);
    if (!provider) {
      console.log("❌ Provider not found:", req.user._id);
      return res.status(404).json({
        success: false,
        message: "Service provider not found",
      });
    }

    console.log("✅ Provider found:", provider.businessNameRegistered);

    // Check if provider is approved
    if (!provider.isApproved && provider.approvalStatus !== "approved") {
      console.log("❌ Provider not approved");
      return res.status(400).json({
        success: false,
        message:
          "Your provider account needs to be approved first before submitting verification",
      });
    }

    // Check if verification already exists and is pending
    const existingVerification = await Verification.findOne({
      provider: req.user._id,
      status: "pending",
    });

    if (existingVerification) {
      console.log("❌ Pending verification already exists");
      return res.status(400).json({
        success: false,
        message: "You already have a pending verification request",
      });
    }

    console.log("✅ Creating new verification record...");

    // Create verification record with all documents
    const verification = new Verification({
      provider: req.user._id,
      einNumber,
      firstName,
      lastName,
      businessRegisteredCountry,
      insuranceDocument: {
        url: insuranceDocument.path,
        publicId: insuranceDocument.filename,
      },
      idCardFront: {
        url: idCardFront.path,
        publicId: idCardFront.filename,
      },
      idCardBack: {
        url: idCardBack.path,
        publicId: idCardBack.filename,
      },
    });

    console.log("💾 Saving verification to database...");
    await verification.save();
    console.log("✅ Verification saved:", verification._id);

    // Update provider verification status
    provider.isVerified = false;
    await provider.save();
    console.log("✅ Provider verification status updated");

    res.status(201).json({
      success: true,
      message:
        "Verification information submitted successfully with all documents",
      data: {
        verification: {
          id: verification._id,
          einNumber: verification.einNumber,
          firstName: verification.firstName,
          lastName: verification.lastName,
          businessRegisteredCountry: verification.businessRegisteredCountry,
          status: verification.status,
          submittedAt: verification.submittedAt,
          insuranceDocument: verification.insuranceDocument,
          idCardFront: verification.idCardFront,
          idCardBack: verification.idCardBack,
        },
      },
    });
  } catch (error) {
    console.error("❌ Submit verification error:", error);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
    });

    // Delete all uploaded files if verification fails
    if (req.files) {
      console.log("🗑️ Cleaning up uploaded files due to error...");
      const filesToDelete = [];

      if (req.files["insuranceDocument"]?.[0]?.filename) {
        filesToDelete.push(req.files["insuranceDocument"][0].filename);
      }
      if (req.files["idCardFront"]?.[0]?.filename) {
        filesToDelete.push(req.files["idCardFront"][0].filename);
      }
      if (req.files["idCardBack"]?.[0]?.filename) {
        filesToDelete.push(req.files["idCardBack"][0].filename);
      }

      for (const publicId of filesToDelete) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`✅ Deleted uploaded file: ${publicId}`);
        } catch (deleteError) {
          console.error(`❌ Error deleting file ${publicId}:`, deleteError);
        }
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to submit verification information",
      error:
        process.env.NODE_ENV === "development"
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : "Internal server error",
    });
  }
};

// Get verification status for provider
exports.getVerificationStatus = async (req, res) => {
  try {
    const verification = await Verification.findOne({
      provider: req.user._id,
    }).sort({ createdAt: -1 }); // Get latest verification

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "No verification information found",
      });
    }

    res.json({
      success: true,
      data: {
        verification,
      },
    });
  } catch (error) {
    console.error("Get verification status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get verification status",
      error: error.message,
    });
  }
};

// Admin: Get all verification requests
exports.getAllVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;

    const verifications = await Verification.find(filter)
      .populate(
        "provider",
        "firstName lastName email businessNameRegistered profileImage"
      )
      .populate("reviewedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Verification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        verifications,
        pagination: {
          current: parseInt(page),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get all verifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification requests",
      error: error.message,
    });
  }
};

// Admin: Approve/Reject verification
exports.reviewVerification = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected"',
      });
    }

    const verification = await Verification.findById(verificationId).populate(
      "provider"
    );

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    verification.status = status;
    verification.reviewedBy = req.user._id;
    verification.reviewedAt = new Date();

    if (status === "rejected" && rejectionReason) {
      verification.rejectionReason = rejectionReason;
    }

    await verification.save();

    // Update provider verification status
    if (verification.provider) {
      verification.provider.isVerified = status === "approved";
      await verification.provider.save();
    }

    res.json({
      success: true,
      message: `Verification ${status} successfully`,
      data: {
        verification,
      },
    });
  } catch (error) {
    console.error("Review verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review verification",
      error: error.message,
    });
  }
};

// Provider: Delete verification (if pending)
exports.deleteVerification = async (req, res) => {
  try {
    const verification = await Verification.findOne({
      provider: req.user._id,
      status: "pending",
    });

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "No pending verification found to delete",
      });
    }

    // 🆕 NEW: Delete all documents from Cloudinary
    const filesToDelete = [];

    if (verification.insuranceDocument?.publicId) {
      filesToDelete.push(verification.insuranceDocument.publicId);
    }
    if (verification.idCardFront?.publicId) {
      filesToDelete.push(verification.idCardFront.publicId);
    }
    if (verification.idCardBack?.publicId) {
      filesToDelete.push(verification.idCardBack.publicId);
    }

    // Delete all files from Cloudinary
    for (const publicId of filesToDelete) {
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`✅ Deleted verification file: ${publicId}`);
      } catch (deleteError) {
        console.error(`❌ Error deleting file ${publicId}:`, deleteError);
      }
    }

    await Verification.findByIdAndDelete(verification._id);

    res.json({
      success: true,
      message: "Verification request and all documents deleted successfully",
    });
  } catch (error) {
    console.error("Delete verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete verification request",
      error: error.message,
    });
  }
};

// 🆕 NEW: Get verification by ID (for admin/details)
exports.getVerificationById = async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await Verification.findById(verificationId)
      .populate(
        "provider",
        "firstName lastName email businessNameRegistered phone profileImage"
      )
      .populate("reviewedBy", "firstName lastName email");

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    res.json({
      success: true,
      data: {
        verification,
      },
    });
  } catch (error) {
    console.error("Get verification by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification details",
      error: error.message,
    });
  }
};
