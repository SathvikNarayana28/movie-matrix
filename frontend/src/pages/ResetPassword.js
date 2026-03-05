import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../api";
import "./Login.css";

function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        // Client-side validation
        if (password.length < 6) {
            return setError("Password must be at least 6 characters.");
        }
        if (password !== confirmPassword) {
            return setError("Passwords do not match.");
        }

        setLoading(true);

        try {
            const res = await API.post(`/auth/reset-password/${token}`, { password });
            setMessage(res.data.msg);
            setPassword("");
            setConfirmPassword("");
            // Redirect to login after 3 seconds
            setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to reset password. The link may have expired.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>Reset Password</h2>
                <p style={{ fontSize: "13px", color: "#888", textAlign: "center", marginBottom: "18px" }}>
                    Enter your new password below.
                </p>

                {error && <p className="auth-error">{error}</p>}
                {message && (
                    <p className="auth-success">
                        {message}<br />
                        <span style={{ fontSize: "12px" }}>Redirecting to login...</span>
                    </p>
                )}

                {!message && (
                    <>
                        <label>New Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            required
                            minLength={6}
                            disabled={loading}
                        />

                        <label>Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter your password"
                            required
                            disabled={loading}
                        />

                        <button type="submit" disabled={loading}>
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </>
                )}

                <p className="auth-switch">
                    <Link to="/login">Back to Login</Link>
                </p>
            </form>
        </div>
    );
}

export default ResetPassword;
