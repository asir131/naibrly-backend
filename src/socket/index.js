const { Server: SocketIOServer } = require("socket.io");
const jwt = require("jsonwebtoken");
const Conversation = require("../models/Conversation");
const QuickChat = require("../models/QuickChat");
const ServiceRequest = require("../models/ServiceRequest");
const ServiceProvider = require("../models/ServiceProvider");
const Customer = require("../models/Customer");
const Bundle = require("../models/Bundle");

// Store user connections
const userSocketMap = new Map();
let io;

// Improved authentication middleware
const authenticateSocket = async (socket, next) => {
  console.log("🔐 Authentication attempt for socket:", socket.id);

  const token =
    socket.handshake.auth.token ||
    socket.handshake.headers.token ||
    socket.handshake.query.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.userId) {
        socket.userId = decoded.userId.toString();

        // Get user role from database to ensure it's correct
        let user = await Customer.findById(decoded.userId);
        if (user) {
          socket.userRole = user.role;
        } else {
          user = await ServiceProvider.findById(decoded.userId);
          if (user) {
            socket.userRole = user.role;
          } else {
            throw new Error("User not found");
          }
        }

        console.log(
          `✅ User authenticated: ${socket.userId} (${socket.userRole})`
        );
        socket.isAuthenticated = true;
        return next();
      }
    } catch (error) {
      console.log("❌ Token verification failed:", error.message);
    }
  }

  console.log("⚠️  No valid token, allowing unauthenticated connection");
  socket.isAuthenticated = false;
  next();
};

// Helper function to create or get conversation for both service requests and bundles
async function getOrCreateConversation(socket, requestId, bundleId) {
  try {
    console.log("🔄 getOrCreateConversation called with:", {
      requestId,
      bundleId,
    });

    let conversation;
    let customerId, providerId;

    if (requestId) {
      console.log("🔍 Looking for service request:", requestId);
      // For service request conversation
      const serviceRequest = await ServiceRequest.findById(requestId)
        .populate("customer")
        .populate("provider");

      if (!serviceRequest) {
        console.log("❌ Service request not found:", requestId);
        throw new Error("Service request not found");
      }

      console.log("✅ Service request found:", {
        customer: serviceRequest.customer?._id,
        provider: serviceRequest.provider?._id,
      });

      // Check if user has access to this conversation
      const hasAccess =
        socket.userId === serviceRequest.customer._id.toString() ||
        (serviceRequest.provider &&
          socket.userId === serviceRequest.provider._id.toString());

      if (!hasAccess) {
        console.log("❌ Access denied for user:", socket.userId);
        throw new Error("Access denied to this conversation");
      }

      conversation = await Conversation.findOne({ requestId });

      if (!conversation) {
        console.log(
          "🆕 Creating new conversation for service request:",
          requestId
        );
        conversation = new Conversation({
          customerId: serviceRequest.customer._id,
          providerId: serviceRequest.provider._id,
          requestId: requestId,
          messages: [],
          isActive: true,
        });
        await conversation.save();
        console.log(
          "✅ Conversation created for service request:",
          conversation._id
        );
      } else {
        console.log(
          "📁 Found existing conversation for service request:",
          conversation._id
        );
      }
    } else if (bundleId) {
      console.log("🔍 Looking for bundle:", bundleId);
      // For bundle conversation
      const bundle = await Bundle.findById(bundleId)
        .populate("creator")
        .populate("provider");

      if (!bundle) {
        console.log("❌ Bundle not found:", bundleId);
        throw new Error("Bundle not found");
      }

      console.log("✅ Bundle found:", {
        creator: bundle.creator?._id,
        provider: bundle.provider?._id,
        status: bundle.status,
      });

      // Check if user has access to this bundle conversation
      const hasAccess =
        socket.userId === bundle.creator._id.toString() ||
        (bundle.provider && socket.userId === bundle.provider._id.toString());

      if (!hasAccess) {
        console.log("❌ Access denied for user:", socket.userId);
        throw new Error("Access denied to this bundle conversation");
      }

      conversation = await Conversation.findOne({ bundleId });

      if (!conversation) {
        console.log("🆕 Creating new conversation for bundle:", bundleId);
        conversation = new Conversation({
          customerId: bundle.creator._id,
          providerId: bundle.provider ? bundle.provider._id : null,
          bundleId: bundleId,
          messages: [],
          isActive: true,
        });
        await conversation.save();
        console.log("✅ Conversation created for bundle:", conversation._id);
      } else {
        console.log(
          "📁 Found existing conversation for bundle:",
          conversation._id
        );
      }
    } else {
      throw new Error("Either requestId or bundleId is required");
    }

    return conversation;
  } catch (error) {
    console.error("❌ Error in getOrCreateConversation:", error.message);
    throw error;
  }
}

// Helper functions
async function handleJoinConversation(socket, data) {
  try {
    console.log("👥 Join conversation request:", data);

    if (!socket.userId || !socket.userRole) {
      socket.emit("message", {
        type: "error",
        data: { message: "Authentication required to join conversations" },
      });
      return;
    }

    const { requestId, bundleId } = data;

    if (!requestId && !bundleId) {
      socket.emit("message", {
        type: "error",
        data: { message: "requestId or bundleId is required" },
      });
      return;
    }

    const conversation = await getOrCreateConversation(
      socket,
      requestId,
      bundleId
    );

    if (conversation) {
      socket.join(`conversation_${conversation._id}`);
      console.log(
        `✅ User ${socket.userId} joined conversation ${conversation._id}`
      );

      socket.emit("message", {
        type: "joined_conversation",
        data: {
          conversationId: conversation._id,
          requestId: requestId,
          bundleId: bundleId,
          message: "Successfully joined conversation",
          timestamp: new Date().toISOString(),
        },
      });

      // Send conversation history
      const populatedConversation = await Conversation.findById(
        conversation._id
      )
        .populate("customerId", "firstName lastName profileImage")
        .populate(
          "providerId",
          "firstName lastName businessNameRegistered profileImage"
        );

      socket.emit("message", {
        type: "conversation_history",
        data: {
          conversation: {
            _id: populatedConversation._id,
            customer: populatedConversation.customerId,
            provider: populatedConversation.providerId,
            requestId: populatedConversation.requestId,
            bundleId: populatedConversation.bundleId,
          },
          messages: populatedConversation.messages,
        },
      });
    }
  } catch (error) {
    console.error("❌ Join conversation error:", error);
    socket.emit("message", {
      type: "error",
      data: {
        message: error.message,
        requestId: data.requestId,
        bundleId: data.bundleId,
      },
    });
  }
}

async function handleSendQuickChat(socket, data) {
  try {
    console.log("💬 Send quick chat request:", data);

    // Validate authentication and role
    if (!socket.userId || !socket.userRole) {
      socket.emit("message", {
        type: "error",
        data: { message: "Authentication required to send messages" },
      });
      return;
    }

    const { requestId, bundleId, quickChatId } = data;

    if (!quickChatId) {
      socket.emit("message", {
        type: "error",
        data: { message: "quickChatId is required" },
      });
      return;
    }

    console.log("🔍 Looking for quick chat:", quickChatId);
    // Get quick chat content - verify it belongs to the user
    const quickChat = await QuickChat.findOne({
      _id: quickChatId,
      createdBy: socket.userId,
      createdByRole: socket.userRole,
    });

    if (!quickChat) {
      console.log("❌ Quick chat not found or doesn't belong to user");
      socket.emit("message", {
        type: "error",
        data: { message: "Quick chat not found or access denied" },
      });
      return;
    }

    console.log("✅ Quick chat found:", quickChat.content);

    // Get or create conversation
    console.log("🔄 Getting or creating conversation...");
    const conversation = await getOrCreateConversation(
      socket,
      requestId,
      bundleId
    );

    if (!conversation) {
      console.log("❌ Conversation not found after getOrCreate");
      socket.emit("message", {
        type: "error",
        data: { message: "Conversation not found" },
      });
      return;
    }

    console.log("✅ Conversation ready:", conversation._id);
    console.log("📝 Current messages count:", conversation.messages.length);

    // Create message with validated role
    const message = {
      senderId: socket.userId,
      senderRole: socket.userRole,
      content: quickChat.content,
      quickChatId: quickChatId,
      timestamp: new Date(),
    };

    console.log("📨 Creating message:", {
      senderId: socket.userId,
      senderRole: socket.userRole,
      content: quickChat.content,
    });

    // Add message to conversation
    console.log("➕ Adding message to conversation array...");
    conversation.messages.push(message);
    conversation.lastMessage = quickChat.content;
    conversation.lastMessageAt = new Date();

    // Save the conversation with the new message
    console.log("💾 Saving conversation to database...");
    await conversation.save();
    console.log("✅ Conversation saved successfully!");
    console.log("📊 New messages count:", conversation.messages.length);

    // Verify the message was saved by fetching the conversation again
    const updatedConversation = await Conversation.findById(conversation._id);
    console.log(
      "🔍 Verification - messages in DB:",
      updatedConversation.messages.length
    );

    // Increment quick chat usage count
    console.log("📈 Incrementing quick chat usage...");
    quickChat.usageCount += 1;
    await quickChat.save();
    console.log("✅ Quick chat usage count updated:", quickChat.usageCount);

    // Emit to everyone in the conversation room
    console.log(
      "📤 Emitting new_message to room:",
      `conversation_${conversation._id}`
    );
    io.to(`conversation_${conversation._id}`).emit("message", {
      type: "new_message",
      data: {
        conversationId: conversation._id,
        message: message,
        sender: {
          id: socket.userId,
          role: socket.userRole,
        },
      },
    });

    // Notify the other user(s)
    if (conversation.providerId) {
      const otherUserId =
        socket.userRole === "customer"
          ? conversation.providerId
          : conversation.customerId;
      if (otherUserId && userSocketMap.has(otherUserId.toString())) {
        io.to(`user_${otherUserId}`).emit("message", {
          type: "conversation_updated",
          data: {
            conversationId: conversation._id,
            lastMessage: quickChat.content,
            lastMessageAt: new Date(),
          },
        });
      }
    } else if (conversation.bundleId) {
      // For bundles without provider, notify the bundle creator if someone else is messaging
      const otherUserId =
        socket.userRole === "customer" ? null : conversation.customerId;
      if (otherUserId && userSocketMap.has(otherUserId.toString())) {
        io.to(`user_${otherUserId}`).emit("message", {
          type: "conversation_updated",
          data: {
            conversationId: conversation._id,
            lastMessage: quickChat.content,
            lastMessageAt: new Date(),
          },
        });
      }
    }

    console.log("🎉 Sending message_sent confirmation");
    socket.emit("message", {
      type: "message_sent",
      data: {
        success: true,
        conversationId: conversation._id,
        message: "Message sent successfully",
        savedMessage: message,
      },
    });

    console.log("🎉 Complete message flow finished successfully!");
  } catch (error) {
    console.error("❌ Send quick chat error:", error);
    console.error("❌ Error details:", {
      message: error.message,
      stack: error.stack,
      userId: socket.userId,
      requestId: data.requestId,
      bundleId: data.bundleId,
      quickChatId: data.quickChatId,
    });
    socket.emit("message", {
      type: "error",
      data: { message: "Failed to send message: " + error.message },
    });
  }
}

async function handleAuthenticate(socket, data) {
  try {
    const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
    socket.userId = decoded.userId.toString();

    // Get user from database to ensure correct role
    let user = await Customer.findById(socket.userId);
    if (user) {
      socket.userRole = user.role;
    } else {
      user = await ServiceProvider.findById(socket.userId);
      if (user) {
        socket.userRole = user.role;
      } else {
        throw new Error("User not found in database");
      }
    }

    socket.isAuthenticated = true;
    userSocketMap.set(socket.userId, socket.id);

    console.log(
      `✅ Socket ${socket.id} authenticated as user ${socket.userId} (${socket.userRole})`
    );

    socket.emit("message", {
      type: "authenticated",
      data: {
        success: true,
        userId: socket.userId,
        userRole: socket.userRole,
        message: "Authentication successful",
      },
    });
  } catch (error) {
    console.log("❌ Authentication failed:", error.message);
    socket.emit("message", {
      type: "error",
      data: { message: "Authentication failed: " + error.message },
    });
  }
}

async function handleGetConversation(socket, data) {
  try {
    const { requestId, bundleId } = data;

    const query = {};
    if (requestId) query.requestId = requestId;
    if (bundleId) query.bundleId = bundleId;

    const conversation = await Conversation.findOne(query)
      .populate("customerId", "firstName lastName profileImage")
      .populate(
        "providerId",
        "firstName lastName businessNameRegistered profileImage"
      )
      .sort({ "messages.timestamp": 1 });

    if (conversation) {
      socket.emit("message", {
        type: "conversation_history",
        data: {
          conversation: {
            _id: conversation._id,
            customer: conversation.customerId,
            provider: conversation.providerId,
            requestId: conversation.requestId,
            bundleId: conversation.bundleId,
          },
          messages: conversation.messages,
        },
      });
    } else {
      socket.emit("message", {
        type: "conversation_history",
        data: {
          conversation: null,
          messages: [],
        },
      });
    }
  } catch (error) {
    console.error("❌ Get conversation error:", error);
    socket.emit("message", {
      type: "error",
      data: { message: "Failed to get conversation" },
    });
  }
}

const initSocket = (server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    connectTimeout: 30000,
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const userId = socket.userId;

    if (userId && socket.userRole) {
      console.log(
        `✅ Client connected: ${socket.id} for user ${userId} (${socket.userRole})`
      );
      userSocketMap.set(userId, socket.id);
      socket.join(`user_${userId}`);

      socket.emit("message", {
        type: "welcome",
        data: {
          message: "Welcome! You are authenticated.",
          userId: userId,
          userRole: socket.userRole,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      console.log(`✅ Client connected: ${socket.id} (unauthenticated)`);
      socket.isAuthenticated = false;

      socket.emit("message", {
        type: "welcome",
        data: {
          message: "Welcome! Please authenticate to use chat features.",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Handle Postman's default "message" events
    socket.on("message", (data) => {
      console.log("📨 Message received:", data);

      if (typeof data === "string") {
        socket.emit("message", {
          type: "pong",
          data: {
            message: "Pong!",
            yourMessage: data,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const { type, data: eventData } = data;

      if (!type) {
        socket.emit("message", {
          type: "error",
          data: { message: "Message must have 'type' field" },
        });
        return;
      }

      switch (type) {
        case "join_conversation":
          handleJoinConversation(socket, eventData);
          break;
        case "send_quick_chat":
          handleSendQuickChat(socket, eventData);
          break;
        case "authenticate":
          handleAuthenticate(socket, eventData);
          break;
        case "get_conversation":
          handleGetConversation(socket, eventData);
          break;
        case "ping":
          socket.emit("message", {
            type: "pong",
            data: {
              message: "Pong from server!",
              yourData: eventData,
              timestamp: new Date().toISOString(),
            },
          });
          break;
        default:
          socket.emit("message", {
            type: "error",
            data: { message: "Unknown event type: " + type },
          });
      }
    });

    // Direct event handlers
    socket.on("authenticate", (data) => {
      const token = typeof data === "string" ? data : data.token;
      handleAuthenticate(socket, { token });
    });

    socket.on("join_conversation", (data) => {
      console.log("👥 Direct join_conversation:", data);
      handleJoinConversation(socket, data);
    });

    socket.on("send_quick_chat", (data) => {
      console.log("💬 Direct send_quick_chat:", data);
      handleSendQuickChat(socket, data);
    });

    socket.on("get_conversation", (data) => {
      console.log("📋 Direct get_conversation:", data);
      handleGetConversation(socket, data);
    });

    // Test events
    socket.on("ping", (data) => {
      console.log("🏓 Ping received:", data);
      socket.emit("pong", {
        message: "Pong! Server is working!",
        yourData: data,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", (reason) => {
      const userId = socket.userId;
      if (userId) {
        console.log(`❌ Client disconnected: ${socket.id} for user ${userId}`);
        userSocketMap.delete(userId);
      } else {
        console.log(`❌ Client disconnected: ${socket.id}`);
      }
    });
  });

  console.log("✅ Socket.io server initialized with conversation system");
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

const emitToUser = (userId, event, data) => {
  const socketId = userSocketMap.get(userId.toString());
  if (socketId) {
    getIO().to(socketId).emit(event, data);
    return true;
  }
  return false;
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
};
