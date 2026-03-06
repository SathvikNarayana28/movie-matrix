import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import { TopReviewerSkeleton } from "../components/Skeleton";
import "./TopReviewers.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL
    ? process.env.REACT_APP_API_BASE_URL.replace("/api", "")
    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000"
        : "";

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

    if (loading) return (
        <div className="tr-section">
            <h3 className="section-title">🏆 Top Reviewers</h3>
            <p className="section-subtitle">Most upvoted critics in Movie Matrix</p>
            <div className="tr-list">
                {[...Array(5)].map((_, i) => (
                    <TopReviewerSkeleton key={i} />
                ))}
            </div>
        </div>
    );
    if (error) return <p className="tr-section-error">{error}</p>;

    return (
        <div className="tr-section">
            <h3 className="section-title">🏆 Top Reviewers</h3>
            <p className="section-subtitle">Most upvoted critics in Movie Matrix</p>

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
                                {reviewer.profilePic ? (
                                    <img src={`${API_BASE}${reviewer.profilePic}`} alt={reviewer.name} className="tr-avatar-img" />
                                ) : (
                                    reviewer.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="tr-info">
                                <Link to={`/profile/${reviewer.userId}`} className="tr-name">
                                    {reviewer.name}
                                </Link>
                                <div className="tr-stats">
                                    <span className="tr-stat" title="Average Rating">
                                        ⭐ {reviewer.avgRating.toFixed(1)}
                                    </span>
                                    <span className="tr-separator">·</span>
                                    <span className="tr-stat tr-stat-upvotes" title="Total Upvotes">
                                        👍 {reviewer.totalUpvotes}
                                    </span>
                                    <span className="tr-separator">·</span>
                                    <span className="tr-stat" title="Total Reviews">
                                        📝 {reviewer.reviewCount}
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
