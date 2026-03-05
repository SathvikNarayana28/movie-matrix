import React, { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import "./Login.css";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        try {
            const res = await API.post("/auth/forgot-password", { email });
            setMessage(res.data.msg);
            setEmail("");
        } catch (err) {
            setError(err.response?.data?.msg || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>Forgot Password</h2>
                <p style={{ fontSize: "13px", color: "#888", textAlign: "center", marginBottom: "18px" }}>
                    Enter your registered email address and we'll send you a link to reset your password.
                </p>

                {error && <p className="auth-error">{error}</p>}
                {message && <p className="auth-success">{message}</p>}

                <label>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                />

                <button type="submit" disabled={loading}>
                    {loading ? "Sending..." : "Send Reset Link"}
                </button>

                <p className="auth-switch">
                    Remember your password? <Link to="/login">Login</Link>
                </p>
            </form>
        </div>
    );
}

export default ForgotPassword;
