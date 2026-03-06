const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    searchUsers,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    getUserActivity,
    getUserProfile,
    uploadProfilePic,
    uploadMiddleware,
    removeProfilePic
} = require("../controllers/userController");

// Search route (must be before /:userId to avoid conflicts)
router.get("/search", authMiddleware, searchUsers);

// Upload profile picture (protected)
router.post("/upload-profile-pic", authMiddleware, uploadMiddleware, uploadProfilePic);

// Remove profile picture (protected)
router.delete("/remove-profile-pic", authMiddleware, removeProfilePic);

// Public routes
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);
router.get("/:userId/activity", getUserActivity);
router.get("/:userId/profile", getUserProfile);

// Protected routes (login required)
router.post("/follow/:userId", authMiddleware, followUser);
router.post("/unfollow/:userId", authMiddleware, unfollowUser);

module.exports = router;
