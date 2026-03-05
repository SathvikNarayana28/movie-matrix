const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    getUserProfile
} = require("../controllers/userController");

// Public routes
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);
router.get("/:userId/profile", getUserProfile);

// Protected routes (login required)
router.post("/follow/:userId", authMiddleware, followUser);
router.post("/unfollow/:userId", authMiddleware, unfollowUser);

module.exports = router;
