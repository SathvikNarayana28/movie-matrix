import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api";
import "./Navbar.css";

function Navbar() {
    const token = localStorage.getItem("token");
    const [role, setRole] = useState(localStorage.getItem("role") || "");
    const navigate = useNavigate();

    // Sync role from backend on every page load (prevents stale role issues)
    useEffect(() => {
        if (!token) return;
        API.get("/auth/me")
            .then((res) => {
                const backendRole = res.data.role || "user";
                if (backendRole !== localStorage.getItem("role")) {
                    localStorage.setItem("role", backendRole);
                    setRole(backendRole);
                }
            })
            .catch(() => {
                // token invalid or expired — clear session
                localStorage.removeItem("token");
                localStorage.removeItem("role");
                setRole("");
            });
    }, [token]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        navigate("/login");
        window.location.reload();
    };

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-brand">
                🎬 Movie Matrix
            </Link>
            <div className="navbar-links">
                <Link to="/">Home</Link>
                {token && role === "admin" && <Link to="/admin">Admin Dashboard</Link>}
                {token && <Link to="/my-bookings">My Bookings</Link>}
                {token && <Link to="/favorites">Favorites</Link>}
                {token && <Link to="/feed">Reviews Feed</Link>}
                {token && <Link to="/search-users">Search Users</Link>}
                <Link to="/top-reviewers">Top Reviewers</Link>
                {token && <Link to="/profile">Profile</Link>}
                {token ? (
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                ) : (
                    <>
                        <Link to="/login">Login</Link>
                        <Link to="/register">Register</Link>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;
