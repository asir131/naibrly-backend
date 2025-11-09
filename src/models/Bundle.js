const mongoose = require("mongoose");

const bundleSchema = new mongoose.Schema(
  {
    // Bundle creator
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    // Service provider who accepted the bundle (initially null)
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
      default: null,
    },

    // Bundle details
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Service selection
    category: {
      type: String,
      required: true,
    },
    categoryTypeName: {
      type: String,
      required: true,
    },
    services: [
      {
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],

    // Scheduling
    serviceDate: {
      type: Date,
      required: true,
    },
    serviceTimeStart: {
      type: String,
      required: true,
    },
    serviceTimeEnd: {
      type: String,
      required: true,
    },

    // Location
    zipCode: {
      type: String,
      required: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      aptSuite: String,
    },

    // Bundle capacity (set by admin)
    maxParticipants: {
      type: Number,
      default: 5,
      min: 2,
      max: 10,
    },
    currentParticipants: {
      type: Number,
      default: 1,
    },

    // Participants
    participants: [
      {
        customer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Pricing (calculated automatically)
    totalPrice: {
      type: Number,
      required: true,
    },
    bundleDiscount: {
      type: Number,
      default: 5, // Set by admin
    },
    finalPrice: {
      type: Number,
      required: true,
    },
    pricePerPerson: {
      type: Number,
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "full",
        "in_progress",
        "completed",
        "cancelled",
        "expired",
      ],
      default: "pending",
    },

    // Provider responses
    providerOffers: [
      {
        provider: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ServiceProvider",
        },
        message: String,
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        submittedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Timestamps
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
bundleSchema.index({ zipCode: 1, status: 1 });
bundleSchema.index({ category: 1, status: 1 });
bundleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
bundleSchema.index({ "services.name": 1 });

module.exports = mongoose.model("Bundle", bundleSchema);
