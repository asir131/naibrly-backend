const Customer = require('../models/Customer');
const ServiceProvider = require('../models/ServiceProvider');
const Admin = require('../models/Admin');
const { cloudinary } = require('../config/cloudinary');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Role selection
const selectRole = async (req, res) => {
    try {
        const { role } = req.body;

        if (!['customer', 'provider'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid role: customer or provider'
            });
        }

        res.json({
            success: true,
            message: `Role ${role} selected successfully`,
            data: { 
                selectedRole: role,
                nextStep: 'registration'
            }
        });
    } catch (error) {
        console.error('Role selection error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during role selection',
            error: error.message
        });
    }
};

// Customer registration with file upload
const registerCustomer = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            phone,
            street,
            city,
            state,
            zipCode,
            aptSuite
        } = req.body;

        // Validation
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // Check if user already exists
        const existingCustomer = await Customer.findOne({ email });
        let existingProvider = null;
        
        try {
            if (ServiceProvider && typeof ServiceProvider.findOne === 'function') {
                existingProvider = await ServiceProvider.findOne({ email });
            }
        } catch (error) {
            console.warn('ServiceProvider check failed:', error.message);
        }
        
        if (existingCustomer || existingProvider) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Handle profile image upload
        let profileImageData = { url: '', publicId: '' };
        if (req.file) {
            profileImageData = {
                url: req.file.path,
                publicId: req.file.filename
            };
        }

        // Create customer
        const customer = new Customer({
            firstName,
            lastName,
            email,
            password,
            phone,
            profileImage: profileImageData,
            address: {
                street,
                city,
                state,
                zipCode,
                aptSuite: aptSuite || ''
            }
        });

        await customer.save();

        // Generate token
        const token = generateToken(customer._id);

        res.status(201).json({
            success: true,
            message: 'Customer registered successfully',
            data: {
                token,
                user: {
                    id: customer._id,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    role: customer.role,
                    profileImage: customer.profileImage,
                    address: customer.address
                }
            }
        });

    } catch (error) {
        console.error('Customer registration error:', error);
        
        if (req.file && req.file.filename) {
            try {
                await cloudinary.uploader.destroy(req.file.filename);
            } catch (deleteError) {
                console.error('Error deleting uploaded image:', deleteError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Customer registration failed',
            error: error.message
        });
    }
};

// Service Provider registration with file uploads
const registerProvider = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            phone,
            businessNameRegistered,
            businessNameDBA,
            providerRole,
            businessAddress,
            businessPhone,
            website,
            servicesProvided,
            description,
            experience,
            hourlyRate
        } = req.body;

        // Validation
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // Check if user already exists
        const existingCustomer = await Customer.findOne({ email });
        let existingProvider = null;
        
        try {
            if (ServiceProvider && typeof ServiceProvider.findOne === 'function') {
                existingProvider = await ServiceProvider.findOne({ email });
            }
        } catch (error) {
            console.warn('ServiceProvider check failed:', error.message);
        }
        
        if (existingCustomer || existingProvider) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Parse serviceDays from individual form fields
        const serviceDaysData = {
            start: req.body.serviceDaysStart,
            end: req.body.serviceDaysEnd
        };

        // Parse businessHours from individual form fields
        const businessHoursData = {
            start: req.body.businessHoursStart,
            end: req.body.businessHoursEnd
        };

        // Validate required nested fields
        if (!serviceDaysData.start || !serviceDaysData.end) {
            return res.status(400).json({
                success: false,
                message: 'Service days start and end are required'
            });
        }

        if (!businessHoursData.start || !businessHoursData.end) {
            return res.status(400).json({
                success: false,
                message: 'Business hours start and end are required'
            });
        }

        // Handle profile image upload
        let profileImageData = { url: '', publicId: '' };
        if (req.files && req.files['profileImage']) {
            const profileImage = req.files['profileImage'][0];
            profileImageData = {
                url: profileImage.path,
                publicId: profileImage.filename
            };
        }

        // Handle business logo upload
        let businessLogoData = { url: '', publicId: '' };
        if (req.files && req.files['businessLogo']) {
            const businessLogo = req.files['businessLogo'][0];
            businessLogoData = {
                url: businessLogo.path,
                publicId: businessLogo.filename
            };
        }

        // Parse servicesProvided if it's a string
        let servicesArray = [];
        if (servicesProvided) {
            if (typeof servicesProvided === 'string') {
                servicesArray = servicesProvided.split(',').map(s => s.trim());
            } else if (Array.isArray(servicesProvided)) {
                servicesArray = servicesProvided;
            }
        }

        // Create service provider - AUTO APPROVE FOR TESTING
        const serviceProvider = new ServiceProvider({
            firstName,
            lastName,
            email,
            password,
            phone,
            profileImage: profileImageData,
            businessLogo: businessLogoData,
            businessNameRegistered,
            businessNameDBA: businessNameDBA || '',
            providerRole,
            businessAddress,
            businessPhone,
            website: website || '',
            serviceDays: serviceDaysData,
            businessHours: businessHoursData,
            servicesProvided: servicesArray,
            description: description || '',
            experience: experience ? parseInt(experience) : 0,
            hourlyRate: hourlyRate ? parseFloat(hourlyRate) : 0,
            isApproved: true, // AUTO APPROVE PROVIDERS FOR TESTING
            approvalStatus: 'approved', // ADD THIS FIELD
            isActive: true, // ENSURE THIS IS TRUE
            isVerified: true // ADD THIS FIELD
        });

        await serviceProvider.save();

        // Generate token
        const token = generateToken(serviceProvider._id);

        res.status(201).json({
            success: true,
            message: 'Service provider registered and approved successfully',
            data: {
                token,
                user: {
                    id: serviceProvider._id,
                    firstName: serviceProvider.firstName,
                    lastName: serviceProvider.lastName,
                    email: serviceProvider.email,
                    role: serviceProvider.role,
                    phone: serviceProvider.phone,
                    profileImage: serviceProvider.profileImage,
                    isApproved: serviceProvider.isApproved, // INCLUDE THIS
                    approvalStatus: serviceProvider.approvalStatus, // INCLUDE THIS
                    isVerified: serviceProvider.isVerified // INCLUDE THIS
                },
                providerProfile: {
                    businessName: serviceProvider.businessNameRegistered,
                    providerRole: serviceProvider.providerRole,
                    servicesProvided: serviceProvider.servicesProvided,
                    isApproved: serviceProvider.isApproved,
                    approvalStatus: serviceProvider.approvalStatus,
                    businessLogo: serviceProvider.businessLogo
                }
            }
        });

    } catch (error) {
        console.error('Provider registration error:', error);
        
        if (req.files) {
            try {
                if (req.files['profileImage']) {
                    await cloudinary.uploader.destroy(req.files['profileImage'][0].filename);
                }
                if (req.files['businessLogo']) {
                    await cloudinary.uploader.destroy(req.files['businessLogo'][0].filename);
                }
            } catch (deleteError) {
                console.error('Error deleting uploaded images:', deleteError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Service provider registration failed',
            error: error.message
        });
    }
};

// Login (works for all roles)
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check in all models
        let user = await Customer.findOne({ email });
        if (!user) {
            try {
                user = await ServiceProvider.findOne({ email });
            } catch (error) {
                console.warn('ServiceProvider login check failed:', error.message);
            }
        }
        if (!user) {
            try {
                user = await Admin.findOne({ email });
            } catch (error) {
                console.warn('Admin login check failed:', error.message);
            }
        }

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Generate token
        const token = generateToken(user._id);

        // Prepare response data
        let userData = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage,
            isVerified: user.isVerified
        };

        // Add role-specific data
        if (user.role === 'provider') {
            userData.providerProfile = {
                businessName: user.businessNameRegistered,
                providerRole: user.providerRole,
                servicesProvided: user.servicesProvided,
                isApproved: user.isApproved,
                approvalStatus: user.approvalStatus, // ADD THIS
                rating: user.rating,
                businessLogo: user.businessLogo
            };
            
            // Add approval status to main user object for provider
            userData.isApproved = user.isApproved;
            userData.approvalStatus = user.approvalStatus;
        } else if (user.role === 'customer') {
            userData.address = user.address;
        } else if (user.role === 'admin') {
            userData.adminRole = user.adminRole;
            userData.permissions = user.permissions;
        }

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: userData
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// Get current user (works for all roles)
const getMe = async (req, res) => {
    try {
        let userData;

        // Get user based on role
        if (req.user.role === 'customer') {
            userData = await Customer.findById(req.user._id).select('-password');
        } else if (req.user.role === 'provider') {
            userData = await ServiceProvider.findById(req.user._id).select('-password');
        } else if (req.user.role === 'admin') {
            userData = await Admin.findById(req.user._id).select('-password');
        }

        res.json({
            success: true,
            data: {
                user: userData
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Admin route to approve providers (for testing)
const approveProvider = async (req, res) => {
    try {
        const { providerId } = req.params;

        const provider = await ServiceProvider.findById(providerId);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        provider.isApproved = true;
        provider.approvalStatus = 'approved';
        await provider.save();

        res.json({
            success: true,
            message: 'Provider approved successfully',
            data: {
                provider: {
                    id: provider._id,
                    email: provider.email,
                    businessName: provider.businessNameRegistered,
                    isApproved: provider.isApproved,
                    approvalStatus: provider.approvalStatus
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Approval failed',
            error: error.message
        });
    }
};

// Route to check provider approval status
const checkProviderStatus = async (req, res) => {
    try {
        const provider = await ServiceProvider.findById(req.user._id);
        
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        res.json({
            success: true,
            data: {
                isApproved: provider.isApproved,
                approvalStatus: provider.approvalStatus,
                isActive: provider.isActive,
                isVerified: provider.isVerified,
                canSubmitVerification: provider.isApproved && provider.approvalStatus === 'approved'
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking provider status',
            error: error.message
        });
    }
};

// Get all providers (for admin)
const getAllProviders = async (req, res) => {
    try {
        const providers = await ServiceProvider.find().select('-password');
        
        res.json({
            success: true,
            data: {
                providers: providers.map(provider => ({
                    id: provider._id,
                    firstName: provider.firstName,
                    lastName: provider.lastName,
                    email: provider.email,
                    businessName: provider.businessNameRegistered,
                    isApproved: provider.isApproved,
                    approvalStatus: provider.approvalStatus,
                    isActive: provider.isActive,
                    createdAt: provider.createdAt
                }))
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching providers',
            error: error.message
        });
    }
};

// Export all functions
module.exports = {
    selectRole,
    registerCustomer,
    registerProvider,
    login,
    getMe,
    approveProvider,
    checkProviderStatus,
    getAllProviders
};