const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Showtime = require("../models/Showtime");
const User = require("../models/User");
const mongoose = require("mongoose");
const { buildShowDateTime } = require("../utils/dateTime");
const { invalidateUserProfileCache } = require("../services/profileBuilder");
const { invalidateRecommendationCache } = require("../services/recommendationEngine");

async function buildVerifiedViewerLookup(movieIds) {
    const normalizedMovieIds = [...new Set(
        (movieIds || []).filter(Boolean).map((movieId) => movieId.toString())
    )];

    if (normalizedMovieIds.length === 0) {
        return new Set();
    }

    const showtimes = await Showtime.find({ movie: { $in: normalizedMovieIds } })
        .select("_id movie")
        .lean();

    if (showtimes.length === 0) {
        return new Set();
    }

    const showtimeToMovieId = new Map(
        showtimes.map((showtime) => [showtime._id.toString(), showtime.movie.toString()])
    );

    const bookings = await Booking.find({
        showtime: { $in: showtimes.map((showtime) => showtime._id) },
        status: "confirmed"
    })
        .select("user showtime")
        .lean();

    const verifiedLookup = new Set();
    bookings.forEach((booking) => {
        const movieId = showtimeToMovieId.get(booking.showtime.toString());
        if (movieId && booking.user) {
            verifiedLookup.add(`${movieId}:${booking.user.toString()}`);
        }
    });

    return verifiedLookup;
}

function attachVerifiedViewer(reviews, verifiedLookup) {
    return reviews.map((review) => {
        const reviewObject = review.toObject();
        const movieId = review.movie ? (review.movie._id || review.movie).toString() : null;
        const userId = review.user ? (review.user._id || review.user).toString() : null;

        reviewObject.verifiedViewer = Boolean(
            movieId && userId && verifiedLookup.has(`${movieId}:${userId}`)
        );

        return reviewObject;
    });
}

// POST /api/reviews — Create a review from My Bookings page
// Body: { movieId, rating, comment }
exports.createReviewFromBookings = async (req, res) => {
    try {
        const { movieId, rating, comment } = req.body;
        const userId = req.user.id;
        const numericRating = Number(rating);
        const commentText = typeof comment === "string" ? comment.trim() : "";

        if (!movieId || !mongoose.Types.ObjectId.isValid(movieId)) {
            return res.status(400).json({ error: "Valid movieId is required." });
        }
        if (!numericRating || !commentText) {
            return res.status(400).json({ error: "Rating and comment are required." });
        }
        if (numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5." });
        }
        if (commentText.length > 1000) {
            return res.status(400).json({ error: "Comment must be 1000 characters or less." });
        }

        const existing = await Review.findOne({ user: userId, movie: movieId });
        if (existing) {
            return res.status(400).json({ error: "You have already reviewed this movie." });
        }

        const bookings = await Booking.find({ user: userId, status: "confirmed" })
            .populate({
                path: "showtime",
                select: "movie date time"
            });

        const now = new Date();
        const eligibleBooking = bookings.find((booking) => {
            const showtime = booking.showtime;
            if (!showtime || !showtime.movie) return false;

            const bookedMovieId = showtime.movie.toString();
            if (bookedMovieId !== movieId) return false;

            const showDateTime = buildShowDateTime(showtime.date, showtime.time);
            return showDateTime && showDateTime < now;
        });

        if (!eligibleBooking) {
            return res.status(403).json({ error: "You can review only after a booked showtime has finished." });
        }

        const review = await Review.create({
            user: userId,
            movie: movieId,
            rating: numericRating,
            comment: commentText
        });

        await review.populate("user", "name profilePic");
        await review.populate("movie", "title posterUrl");

        invalidateUserProfileCache(userId);
        invalidateRecommendationCache(userId);

        res.status(201).json(review);
    } catch (err) {
        console.error("Create review from bookings error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ error: "You have already reviewed this movie." });
        }
        res.status(500).json({ error: "Failed to submit review." });
    }
};

// POST /api/reviews/:movieId — Create a review (with booking + showtime verification)
exports.createReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const movieId = req.params.movieId;
        const userId = req.user.id;

        if (!rating || !comment) {
            return res.status(400).json({ error: "Rating and comment are required." });
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5." });
        }
        if (comment.length > 1000) {
            return res.status(400).json({ error: "Comment must be 1000 characters or less." });
        }

        // STEP 1: Check if user has a booking for this movie
        // Booking stores showtimeId, so first find all showtimes for this movie
        const movieShowtimeIds = await Showtime.find({ movie: movieId }).select("_id");
        const showtimeIds = movieShowtimeIds.map(st => st._id);

        const hasBooking = await Booking.findOne({
            user: userId,
            showtime: { $in: showtimeIds },
            status: "confirmed"
        });

        if (!hasBooking) {
            return res.status(403).json({ error: "Only users who booked this movie can leave a review." });
        }

        // STEP 2: Check if movie currently has active showtimes (running in theatres)
        const movieShowtimes = await Showtime.find({ movie: movieId })
            .select("date time")
            .lean();
        const now = new Date();
        const activeShowtime = movieShowtimes.some((showtime) => {
            const showDateTime = buildShowDateTime(showtime.date, showtime.time);
            return showDateTime && showDateTime > now;
        });

        if (!activeShowtime) {
            return res.status(400).json({ error: "Reviews can only be added while movie is running in theatres." });
        }

        // STEP 3: Check if user already reviewed this movie
        const existing = await Review.findOne({ user: userId, movie: movieId });
        if (existing) {
            return res.status(400).json({ error: "You have already reviewed this movie." });
        }

        // STEP 4: Create review
        const review = await Review.create({
            user: userId,
            movie: movieId,
            rating,
            comment
        });

        // Populate user name before returning
        await review.populate("user", "name profilePic");

        invalidateUserProfileCache(userId);
        invalidateRecommendationCache(userId);

        res.status(201).json(review);
    } catch (err) {
        console.error("Create review error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ error: "You have already reviewed this movie." });
        }
        res.status(500).json({ error: "Failed to submit review." });
    }
};

// GET /api/reviews/:movieId/eligibility — Check if logged-in user can review this movie
exports.checkEligibility = async (req, res) => {
    try {
        const movieId = req.params.movieId;
        const userId = req.user.id;

        // Check if user has a confirmed booking for this movie
        const movieShowtimeIds = await Showtime.find({ movie: movieId }).select("_id");
        const showtimeIds = movieShowtimeIds.map(st => st._id);

        const hasBooking = await Booking.findOne({
            user: userId,
            showtime: { $in: showtimeIds },
            status: "confirmed"
        });

        // Check if user already reviewed
        const alreadyReviewed = await Review.findOne({ user: userId, movie: movieId });

        res.json({
            hasBooked: !!hasBooking,
            alreadyReviewed: !!alreadyReviewed
        });
    } catch (err) {
        console.error("Check eligibility error:", err);
        res.status(500).json({ error: "Failed to check review eligibility." });
    }
};

// GET /api/reviews/:movieId — Get all reviews for a movie (with verifiedViewer check)
exports.getMovieReviews = async (req, res) => {
    try {
        const movieId = req.params.movieId;
        const reviews = await Review.find({ movie: movieId })
            .populate("user", "name profilePic")
            .sort({ createdAt: -1 });

        const verifiedLookup = await buildVerifiedViewerLookup([movieId]);
        const reviewsWithBadge = attachVerifiedViewer(reviews, verifiedLookup);

        res.json(reviewsWithBadge);
    } catch (err) {
        console.error("Get reviews error:", err);
        res.status(500).json({ error: "Failed to fetch reviews." });
    }
};

// GET /api/reviews/:movieId/average — Get average rating & count
exports.getAverageRating = async (req, res) => {
    try {
        const movieId = new mongoose.Types.ObjectId(req.params.movieId);

        const result = await Review.aggregate([
            { $match: { movie: movieId } },
            {
                $group: {
                    _id: "$movie",
                    averageRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        if (result.length === 0) {
            return res.json({ averageRating: 0, totalReviews: 0 });
        }

        res.json({
            averageRating: Math.round(result[0].averageRating * 10) / 10,  // round to 1 decimal
            totalReviews: result[0].totalReviews
        });
    } catch (err) {
        console.error("Average rating error:", err);
        res.status(500).json({ error: "Failed to calculate average rating." });
    }
};

// PUT /api/reviews/:reviewId — Edit own review
exports.updateReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;

        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({ error: "Rating must be between 1 and 5." });
        }
        if (comment && comment.length > 1000) {
            return res.status(400).json({ error: "Comment must be 1000 characters or less." });
        }

        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ error: "Review not found." });
        }

        // Only the review author can edit
        if (review.user.toString() !== req.user.id) {
            return res.status(403).json({ error: "You can only edit your own review." });
        }

        if (rating) review.rating = rating;
        if (comment) review.comment = comment;
        await review.save();

        await review.populate("user", "name profilePic");
        invalidateUserProfileCache(req.user.id);
        invalidateRecommendationCache(req.user.id);
        res.json(review);
    } catch (err) {
        console.error("Update review error:", err);
        res.status(500).json({ error: "Failed to update review." });
    }
};

// DELETE /api/reviews/:reviewId — Delete own review
exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ error: "Review not found." });
        }

        // Only the review author can delete
        if (review.user.toString() !== req.user.id) {
            return res.status(403).json({ error: "You can only delete your own review." });
        }

        await review.deleteOne();
        invalidateUserProfileCache(req.user.id);
        invalidateRecommendationCache(req.user.id);
        res.json({ message: "Review deleted successfully." });
    } catch (err) {
        console.error("Delete review error:", err);
        res.status(500).json({ error: "Failed to delete review." });
    }
};

// GET /api/reviews/all — All reviews on the platform (newest first)
exports.getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate("user", "name profilePic")
            .populate("movie", "title posterUrl")
            .populate("comments.user", "name profilePic")
            .sort({ createdAt: -1 })
            .limit(50);

        const verifiedLookup = await buildVerifiedViewerLookup(
            reviews.map((review) => review.movie?._id || review.movie)
        );
        const reviewsWithBadge = attachVerifiedViewer(reviews, verifiedLookup);

        res.json(reviewsWithBadge);
    } catch (err) {
        console.error("All reviews error:", err);
        res.status(500).json({ error: "Failed to fetch all reviews." });
    }
};

// GET /api/reviews/feed — Reviews from the current user + users they follow (newest first)
exports.getReviewsFeed = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id).select("following");
        if (!currentUser) {
            return res.status(404).json({ error: "User not found." });
        }

        // Include both the current user's own reviews AND reviews from followed users
        const feedUserIds = [req.user.id, ...currentUser.following];

        const reviews = await Review.find({ user: { $in: feedUserIds } })
            .populate("user", "name profilePic")
            .populate("movie", "title posterUrl")
            .populate("comments.user", "name profilePic")
            .sort({ createdAt: -1 })
            .limit(50);

        const verifiedLookup = await buildVerifiedViewerLookup(
            reviews.map((review) => review.movie?._id || review.movie)
        );
        const reviewsWithBadge = attachVerifiedViewer(reviews, verifiedLookup);

        res.json(reviewsWithBadge);
    } catch (err) {
        console.error("Reviews feed error:", err);
        res.status(500).json({ error: "Failed to fetch reviews feed." });
    }
};

// GET /api/reviews/top-reviewers — Leaderboard of users sorted by total upvotes
exports.getTopReviewers = async (req, res) => {
    try {
        const topReviewers = await Review.aggregate([
            {
                $group: {
                    _id: "$user",
                    reviewCount: { $sum: 1 },
                    avgRating: { $avg: "$rating" },
                    totalUpvotes: { $sum: { $size: { $ifNull: ["$upvotes", []] } } }
                }
            },
            { $sort: { totalUpvotes: -1 } },
            { $limit: 10 }
        ]);

        // Populate user names
        const populatedReviewers = await User.populate(topReviewers, {
            path: "_id",
            select: "name profilePic"
        });

        const results = populatedReviewers.map(r => ({
            userId: r._id._id,
            name: r._id.name,
            profilePic: r._id.profilePic || "",
            reviewCount: r.reviewCount,
            avgRating: Math.round(r.avgRating * 10) / 10,
            totalUpvotes: r.totalUpvotes
        }));

        res.json(results);
    } catch (err) {
        console.error("Top reviewers error:", err);
        res.status(500).json({ error: "Failed to fetch top reviewers." });
    }
};

// POST /api/reviews/:reviewId/like — Like or unlike a review (toggle)
exports.toggleLikeReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ error: "Review not found." });
        }

        const userId = req.user.id;
        const alreadyLiked = review.likes.some(id => id.toString() === userId);

        if (alreadyLiked) {
            // Unlike
            review.likes = review.likes.filter(id => id.toString() !== userId);
        } else {
            // Like
            review.likes.push(userId);
        }

        await review.save();
        res.json({ liked: !alreadyLiked, likesCount: review.likes.length });
    } catch (err) {
        console.error("Toggle like error:", err);
        res.status(500).json({ error: "Failed to toggle like." });
    }
};

// POST /api/reviews/:reviewId/vote — Upvote or downvote a review (Reddit/Quora style)
exports.voteReview = async (req, res) => {
    try {
        const { voteType } = req.body;
        const userId = req.user.id;

        if (!voteType || !["upvote", "downvote"].includes(voteType)) {
            return res.status(400).json({ error: "voteType must be 'upvote' or 'downvote'." });
        }

        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ error: "Review not found." });
        }

        const alreadyUpvoted = (review.upvotes || []).some(id => id.toString() === userId);
        const alreadyDownvoted = (review.downvotes || []).some(id => id.toString() === userId);

        if (voteType === "upvote") {
            if (alreadyUpvoted) {
                // Already upvoted → remove upvote (toggle off)
                review.upvotes = review.upvotes.filter(id => id.toString() !== userId);
            } else {
                // Remove downvote if exists, then add upvote
                if (alreadyDownvoted) {
                    review.downvotes = review.downvotes.filter(id => id.toString() !== userId);
                }
                review.upvotes.push(userId);
            }
        } else {
            // voteType === "downvote"
            if (alreadyDownvoted) {
                // Already downvoted → remove downvote (toggle off)
                review.downvotes = review.downvotes.filter(id => id.toString() !== userId);
            } else {
                // Remove upvote if exists, then add downvote
                if (alreadyUpvoted) {
                    review.upvotes = review.upvotes.filter(id => id.toString() !== userId);
                }
                review.downvotes.push(userId);
            }
        }

        await review.save();

        res.json({
            upvotes: review.upvotes,
            downvotes: review.downvotes,
            score: review.upvotes.length - review.downvotes.length
        });
    } catch (err) {
        console.error("Vote review error:", err);
        res.status(500).json({ error: "Failed to vote on review." });
    }
};

// POST /api/reviews/:reviewId/comment — Add a comment to a review
exports.addCommentToReview = async (req, res) => {
    try {
        const { text } = req.body;
        const userId = req.user.id;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: "Comment text is required." });
        }
        if (text.length > 500) {
            return res.status(400).json({ error: "Comment must be 500 characters or less." });
        }

        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ error: "Review not found." });
        }

        // Push the new comment
        review.comments.push({
            user: userId,
            text: text.trim(),
            createdAt: new Date()
        });

        await review.save();

        // Populate the user names in comments before returning
        await review.populate("comments.user", "name profilePic");

        res.status(201).json({ comments: review.comments });
    } catch (err) {
        console.error("Add comment error:", err);
        res.status(500).json({ error: "Failed to add comment." });
    }
};

// GET /api/reviews/user/:userId — All reviews by a specific user
exports.getUserReviews = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ error: "Invalid userId." });
        }

        const reviews = await Review.find({ user: req.params.userId })
            .populate("movie", "title posterUrl")
            .sort({ createdAt: -1 });

        res.json(reviews);
    } catch (err) {
        console.error("Get user reviews error:", err);
        res.status(500).json({ error: "Failed to fetch user reviews." });
    }
};
