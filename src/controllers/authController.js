const Customer = require('../models/Customer');
const ServiceProvider = require('../models/ServiceProvider');
const Admin = require('../models/Admin');
const { cloudinary } = require('../config/cloudinary');
const jwt = require('jsonwebtoken');

// Generate JWT Token - FIXED: Only include userId
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Role selection
exports.selectRole = async (req, res) => {
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
exports.registerCustomer = async (req, res) => {
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

        // Check if user already exists in any model
        const existingCustomer = await Customer.findOne({ email });
        const existingProvider = await ServiceProvider.findOne({ email });
        const existingAdmin = await Admin.findOne({ email });
        
        if (existingCustomer || existingProvider || existingAdmin) {
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
                    role: 'customer',
                    profileImage: customer.profileImage,
                    address: customer.address,
                    isVerified: customer.isVerified,
                    isActive: customer.isActive
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
exports.registerProvider = async (req, res) => {
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

        // Check if user already exists in any model
        const existingCustomer = await Customer.findOne({ email });
        const existingProvider = await ServiceProvider.findOne({ email });
        const existingAdmin = await Admin.findOne({ email });
        
        if (existingCustomer || existingProvider || existingAdmin) {
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

        // Create service provider
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
            isApproved: true,
            isActive: true,
            isVerified: true
        });

        await serviceProvider.save();

        // Generate token
        const token = generateToken(serviceProvider._id);

        res.status(201).json({
            success: true,
            message: 'Service provider registered successfully',
            data: {
                token,
                user: {
                    id: serviceProvider._id,
                    firstName: serviceProvider.firstName,
                    lastName: serviceProvider.lastName,
                    email: serviceProvider.email,
                    role: 'provider',
                    phone: serviceProvider.phone,
                    profileImage: serviceProvider.profileImage,
                    isApproved: serviceProvider.isApproved,
                    isVerified: serviceProvider.isVerified,
                    isActive: serviceProvider.isActive
                },
                providerProfile: {
                    businessName: serviceProvider.businessNameRegistered,
                    providerRole: serviceProvider.providerRole,
                    servicesProvided: serviceProvider.servicesProvided,
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
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Check in all models
        let user = await Customer.findOne({ email });
        let role = 'customer';

        if (!user) {
            user = await ServiceProvider.findOne({ email });
            role = 'provider';
        }

        if (!user) {
            user = await Admin.findOne({ email });
            role = 'admin';
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

        // Prepare response data based on role
        let userData = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: role,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            isActive: user.isActive
        };

        // Add role-specific data
        if (role === 'provider') {
            userData.isApproved = user.isApproved;
            userData.providerProfile = {
                businessName: user.businessNameRegistered,
                providerRole: user.providerRole,
                servicesProvided: user.servicesProvided,
                businessLogo: user.businessLogo,
                rating: user.rating
            };
        } else if (role === 'customer') {
            userData.address = user.address;
        } else if (role === 'admin') {
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
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// Get current user (works for all roles)
exports.getMe = async (req, res) => {
    try {
        // req.user is already populated by auth middleware
        const userData = req.user;

        res.json({
            success: true,
            data: {
                user: userData
            }
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};