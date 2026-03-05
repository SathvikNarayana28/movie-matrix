import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import "./TopReviewers.css";

// TopReviewers — embeddable section component for the Reviews Feed page
// Calls GET /api/reviews/top-reviewers and shows top 5 users

function TopReviewers() {
    const [reviewers, setReviewers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchTopReviewers = async () => {
            try {
                const res = await API.get("/reviews/top-reviewers");
                // Show only top 5 reviewers
                setReviewers(res.data.slice(0, 5));
            } catch (err) {
                console.error("Top reviewers error:", err);
                setError("Failed to load top reviewers.");
            } finally {
                setLoading(false);
            }
        };
        fetchTopReviewers();
    }, []);

    const renderStars = (rating) => {
        return [...Array(5)].map((_, i) => (
            <span key={i} style={{ color: i < Math.round(rating) ? "#f5c518" : "#ccc", fontSize: 14 }}>
                ★
            </span>
        ));
    };

    if (loading) return <p className="tr-section-loading">Loading top reviewers...</p>;
    if (error) return <p className="tr-section-error">{error}</p>;

    return (
        <div className="tr-section">
            <h3 className="section-title">🏆 Top Reviewers</h3>
            <p className="section-subtitle">Most active critics in Movie Matrix</p>

            {reviewers.length === 0 ? (
                <p className="tr-section-empty">No reviews yet. Be the first to review a movie!</p>
            ) : (
                <div className="tr-list">
                    {reviewers.map((reviewer, index) => (
                        <div key={reviewer.userId} className="tr-card">
                            <div className="tr-rank">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                            </div>
                            <div className="tr-avatar">
                                {reviewer.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="tr-info">
                                <Link to={`/profile/${reviewer.userId}`} className="tr-name">
                                    {reviewer.name}
                                </Link>
                                <div className="tr-stats">
                                    <span className="tr-review-count">
                                        {reviewer.reviewCount} review{reviewer.reviewCount !== 1 ? "s" : ""}
                                    </span>
                                    <span className="tr-separator">·</span>
                                    <span className="tr-avg-rating">
                                        {renderStars(reviewer.avgRating)} {reviewer.avgRating.toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TopReviewers;
