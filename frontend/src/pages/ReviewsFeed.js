import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import SearchUsers from "./SearchUsers";
import TopReviewers from "./TopReviewers";
import { ReviewCardSkeleton } from "../components/Skeleton";
import "./ReviewsFeed.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL
    ? process.env.REACT_APP_API_BASE_URL.replace("/api", "")
    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000"
        : "";

// ReviewsFeed — main feed page containing 3 sections:
// 1. Search Users
// 2. Top Reviewers
// 3. Reviews list with tabs: All Reviews / Following

function ReviewsFeed() {
    const [allReviews, setAllReviews] = useState([]);
    const [followingReviews, setFollowingReviews] = useState([]);
    const [activeTab, setActiveTab] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // Get current user id from token (for like button state)
    const [currentUserId, setCurrentUserId] = useState(null);

    // Sort filter for "All Reviews" tab
    const [sortType, setSortType] = useState("latest");

    // Comment UI state
    const [openComments, setOpenComments] = useState({});   // { reviewId: true/false }
    const [commentText, setCommentText] = useState({});     // { reviewId: "text" }
    const [commentLoading, setCommentLoading] = useState({});

    // Fetch all reviews (for "All Reviews" tab)
    const fetchAllReviews = useCallback(async () => {
        try {
            const res = await API.get("/reviews/all");
            setAllReviews(res.data);
        } catch (err) {
            console.error("All reviews error:", err);
        }
    }, []);

    // Fetch following reviews (for "Following" tab)
    const fetchFollowingReviews = useCallback(async () => {
        try {
            const res = await API.get("/reviews/feed");
            setFollowingReviews(res.data);
        } catch (err) {
            console.error("Feed error:", err);
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

        // Fetch both datasets on page load
        setLoading(true);
        setError("");
        Promise.all([fetchAllReviews(), fetchFollowingReviews()])
            .then(() => setLoading(false))
            .catch(() => {
                setError("Failed to load reviews feed.");
                setLoading(false);
            });
    }, [navigate, fetchAllReviews, fetchFollowingReviews]);

    const handleVote = async (reviewId, voteType) => {
        try {
            const res = await API.post(`/reviews/${reviewId}/vote`, { voteType });
            // Update vote state locally in both arrays
            const updateVotes = (list) => list.map(rev => {
                if (rev._id === reviewId) {
                    return {
                        ...rev,
                        upvotes: res.data.upvotes,
                        downvotes: res.data.downvotes
                    };
                }
                return rev;
            });
            setAllReviews(prev => updateVotes(prev));
            setFollowingReviews(prev => updateVotes(prev));
        } catch (err) {
            console.error("Vote error:", err);
        }
    };

    // Toggle comment section open/close
    const toggleComments = (reviewId) => {
        setOpenComments(prev => ({ ...prev, [reviewId]: !prev[reviewId] }));
    };

    // Post a new comment
    const handlePostComment = async (reviewId) => {
        const text = (commentText[reviewId] || "").trim();
        if (!text) return;

        try {
            setCommentLoading(prev => ({ ...prev, [reviewId]: true }));
            const res = await API.post(`/reviews/${reviewId}/comment`, { text });

            // Update comments locally in both arrays
            const updateComments = (list) => list.map(rev => {
                if (rev._id === reviewId) {
                    return { ...rev, comments: res.data.comments };
                }
                return rev;
            });
            setAllReviews(prev => updateComments(prev));
            setFollowingReviews(prev => updateComments(prev));
            setCommentText(prev => ({ ...prev, [reviewId]: "" }));
        } catch (err) {
            console.error("Comment error:", err);
        } finally {
            setCommentLoading(prev => ({ ...prev, [reviewId]: false }));
        }
    };

    const renderStars = (count) => {
        return [...Array(5)].map((_, i) => (
            <span key={i} style={{ color: i < count ? "#f5c518" : "#ccc", fontSize: 16 }}>
                ★
            </span>
        ));
    };

    // Sort "All Reviews" based on selected sortType
    const sortedAllReviews = useMemo(() => {
        const copy = [...allReviews];
        switch (sortType) {
            case "most-upvotes":
                copy.sort((a, b) => (b.upvotes || []).length - (a.upvotes || []).length);
                break;
            case "most-downvotes":
                copy.sort((a, b) => (b.downvotes || []).length - (a.downvotes || []).length);
                break;
            case "most-commented":
                copy.sort((a, b) => (b.comments || []).length - (a.comments || []).length);
                break;
            case "latest":
            default:
                copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
        }
        return copy;
    }, [allReviews, sortType]);

    // Pick the correct reviews list based on active tab
    const reviews = activeTab === "all" ? sortedAllReviews : followingReviews;

    return (
        <div className="feed-page">
            <h2 className="feed-title">Reviews Feed</h2>
            <p className="feed-subtitle">Discover reviews from the community</p>

            {/* Three-column layout */}
            <div className="feed-layout">
                {/* Left Sidebar — Search Users */}
                <aside className="feed-left-sidebar">
                    <SearchUsers />
                </aside>

                {/* Center — Main Feed */}
                <main className="feed-main">
                    <div className="feed-reviews-section">
                {/* Tab Bar */}
                <div className="feed-tabs">
                    <button
                        className={`feed-tab ${activeTab === "all" ? "feed-tab-active" : ""}`}
                        onClick={() => setActiveTab("all")}
                    >
                        📰 All Reviews
                    </button>
                    <button
                        className={`feed-tab ${activeTab === "following" ? "feed-tab-active" : ""}`}
                        onClick={() => setActiveTab("following")}
                    >
                        👥 Following
                    </button>
                </div>

                {/* Sort dropdown — only for All Reviews tab */}
                {activeTab === "all" && (
                    <div className="feed-sort-bar">
                        <label className="feed-sort-label" htmlFor="sort-select">Sort by:</label>
                        <select
                            id="sort-select"
                            className="feed-sort-select"
                            value={sortType}
                            onChange={(e) => setSortType(e.target.value)}
                        >
                            <option value="latest">Latest</option>
                            <option value="most-upvotes">Most Upvotes</option>
                            <option value="most-downvotes">Most Downvotes</option>
                            <option value="most-commented">Most Commented</option>
                        </select>
                    </div>
                )}

                {loading ? (
                    <div className="feed-list">
                        {[...Array(4)].map((_, i) => (
                            <ReviewCardSkeleton key={i} />
                        ))}
                    </div>
                ) : error ? (
                    <p className="feed-error">{error}</p>
                ) : reviews.length === 0 ? (
                    <div className="feed-empty">
                        {activeTab === "all" ? (
                            <p>No reviews on the platform yet. Be the first to review a movie!</p>
                        ) : (
                            <>
                                <p>No reviews in your feed yet.</p>
                                <p className="feed-empty-hint">
                                    Follow other users to see their reviews here, or search for users above.
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="feed-list">
                        {reviews.map(rev => {
                            const upvotes = rev.upvotes || [];
                            const downvotes = rev.downvotes || [];
                            const hasUpvoted = currentUserId && upvotes.some(
                                id => (typeof id === "string" ? id : id?._id || id) === currentUserId
                            );
                            const hasDownvoted = currentUserId && downvotes.some(
                                id => (typeof id === "string" ? id : id?._id || id) === currentUserId
                            );

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
                                                <Link to={`/profile/${rev.user?._id}`} className="feed-reviewer-avatar-link">
                                                    {rev.user?.profilePic ? (
                                                        <img src={`${API_BASE}${rev.user.profilePic}`} alt={rev.user.name} className="feed-reviewer-pic" />
                                                    ) : (
                                                        <span className="feed-reviewer-initial">{(rev.user?.name || "U").charAt(0).toUpperCase()}</span>
                                                    )}
                                                </Link>
                                                <Link to={`/profile/${rev.user?._id}`} className="feed-reviewer-name">
                                                    {rev.user?.name || "User"}
                                                </Link>
                                                {rev.verifiedViewer && (
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

                                        {/* Vote buttons — horizontal at bottom */}
                                        <div className="feed-vote-row">
                                            <button
                                                className={`feed-vote-btn feed-upvote ${hasUpvoted ? "feed-voted" : ""}`}
                                                onClick={() => handleVote(rev._id, "upvote")}
                                                title="Upvote"
                                            >
                                                👍 <span className="feed-vote-count">{upvotes.length}</span>
                                            </button>
                                            <button
                                                className={`feed-vote-btn feed-downvote ${hasDownvoted ? "feed-voted" : ""}`}
                                                onClick={() => handleVote(rev._id, "downvote")}
                                                title="Downvote"
                                            >
                                                👎 <span className="feed-vote-count">{downvotes.length}</span>
                                            </button>
                                            <button
                                                className="feed-comment-toggle"
                                                onClick={() => toggleComments(rev._id)}
                                            >
                                                💬 {(rev.comments || []).length > 0
                                                    ? `Comments (${(rev.comments || []).length})`
                                                    : "Comment"}
                                            </button>
                                        </div>

                                        {/* Comment section — shown when toggled open */}
                                        {openComments[rev._id] && (
                                            <div className="feed-comments-section">
                                                {(rev.comments || []).length > 0 && (
                                                    <div className="feed-comments-list">
                                                        {(rev.comments || []).map((c, idx) => (
                                                            <div key={c._id || idx} className="feed-comment-item">
                                                                {c.user?.profilePic ? (
                                                                    <img src={`${API_BASE}${c.user.profilePic}`} alt={c.user.name} className="feed-comment-pic" />
                                                                ) : (
                                                                    <span className="feed-comment-initial">{(c.user?.name || "U").charAt(0).toUpperCase()}</span>
                                                                )}
                                                                <span className="feed-comment-author">
                                                                    {c.user?.name || "User"}
                                                                </span>
                                                                <span className="feed-comment-text">{c.text}</span>
                                                                <span className="feed-comment-time">
                                                                    {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="feed-comment-input-row">
                                                    <input
                                                        type="text"
                                                        className="feed-comment-input"
                                                        placeholder="Write a comment..."
                                                        value={commentText[rev._id] || ""}
                                                        onChange={(e) => setCommentText(prev => ({ ...prev, [rev._id]: e.target.value }))}
                                                        onKeyDown={(e) => { if (e.key === "Enter") handlePostComment(rev._id); }}
                                                        maxLength={500}
                                                    />
                                                    <button
                                                        className="feed-comment-post-btn"
                                                        onClick={() => handlePostComment(rev._id)}
                                                        disabled={commentLoading[rev._id] || !(commentText[rev._id] || "").trim()}
                                                    >
                                                        {commentLoading[rev._id] ? "..." : "Post"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                    </div>
                </main>

                {/* Right Sidebar — Top Reviewers */}
                <aside className="feed-right-sidebar">
                    <TopReviewers />
                </aside>
            </div>
        </div>
    );
}

export default ReviewsFeed;
