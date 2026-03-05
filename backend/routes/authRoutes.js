const express = require("express");
const router = express.Router();
const { register, login, getProfile, resetPassword, forgotPassword, resetPasswordWithToken } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);                          // POST /api/auth/forgot-password (public)
router.post("/reset-password/:token", resetPasswordWithToken);            // POST /api/auth/reset-password/:token (public)
router.get("/me", authMiddleware, getProfile);                            // GET  /api/auth/me (protected)
router.put("/reset-password", authMiddleware, resetPassword);             // PUT  /api/auth/reset-password (protected)

module.exports = router;
