const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Movie"                                    // list of saved movie IDs
    }],
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"                                     // users who follow this user
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"                                     // users this user follows
    }],
    resetPasswordToken: { type: String, default: null },     // hashed crypto token
    resetPasswordExpires: { type: Date, default: null }      // token expiry time
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
