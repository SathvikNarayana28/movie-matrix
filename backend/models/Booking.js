const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",                                   // who booked
        required: true
    },
    showtime: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Showtime",                               // which show
        required: true
    },
    seats: {
        type: [String],                                // e.g. ["A1", "A2", "A3"]
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["confirmed", "cancelled"],              // only these 2 values allowed
        default: "confirmed"
    }
}, { timestamps: true });

module.exports = mongoose.model("Booking", BookingSchema);
