const Bundle = require("../models/Bundle");
const BundleSettings = require("../models/BundleSettings");
const Customer = require("../models/Customer");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { calculateBundleCommission } = require("./commissionController");

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
      services, // Array of service names only
      serviceDate,
      serviceTimeStart,
      serviceTimeEnd,
      title,
      description,
    } = req.body;

    console.log("🔍 Debug - Bundle creation request:", {
      category,
      categoryTypeName,
      services,
      serviceDate,
      serviceTimeStart,
      serviceTimeEnd,
      title,
      description,
    });

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

    // Parse services array - only service names
    let servicesArray = [];

    if (typeof services === "string") {
      try {
        // Try to parse as JSON array
        servicesArray = JSON.parse(services);
      } catch (error) {
        // If JSON parsing fails, try comma-separated string
        servicesArray = services.split(",").map((s) => s.trim());
      }
    } else if (Array.isArray(services)) {
      servicesArray = services;
    }

    // Ensure all services are strings
    servicesArray = servicesArray
      .map((service) => {
        if (typeof service === "string") {
          return service.trim();
        } else if (service && typeof service === "object" && service.name) {
          return service.name.trim(); // Extract name if object is passed
        }
        return String(service).trim(); // Fallback
      })
      .filter((service) => service && service.length > 0);

    console.log("🔍 Debug - Final services array:", servicesArray);

    // Validate services exist in the system
    const validServices = await Service.find({
      name: { $in: servicesArray },
      isActive: true,
    });

    if (validServices.length !== servicesArray.length) {
      const validServiceNames = validServices.map((s) => s.name);
      const invalidServices = servicesArray.filter(
        (service) => !validServiceNames.includes(service)
      );

      return res.status(400).json({
        success: false,
        message: `Invalid services: ${invalidServices.join(", ")}`,
        debug: {
          requested: servicesArray,
          valid: validServiceNames,
          invalid: invalidServices,
        },
      });
    }

    // Get bundle settings (admin set values)
    const bundleSettings = await BundleSettings.findOne();
    const maxParticipants = bundleSettings?.maxParticipants || 5;
    const bundleDiscount = bundleSettings?.bundleDiscount || 5;
    const expiryHours = bundleSettings?.bundleExpiryHours || 24;

    // Calculate pricing using average service prices from providers
    let totalPrice = 0;
    const servicesWithPricing = [];

    for (const serviceName of servicesArray) {
      // Get providers who offer this service
      const providersWithService = await ServiceProvider.find({
        "servicesProvided.name": serviceName,
        isApproved: true,
        isActive: true,
      });

      let servicePrice = 50; // Default price if no providers found

      if (providersWithService.length > 0) {
        // Calculate average price from providers who offer this service
        const totalServicePrice = providersWithService.reduce(
          (sum, provider) => {
            const providerService = provider.servicesProvided.find(
              (s) => s.name === serviceName
            );
            // Use provider's hourly rate for this service, or fallback to general hourly rate
            return (
              sum + (providerService?.hourlyRate || provider.hourlyRate || 50)
            );
          },
          0
        );
        servicePrice = Math.round(
          totalServicePrice / providersWithService.length
        );
      }

      // Create service object with name and calculated price
      servicesWithPricing.push({
        name: serviceName,
        price: servicePrice,
      });

      totalPrice += servicePrice;
    }

    // Calculate final price using admin-set discount
    const finalPrice = totalPrice * (1 - bundleDiscount / 100);
    const pricePerPerson = finalPrice / maxParticipants;

    // Calculate commission
    const commissionCalculation = await calculateBundleCommission(finalPrice);

    // Generate unique share token
    const shareToken = crypto.randomBytes(16).toString("hex");

    // Create bundle
    const bundle = new Bundle({
      creator: customer._id,
      title: title || `${servicesArray.join(", ")} Bundle`,
      description:
        description || `Bundle of ${servicesArray.join(", ")} services`,
      category,
      categoryTypeName,
      services: servicesWithPricing, // Array of objects with name and calculated price
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
      // Commission fields
      commission: {
        rate: commissionCalculation.commissionRate,
        amount: commissionCalculation.commissionAmount,
        providerAmount: commissionCalculation.providerAmount,
      },
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
      shareToken,
    });

    console.log("🔍 Debug - Bundle object before save:", bundle.services);

    await bundle.save();

    // Generate shareable link and QR code
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const shareLink = `${baseUrl}/bundle/join/${shareToken}`;

    let qrCodeDataUrl;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(shareLink);
    } catch (qrError) {
      console.error("QR Code generation error:", qrError);
      qrCodeDataUrl = null;
    }

    // Find matching providers and notify them
    const matchingProviders = await ServiceProvider.find({
      "servicesProvided.name": { $in: servicesArray },
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
          commission: {
            rate: `${commissionCalculation.commissionRate}%`,
            amount: commissionCalculation.commissionAmount,
          },
          providerAmount: commissionCalculation.providerAmount,
        },
        services: servicesArray, // Return the service names used
        sharing: {
          shareLink,
          qrCode: qrCodeDataUrl,
          shareToken,
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

    if (error.name === "ObjectParameterError") {
      return res.status(400).json({
        success: false,
        message: "Invalid data format for services",
        error: "Services must be provided as an array of service names",
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
      provider.servicesProvided.some((sp) => sp.name === service)
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

    // Use provider's maxBundleCapacity instead of global setting
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
          commission: bundle.commission,
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

// Join an existing bundle (customers from same ZIP can join anytime regardless of provider acceptance)
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

    // ZIP CODE VALIDATION: Check if customer is in same zip code as bundle creator
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

    // If provider already accepted and capacity is provider-specific, pricePerPerson already calculated.
    // If provider has not accepted yet, keep existing maxParticipants and pricePerPerson (based on settings).

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
          commission: bundle.commission,
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
        {
          "services.name": {
            $in: provider.servicesProvided.map((s) => s.name),
          },
        },
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
        provider.servicesProvided.some((sp) => sp.name === service.name)
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
        providerServices: provider.servicesProvided.map((s) => s.name),
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
      success: false,
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

// Get bundles available in the authenticated customer's ZIP code
exports.getBundlesInCustomerArea = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch customer to get ZIP code
    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    const filter = {
      zipCode: customer.address.zipCode,
      expiresAt: { $gt: new Date() },
    };
    if (status) filter.status = status; // optional status filter

    const bundles = await Bundle.find(filter)
      .populate("creator", "firstName lastName profileImage address")
      .populate("provider", "businessNameRegistered businessLogo rating")
      .populate(
        "participants.customer",
        "firstName lastName profileImage address"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Bundle.countDocuments(filter);

    res.json({
      success: true,
      data: {
        zipCode: customer.address.zipCode,
        bundles,
        pagination: {
          current: parseInt(page),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get bundles in customer area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bundles in your area",
      error: error.message,
    });
  }
};

// Join bundle via share token (public endpoint for customers in same ZIP)
exports.joinBundleViaShareToken = async (req, res) => {
  try {
    const { shareToken } = req.params;

    // Find bundle by share token
    const bundle = await Bundle.findOne({ shareToken });
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found or link has expired",
      });
    }

    // Check if bundle is expired
    if (new Date() > bundle.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Bundle has expired",
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

    // ZIP CODE VALIDATION: Check if customer is in same zip code as bundle creator
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
      message: "Successfully joined the bundle via share link",
      data: {
        bundle,
        availableSpots: bundle.maxParticipants - bundle.currentParticipants,
        yourShare: bundle.pricePerPerson,
        pricing: {
          totalPrice: bundle.totalPrice,
          bundleDiscount: `${bundle.bundleDiscount}%`,
          finalPrice: bundle.finalPrice,
          pricePerPerson: bundle.pricePerPerson,
          commission: bundle.commission,
        },
      },
    });
  } catch (error) {
    console.error("Join bundle via share token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to join bundle",
      error: error.message,
    });
  }
};

// Update bundle status (Provider actions: accept, complete, cancel) - WITH ZIP CODE VALIDATION
exports.updateBundleStatus = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { status, cancellationReason } = req.body;

    console.log("🔧 Update bundle status request:", {
      bundleId,
      status,
      cancellationReason,
      providerId: req.user._id,
    });

    // Validate required fields
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Validate status
    const validStatuses = ["accepted", "completed", "cancelled", "in_progress"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Use: ${validStatuses.join(", ")}`,
      });
    }

    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
      });
    }

    // Get provider details to check ZIP code
    const provider = await ServiceProvider.findById(req.user._id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // ✅ ZIP CODE VALIDATION: Check if provider serves this zip code
    const servesThisZip = provider.serviceAreas.some(
      (area) => area.zipCode === bundle.zipCode && area.isActive
    );

    if (!servesThisZip) {
      return res.status(400).json({
        success: false,
        message: "You do not serve in this bundle's service area (ZIP code)",
        details: {
          providerServiceAreas: provider.serviceAreas
            .filter((area) => area.isActive)
            .map((area) => area.zipCode),
          bundleZipCode: bundle.zipCode,
        },
      });
    }

    // SPECIAL CASE: When accepting a bundle, assign the provider
    if (status === "accepted") {
      // If bundle doesn't have a provider, assign the current provider
      if (!bundle.provider) {
        bundle.provider = req.user._id;

        // Add to provider offers if not already there
        const existingOffer = bundle.providerOffers.find(
          (offer) => offer.provider.toString() === req.user._id.toString()
        );

        if (!existingOffer) {
          bundle.providerOffers.push({
            provider: req.user._id,
            message: `Provider ${provider.businessNameRegistered} accepted this bundle`,
            status: "accepted",
          });
        }
      }
      // If bundle already has a provider, check if it's the same provider
      else if (bundle.provider.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "This bundle is already assigned to another provider",
        });
      }
    }
    // For other status changes, check if provider owns this bundle
    else if (
      bundle.provider &&
      bundle.provider.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Not authorized to update this bundle - you are not the assigned provider",
      });
    }

    // Validate current status transitions
    const validTransitions = {
      pending: ["accepted", "cancelled"],
      accepted: ["in_progress", "completed", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
      full: ["accepted", "in_progress", "completed", "cancelled"],
    };

    if (!validTransitions[bundle.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${bundle.status} to ${status}`,
      });
    }

    // Store previous status for response
    const previousStatus = bundle.status;

    // Update bundle status
    bundle.status = status;

    // Add status history
    if (!bundle.statusHistory) {
      bundle.statusHistory = [];
    }

    let statusNote = "";
    let changedBy = "provider";

    if (status === "accepted") {
      statusNote = `Bundle accepted by ${provider.businessNameRegistered}`;
    } else if (status === "in_progress") {
      statusNote = "Bundle work started by provider";
    } else if (status === "completed") {
      statusNote = "Bundle completed by provider";
      bundle.completedAt = new Date();
    } else if (status === "cancelled") {
      // Make cancellationReason optional - use default if not provided
      statusNote = cancellationReason || "Bundle cancelled by provider";
      bundle.cancelledBy = "provider";
      bundle.cancellationReason = cancellationReason || "No reason provided";
    }

    bundle.statusHistory.push({
      status: status,
      note: statusNote,
      changedBy: changedBy,
      timestamp: new Date(),
    });

    await bundle.save();

    // Populate for response
    await bundle.populate("creator", "firstName lastName profileImage phone");
    await bundle.populate(
      "participants.customer",
      "firstName lastName profileImage phone"
    );
    await bundle.populate(
      "provider",
      "businessNameRegistered businessLogo rating phone email businessAddress"
    );

    // Prepare response message
    let message = `Bundle ${status} successfully`;
    if (status === "accepted") {
      message = "Bundle accepted successfully";
    } else if (status === "in_progress") {
      message = "Bundle marked as in progress";
    } else if (status === "completed") {
      message = "Bundle completed successfully";
    } else if (status === "cancelled") {
      message = "Bundle cancelled successfully";
    }

    console.log(
      `✅ Bundle ${bundleId} status updated from ${previousStatus} to ${status} by provider in ZIP ${provider.businessAddress.zipCode}`
    );

    res.json({
      success: true,
      message,
      data: {
        bundle: {
          _id: bundle._id,
          title: bundle.title,
          status: bundle.status,
          previousStatus,
          provider: bundle.provider,
          creator: bundle.creator,
          participants: bundle.participants,
          finalPrice: bundle.finalPrice,
          commission: bundle.commission,
          completedAt: bundle.completedAt,
          statusHistory: bundle.statusHistory,
          zipCode: bundle.zipCode,
        },
        providerZipCode: provider.businessAddress.zipCode,
      },
    });
  } catch (error) {
    console.error("Update bundle status error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid bundle ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update bundle status",
      error: error.message,
    });
  }
};

// Provider accepts a specific bundle (alternative to providerAcceptBundle)
exports.providerAcceptBundleDirect = async (req, res) => {
  try {
    const { bundleId } = req.params;

    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
      });
    }

    // Check if bundle is still available
    if (bundle.status !== "pending" && bundle.status !== "full") {
      return res.status(400).json({
        success: false,
        message: "Bundle is no longer available for acceptance",
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
      provider.servicesProvided.some((sp) => sp.name === service)
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

    // Set provider and update status
    bundle.provider = req.user._id;
    bundle.status = "accepted";

    // Add to provider offers if not already there
    if (!existingOffer) {
      bundle.providerOffers.push({
        provider: req.user._id,
        message: `Provider ${provider.businessNameRegistered} accepted this bundle`,
        status: "accepted",
      });
    }

    // Add status history
    if (!bundle.statusHistory) {
      bundle.statusHistory = [];
    }

    bundle.statusHistory.push({
      status: "accepted",
      note: `Bundle accepted by ${provider.businessNameRegistered}`,
      changedBy: "provider",
      timestamp: new Date(),
    });

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
          maxBundleCapacity: provider.maxBundleCapacity,
        },
        pricing: {
          totalPrice: bundle.totalPrice,
          bundleDiscount: `${bundle.bundleDiscount}%`,
          finalPrice: bundle.finalPrice,
          pricePerPerson: bundle.pricePerPerson,
          maxParticipants: bundle.maxParticipants,
          commission: bundle.commission,
        },
      },
    });
  } catch (error) {
    console.error("Provider accept bundle direct error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept bundle",
      error: error.message,
    });
  }
};

// Get provider's bundle statistics
exports.getProviderBundleStats = async (req, res) => {
  try {
    const providerId = req.user._id;

    const stats = await Bundle.aggregate([
      { $match: { provider: new mongoose.Types.ObjectId(providerId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$finalPrice" },
          totalCommission: { $sum: "$commission.amount" },
        },
      },
    ]);

    // Format stats
    const statusCounts = {
      pending: 0,
      accepted: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
    };

    const revenueStats = {
      totalRevenue: 0,
      totalCommission: 0,
      netEarnings: 0,
    };

    stats.forEach((stat) => {
      statusCounts[stat._id] = stat.count;
      statusCounts.total += stat.count;

      if (stat._id === "completed") {
        revenueStats.totalRevenue += stat.totalRevenue || 0;
        revenueStats.totalCommission += stat.totalCommission || 0;
        revenueStats.netEarnings =
          revenueStats.totalRevenue - revenueStats.totalCommission;
      }
    });

    // Get recent bundles
    const recentBundles = await Bundle.find({ provider: providerId })
      .populate("creator", "firstName lastName profileImage")
      .sort({ updatedAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        statusCounts,
        revenueStats,
        recentBundles,
        provider: {
          id: req.user._id,
          name: `${req.user.firstName} ${req.user.lastName}`,
          businessName: req.user.businessNameRegistered,
        },
      },
    });
  } catch (error) {
    console.error("Get provider bundle stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bundle statistics",
      error: error.message,
    });
  }
};

exports.initializeBundleSettings = initializeBundleSettings;
