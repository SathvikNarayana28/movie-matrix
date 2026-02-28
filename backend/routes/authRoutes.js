const express = require("express");
const router = express.Router();
const { register, login, getProfile, resetPassword } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getProfile);             // GET  /api/auth/me (protected)
router.put("/reset-password", authMiddleware, resetPassword); // PUT /api/auth/reset-password (protected)

module.exports = router;
