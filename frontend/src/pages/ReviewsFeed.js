import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import "./ReviewsFeed.css";

function ReviewsFeed() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const fetchFeed = async () => {
            try {
                const res = await API.get("/reviews/feed");
                setReviews(res.data);
            } catch (err) {
                console.error("Feed error:", err);
                setError("Failed to load reviews feed.");
            } finally {
                setLoading(false);
            }
        };
        fetchFeed();
    }, [navigate]);

    const renderStars = (count) => {
        return [...Array(5)].map((_, i) => (
            <span key={i} style={{ color: i < count ? "#f5c518" : "#ccc", fontSize: 16 }}>
                ★
            </span>
        ));
    };

    if (loading) return <p className="feed-loading">Loading feed...</p>;
    if (error) return <p className="feed-error">{error}</p>;

    return (
        <div className="feed-page">
            <h2 className="feed-title">Reviews Feed</h2>
            <p className="feed-subtitle">Latest reviews from people you follow</p>

            {reviews.length === 0 ? (
                <div className="feed-empty">
                    <p>No reviews in your feed yet.</p>
                    <p className="feed-empty-hint">
                        Follow other users from their profile pages to see their reviews here.
                    </p>
                </div>
            ) : (
                <div className="feed-list">
                    {reviews.map(rev => (
                        <div key={rev._id} className="feed-card">
                            <div className="feed-card-left">
                                {rev.movie?.posterUrl && (
                                    <img
                                        src={rev.movie.posterUrl}
                                        alt={rev.movie.title}
                                        className="feed-poster"
                                        onError={(e) => {
                                            e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='90' fill='%23ccc'%3E%3Crect width='60' height='90' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='10'%3EPoster%3C/text%3E%3C/svg%3E";
                                        }}
                                    />
                                )}
                            </div>
                            <div className="feed-card-right">
                                <div className="feed-card-header">
                                    <Link to={`/user/${rev.user?._id}`} className="feed-reviewer-name">
                                        {rev.user?.name || "User"}
                                    </Link>
                                    <span className="feed-date">
                                        {new Date(rev.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                    </span>
                                </div>
                                <p className="feed-movie-title">
                                    {rev.movie?.title || "Unknown Movie"}
                                </p>
                                <div className="feed-stars">{renderStars(rev.rating)}</div>
                                <p className="feed-comment">{rev.comment}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ReviewsFeed;
