const express = require('express');
const { auth } = require('../middleware/auth');
const { 
    uploadProfileImage, 
    uploadBusinessLogo 
} = require('../config/cloudinary');
const {
    uploadCustomerProfileImage,
    uploadProviderProfileImage,
    uploadBusinessLogo: uploadBizLogo,
    deleteProfileImage,
    deleteBusinessLogo
} = require('../controllers/uploadController');

const router = express.Router();

// Customer profile image upload
router.post(
    '/customer/profile-image',
    auth,
    uploadProfileImage.single('profileImage'),
    uploadCustomerProfileImage
);

// Provider profile image upload
router.post(
    '/provider/profile-image',
    auth,
    uploadProfileImage.single('profileImage'),
    uploadProviderProfileImage
);

// Business logo upload
router.post(
    '/provider/business-logo',
    auth,
    uploadBusinessLogo.single('businessLogo'),
    uploadBizLogo
);

// Delete profile image
router.delete('/profile-image', auth, deleteProfileImage);

// Delete business logo
router.delete('/business-logo', auth, deleteBusinessLogo);

module.exports = router;