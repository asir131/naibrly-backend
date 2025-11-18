const mongoose = require("mongoose");

const bundleSchema = new mongoose.Schema(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
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
    totalPrice: {
      type: Number,
      required: true,
    },
    bundleDiscount: {
      type: Number,
      default: 5,
    },
    finalPrice: {
      type: Number,
      required: true,
    },
    pricePerPerson: {
      type: Number,
      required: true,
    },
    // Commission fields
    commission: {
      rate: {
        type: Number,
        default: 5,
      },
      amount: {
        type: Number,
        default: 0,
      },
      providerAmount: {
        type: Number,
        default: 0,
      },
    },
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
    statusHistory: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
        changedBy: {
          type: String,
          enum: ["customer", "provider", "system"],
          default: "system",
        },
      },
    ],
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
    expiresAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
    },
    cancelledBy: {
      type: String,
      enum: ["customer", "provider"],
    },
    cancellationReason: String,
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

bundleSchema.index({ zipCode: 1, status: 1 });
bundleSchema.index({ category: 1, status: 1 });
bundleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
bundleSchema.index({ "services.name": 1 });
bundleSchema.index({ provider: 1, status: 1 });

module.exports = mongoose.model("Bundle", bundleSchema);
