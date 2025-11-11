const express = require("express");
const {
  getQuickChats,
  createQuickChat,
  deleteQuickChat,
  updateQuickChat,
} = require("../controllers/quickChatController");
const { auth } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication since quick chats are user-specific
router.get("/", auth, getQuickChats);
router.post("/", auth, createQuickChat);
router.delete("/:quickChatId", auth, deleteQuickChat);
router.put("/:quickChatId", auth, updateQuickChat);

module.exports = router;
