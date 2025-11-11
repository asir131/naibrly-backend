const QuickChat = require("../models/QuickChat");

// Get all quick chats for the current user
exports.getQuickChats = async (req, res) => {
  try {
    // Get quick chats created by this user only
    const quickChats = await QuickChat.find({
      createdBy: req.user._id,
      createdByRole: req.user.role,
      isActive: true,
    }).sort({ usageCount: -1, createdAt: -1 });

    res.json({
      success: true,
      data: { quickChats },
    });
  } catch (error) {
    console.error("Get quick chats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quick chats",
      error: error.message,
    });
  }
};

// Create new quick chat (no category required)
exports.createQuickChat = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Quick chat content is required",
      });
    }

    // Check if similar quick chat already exists for this user
    const existingQuickChat = await QuickChat.findOne({
      createdBy: req.user._id,
      createdByRole: req.user.role,
      content: content.trim(),
      isActive: true,
    });

    if (existingQuickChat) {
      return res.status(400).json({
        success: false,
        message: "You already have a quick chat with similar content",
      });
    }

    const quickChat = new QuickChat({
      content: content.trim(),
      createdBy: req.user._id,
      createdByRole: req.user.role,
    });

    await quickChat.save();

    res.status(201).json({
      success: true,
      message: "Quick chat created successfully",
      data: { quickChat },
    });
  } catch (error) {
    console.error("Create quick chat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create quick chat",
      error: error.message,
    });
  }
};

// Delete quick chat (user can only delete their own)
exports.deleteQuickChat = async (req, res) => {
  try {
    const { quickChatId } = req.params;

    const quickChat = await QuickChat.findOneAndDelete({
      _id: quickChatId,
      createdBy: req.user._id, // Users can only delete their own quick chats
      createdByRole: req.user.role,
    });

    if (!quickChat) {
      return res.status(404).json({
        success: false,
        message: "Quick chat not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Quick chat deleted successfully",
    });
  } catch (error) {
    console.error("Delete quick chat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete quick chat",
      error: error.message,
    });
  }
};

// Update quick chat content
exports.updateQuickChat = async (req, res) => {
  try {
    const { quickChatId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Quick chat content is required",
      });
    }

    const quickChat = await QuickChat.findOneAndUpdate(
      {
        _id: quickChatId,
        createdBy: req.user._id, // Users can only update their own quick chats
        createdByRole: req.user.role,
      },
      {
        content: content.trim(),
      },
      { new: true, runValidators: true }
    );

    if (!quickChat) {
      return res.status(404).json({
        success: false,
        message: "Quick chat not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Quick chat updated successfully",
      data: { quickChat },
    });
  } catch (error) {
    console.error("Update quick chat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update quick chat",
      error: error.message,
    });
  }
};
