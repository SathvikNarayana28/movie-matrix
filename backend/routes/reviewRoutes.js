const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    createReviewFromBookings,
    createReview,
    getMovieReviews,
    getAverageRating,
    checkEligibility,
    updateReview,
    deleteReview,
    getReviewsFeed,
    getAllReviews,
    toggleLikeReview,
    voteReview,
    addCommentToReview,
    getTopReviewers,
    getUserReviews
} = require("../controllers/reviewController");

// Feed and leaderboard routes (must be before /:movieId to avoid conflicts)
router.get("/feed", authMiddleware, getReviewsFeed);
router.get("/all", authMiddleware, getAllReviews);
router.get("/top-reviewers", getTopReviewers);
router.get("/user/:userId", getUserReviews);
router.post("/", authMiddleware, createReviewFromBookings);

// Public routes
router.get("/:movieId", getMovieReviews);
router.get("/:movieId/average", getAverageRating);

// Protected routes (login required)
router.get("/:movieId/eligibility", authMiddleware, checkEligibility);
router.post("/:movieId", authMiddleware, createReview);
router.put("/:reviewId", authMiddleware, updateReview);
router.delete("/:reviewId", authMiddleware, deleteReview);
router.post("/:reviewId/like", authMiddleware, toggleLikeReview);
router.post("/:reviewId/vote", authMiddleware, voteReview);
router.post("/:reviewId/comment", authMiddleware, addCommentToReview);

module.exports = router;
