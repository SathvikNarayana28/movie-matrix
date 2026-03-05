import React, { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import "./Login.css";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const res = await API.post("/auth/login", { email, password });
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("role", res.data.user?.role || "user");
            localStorage.setItem("userId", res.data.user?.id || "");
            const userRole = res.data.user?.role || "user";
            // Use window.location to navigate + reload in one step
            // so the navbar refreshes AND we land on the correct page
            if (userRole === "admin") {
                window.location.href = "/admin";
            } else {
                window.location.href = "/";
            }
        } catch (err) {
            setError(err.response?.data?.msg || "Login failed. Try again.");
        }
    };

    return (
        <div className="auth-container">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>Login</h2>

                {error && <p className="auth-error">{error}</p>}

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
                    placeholder="Enter your password"
                    required
                />

                <button type="submit">Login</button>

                <p className="auth-switch">
                    <Link to="/forgot-password">Forgot Password?</Link>
                </p>
                <p className="auth-switch">
                    Don't have an account? <Link to="/register">Register</Link>
                </p>
            </form>
        </div>
    );
}

export default Login;
