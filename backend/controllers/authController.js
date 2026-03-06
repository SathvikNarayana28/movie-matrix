const User = require("../models/User");
const Review = require("../models/Review");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../utils/sendEmail");

// REGISTER
exports.register = async (req, res) => {
    try {
        const { name, email, password, adminCode } = req.body;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "User already exists" });

        // Determine role: only grant admin if correct secret code is provided
        let role = "user";
        if (adminCode) {
            if (adminCode === process.env.ADMIN_SECRET_CODE) {
                role = "admin";
            } else {
                return res.status(400).json({ msg: "Invalid admin access code" });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        user = new User({
            name,
            email,
            password: hashedPassword,
            role
        });

        await user.save();

        res.json({ msg: role === "admin" ? "Admin registered successfully" : "User registered successfully" });

    } catch (err) {
        res.status(500).send("Server Error");
    }
};

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });

    } catch (err) {
        res.status(500).send("Server Error");
    }
};

// GET LOGGED-IN USER PROFILE
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ msg: "User not found" });

        const reviewCount = await Review.countDocuments({ user: req.user.id });

        const userObj = user.toObject();
        userObj.reviewCount = reviewCount;
        res.json(userObj);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// RESET PASSWORD (logged-in user only)
exports.resetPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // 1. Validate inputs
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ msg: "Current password and new password are required" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ msg: "New password must be at least 6 characters" });
        }

        // 2. Find user by JWT id (includes password field)
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        // 3. Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: "Current password is incorrect" });
        }

        // 4. Hash new password and save
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ msg: "Password updated successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// FORGOT PASSWORD — generate token and send reset email
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ msg: "Email is required" });
        }

        // Generic message — don't reveal whether email exists (security)
        const genericMsg = "If an account with that email exists, a password reset link has been sent.";

        // 1. Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            // Return same message to prevent email enumeration
            return res.json({ msg: genericMsg });
        }

        // 2. Generate a secure random token (32 bytes → 64-char hex string)
        const rawToken = crypto.randomBytes(32).toString("hex");

        // 3. Hash the token before storing in DB
        //    (so even if DB is compromised, tokens can't be used)
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        // 4. Save hashed token + expiry (15 minutes) to the user document
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        await user.save();

        // 5. Build the reset URL (raw token goes in the URL, NOT the hashed one)
        const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";
        const resetURL = `${frontendURL}/reset-password/${rawToken}`;

        // 6. Send the reset email
        await sendPasswordResetEmail(user.email, user.name, resetURL);
        console.log(`✅ Password reset email sent to ${user.email}`);

        res.json({ msg: genericMsg });

    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ msg: "Failed to process request. Please try again." });
    }
};

// RESET PASSWORD WITH TOKEN — verify token from email link and set new password
exports.resetPasswordWithToken = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        // 1. Validate inputs
        if (!token) {
            return res.status(400).json({ msg: "Reset token is required" });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ msg: "Password must be at least 6 characters" });
        }

        // 2. Hash the raw token from the URL to match against DB
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        // 3. Find user with matching token AND token not expired
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }    // token must not be expired
        });

        if (!user) {
            return res.status(400).json({ msg: "Invalid or expired reset token. Please request a new one." });
        }

        // 4. Hash the new password and save
        user.password = await bcrypt.hash(password, 10);

        // 5. Clear the reset token fields (one-time use)
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;

        await user.save();
        console.log(`✅ Password reset successful for ${user.email}`);

        res.json({ msg: "Password has been reset successfully. You can now login with your new password." });

    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ msg: "Failed to reset password. Please try again." });
    }
};
