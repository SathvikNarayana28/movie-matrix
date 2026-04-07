const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },        // 1–5 stars
    comment: { type: String, required: true, maxlength: 1000 },
    isVerifiedViewer: { type: Boolean, default: true },               // true = user had a confirmed booking
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],   // users who liked this review
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],  // users who upvoted
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // users who downvoted
    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

// One review per user per movie
ReviewSchema.index({ user: 1, movie: 1 }, { unique: true });
ReviewSchema.index({ movie: 1, createdAt: -1 });
ReviewSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Review", ReviewSchema);
