const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json({
            success: true,
            data: { users }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        let profileData = { user: req.user };

        // If user is a provider, include provider details
        if (req.user.role === 'provider') {
            const providerProfile = await ServiceProvider.findOne({ _id: req.user._id });
            profileData.providerProfile = providerProfile;
        }

        res.json({
            success: true,
            data: profileData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name, phone },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Profile update failed',
            error: error.message
        });
    }
};