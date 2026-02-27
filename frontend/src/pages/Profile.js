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
            </div>
        </div>
    );
}

export default Profile;
