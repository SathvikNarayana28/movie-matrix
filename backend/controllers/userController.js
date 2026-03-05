const User = require("../models/User");
const Review = require("../models/Review");

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
            .select("name followers following")
            .limit(10);

        // For each user, tell the frontend if the current user is already following them
        const currentUser = await User.findById(currentUserId).select("following");
        const followingIds = currentUser.following.map(id => id.toString());

        const results = users.map(user => ({
            _id: user._id,
            name: user.name,
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
            .populate("followers", "name");

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
            .populate("following", "name");

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json(user.following);
    } catch (err) {
        console.error("Get following error:", err);
        res.status(500).json({ error: "Failed to fetch following." });
    }
};

// GET /api/users/:userId/profile — Get public user profile with reviews
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select("name followers following createdAt");

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
