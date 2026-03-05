const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    createReview,
    getMovieReviews,
    getAverageRating,
    checkEligibility,
    updateReview,
    deleteReview
} = require("../controllers/reviewController");

// Public routes
router.get("/:movieId", getMovieReviews);
router.get("/:movieId/average", getAverageRating);

// Protected routes (login required)
router.get("/:movieId/eligibility", authMiddleware, checkEligibility);
router.post("/:movieId", authMiddleware, createReview);
router.put("/:reviewId", authMiddleware, updateReview);
router.delete("/:reviewId", authMiddleware, deleteReview);

module.exports = router;
