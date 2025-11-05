const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const serviceProviderSchema = new mongoose.Schema({
    // Personal Information
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required']
    },
    profileImage: {
        type: String,
        default: ''
    },
    
    // Business Information
    businessLogo: {
        type: String,
        default: ''
    },
    businessNameRegistered: {
        type: String,
        required: [true, 'Registered business name is required'],
        trim: true
    },
    businessNameDBA: {
        type: String,
        trim: true
    },
    providerRole: {
        type: String,
        enum: ['owner', 'manager', 'employee'],
        required: [true, 'Provider role is required']
    },
    businessAddress: {
        type: String,
        required: [true, 'Business address is required']
    },
    businessPhone: {
        type: String,
        required: [true, 'Business phone is required']
    },
    website: {
        type: String,
        default: ''
    },
    
    // Service Schedule
    serviceDays: {
        start: {
            type: String,
            enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
            required: true
        },
        end: {
            type: String,
            enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
            required: true
        }
    },
    businessHours: {
        start: {
            type: String,
            required: true
        },
        end: {
            type: String,
            required: true
        }
    },
    
    // Services
    servicesProvided: [{
        type: String,
        enum: [
            'Home Repairs & Maintenance',
            'Cleaning & Organization', 
            'Renovations & Upgrades'
        ]
    }],
    
    // Business Details
    description: {
        type: String,
        maxlength: 500
    },
    experience: {
        type: Number,
        min: 0
    },
    hourlyRate: {
        type: Number,
        min: 0
    },
    
    // Status & Ratings
    isApproved: {
        type: Boolean,
        default: false
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    totalJobsCompleted: {
        type: Number,
        default: 0
    },
    
    // Documents & Verification
    documents: [{
        name: String,
        url: String,
        verified: {
            type: Boolean,
            default: false
        }
    }],
    approvalNotes: {
        type: String
    },
    
    role: {
        type: String,
        default: 'provider',
        immutable: true
    },
    resetPasswordToken: {
    type: String
},
resetPasswordExpires: {
    type: Date
}
}, {
    timestamps: true
});

// Hash password before saving
serviceProviderSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
serviceProviderSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);