import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import "./ReviewsFeed.css";

function ReviewsFeed() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // Get current user id from token (for like button state)
    const [currentUserId, setCurrentUserId] = useState(null);

    // Extracted fetch function so it can be called anytime to refresh the feed
    const fetchFeed = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/reviews/feed");
            setReviews(res.data);
            setError("");
        } catch (err) {
            console.error("Feed error:", err);
            setError("Failed to load reviews feed.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }
        // Get current user id
        API.get("/auth/me")
            .then(res => setCurrentUserId(res.data._id))
            .catch(() => {});
        fetchFeed();
    }, [navigate, fetchFeed]);

    const handleLike = async (reviewId) => {
        try {
            const res = await API.post(`/reviews/${reviewId}/like`);
            // Update like state locally without re-fetching entire feed
            setReviews(prev => prev.map(rev => {
                if (rev._id === reviewId) {
                    return {
                        ...rev,
                        likes: res.data.liked
                            ? [...(rev.likes || []), currentUserId]
                            : (rev.likes || []).filter(id => id !== currentUserId),
                    };
                }
                return rev;
            }));
        } catch (err) {
            console.error("Like error:", err);
        }
    };

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
            <p className="feed-subtitle">Your reviews and latest reviews from people you follow</p>

            {reviews.length === 0 ? (
                <div className="feed-empty">
                    <p>No reviews in your feed yet.</p>
                    <p className="feed-empty-hint">
                        Follow other users from their profile pages to see their reviews here.
                    </p>
                </div>
            ) : (
                <div className="feed-list">
                    {reviews.map(rev => {
                        const isLiked = currentUserId && (rev.likes || []).some(
                            id => (typeof id === "string" ? id : id?._id || id) === currentUserId
                        );
                        const likesCount = (rev.likes || []).length;

                        return (
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
                                        <div className="feed-header-left">
                                            <Link to={`/profile/${rev.user?._id}`} className="feed-reviewer-name">
                                                {rev.user?.name || "User"}
                                            </Link>
                                            {rev.isVerifiedViewer && (
                                                <span className="feed-verified-badge" title="Verified Viewer — booked and watched this movie">
                                                    ✓ Verified Viewer
                                                </span>
                                            )}
                                        </div>
                                        <span className="feed-date">
                                            {new Date(rev.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                        </span>
                                    </div>
                                    <p className="feed-movie-title">
                                        {rev.movie?.title || "Unknown Movie"}
                                    </p>
                                    <div className="feed-stars">{renderStars(rev.rating)}</div>
                                    <p className="feed-comment">{rev.comment}</p>
                                    <div className="feed-actions">
                                        <button
                                            className={`feed-like-btn ${isLiked ? "feed-liked" : ""}`}
                                            onClick={() => handleLike(rev._id)}
                                            title={isLiked ? "Unlike" : "Like"}
                                        >
                                            {isLiked ? "❤️" : "🤍"} {likesCount > 0 && <span className="feed-like-count">{likesCount}</span>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ReviewsFeed;
