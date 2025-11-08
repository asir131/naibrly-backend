const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// File filter for images only
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Configure storage for profile images
const profileImageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'naibrly/profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' }
        ]
    }
});

// Configure storage for business logos
const businessLogoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'naibrly/business-logos',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 300, height: 300, crop: 'limit' },
            { quality: 'auto' }
        ]
    }
});

// Configure storage for category type images
const categoryTypeImageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'naibrly/category-types',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 600, height: 400, crop: 'limit' },
            { quality: 'auto' }
        ]
    }
});

const insuranceDocumentStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'naibrly/insurance-documents',
        format: async (req, file) => {
            if (file.mimetype === 'application/pdf') return 'pdf';
            return 'png';
        },
        public_id: (req, file) => {
            const userId = req.user?._id || 'unknown';
            const timestamp = Date.now();
            return `insurance_${userId}_${timestamp}`;
        },
        transformation: file => {
            if (file.mimetype === 'application/pdf') {
                return [];
            }
            return [
                { quality: 'auto' }
            ];
        }
    }
});

// Multer upload configurations
const uploadProfileImage = multer({
    storage: profileImageStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

const uploadBusinessLogo = multer({
    storage: businessLogoStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// Category type image upload - SIMPLIFIED
// const uploadCategoryTypeImage = multer({
//     storage: categoryTypeImageStorage,
//     fileFilter: fileFilter,
//     limits: {
//         fileSize: 5 * 1024 * 1024
//     }
// });

const uploadInsuranceDocument = multer({
    storage: insuranceDocumentStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only image files and PDFs are allowed!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

const uploadProviderFiles = multer({
    storage: profileImageStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
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
    // uploadCategoryTypeImage,
    uploadInsuranceDocument,
    deleteImageFromCloudinary,
    uploadProviderFiles
};