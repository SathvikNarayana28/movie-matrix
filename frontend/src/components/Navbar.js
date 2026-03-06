import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { FaHome, FaNewspaper, FaSignInAlt, FaUserPlus } from "react-icons/fa";
import API from "../api";
import logo from "../logo.png";
import "./Navbar.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL?.replace("/api", "") || "http://localhost:5000";

function Navbar() {
    const token = localStorage.getItem("token");
    const [role, setRole] = useState(localStorage.getItem("role") || "");
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
    const [userName, setUserName] = useState("");
    const [userPic, setUserPic] = useState("");
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();

    // Apply dark mode class on mount and when toggled
    useEffect(() => {
        if (darkMode) {
            document.body.classList.add("dark-mode");
        } else {
            document.body.classList.remove("dark-mode");
        }
    }, [darkMode]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleDarkMode = () => {
        setDarkMode((prev) => {
            const next = !prev;
            localStorage.setItem("theme", next ? "dark" : "light");
            return next;
        });
    };

    // Sync role + profile info from backend on every page load
    useEffect(() => {
        if (!token) return;
        API.get("/auth/me")
            .then((res) => {
                const u = res.data;
                const backendRole = u.role || "user";
                if (backendRole !== localStorage.getItem("role")) {
                    localStorage.setItem("role", backendRole);
                    setRole(backendRole);
                }
                setUserName(u.name || "");
                setUserPic(u.profilePic || "");
            })
            .catch(() => {
                // token invalid or expired — clear session
                localStorage.removeItem("token");
                localStorage.removeItem("role");
                setRole("");
                setUserName("");
                setUserPic("");
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
            <Link to="/" className="logo-wrapper">
                <img src={logo} alt="Movie Matrix" className="logo" />
            </Link>
            <div className="navbar-links">
                <NavLink to="/" end className="nav-icon-link" title="Home">
                    <FaHome className="nav-icon" />
                </NavLink>
                {token && (
                    <NavLink to="/feed" className="nav-icon-link" title="Reviews Feed">
                        <FaNewspaper className="nav-icon" />
                    </NavLink>
                )}
                {token ? (
                    <div className="nav-profile-wrapper" ref={menuRef}>
                        <button className="nav-avatar-btn" onClick={() => setShowMenu((p) => !p)} title="Profile menu">
                            {userPic ? (
                                <img src={`${API_BASE}${userPic}`} alt="Profile" className="nav-avatar" />
                            ) : (
                                <span className="nav-avatar-initial">{userName?.charAt(0)?.toUpperCase() || "?"}</span>
                            )}
                        </button>
                        {showMenu && (
                            <div className="profile-dropdown">
                                <div className="dropdown-user-info">
                                    {userPic ? (
                                        <img src={`${API_BASE}${userPic}`} alt="" className="dropdown-avatar" />
                                    ) : (
                                        <span className="dropdown-avatar-initial">{userName?.charAt(0)?.toUpperCase() || "?"}</span>
                                    )}
                                    <span className="dropdown-user-name">{userName || "User"}</span>
                                </div>
                                <div className="dropdown-divider" />
                                {role === "admin" && (
                                    <Link to="/admin" className="dropdown-item" onClick={() => setShowMenu(false)}>
                                        <span className="dropdown-icon">📊</span> Admin Dashboard
                                    </Link>
                                )}
                                <Link to="/my-bookings" className="dropdown-item" onClick={() => setShowMenu(false)}>
                                    <span className="dropdown-icon">🎟️</span> My Bookings
                                </Link>
                                <Link to="/favorites" className="dropdown-item" onClick={() => setShowMenu(false)}>
                                    <span className="dropdown-icon">❤️</span> Favorites
                                </Link>
                                <Link to="/profile" className="dropdown-item" onClick={() => setShowMenu(false)}>
                                    <span className="dropdown-icon">👤</span> Profile
                                </Link>
                                <Link to="/settings" className="dropdown-item" onClick={() => setShowMenu(false)}>
                                    <span className="dropdown-icon">⚙️</span> Settings
                                </Link>
                                <div className="dropdown-divider" />
                                <button className="dropdown-item dropdown-logout" onClick={() => { setShowMenu(false); handleLogout(); }}>
                                    <span className="dropdown-icon">🚪</span> Logout
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <NavLink to="/login" className="nav-icon-link" title="Login">
                            <FaSignInAlt className="nav-icon" />
                        </NavLink>
                        <NavLink to="/register" className="nav-icon-link" title="Register">
                            <FaUserPlus className="nav-icon" />
                        </NavLink>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;
