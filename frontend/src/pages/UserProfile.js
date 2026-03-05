import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import API from "../api";
import "./UserProfile.css";

function UserProfile() {
    const { userId } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await API.get(`/users/${userId}/profile`);
                setProfile(res.data);

                // Check if current user follows this user
                const token = localStorage.getItem("token");
                if (token) {
                    const meRes = await API.get("/auth/me");
                    setCurrentUserId(meRes.data._id);
                    // Check following list
                    const followingRes = await API.get(`/users/${meRes.data._id}/following`);
                    const followingIds = followingRes.data.map(u => u._id);
                    setIsFollowing(followingIds.includes(userId));
                }
            } catch (err) {
                console.error("Profile error:", err);
                setError("Failed to load user profile.");
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [userId]);

    const handleFollow = async () => {
        setFollowLoading(true);
        try {
            await API.post(`/users/follow/${userId}`);
            setIsFollowing(true);
            setProfile(prev => ({
                ...prev,
                followersCount: prev.followersCount + 1
            }));
        } catch (err) {
            console.error("Follow error:", err);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleUnfollow = async () => {
        setFollowLoading(true);
        try {
            await API.post(`/users/unfollow/${userId}`);
            setIsFollowing(false);
            setProfile(prev => ({
                ...prev,
                followersCount: prev.followersCount - 1
            }));
        } catch (err) {
            console.error("Unfollow error:", err);
        } finally {
            setFollowLoading(false);
        }
    };

    const renderStars = (count) => {
        return [...Array(5)].map((_, i) => (
            <span key={i} style={{ color: i < count ? "#f5c518" : "#ccc", fontSize: 16 }}>
                ★
            </span>
        ));
    };

    if (loading) return <p className="up-loading">Loading profile...</p>;
    if (error) return <p className="up-error">{error}</p>;
    if (!profile) return <p className="up-error">User not found.</p>;

    const isOwnProfile = currentUserId === userId;

    return (
        <div className="user-profile-page">
            <div className="up-card">
                <div className="up-avatar">
                    {profile.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="up-name">{profile.name}</h2>
                <p className="up-joined">
                    Joined {new Date(profile.joinedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </p>

                <div className="up-stats">
                    <div className="up-stat">
                        <span className="up-stat-number">{profile.followersCount}</span>
                        <span className="up-stat-label">Followers</span>
                    </div>
                    <div className="up-stat">
                        <span className="up-stat-number">{profile.followingCount}</span>
                        <span className="up-stat-label">Following</span>
                    </div>
                    <div className="up-stat">
                        <span className="up-stat-number">{profile.reviews.length}</span>
                        <span className="up-stat-label">Reviews</span>
                    </div>
                </div>

                {/* Follow/Unfollow button — only if logged in and not own profile */}
                {localStorage.getItem("token") && !isOwnProfile && (
                    <button
                        className={`up-follow-btn ${isFollowing ? "up-following" : ""}`}
                        onClick={isFollowing ? handleUnfollow : handleFollow}
                        disabled={followLoading}
                    >
                        {followLoading ? "..." : isFollowing ? "Unfollow" : "Follow"}
                    </button>
                )}
            </div>

            {/* User's Reviews */}
            <div className="up-reviews-section">
                <h3 className="up-reviews-heading">Reviews by {profile.name}</h3>

                {profile.reviews.length === 0 ? (
                    <p className="up-no-reviews">No reviews yet.</p>
                ) : (
                    <div className="up-reviews-list">
                        {profile.reviews.map(rev => (
                            <div key={rev._id} className="up-review-card">
                                <div className="up-review-left">
                                    {rev.movie?.posterUrl && (
                                        <Link to={`/movie/${rev.movie._id}`}>
                                            <img
                                                src={rev.movie.posterUrl}
                                                alt={rev.movie.title}
                                                className="up-review-poster"
                                                onError={(e) => {
                                                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='75' fill='%23ccc'%3E%3Crect width='50' height='75' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='8'%3EPoster%3C/text%3E%3C/svg%3E";
                                                }}
                                            />
                                        </Link>
                                    )}
                                </div>
                                <div className="up-review-right">
                                    <Link to={`/movie/${rev.movie?._id}`} className="up-review-movie">
                                        {rev.movie?.title || "Unknown Movie"}
                                    </Link>
                                    <div className="up-review-meta">
                                        <span className="up-review-stars">{renderStars(rev.rating)}</span>
                                        <span className="up-review-date">
                                            {new Date(rev.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                        </span>
                                    </div>
                                    <p className="up-review-comment">{rev.comment}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default UserProfile;
