const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure storage for profile images
const profileImageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'naibrly/profiles',
        format: async (req, file) => 'png',
        public_id: (req, file) => {
            const timestamp = Date.now();
            return `profile_${timestamp}`;
        },
        transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' },
            { format: 'png' }
        ]
    }
});

// Configure storage for business logos
const businessLogoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'naibrly/business-logos',
        format: async (req, file) => 'png',
        public_id: (req, file) => {
            const timestamp = Date.now();
            return `business_logo_${timestamp}`;
        },
        transformation: [
            { width: 300, height: 300, crop: 'limit' },
            { quality: 'auto' },
            { format: 'png' }
        ]
    }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Multer upload configurations
const uploadProfileImage = multer({
    storage: profileImageStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const uploadBusinessLogo = multer({
    storage: businessLogoStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Utility function to delete image from Cloudinary
const deleteImageFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return;
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
    }
};

module.exports = {
    cloudinary,
    uploadProfileImage,
    uploadBusinessLogo,
    deleteImageFromCloudinary
};