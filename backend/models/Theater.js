const mongoose = require("mongoose");

const TheaterSchema = new mongoose.Schema({
    name: { type: String, required: true },                // e.g. "AMB Cinemas"
    city: { type: String, required: true },                // e.g. "Hyderabad"
    area: { type: String, required: true },                // e.g. "Gachibowli"
    screens: { type: Number, required: true },             // e.g. 4
    totalSeatsPerScreen: { type: Number, required: true }  // e.g. 100
}, { timestamps: true });

module.exports = mongoose.model("Theater", TheaterSchema);
