const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Universal storage configuration for all images
const createCloudinaryStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `naibrly/${folder}`,
      format: async (req, file) => {
        // Support multiple image formats
        if (file.mimetype === "image/jpeg") return "jpg";
        if (file.mimetype === "image/png") return "png";
        if (file.mimetype === "image/webp") return "webp";
        return "png"; // default
      },
      public_id: (req, file) => {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        return `${folder}_${timestamp}_${randomString}`;
      },
    },
  });
};

// Create storage configurations
const profileImageStorage = createCloudinaryStorage("profiles");
const businessLogoStorage = createCloudinaryStorage("business-logos");
const insuranceDocumentStorage = createCloudinaryStorage("insurance-documents");
const documentStorage = createCloudinaryStorage("documents");

// Create universal image upload middleware (accepts any field name)
const createImageUpload = (storage) => {
  return multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed!"), false);
      }
    },
  });
};

// Create document upload middleware
const createDocumentUpload = (storage) => {
  return multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for documents
    },
    fileFilter: (req, file, cb) => {
      if (
        file.mimetype.startsWith("image/") ||
        file.mimetype === "application/pdf"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only image and PDF files are allowed!"), false);
      }
    },
  });
};

// Export upload middlewares
const uploadProfileImage = createImageUpload(profileImageStorage);
const uploadBusinessLogo = createImageUpload(businessLogoStorage);
const uploadInsuranceDocument = createDocumentUpload(insuranceDocumentStorage);
const uploadDocument = createDocumentUpload(documentStorage);

// Universal upload middleware that accepts any field name for images
const uploadAnyImage = createImageUpload(createCloudinaryStorage("uploads"));

// Function to delete image from Cloudinary
const deleteImageFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    throw error;
  }
};

// Function to delete document from Cloudinary
const deleteDocumentFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
    });
    return result;
  } catch (error) {
    console.error("Error deleting document from Cloudinary:", error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadProfileImage,
  uploadBusinessLogo,
  uploadInsuranceDocument,
  uploadDocument,
  uploadAnyImage, // Add this universal uploader
  deleteImageFromCloudinary,
  deleteDocumentFromCloudinary,
};
