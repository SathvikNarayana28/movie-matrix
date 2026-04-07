const mongoose = require("mongoose");

// =============================================
//  SEAT GENERATION FUNCTION
//  Creates an array of seats: A1, A2, ... B1, B2 ...
//  Default: 10 rows × 10 seats = 100 seats
// =============================================
function generateSeats(rows = 10, seatsPerRow = 10) {
    const seats = [];
    for (let r = 0; r < rows; r++) {
        const rowLetter = String.fromCharCode(65 + r);  // A, B, C, ...
        for (let s = 1; s <= seatsPerRow; s++) {
            seats.push({
                seatId: `${rowLetter}${s}`,     // e.g. "A1", "B5"
                row: rowLetter,
                number: s,
                isBooked: false
            });
        }
    }
    return seats;
}

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
    price: { type: Number, required: true },           // base ticket price (kept for backward compat)
    pricing: {
        regular: { type: Number, default: 0 },
        silver: { type: Number, default: 0 },
        gold: { type: Number, default: 0 }
    },
    seats: [
        {
            seatId: { type: String, required: true },   // e.g. "A1"
            row: { type: String, required: true },      // e.g. "A"
            number: { type: Number, required: true },   // e.g. 1
            isBooked: { type: Boolean, default: false }, // false = available
            isLocked: { type: Boolean, default: false },
            lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            lockExpiresAt: { type: Date, default: null }
        }
    ]
}, { timestamps: true });

ShowtimeSchema.index({ movie: 1, date: 1, time: 1 });
ShowtimeSchema.index({ theater: 1, date: 1, time: 1 });

module.exports = mongoose.model("Showtime", ShowtimeSchema);
module.exports.generateSeats = generateSeats;
