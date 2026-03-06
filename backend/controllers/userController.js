const User = require("../models/User");
const Review = require("../models/Review");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer config for profile picture uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, "..", "uploads", "profile-pics");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.user.id}_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error("Only image files are allowed."));
    }
});

exports.uploadMiddleware = upload.single("profilePic");

// POST /api/users/upload-profile-pic — Upload or change profile picture
exports.uploadProfilePic = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided." });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        // Delete old profile pic file if it exists
        if (user.profilePic) {
            const oldPath = path.join(__dirname, "..", user.profilePic);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        // Save relative path in DB
        const relativePath = `/uploads/profile-pics/${req.file.filename}`;
        user.profilePic = relativePath;
        await user.save();

        res.json({ profilePic: relativePath, msg: "Profile picture updated!" });
    } catch (err) {
        console.error("Upload profile pic error:", err);
        res.status(500).json({ error: "Failed to upload profile picture." });
    }
};

// DELETE /api/users/remove-profile-pic — Remove current profile picture
exports.removeProfilePic = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        if (user.profilePic) {
            // Delete the file from disk
            const filePath = path.join(__dirname, "..", user.profilePic);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            // Clear the field in DB
            user.profilePic = "";
            await user.save();
        }

        res.json({ msg: "Profile picture removed." });
    } catch (err) {
        console.error("Remove profile pic error:", err);
        res.status(500).json({ error: "Failed to remove profile picture." });
    }
};

// GET /api/users/search?query=<name> — Search users by name
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.trim().length === 0) {
            return res.json([]);
        }

        const currentUserId = req.user.id;

        // Find users whose name matches the query (case-insensitive), exclude current user
        const users = await User.find({
            name: { $regex: query.trim(), $options: "i" },
            _id: { $ne: currentUserId }
        })
            .select("name followers following profilePic")
            .limit(10);

        // For each user, tell the frontend if the current user is already following them
        const currentUser = await User.findById(currentUserId).select("following");
        const followingIds = currentUser.following.map(id => id.toString());

        const results = users.map(user => ({
            _id: user._id,
            name: user.name,
            profilePic: user.profilePic || "",
            followersCount: user.followers.length,
            followingCount: user.following.length,
            isFollowing: followingIds.includes(user._id.toString())
        }));

        res.json(results);
    } catch (err) {
        console.error("Search users error:", err);
        res.status(500).json({ error: "Failed to search users." });
    }
};

// POST /api/users/follow/:userId — Follow a user
exports.followUser = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId;

        // Can't follow yourself
        if (currentUserId === targetUserId) {
            return res.status(400).json({ error: "You cannot follow yourself." });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found." });
        }

        // Check if already following
        const currentUser = await User.findById(currentUserId);
        if (currentUser.following.includes(targetUserId)) {
            return res.status(400).json({ error: "You are already following this user." });
        }

        // Add to current user's following list
        currentUser.following.push(targetUserId);
        await currentUser.save();

        // Add to target user's followers list
        targetUser.followers.push(currentUserId);
        await targetUser.save();

        res.json({ message: `You are now following ${targetUser.name}.` });
    } catch (err) {
        console.error("Follow user error:", err);
        res.status(500).json({ error: "Failed to follow user." });
    }
};

// POST /api/users/unfollow/:userId — Unfollow a user
exports.unfollowUser = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({ error: "You cannot unfollow yourself." });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found." });
        }

        const currentUser = await User.findById(currentUserId);
        if (!currentUser.following.includes(targetUserId)) {
            return res.status(400).json({ error: "You are not following this user." });
        }

        // Remove from current user's following list
        currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId);
        await currentUser.save();

        // Remove from target user's followers list
        targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId);
        await targetUser.save();

        res.json({ message: `You have unfollowed ${targetUser.name}.` });
    } catch (err) {
        console.error("Unfollow user error:", err);
        res.status(500).json({ error: "Failed to unfollow user." });
    }
};

// GET /api/users/:userId/followers — Get a user's followers
exports.getFollowers = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate("followers", "name profilePic");

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json(user.followers);
    } catch (err) {
        console.error("Get followers error:", err);
        res.status(500).json({ error: "Failed to fetch followers." });
    }
};

// GET /api/users/:userId/following — Get who a user follows
exports.getFollowing = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate("following", "name profilePic");

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json(user.following);
    } catch (err) {
        console.error("Get following error:", err);
        res.status(500).json({ error: "Failed to fetch following." });
    }
};

// GET /api/users/:userId/activity — Get recent activity for a user
exports.getUserActivity = async (req, res) => {
    try {
        const userId = req.params.userId;
        const activities = [];

        // 1. Reviews by the user
        const reviews = await Review.find({ user: userId })
            .populate("movie", "title")
            .sort({ createdAt: -1 })
            .limit(10);

        reviews.forEach(rev => {
            activities.push({
                type: "review",
                icon: "📝",
                text: `Reviewed ${rev.movie?.title || "a movie"}`,
                rating: rev.rating,
                createdAt: rev.createdAt
            });
        });

        // 2. Comments by the user on any review
        const reviewsWithComments = await Review.find({ "comments.user": userId })
            .populate("movie", "title")
            .select("comments movie");

        reviewsWithComments.forEach(rev => {
            rev.comments.forEach(c => {
                if (c.user && c.user.toString() === userId) {
                    activities.push({
                        type: "comment",
                        icon: "💬",
                        text: `Commented on a review for ${rev.movie?.title || "a movie"}`,
                        createdAt: c.createdAt
                    });
                }
            });
        });

        // 3. Upvotes by the user on others' reviews
        const upvotedReviews = await Review.find({ upvotes: userId, user: { $ne: userId } })
            .populate("movie", "title")
            .populate("user", "name")
            .sort({ createdAt: -1 })
            .limit(10);

        upvotedReviews.forEach(rev => {
            activities.push({
                type: "upvote",
                icon: "👍",
                text: `Upvoted ${rev.user?.name || "someone"}'s review on ${rev.movie?.title || "a movie"}`,
                createdAt: rev.updatedAt || rev.createdAt
            });
        });

        // 4. Users this person follows
        const user = await User.findById(userId).populate("following", "name createdAt");
        if (user && user.following && user.following.length > 0) {
            // Take at most 5 most recent follows
            const recentFollows = user.following.slice(-5).reverse();
            recentFollows.forEach(f => {
                activities.push({
                    type: "follow",
                    icon: "👥",
                    text: `Followed ${f.name}`,
                    createdAt: user.updatedAt
                });
            });
        }

        // Sort all activities by date (newest first) and limit to 15
        activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(activities.slice(0, 15));
    } catch (err) {
        console.error("Get user activity error:", err);
        res.status(500).json({ error: "Failed to load activity." });
    }
};

// GET /api/users/:userId/profile — Get public user profile with reviews
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select("name followers following createdAt profilePic");

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Get all reviews by this user
        const reviews = await Review.find({ user: req.params.userId })
            .populate("movie", "title posterUrl")
            .sort({ createdAt: -1 });

        res.json({
            _id: user._id,
            name: user.name,
            profilePic: user.profilePic || "",
            followersCount: user.followers.length,
            followingCount: user.following.length,
            joinedDate: user.createdAt,
            reviews
        });
    } catch (err) {
        console.error("Get user profile error:", err);
        res.status(500).json({ error: "Failed to fetch user profile." });
    }
};
