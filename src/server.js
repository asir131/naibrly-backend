require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const dotenv = require("dotenv");
const http = require("http");
const connectDB = require("./config/database");
const { initializeAdmin } = require("./controllers/adminController");
const { initializeDefaultData } = require("./controllers/categoryController");
const { uploadProfileImage } = require("./config/cloudinary");
const { initializeBundleSettings } = require("./controllers/bundleController");
const { initSocket } = require("./socket");

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:3000", // For local development
      process.env.CLIENT_URL, // For production
    ],
    credentials: true,
  })
);
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Initialize admin user on server start
initializeAdmin();
initializeDefaultData();
initializeBundleSettings();

// Debug route for testing uploads
app.post(
  "/api/debug/upload-test",
  uploadProfileImage.single("testImage"),
  (req, res) => {
    console.log("Debug upload - File received:", req.file);
    res.json({
      success: true,
      file: req.file,
      message: "Upload test completed",
    });
  }
);

// API listing route at root
app.get("/", (req, res) => {
  const port = process.env.PORT || 5000;
  res.json({
    success: true,
    message: `Naibrly API is running on port ${port}`,
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      admin: "/api/admin",
      users: "/api/users",
      zip: "/api/zip",
      serviceRequests: "/api/service-requests",
      passwordReset: "/api/auth/password-reset",
      verification: "/api/verify-information",
      upload: "/api/upload",
      categories: "/api/categories",
      bundles: "/api/bundles",
      bundleSettings: "/api/bundle-settings",
      providers: "/api/providers",
      quickChats: "/api/quick-chats",
    },
    health: "/health",
    test: "/api/test",
  });
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/users", require("./routes/users"));
app.use("/api/zip", require("./routes/zip"));
app.use("/api/service-requests", require("./routes/serviceRequests"));
app.use("/api/auth/password-reset", require("./routes/passwordReset"));
app.use("/api/verify-information", require("./routes/verification"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/bundles", require("./routes/bundles"));
app.use("/api/bundle-settings", require("./routes/bundleSettings"));
app.use("/api/providers", require("./routes/providers"));
app.use("/api/quick-chats", require("./routes/quickChats"));

app.use("/api/conversations", require("./routes/conversation"));

// Test routes
app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5000,
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Naibrly API is working!",
    port: process.env.PORT || 5000,
  });
});

app.get("/api/debug/test", (req, res) => {
  res.json({
    message: "Debug route works!",
    port: process.env.PORT || 5000,
  });
});

app.post("/api/debug/test-post", (req, res) => {
  res.json({
    message: "POST debug route works!",
    body: req.body,
    port: process.env.PORT || 5000,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "production" ? {} : err.message,
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    requestedUrl: req.originalUrl,
    port: process.env.PORT || 5000,
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`👤 Admin username: ${process.env.ADMIN_USERNAME}`);
  console.log(`🔗 API Root: http://localhost:${PORT}/`);
  console.log(`💬 Socket.io running on port ${PORT}`);
});
