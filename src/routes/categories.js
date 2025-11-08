const express = require('express');
const {
    getAllCategories,
    createCategoryTypeWithServices,
    getAllServices,
    initializeDefaultData
} = require('../controllers/categoryController');
const { uploadCategoryTypeImage } = require('../config/categoryCloudinary');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Initialize categories on server start


// Public routes
router.get('/services', getAllServices);

// Admin routes
router.get('/', auth, authorize('admin'), getAllCategories);

// SIMPLE AND CLEAN - This will work
router.post(
    '/create',
    auth,
    authorize('admin'),
    uploadCategoryTypeImage.single('image'), // Field name is 'image'
    createCategoryTypeWithServices
);
// router.post('/test-upload', 
//     uploadCategoryTypeImage.single('image'),
//     (req, res) => {
//         console.log('Test upload - File:', req.file);
//         console.log('Test upload - Body:', req.body);
        
//         res.json({
//             success: true,
//             message: 'Upload test successful',
//             file: req.file,
//             body: req.body
//         });
//     }
// );

module.exports = router;