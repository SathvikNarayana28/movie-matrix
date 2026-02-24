const mongoose = require("mongoose");

const ShowtimeSchema = new mongoose.Schema({
    movie: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Movie",                                  // links to Movie collection
        required: true
    },
    theater: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Theater",                                // links to Theater collection
        required: true
    },
    date: { type: String, required: true },            // e.g. "2026-03-01"
    time: { type: String, required: true },            // e.g. "06:30 PM"
    price: { type: Number, required: true },           // ticket price, e.g. 250
    availableSeats: { type: Number, required: true }   // seats left for this show
}, { timestamps: true });

module.exports = mongoose.model("Showtime", ShowtimeSchema);
