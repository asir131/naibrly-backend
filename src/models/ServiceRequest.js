const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    serviceType: {
        type: String,
        required: true,
        enum: [
            'IKEA Assembly',
            'TV Mounting',
            'Furniture Assembly',
            'General Mounting',
            'Truck Assisted Help Moving',
            'Help Moving',
            'Cleaning',
            'Door, Cabinet, & Furniture Repair',
            'Heavy Lifting & Loading',
            'Electrical help',
            'Plumbing help',
            'Painting',
            'Carpentry',
            'Appliance Installation',
            'Home Organization',
            'Home Repairs & Maintenance',
            'Cleaning & Organization', 
            'Renovations & Upgrades'
        ]
    },
    problem: {
        type: String,
        required: [true, 'Problem description is required'],
        trim: true,
        minlength: [10, 'Problem description should be at least 10 characters'],
        maxlength: [500, 'Problem description should not exceed 500 characters']
    },
    note: {
        type: String,
        trim: true,
        maxlength: [200, 'Note should not exceed 200 characters']
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'completed', 'cancelled'],
        default: 'pending'
    },
    statusHistory: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String,
        changedBy: {
            type: String,
            enum: ['customer', 'provider', 'system'],
            default: 'system'
        }
    }],
    price: {
        type: Number,
        default: 0
    },
    estimatedHours: {
        type: Number,
        default: 1
    },
    providerNotes: {
        type: String,
        default: ''
    },
    review: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    cancelledBy: {
        type: String,
        enum: ['customer', 'provider']
    },
    cancellationReason: String,
    completedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Enhanced pre-save middleware for status tracking
serviceRequestSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        let note = '';
        let changedBy = 'system';
        
        if (this.status === 'cancelled') {
            note = this.cancellationReason || 'No reason provided';
            changedBy = this.cancelledBy || 'system';
        } else if (this.status === 'completed') {
            note = 'Service completed by provider';
            changedBy = 'provider';
            this.completedAt = new Date();
        } else if (this.status === 'accepted') {
            note = 'Service accepted by provider';
            changedBy = 'provider';
        }
        
        this.statusHistory.push({
            status: this.status,
            note: note,
            changedBy: changedBy,
            timestamp: new Date()
        });
    }
    next();
});

// Index for better performance
serviceRequestSchema.index({ provider: 1, status: 1 });
serviceRequestSchema.index({ customer: 1, status: 1 });
serviceRequestSchema.index({ scheduledDate: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);