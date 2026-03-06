import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./Settings.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL
    ? process.env.REACT_APP_API_BASE_URL.replace("/api", "")
    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000"
        : "";

function Settings() {
    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const fileInputRef = useRef(null);

    // User info
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Profile pic
    const [uploadingPic, setUploadingPic] = useState(false);

    // Dark mode
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

    // Reset password
    const [showResetForm, setShowResetForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetMsg, setResetMsg] = useState("");
    const [resetError, setResetError] = useState("");
    const [resetLoading, setResetLoading] = useState(false);

    useEffect(() => {
        if (!token) { navigate("/login"); return; }
        API.get("/auth/me")
            .then((res) => setUser(res.data))
            .catch(() => { navigate("/login"); })
            .finally(() => setLoading(false));
    }, [token, navigate]);

    // Toggle dark mode
    const toggleDarkMode = () => {
        setDarkMode((prev) => {
            const next = !prev;
            localStorage.setItem("theme", next ? "dark" : "light");
            if (next) {
                document.body.classList.add("dark-mode");
            } else {
                document.body.classList.remove("dark-mode");
            }
            return next;
        });
    };

    // Profile pic upload
    const handlePicUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowed.includes(file.type)) {
            alert("Please select a valid image file (JPEG, PNG, GIF, or WebP).");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert("Image must be smaller than 5 MB.");
            return;
        }
        const formData = new FormData();
        formData.append("profilePic", file);
        setUploadingPic(true);
        try {
            const res = await API.post("/users/upload-profile-pic", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setUser((prev) => ({ ...prev, profilePic: res.data.profilePic }));
        } catch {
            alert("Failed to upload profile picture.");
        } finally {
            setUploadingPic(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Reset password
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetMsg("");
        setResetError("");
        if (newPassword.length < 6) { setResetError("New password must be at least 6 characters"); return; }
        if (newPassword !== confirmPassword) { setResetError("Passwords do not match"); return; }
        setResetLoading(true);
        try {
            const res = await API.put("/auth/reset-password", { currentPassword, newPassword });
            setResetMsg(res.data.msg);
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
            setTimeout(() => { setShowResetForm(false); setResetMsg(""); }, 2500);
        } catch (err) {
            setResetError(err.response?.data?.msg || "Failed to reset password");
        } finally {
            setResetLoading(false);
        }
    };

    if (loading) return <div className="settings-page"><p className="settings-loading">Loading settings...</p></div>;
    if (!user) return null;

    return (
        <div className="settings-page">
            <h2 className="settings-heading">Settings</h2>

            {/* User preview card */}
            <div className="settings-user-card">
                {user.profilePic ? (
                    <img src={`${API_BASE}${user.profilePic}`} alt={user.name} className="settings-user-avatar" />
                ) : (
                    <div className="settings-user-initial">{user.name?.charAt(0)?.toUpperCase()}</div>
                )}
                <div className="settings-user-info">
                    <span className="settings-user-name">{user.name}</span>
                    <span className="settings-user-email">{user.email}</span>
                </div>
            </div>

            {/* Settings list */}
            <div className="settings-list">

                {/* Change Profile Picture */}
                <button className="settings-item" onClick={() => fileInputRef.current?.click()} disabled={uploadingPic}>
                    <span className="settings-item-icon">🖼️</span>
                    <div className="settings-item-content">
                        <span className="settings-item-title">
                            {uploadingPic ? "Uploading..." : "Change Profile Picture"}
                        </span>
                        <span className="settings-item-desc">Upload a new profile photo</span>
                    </div>
                    <span className="settings-item-arrow">›</span>
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handlePicUpload} />

                {/* Switch Mode */}
                <button className="settings-item" onClick={toggleDarkMode}>
                    <span className="settings-item-icon">{darkMode ? "☀️" : "🌙"}</span>
                    <div className="settings-item-content">
                        <span className="settings-item-title">Appearance</span>
                        <span className="settings-item-desc">
                            Currently: <strong>{darkMode ? "Dark Mode" : "Light Mode"}</strong>
                        </span>
                    </div>
                    <span className="settings-item-toggle">
                        <span className={`toggle-track ${darkMode ? "toggle-on" : ""}`}>
                            <span className="toggle-thumb" />
                        </span>
                    </span>
                </button>

                {/* Reset Password */}
                <button className="settings-item" onClick={() => { setShowResetForm((p) => !p); setResetMsg(""); setResetError(""); }}>
                    <span className="settings-item-icon">🔑</span>
                    <div className="settings-item-content">
                        <span className="settings-item-title">Reset Password</span>
                        <span className="settings-item-desc">Change your account password</span>
                    </div>
                    <span className="settings-item-arrow" style={{ transform: showResetForm ? "rotate(90deg)" : "none" }}>›</span>
                </button>

                {showResetForm && (
                    <form className="settings-reset-form" onSubmit={handleResetPassword}>
                        <input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                        <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                        <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                        {resetError && <p className="settings-msg error">{resetError}</p>}
                        {resetMsg && <p className="settings-msg success">{resetMsg}</p>}
                        <button type="submit" className="settings-reset-btn" disabled={resetLoading}>
                            {resetLoading ? "Updating..." : "Update Password"}
                        </button>
                    </form>
                )}


            </div>
        </div>
    );
}

export default Settings;
