const mongoose = require("mongoose");

const MovieSchema = new mongoose.Schema({
    tmdbId: { type: String, unique: true, sparse: true }, // optional TMDB ID to prevent duplicates
    title: { type: String, required: true },
    genre: { type: [String], required: true },          // e.g. ["Action", "Sci-Fi"]
    language: { type: String, required: true },          // e.g. "English"
    duration: { type: Number, required: true },          // in minutes, e.g. 148
    releaseDate: { type: Date, required: true },
    rating: { type: Number, default: 0 },               // out of 10
    description: { type: String, required: true },
    posterUrl: { type: String, required: true },         // image URL for poster
    trailerUrl: { type: String },                        // YouTube trailer link
    cast: { type: [String] },                            // e.g. ["Actor1", "Actor2"]
    director: { type: String },
    nowShowing: { type: Boolean, default: true },        // is the movie currently in theaters?
    status: {
        type: String,
        enum: ["In Theatres", "OTT", "Coming Soon"],
        default: "In Theatres"
    }
}, { timestamps: true });

module.exports = mongoose.model("Movie", MovieSchema);
