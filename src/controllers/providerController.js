const ServiceProvider = require("../models/ServiceProvider");
const ProviderServiceFeedback = require("../models/ProviderServiceFeedback");
const Customer = require("../models/Customer");

// Update provider's bundle capacity
exports.updateProviderCapacity = async (req, res) => {
  try {
    const { maxBundleCapacity } = req.body;

    if (maxBundleCapacity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Max bundle capacity is required",
      });
    }

    if (maxBundleCapacity < 1 || maxBundleCapacity > 10) {
      return res.status(400).json({
        success: false,
        message: "Bundle capacity must be between 1 and 10 people",
      });
    }

    // Update provider's own capacity
    const provider = await ServiceProvider.findByIdAndUpdate(
      req.user._id,
      { maxBundleCapacity },
      { new: true, runValidators: true }
    ).select("-password");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    res.json({
      success: true,
      message: `Your bundle capacity updated to ${maxBundleCapacity} people successfully`,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          maxBundleCapacity: provider.maxBundleCapacity,
        },
      },
    });
  } catch (error) {
    console.error("Update provider capacity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update bundle capacity",
      error: error.message,
    });
  }
};

// Get provider's bundle capacity
exports.getProviderCapacity = async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.user._id).select(
      "maxBundleCapacity businessNameRegistered servicesProvided"
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    res.json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          maxBundleCapacity: provider.maxBundleCapacity,
          servicesProvided: provider.servicesProvided,
        },
      },
    });
  } catch (error) {
    console.error("Get provider capacity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bundle capacity",
      error: error.message,
    });
  }
};

// Public: list all services for a provider (by providerId)
exports.getProviderServices = async (req, res) => {
  try {
    const { providerId } = req.params;

    const provider = await ServiceProvider.findById(providerId).select(
      "businessNameRegistered servicesProvided rating totalReviews"
    );

    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider not found" });
    }

    res.json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
        },
        services: provider.servicesProvided,
      },
    });
  } catch (error) {
    console.error("Get provider services error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch services",
        error: error.message,
      });
  }
};

// Get authenticated provider's own services
exports.getMyServices = async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.user._id).select(
      "businessNameRegistered servicesProvided rating totalReviews"
    );

    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider not found" });
    }

    res.json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
        },
        services: provider.servicesProvided,
      },
    });
  } catch (error) {
    console.error("Get my services error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch services",
        error: error.message,
      });
  }
};

// Public: get a specific service, other services, and feedback (by providerId)
exports.getProviderServiceDetailWithFeedback = async (req, res) => {
  try {
    const { providerId, serviceName } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const provider = await ServiceProvider.findById(providerId).select(
      "businessNameRegistered servicesProvided rating totalReviews"
    );
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider not found" });
    }

    const selectedService = provider.servicesProvided.find(
      (s) => s.name === serviceName
    );
    if (!selectedService) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Service not found for this provider",
        });
    }

    const otherServices = provider.servicesProvided.filter(
      (s) => s.name !== serviceName
    );

    // Feedback aggregation & list
    const [feedback, total, agg] = await Promise.all([
      ProviderServiceFeedback.find({ provider: providerId, serviceName })
        .populate("customer", "firstName lastName profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ProviderServiceFeedback.countDocuments({
        provider: providerId,
        serviceName,
      }),
      ProviderServiceFeedback.aggregate([
        {
          $match: {
            provider: new (require("mongoose").Types.ObjectId)(providerId),
            serviceName,
          },
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const averageRating = agg.length ? Number(agg[0].avgRating.toFixed(2)) : 0;

    res.json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
        },
        selectedService,
        otherServices,
        feedback: {
          list: feedback,
          pagination: {
            current: parseInt(page),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
          aggregates: {
            averageRating,
            totalReviews: total,
          },
        },
      },
    });
  } catch (error) {
    console.error("Get provider service details error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch service details",
        error: error.message,
      });
  }
};

// Get authenticated provider's own service details
exports.getMyServiceDetail = async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const provider = await ServiceProvider.findById(req.user._id).select(
      "businessNameRegistered servicesProvided rating totalReviews"
    );
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider not found" });
    }

    const selectedService = provider.servicesProvided.find(
      (s) => s.name === serviceName
    );
    if (!selectedService) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }

    const otherServices = provider.servicesProvided.filter(
      (s) => s.name !== serviceName
    );

    // Feedback aggregation & list
    const [feedback, total, agg] = await Promise.all([
      ProviderServiceFeedback.find({ provider: req.user._id, serviceName })
        .populate("customer", "firstName lastName profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ProviderServiceFeedback.countDocuments({
        provider: req.user._id,
        serviceName,
      }),
      ProviderServiceFeedback.aggregate([
        { $match: { provider: req.user._id, serviceName } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const averageRating = agg.length ? Number(agg[0].avgRating.toFixed(2)) : 0;

    res.json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
        },
        selectedService,
        otherServices,
        feedback: {
          list: feedback,
          pagination: {
            current: parseInt(page),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
          aggregates: {
            averageRating,
            totalReviews: total,
          },
        },
      },
    });
  } catch (error) {
    console.error("Get my service details error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch service details",
        error: error.message,
      });
  }
};

// Public: get provider + selected service details by query params (clean endpoint)
exports.getProviderServiceDetailsByQuery = async (req, res) => {
  try {
    const { providerId, serviceName, page = 1, limit = 10 } = req.query;

    if (!providerId || !serviceName) {
      return res
        .status(400)
        .json({
          success: false,
          message: "providerId and serviceName are required",
        });
    }

    // Reuse logic from the path-param handler
    req.params = { providerId, serviceName };
    req.query = { page, limit };
    return exports.getProviderServiceDetailWithFeedback(req, res);
  } catch (error) {
    console.error("Get provider service details by query error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch service details",
        error: error.message,
      });
  }
};

// Authenticated customer: add feedback for a provider service
exports.addProviderServiceFeedback = async (req, res) => {
  try {
    const { providerId, serviceName } = req.params;
    const { rating, comment } = req.body;

    if (rating === undefined || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5" });
    }

    // Validate provider and service
    const provider = await ServiceProvider.findById(providerId).select(
      "servicesProvided"
    );
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider not found" });
    }
    const hasService = provider.servicesProvided.some(
      (s) => s.name === serviceName
    );
    if (!hasService) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Service not found for this provider",
        });
    }

    // Optional: ensure customer exists
    const customer = await Customer.findById(req.user._id).select("_id");
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    const doc = await ProviderServiceFeedback.create({
      provider: providerId,
      customer: req.user._id,
      serviceName,
      rating,
      comment: comment || "",
    });

    await doc.populate("customer", "firstName lastName profileImage");

    res
      .status(201)
      .json({
        success: true,
        message: "Feedback submitted",
        data: { feedback: doc },
      });
  } catch (error) {
    console.error("Add provider service feedback error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to submit feedback",
        error: error.message,
      });
  }
};

// ========== SERVICE AREAS CONTROLLERS ========== //

// Public: Get all service areas for a specific provider (by providerId)
exports.getProviderServiceAreas = async (req, res) => {
  try {
    const { providerId } = req.params;

    // Validate providerId
    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required",
      });
    }

    // Find provider and select only service areas
    const provider = await ServiceProvider.findById(providerId).select(
      "businessNameRegistered serviceAreas isActive"
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    if (!provider.isActive) {
      return res.status(400).json({
        success: false,
        message: "Provider account is not active",
      });
    }

    res.json({
      success: true,
      message: "Service areas retrieved successfully",
      data: {
        provider: {
          id: provider._id,
          businessName: provider.businessNameRegistered,
          isActive: provider.isActive,
        },
        serviceAreas: provider.serviceAreas,
        totalAreas: provider.serviceAreas.length,
        activeAreas: provider.serviceAreas.filter((area) => area.isActive)
          .length,
      },
    });
  } catch (error) {
    console.error("Get provider service areas error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch service areas",
      error: error.message,
    });
  }
};

// Get service areas for the authenticated provider (own profile)
exports.getMyServiceAreas = async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.user._id).select(
      "businessNameRegistered serviceAreas"
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    res.json({
      success: true,
      message: "Your service areas retrieved successfully",
      data: {
        serviceAreas: provider.serviceAreas,
        totalAreas: provider.serviceAreas.length,
        activeAreas: provider.serviceAreas.filter((area) => area.isActive)
          .length,
      },
    });
  } catch (error) {
    console.error("Get my service areas error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your service areas",
      error: error.message,
    });
  }
};

// Add a new service area
exports.addServiceArea = async (req, res) => {
  try {
    const { zipCode, city, state } = req.body;

    // Validate input
    if (!zipCode || !city || !state) {
      return res.status(400).json({
        success: false,
        message: "Zip code, city, and state are required",
      });
    }

    const provider = await ServiceProvider.findById(req.user._id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // Check if service area already exists
    const existingArea = provider.serviceAreas.find(
      (area) => area.zipCode === zipCode && area.isActive
    );

    if (existingArea) {
      return res.status(400).json({
        success: false,
        message: "Service area already exists for this zip code",
      });
    }

    // Add new service area
    provider.serviceAreas.push({
      zipCode,
      city,
      state,
      isActive: true,
      addedAt: new Date(),
    });

    await provider.save();

    res.status(201).json({
      success: true,
      message: "Service area added successfully",
      data: {
        serviceArea: provider.serviceAreas[provider.serviceAreas.length - 1],
        totalAreas: provider.serviceAreas.length,
      },
    });
  } catch (error) {
    console.error("Add service area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add service area",
      error: error.message,
    });
  }
};

// Update a service area
exports.updateServiceArea = async (req, res) => {
  try {
    const { areaId } = req.params;
    const { zipCode, city, state, isActive } = req.body;

    const provider = await ServiceProvider.findById(req.user._id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // Find the service area
    const serviceArea = provider.serviceAreas.id(areaId);

    if (!serviceArea) {
      return res.status(404).json({
        success: false,
        message: "Service area not found",
      });
    }

    // Update fields if provided
    if (zipCode) serviceArea.zipCode = zipCode;
    if (city) serviceArea.city = city;
    if (state) serviceArea.state = state;
    if (typeof isActive === "boolean") serviceArea.isActive = isActive;

    await provider.save();

    res.json({
      success: true,
      message: "Service area updated successfully",
      data: {
        serviceArea,
      },
    });
  } catch (error) {
    console.error("Update service area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update service area",
      error: error.message,
    });
  }
};

// Remove a service area (soft delete by setting isActive to false)
exports.removeServiceArea = async (req, res) => {
  try {
    const { areaId } = req.params;

    const provider = await ServiceProvider.findById(req.user._id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // Find the service area
    const serviceArea = provider.serviceAreas.id(areaId);

    if (!serviceArea) {
      return res.status(404).json({
        success: false,
        message: "Service area not found",
      });
    }

    // Soft delete by setting isActive to false
    serviceArea.isActive = false;

    await provider.save();

    res.json({
      success: true,
      message: "Service area removed successfully",
      data: {
        removedArea: serviceArea,
        activeAreas: provider.serviceAreas.filter((area) => area.isActive)
          .length,
      },
    });
  } catch (error) {
    console.error("Remove service area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove service area",
      error: error.message,
    });
  }
};

// Get providers by service area (zip code)
exports.getProvidersByServiceArea = async (req, res) => {
  try {
    const { zipCode } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!zipCode) {
      return res.status(400).json({
        success: false,
        message: "Zip code is required",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find providers who serve this zip code and are active
    const [providers, total] = await Promise.all([
      ServiceProvider.find({
        "serviceAreas.zipCode": zipCode,
        "serviceAreas.isActive": true,
        isActive: true,
        isApproved: true,
      })
        .select(
          "businessNameRegistered businessLogo servicesProvided rating totalReviews totalJobsCompleted serviceAreas hourlyRate description"
        )
        .skip(skip)
        .limit(parseInt(limit)),
      ServiceProvider.countDocuments({
        "serviceAreas.zipCode": zipCode,
        "serviceAreas.isActive": true,
        isActive: true,
        isApproved: true,
      }),
    ]);

    // Filter service areas to only show the matching zip code
    const providersWithFilteredAreas = providers.map((provider) => {
      const providerObj = provider.toObject();
      providerObj.serviceAreas = provider.serviceAreas.filter(
        (area) => area.zipCode === zipCode && area.isActive
      );
      return providerObj;
    });

    res.json({
      success: true,
      message: `Found ${providers.length} providers serving zip code ${zipCode}`,
      data: {
        providers: providersWithFilteredAreas,
        pagination: {
          current: parseInt(page),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get providers by service area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch providers by service area",
      error: error.message,
    });
  }
};
