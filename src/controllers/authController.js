const Customer = require('../models/Customer');
const ServiceProvider = require('../models/ServiceProvider');
const jwt = require('jsonwebtoken');

// Generate JWT Token
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

// Customer registration
exports.registerCustomer = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            phone,
            profileImage,
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
        
        if (existingCustomer || existingProvider) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create customer
        const customer = new Customer({
            firstName,
            lastName,
            email,
            password,
            phone,
            profileImage,
            address: {
                street,
                city,
                state,
                zipCode,
                aptSuite
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
        res.status(500).json({
            success: false,
            message: 'Customer registration failed',
            error: error.message
        });
    }
};

// Service Provider registration
exports.registerProvider = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            phone,
            businessLogo,
            businessNameRegistered,
            businessNameDBA,
            providerRole,
            businessAddress,
            businessPhone,
            website,
            serviceDays,
            businessHours,
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
        
        if (existingCustomer || existingProvider) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create service provider
        const serviceProvider = new ServiceProvider({
            firstName,
            lastName,
            email,
            password,
            phone,
            businessLogo,
            businessNameRegistered,
            businessNameDBA,
            providerRole,
            businessAddress,
            businessPhone,
            website,
            serviceDays,
            businessHours,
            servicesProvided,
            description,
            experience,
            hourlyRate
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
                    role: serviceProvider.role,
                    phone: serviceProvider.phone
                },
                providerProfile: {
                    businessName: serviceProvider.businessNameRegistered,
                    providerRole: serviceProvider.providerRole,
                    servicesProvided: serviceProvider.servicesProvided,
                    isApproved: serviceProvider.isApproved
                }
            }
        });

    } catch (error) {
        console.error('Provider registration error:', error);
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

        // Check in all models
        let user = await Customer.findOne({ email });
        if (!user) user = await ServiceProvider.findOne({ email });
        if (!user) user = await Admin.findOne({ email });

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
                rating: user.rating
            };
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
exports.getMe = async (req, res) => {
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