const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const serviceProviderSchema = new mongoose.Schema({
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
        url: {
            type: String,
            default: ''
        },
        publicId: {
            type: String,
            default: ''
        }
    },
    businessLogo: {
        url: {
            type: String,
            default: ''
        },
        publicId: {
            type: String,
            default: ''
        }
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
   
    
   servicesProvided: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    
    description: {
        type: String,
        maxlength: 500
    },
    experience: {
        type: Number,
        min: 0
    },
     businessServiceDays: {
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
    hourlyRate: {
        type: Number,
        min: 0
    },
   
    isApproved: {
        type: Boolean,
        default: true
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
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },
    role: {
        type: String,
        default: 'provider',
        immutable: true
    }
}, {
    timestamps: true
});

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

serviceProviderSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);