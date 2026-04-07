const User = require("../models/User");
const { invalidateUserProfileCache } = require("../services/profileBuilder");
const { invalidateRecommendationCache } = require("../services/recommendationEngine");

// TOGGLE FAVORITE (add if not saved, remove if already saved)
exports.toggleFavorite = async (req, res) => {
    try {
        const movieId = req.params.movieId;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        // Check if movie is already in favorites
        const index = user.favorites.findIndex(
            favId => favId.toString() === movieId
        );

        if (index === -1) {
            // Not in favorites — add it
            user.favorites.push(movieId);
            await user.save();
            invalidateUserProfileCache(req.user.id);
            invalidateRecommendationCache(req.user.id);
            res.json({ msg: "Movie added to favorites", favorites: user.favorites });
        } else {
            // Already in favorites — remove it
            user.favorites.splice(index, 1);
            await user.save();
            invalidateUserProfileCache(req.user.id);
            invalidateRecommendationCache(req.user.id);
            res.json({ msg: "Movie removed from favorites", favorites: user.favorites });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET ALL FAVORITE MOVIES OF THE LOGGED-IN USER
exports.getMyFavorites = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate("favorites", "title posterUrl genre language rating");
            // fills in movie details instead of just IDs

        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        res.json(user.favorites);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};
