const mongoose = require("mongoose");

const TheaterSchema = new mongoose.Schema({
    name: { type: String, required: true },                // e.g. "AMB Cinemas"
    city: { type: String, required: true },                // e.g. "Hyderabad"
    area: { type: String, required: true },                // e.g. "Gachibowli"
    location: { type: String, default: "" },               // full address for Google Maps
    screens: { type: Number, required: true },             // e.g. 4
    totalSeatsPerScreen: { type: Number, required: true }, // e.g. 100
    lat: { type: Number },                                 // latitude
    lng: { type: Number }                                  // longitude
}, { timestamps: true });

TheaterSchema.index({ city: 1, area: 1 });

module.exports = mongoose.model("Theater", TheaterSchema);
