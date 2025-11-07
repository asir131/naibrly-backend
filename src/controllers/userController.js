const Customer = require('../models/Customer');
const ServiceProvider = require('../models/ServiceProvider');

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        // User is already attached to req by auth middleware
        const user = req.user;

        res.json({
            success: true,
            data: { user }
        });
    } catch (error) {
        console.error('Get user profile error:', error);
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
        const { firstName, lastName, phone } = req.body;
        let user;
        
        if (req.user.role === 'customer') {
            user = await Customer.findByIdAndUpdate(
                req.user._id,
                { firstName, lastName, phone },
                { new: true, runValidators: true }
            ).select('-password');
        } else if (req.user.role === 'provider') {
            user = await ServiceProvider.findByIdAndUpdate(
                req.user._id,
                { firstName, lastName, phone },
                { new: true, runValidators: true }
            ).select('-password');
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Profile update failed',
            error: error.message
        });
    }
};