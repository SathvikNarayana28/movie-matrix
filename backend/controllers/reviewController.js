const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Showtime = require("../models/Showtime");
const User = require("../models/User");
const mongoose = require("mongoose");

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
        const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
        const activeShowtime = await Showtime.findOne({
            movie: movieId,
            date: { $gte: today }
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
        await review.populate("user", "name");

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
            .populate("user", "name")
            .sort({ createdAt: -1 });

        // Find all showtimes for this movie to check bookings
        const movieShowtimeIds = await Showtime.find({ movie: movieId }).select("_id");
        const showtimeIds = movieShowtimeIds.map(st => st._id);

        // Check which reviewers have confirmed bookings
        const bookings = await Booking.find({
            showtime: { $in: showtimeIds },
            status: "confirmed"
        }).select("user");
        const bookedUserIds = bookings.map(b => b.user.toString());

        // Add verifiedViewer flag to each review
        const reviewsWithBadge = reviews.map(rev => {
            const revObj = rev.toObject();
            revObj.verifiedViewer = bookedUserIds.includes(rev.user._id.toString());
            return revObj;
        });

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

        await review.populate("user", "name");
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
        res.json({ message: "Review deleted successfully." });
    } catch (err) {
        console.error("Delete review error:", err);
        res.status(500).json({ error: "Failed to delete review." });
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
            .populate("user", "name")
            .populate("movie", "title posterUrl")
            .sort({ createdAt: -1 })
            .limit(50);

        // Dynamically compute verifiedViewer for each review by checking bookings
        const reviewsWithBadge = await Promise.all(reviews.map(async (rev) => {
            const revObj = rev.toObject();
            if (rev.movie) {
                const showtimeIds = await Showtime.find({ movie: rev.movie._id }).select("_id");
                const sIds = showtimeIds.map(s => s._id);
                const booking = await Booking.findOne({
                    user: rev.user._id,
                    showtime: { $in: sIds },
                    status: "confirmed"
                });
                revObj.verifiedViewer = !!booking;
            } else {
                revObj.verifiedViewer = false;
            }
            return revObj;
        }));

        res.json(reviewsWithBadge);
    } catch (err) {
        console.error("Reviews feed error:", err);
        res.status(500).json({ error: "Failed to fetch reviews feed." });
    }
};

// GET /api/reviews/top-reviewers — Leaderboard of users with most reviews
exports.getTopReviewers = async (req, res) => {
    try {
        const topReviewers = await Review.aggregate([
            {
                $group: {
                    _id: "$user",
                    reviewCount: { $sum: 1 },
                    avgRating: { $avg: "$rating" }
                }
            },
            { $sort: { reviewCount: -1 } },
            { $limit: 10 }
        ]);

        // Populate user names
        const populatedReviewers = await User.populate(topReviewers, {
            path: "_id",
            select: "name"
        });

        const results = populatedReviewers.map(r => ({
            userId: r._id._id,
            name: r._id.name,
            reviewCount: r.reviewCount,
            avgRating: Math.round(r.avgRating * 10) / 10
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
