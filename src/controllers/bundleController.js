const Bundle = require("../models/Bundle");
const BundleSettings = require("../models/BundleSettings");
const Customer = require("../models/Customer");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");

// Initialize default bundle settings
const initializeBundleSettings = async () => {
  try {
    const existingSettings = await BundleSettings.findOne();
    if (!existingSettings) {
      const settings = new BundleSettings();
      await settings.save();
      console.log("✅ Bundle settings initialized");
    }
  } catch (error) {
    console.error("❌ Bundle settings initialization error:", error);
  }
};

// Create a new bundle (without providerId)
exports.createBundle = async (req, res) => {
  try {
    const {
      category,
      categoryTypeName,
      services,
      serviceDate,
      serviceTimeStart,
      serviceTimeEnd,
      title,
      description,
    } = req.body;

    // Validation
    if (
      !category ||
      !categoryTypeName ||
      !services ||
      !serviceDate ||
      !serviceTimeStart ||
      !serviceTimeEnd
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // Get customer (creator)
    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Validate services exist in the system
    const validServices = await Service.find({
      name: { $in: services },
      isActive: true,
    });

    if (validServices.length !== services.length) {
      const validServiceNames = validServices.map((s) => s.name);
      const invalidServices = services.filter(
        (service) => !validServiceNames.includes(service)
      );

      return res.status(400).json({
        success: false,
        message: `Invalid services: ${invalidServices.join(", ")}`,
      });
    }

    // Get bundle settings (admin set values)
    const bundleSettings = await BundleSettings.findOne();
    const maxParticipants = bundleSettings?.maxParticipants || 5;
    const bundleDiscount = bundleSettings?.bundleDiscount || 5;
    const expiryHours = bundleSettings?.bundleExpiryHours || 24;

    // Calculate pricing using average service prices
    let totalPrice = 0;
    const servicesWithPricing = [];

    for (const serviceName of services) {
      // Get average price for this service from providers
      const providersWithService = await ServiceProvider.find({
        servicesProvided: serviceName,
        isApproved: true,
        isActive: true,
      });

      let servicePrice = 50; // Default price if no providers found

      if (providersWithService.length > 0) {
        const totalServicePrice = providersWithService.reduce(
          (sum, provider) => {
            return (
              sum +
              (provider.servicePricing?.get(serviceName) ||
                provider.hourlyRate * 2)
            );
          },
          0
        );
        servicePrice = Math.round(
          totalServicePrice / providersWithService.length
        );
      }

      servicesWithPricing.push({
        name: serviceName,
        price: servicePrice,
      });

      totalPrice += servicePrice;
    }

    // Calculate final price using admin-set discount
    const finalPrice = totalPrice * (1 - bundleDiscount / 100);
    const pricePerPerson = finalPrice / maxParticipants;

    // Create bundle
    const bundle = new Bundle({
      creator: customer._id,
      title: title || `${services.join(", ")} Bundle`,
      description: description || `Bundle of ${services.join(", ")} services`,
      category,
      categoryTypeName,
      services: servicesWithPricing,
      serviceDate: new Date(serviceDate),
      serviceTimeStart,
      serviceTimeEnd,
      zipCode: customer.address.zipCode,
      address: {
        street: customer.address.street,
        city: customer.address.city,
        state: customer.address.state,
        aptSuite: customer.address.aptSuite,
      },
      maxParticipants, // Set by admin
      currentParticipants: 1,
      participants: [
        {
          customer: customer._id,
        },
      ],
      totalPrice,
      bundleDiscount, // Set by admin
      finalPrice,
      pricePerPerson,
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
    });

    await bundle.save();

    // Find matching providers and notify them
    const matchingProviders = await ServiceProvider.find({
      servicesProvided: { $in: services },
      "businessAddress.zipCode": customer.address.zipCode,
      isApproved: true,
      isActive: true,
    });

    console.log(
      `✅ Bundle created. Notifying ${matchingProviders.length} matching providers`
    );

    // Populate for response
    await bundle.populate("creator", "firstName lastName profileImage");

    res.status(201).json({
      success: true,
      message:
        "Bundle created successfully. Providers in your area will be notified.",
      data: {
        bundle,
        matchingProvidersCount: matchingProviders.length,
        availableSpots: maxParticipants - 1,
        pricing: {
          totalPrice,
          bundleDiscount: `${bundleDiscount}%`,
          finalPrice,
          pricePerPerson,
        },
      },
    });
  } catch (error) {
    console.error("Create bundle error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create bundle",
      error: error.message,
    });
  }
};

// Provider accepts a bundle directly
// Provider accepts a bundle directly
exports.providerAcceptBundle = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { message } = req.body;

    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
      });
    }

    // Check if bundle is still available
    if (bundle.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Bundle is no longer available",
      });
    }

    // Get provider details
    const provider = await ServiceProvider.findById(req.user._id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // Check if provider is in same ZIP code and offers the services
    if (provider.businessAddress.zipCode !== bundle.zipCode) {
      return res.status(400).json({
        success: false,
        message: "You are not in the same service area as this bundle",
      });
    }

    const bundleServiceNames = bundle.services.map((s) => s.name);
    const providerCanService = bundleServiceNames.every((service) =>
      provider.servicesProvided.includes(service)
    );

    if (!providerCanService) {
      return res.status(400).json({
        success: false,
        message: "You do not offer all services in this bundle",
      });
    }

    // Check if provider already made an offer
    const existingOffer = bundle.providerOffers.find(
      (offer) => offer.provider.toString() === req.user._id.toString()
    );

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: "You have already made an offer on this bundle",
      });
    }

    // ✅ Use provider's maxBundleCapacity instead of global setting
    const providerMaxCapacity = provider.maxBundleCapacity || 5;

    // Update bundle with provider's capacity
    bundle.maxParticipants = providerMaxCapacity;
    bundle.pricePerPerson = bundle.finalPrice / providerMaxCapacity;

    // Add provider offer and automatically accept it
    bundle.providerOffers.push({
      provider: req.user._id,
      message:
        message ||
        `I accept this bundle for $${bundle.finalPrice} (Capacity: ${providerMaxCapacity} people)`,
      status: "accepted",
    });

    // Update bundle with accepted provider
    bundle.provider = req.user._id;
    bundle.status = "accepted";

    await bundle.save();

    // Populate for response
    await bundle.populate(
      "provider",
      "businessNameRegistered businessLogo rating phone email"
    );
    await bundle.populate("creator", "firstName lastName profileImage phone");
    await bundle.populate(
      "participants.customer",
      "firstName lastName profileImage"
    );

    res.json({
      success: true,
      message: "Bundle accepted successfully",
      data: {
        bundle,
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          rating: provider.rating,
          maxBundleCapacity: providerMaxCapacity,
        },
        pricing: {
          totalPrice: bundle.totalPrice,
          bundleDiscount: `${bundle.bundleDiscount}%`,
          finalPrice: bundle.finalPrice,
          pricePerPerson: bundle.pricePerPerson,
          maxParticipants: providerMaxCapacity,
        },
      },
    });
  } catch (error) {
    console.error("Provider accept bundle error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept bundle",
      error: error.message,
    });
  }
};

// Provider declines a bundle
exports.providerDeclineBundle = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { declineReason } = req.body;

    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
      });
    }

    // Get provider details
    const provider = await ServiceProvider.findById(req.user._id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // Check if provider is in same ZIP code
    if (provider.businessAddress.zipCode !== bundle.zipCode) {
      return res.status(400).json({
        success: false,
        message: "You are not in the same service area as this bundle",
      });
    }

    // Add provider to declined list
    bundle.providerOffers.push({
      provider: req.user._id,
      message: declineReason || "Provider declined this bundle",
      status: "rejected",
    });

    await bundle.save();

    res.json({
      success: true,
      message: "Bundle declined successfully",
      data: {
        bundleId: bundle._id,
        providerId: provider._id,
        businessName: provider.businessNameRegistered,
      },
    });
  } catch (error) {
    console.error("Provider decline bundle error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to decline bundle",
      error: error.message,
    });
  }
};

// Join an existing bundle (with ZIP code validation)
exports.joinBundle = async (req, res) => {
  try {
    const { bundleId } = req.params;

    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
      });
    }

    // Check if bundle is accepted and open for joining
    if (bundle.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message:
          "Bundle is not available for joining. It must be accepted by a provider first.",
      });
    }

    // Check if customer is already in the bundle
    const isAlreadyParticipant = bundle.participants.some(
      (participant) =>
        participant.customer.toString() === req.user._id.toString()
    );

    if (isAlreadyParticipant) {
      return res.status(400).json({
        success: false,
        message: "You are already part of this bundle",
      });
    }

    // Check if bundle is full
    if (bundle.currentParticipants >= bundle.maxParticipants) {
      bundle.status = "full";
      await bundle.save();

      return res.status(400).json({
        success: false,
        message: "Bundle is already full",
      });
    }

    // Get customer
    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // ✅ ZIP CODE VALIDATION: Check if customer is in same zip code as bundle creator
    if (customer.address.zipCode !== bundle.zipCode) {
      return res.status(400).json({
        success: false,
        message:
          "You must be in the same ZIP code area as the bundle creator to join this bundle",
      });
    }

    // Add customer to bundle
    bundle.participants.push({
      customer: customer._id,
    });
    bundle.currentParticipants += 1;

    // Check if bundle is now full
    if (bundle.currentParticipants >= bundle.maxParticipants) {
      bundle.status = "full";
    }

    await bundle.save();

    // Populate for response
    await bundle.populate(
      "participants.customer",
      "firstName lastName profileImage address"
    );
    await bundle.populate("creator", "firstName lastName profileImage address");
    await bundle.populate(
      "provider",
      "businessNameRegistered businessLogo rating"
    );

    res.json({
      success: true,
      message: "Successfully joined the bundle",
      data: {
        bundle,
        availableSpots: bundle.maxParticipants - bundle.currentParticipants,
        yourShare: bundle.pricePerPerson,
        pricing: {
          totalPrice: bundle.totalPrice,
          bundleDiscount: `${bundle.bundleDiscount}%`,
          finalPrice: bundle.finalPrice,
          pricePerPerson: bundle.pricePerPerson,
        },
      },
    });
  } catch (error) {
    console.error("Join bundle error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to join bundle",
      error: error.message,
    });
  }
};

// Get available bundles for providers (matching services and ZIP code)
exports.getProviderAvailableBundles = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Get provider details
    const provider = await ServiceProvider.findById(req.user._id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // Find bundles that match provider's services and ZIP code
    const filter = {
      zipCode: provider.businessAddress.zipCode,
      status: status,
      expiresAt: { $gt: new Date() },
      $or: [
        { "services.name": { $in: provider.servicesProvided } },
        { "providerOffers.provider": { $ne: req.user._id } },
      ],
    };

    const bundles = await Bundle.find(filter)
      .populate("creator", "firstName lastName profileImage address")
      .populate(
        "participants.customer",
        "firstName lastName profileImage address"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Bundle.countDocuments(filter);

    // Enhance bundles with match score
    const enhancedBundles = bundles.map((bundle) => {
      const matchingServices = bundle.services.filter((service) =>
        provider.servicesProvided.includes(service.name)
      );
      const matchScore =
        (matchingServices.length / bundle.services.length) * 100;

      return {
        ...bundle.toObject(),
        matchScore: Math.round(matchScore),
        matchingServices: matchingServices.map((s) => s.name),
        providerAlreadyOffered: bundle.providerOffers.some(
          (offer) => offer.provider.toString() === req.user._id.toString()
        ),
      };
    });

    res.json({
      success: true,
      data: {
        bundles: enhancedBundles,
        providerZipCode: provider.businessAddress.zipCode,
        providerServices: provider.servicesProvided,
        pagination: {
          current: parseInt(page),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get provider available bundles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available bundles",
      error: error.message,
    });
  }
};

// Get provider's accepted bundles
exports.getProviderAcceptedBundles = async (req, res) => {
  try {
    const { status = "accepted", page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      provider: req.user._id,
      status: status,
    };

    const bundles = await Bundle.find(filter)
      .populate("creator", "firstName lastName profileImage address phone")
      .populate(
        "participants.customer",
        "firstName lastName profileImage phone"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Bundle.countDocuments(filter);

    res.json({
      success: true,
      data: {
        bundles,
        pagination: {
          current: parseInt(page),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get provider accepted bundles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch accepted bundles",
      error: error.message,
    });
  }
};

// Get customer's created bundles
exports.getCustomerBundles = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const filter = { creator: req.user._id };
    if (status) filter.status = status;

    const bundles = await Bundle.find(filter)
      .populate(
        "participants.customer",
        "firstName lastName profileImage address"
      )
      .populate("provider", "businessNameRegistered businessLogo rating")
      .populate(
        "providerOffers.provider",
        "businessNameRegistered businessLogo rating"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Bundle.countDocuments(filter);

    res.json({
      success: true,
      data: {
        bundles,
        pagination: {
          current: parseInt(page),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get customer bundles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bundles",
      error: error.message,
    });
  }
};

// Get bundle details
exports.getBundleDetails = async (req, res) => {
  try {
    const { bundleId } = req.params;

    const bundle = await Bundle.findById(bundleId)
      .populate("creator", "firstName lastName profileImage address phone")
      .populate(
        "participants.customer",
        "firstName lastName profileImage phone address"
      )
      .populate(
        "provider",
        "businessNameRegistered businessLogo rating phone email businessAddress"
      )
      .populate(
        "providerOffers.provider",
        "businessNameRegistered businessLogo rating"
      );

    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
      });
    }

    res.json({
      success: true,
      data: { bundle },
    });
  } catch (error) {
    console.error("Get bundle details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bundle details",
      error: error.message,
    });
  }
};

exports.initializeBundleSettings = initializeBundleSettings;
