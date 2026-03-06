import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import API from "../api";
import "./Login.css";

function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminCode, setAdminCode] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        const payload = { name, email, password };
        if (isAdmin) {
            if (!adminCode.trim()) {
                setError("Admin access code is required.");
                return;
            }
            payload.adminCode = adminCode.trim();
        }

        try {
            const res = await API.post("/auth/register", payload);
            setSuccess(res.data.msg + " Redirecting to login...");
            toast.success("Registration successful! Redirecting to login...");
            setTimeout(() => {
                window.location.href = "/login";
            }, 1500);
        } catch (err) {
            const msg = err.response?.data?.msg || "Registration failed. Try again.";
            setError(msg);
            toast.error(msg);
        }
    };

    return (
        <div className="auth-container">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>Register</h2>

                {error && <p className="auth-error">{error}</p>}
                {success && <p className="auth-success">{success}</p>}

                <label>Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    required
                />

                <label>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                />

                <label>Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                />

                {/* Admin Toggle */}
                <div className="admin-toggle">
                    <label className="toggle-label">
                        <input
                            type="checkbox"
                            checked={isAdmin}
                            onChange={(e) => {
                                setIsAdmin(e.target.checked);
                                if (!e.target.checked) setAdminCode("");
                            }}
                        />
                        <span>Register as Admin</span>
                    </label>
                </div>

                {/* Admin Secret Code — only visible when toggle is ON */}
                {isAdmin && (
                    <>
                        <label>Admin Access Code</label>
                        <input
                            type="password"
                            value={adminCode}
                            onChange={(e) => setAdminCode(e.target.value)}
                            placeholder="Enter admin secret code"
                            required
                        />
                    </>
                )}

                <button type="submit">Register</button>

                <p className="auth-switch">
                    Already have an account? <Link to="/login">Login</Link>
                </p>
            </form>
        </div>
    );
}

export default Register;
