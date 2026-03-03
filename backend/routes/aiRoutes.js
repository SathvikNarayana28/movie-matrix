const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const aiController = require("../controllers/aiController");

// GET  /api/ai/recommend — personalized movie recommendations
router.get("/recommend", authMiddleware, aiController.getRecommendations);

// GET  /api/ai/profile — user's computed preference profile
router.get("/profile", authMiddleware, aiController.getUserProfile);

// POST /api/ai/chat — conversational AI assistant
router.post("/chat", authMiddleware, aiController.chat);

module.exports = router;
