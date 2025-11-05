const Verification = require('../models/Verification');
const ServiceProvider = require('../models/ServiceProvider');
const { cloudinary } = require('../config/cloudinary');

// Submit verification information
exports.submitVerification = async (req, res) => {
    try {
        const { einNumber, firstName, lastName } = req.body;

        // Validation
        if (!einNumber || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'EIN Number, first name, and last name are required'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Insurance coverage document is required'
            });
        }

        // Check if provider exists
        const provider = await ServiceProvider.findById(req.user._id);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Service provider not found'
            });
        }

        // DEBUG: Log provider status
        console.log('Provider status:', {
            id: provider._id,
            isApproved: provider.isApproved,
            approvalStatus: provider.approvalStatus,
            isActive: provider.isActive
        });

        // Check if provider is approved - MODIFIED CHECK
        if (!provider.isApproved && provider.approvalStatus !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Your provider account needs to be approved first before submitting verification',
                debug: {
                    isApproved: provider.isApproved,
                    approvalStatus: provider.approvalStatus,
                    isActive: provider.isActive
                }
            });
        }

        // Check if verification already exists and is pending
        const existingVerification = await Verification.findOne({
            provider: req.user._id,
            status: 'pending'
        });

        if (existingVerification) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending verification request'
            });
        }

        // Create verification record
        const verification = new Verification({
            provider: req.user._id,
            einNumber,
            firstName,
            lastName,
            insuranceDocument: {
                url: req.file.path,
                publicId: req.file.filename
            }
        });

        await verification.save();

        // Update provider verification status
        provider.isVerified = false; // Reset until approved
        await provider.save();

        res.status(201).json({
            success: true,
            message: 'Verification information submitted successfully',
            data: {
                verification: {
                    id: verification._id,
                    einNumber: verification.einNumber,
                    firstName: verification.firstName,
                    lastName: verification.lastName,
                    status: verification.status,
                    submittedAt: verification.submittedAt,
                    insuranceDocument: verification.insuranceDocument
                }
            }
        });

    } catch (error) {
        console.error('Submit verification error:', error);
        
        // Delete uploaded document if verification fails
        if (req.file && req.file.filename) {
            try {
                await cloudinary.uploader.destroy(req.file.filename);
            } catch (deleteError) {
                console.error('Error deleting uploaded document:', deleteError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to submit verification information',
            error: error.message
        });
    }
};

// Get verification status for provider
exports.getVerificationStatus = async (req, res) => {
    try {
        const verification = await Verification.findOne({
            provider: req.user._id
        }).sort({ createdAt: -1 }); // Get latest verification

        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'No verification information found'
            });
        }

        res.json({
            success: true,
            data: {
                verification
            }
        });

    } catch (error) {
        console.error('Get verification status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get verification status',
            error: error.message
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
            .populate('provider', 'firstName lastName email businessNameRegistered')
            .populate('reviewedBy', 'firstName lastName email')
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
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all verifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch verification requests',
            error: error.message
        });
    }
};

// Admin: Approve/Reject verification
exports.reviewVerification = async (req, res) => {
    try {
        const { verificationId } = req.params;
        const { status, rejectionReason } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either "approved" or "rejected"'
            });
        }

        const verification = await Verification.findById(verificationId)
            .populate('provider');

        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'Verification request not found'
            });
        }

        verification.status = status;
        verification.reviewedBy = req.user._id;
        verification.reviewedAt = new Date();

        if (status === 'rejected' && rejectionReason) {
            verification.rejectionReason = rejectionReason;
        }

        await verification.save();

        // Update provider verification status
        if (verification.provider) {
            verification.provider.isVerified = status === 'approved';
            await verification.provider.save();
        }

        res.json({
            success: true,
            message: `Verification ${status} successfully`,
            data: {
                verification
            }
        });

    } catch (error) {
        console.error('Review verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review verification',
            error: error.message
        });
    }
};

// Provider: Delete verification (if pending)
exports.deleteVerification = async (req, res) => {
    try {
        const verification = await Verification.findOne({
            provider: req.user._id,
            status: 'pending'
        });

        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'No pending verification found to delete'
            });
        }

        // Delete insurance document from Cloudinary
        if (verification.insuranceDocument.publicId) {
            await cloudinary.uploader.destroy(verification.insuranceDocument.publicId);
        }

        await Verification.findByIdAndDelete(verification._id);

        res.json({
            success: true,
            message: 'Verification request deleted successfully'
        });

    } catch (error) {
        console.error('Delete verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete verification request',
            error: error.message
        });
    }
};