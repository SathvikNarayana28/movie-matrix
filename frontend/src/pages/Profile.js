import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./Profile.css";

function Profile() {
    const [user, setUser] = useState(null);
    const [bookingCount, setBookingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // Reset Password state
    const [showResetForm, setShowResetForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetMsg, setResetMsg] = useState("");
    const [resetError, setResetError] = useState("");
    const [resetLoading, setResetLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const fetchProfile = async () => {
            try {
                const userRes = await API.get("/auth/me");
                setUser(userRes.data);

                const bookingsRes = await API.get("/bookings/my");
                setBookingCount(bookingsRes.data.length);
            } catch (err) {
                console.error(err);
                setError("Failed to load profile");
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [navigate]);

    if (loading) return <p className="loading-text">Loading profile...</p>;
    if (error) return <p className="error-text">{error}</p>;
    if (!user) return <p className="error-text">User not found</p>;

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetMsg("");
        setResetError("");

        // Client-side validation
        if (newPassword.length < 6) {
            setResetError("New password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            setResetError("New password and confirm password do not match");
            return;
        }

        setResetLoading(true);
        try {
            const res = await API.put("/auth/reset-password", {
                currentPassword,
                newPassword
            });
            setResetMsg(res.data.msg);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            // Auto-hide form after success
            setTimeout(() => setShowResetForm(false), 2000);
        } catch (err) {
            setResetError(err.response?.data?.msg || "Failed to reset password");
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-avatar">
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <h2>{user.name}</h2>
                <p className="profile-email">{user.email}</p>
                <p className="profile-joined">
                    Joined: {new Date(user.createdAt).toLocaleDateString()}
                </p>

                <div className="profile-stats">
                    <div className="stat">
                        <span className="stat-number">{bookingCount}</span>
                        <span className="stat-label">Bookings</span>
                    </div>
                    <div className="stat">
                        <span className="stat-number">{user.favorites ? user.favorites.length : 0}</span>
                        <span className="stat-label">Favorites</span>
                    </div>
                </div>

                {/* Reset Password Section */}
                <div className="reset-password-section">
                    <button
                        className="reset-toggle-btn"
                        onClick={() => { setShowResetForm(!showResetForm); setResetMsg(""); setResetError(""); }}
                    >
                        {showResetForm ? "Cancel" : "Reset Password"}
                    </button>

                    {showResetForm && (
                        <form className="reset-form" onSubmit={handleResetPassword}>
                            {resetMsg && <p className="reset-msg success">{resetMsg}</p>}
                            {resetError && <p className="reset-msg error">{resetError}</p>}
                            <input
                                type="password"
                                placeholder="Current Password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                            <input
                                type="password"
                                placeholder="New Password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                            <button type="submit" className="reset-submit-btn" disabled={resetLoading}>
                                {resetLoading ? "Updating..." : "Update Password"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Profile;
