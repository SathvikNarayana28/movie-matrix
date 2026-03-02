const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const authMiddleware = require("../middleware/authMiddleware");

// Initialize Razorpay instance with test keys
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// CREATE RAZORPAY ORDER
// Called by frontend before opening Razorpay checkout
router.post("/create-order", authMiddleware, async (req, res) => {
    try {
        const { amount } = req.body;  // amount in rupees from frontend

        if (!amount || amount <= 0) {
            return res.status(400).json({ msg: "Invalid amount" });
        }

        const options = {
            amount: Math.round(amount * 100),  // Razorpay expects amount in paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID   // frontend needs this to open checkout
        });

    } catch (err) {
        console.error("Razorpay order creation failed:", err.message);
        res.status(500).json({ msg: "Failed to create payment order" });
    }
});

// VERIFY RAZORPAY PAYMENT SIGNATURE
// Called by frontend after successful payment, before confirming booking
router.post("/verify", authMiddleware, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ msg: "Missing payment details" });
        }

        // Generate expected signature using HMAC SHA256
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expectedSignature === razorpay_signature) {
            res.json({ verified: true, paymentId: razorpay_payment_id });
        } else {
            res.status(400).json({ verified: false, msg: "Payment verification failed" });
        }

    } catch (err) {
        console.error("Payment verification error:", err.message);
        res.status(500).json({ msg: "Payment verification failed" });
    }
});

module.exports = router;
