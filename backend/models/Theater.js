const mongoose = require("mongoose");

const TheaterSchema = new mongoose.Schema({
    name: { type: String, required: true },           // e.g. "PVR Cinemas"
    location: { type: String, required: true },        // e.g. "Hyderabad, Forum Mall"
    totalSeats: { type: Number, required: true }       // e.g. 120
}, { timestamps: true });

module.exports = mongoose.model("Theater", TheaterSchema);
