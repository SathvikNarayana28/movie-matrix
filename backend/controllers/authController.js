const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
        res.json(user);
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
