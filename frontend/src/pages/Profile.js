import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import { ProfileSkeleton, ActivitySkeleton } from "../components/Skeleton";
import "./Profile.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL
    ? process.env.REACT_APP_API_BASE_URL.replace("/api", "")
    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000"
        : "";

function Profile() {
    const [user, setUser] = useState(null);
    const [bookingCount, setBookingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [uploadingPic, setUploadingPic] = useState(false);
    const [showPhotoOptions, setShowPhotoOptions] = useState(false);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    // Modal state for followers/following lists
    const [modalType, setModalType] = useState(null);   // "followers" | "following" | null
    const [modalList, setModalList] = useState([]);
    const [modalLoading, setModalLoading] = useState(false);

    // Reviews modal state
    const [showReviewsModal, setShowReviewsModal] = useState(false);
    const [userReviews, setUserReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);

    // Bookings modal state
    const [showBookingsModal, setShowBookingsModal] = useState(false);
    const [userBookings, setUserBookings] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);

    // Recent Activity state
    const [activities, setActivities] = useState([]);
    const [activitiesLoading, setActivitiesLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const fetchProfile = async () => {
            try {
                const userRes = await API.get("/auth/me");
                setUser(userRes.data);

                const bookingsRes = await API.get("/bookings/my");
                setBookingCount(bookingsRes.data.length);

                // Fetch recent activity
                try {
                    const actRes = await API.get(`/users/${userRes.data._id}/activity`);
                    setActivities(actRes.data);
                } catch (actErr) {
                    console.error("Failed to load activity:", actErr);
                } finally {
                    setActivitiesLoading(false);
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load profile");
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [navigate]);

    if (loading) return (
        <div className="profile-page">
            <ProfileSkeleton />
            <div className="profile-activity-card">
                <h3 className="activity-title">Recent Activity</h3>
                {[...Array(4)].map((_, i) => (
                    <ActivitySkeleton key={i} />
                ))}
            </div>
        </div>
    );
    if (error) return <p className="error-text">{error}</p>;
    if (!user) return <p className="error-text">User not found</p>;

    // Open followers or following modal
    const openModal = async (type) => {
        setModalType(type);
        setModalList([]);
        setModalLoading(true);
        try {
            const res = await API.get(`/users/${user._id}/${type}`);
            setModalList(res.data);
        } catch (err) {
            console.error(`Failed to load ${type}:`, err);
        } finally {
            setModalLoading(false);
        }
    };

    const closeModal = () => {
        setModalType(null);
        setModalList([]);
    };

    // Open reviews modal
    const openReviewsModal = async () => {
        setShowReviewsModal(true);
        setUserReviews([]);
        setReviewsLoading(true);
        try {
            const res = await API.get(`/reviews/user/${user._id}`);
            setUserReviews(res.data);
        } catch (err) {
            console.error("Failed to load reviews:", err);
        } finally {
            setReviewsLoading(false);
        }
    };

    const closeReviewsModal = () => {
        setShowReviewsModal(false);
        setUserReviews([]);
    };

    // Open bookings modal
    const openBookingsModal = async () => {
        setShowBookingsModal(true);
        setUserBookings([]);
        setBookingsLoading(true);
        try {
            const res = await API.get("/bookings/my");
            setUserBookings(res.data);
        } catch (err) {
            console.error("Failed to load bookings:", err);
        } finally {
            setBookingsLoading(false);
        }
    };

    const closeBookingsModal = () => {
        setShowBookingsModal(false);
        setUserBookings([]);
    };

    const renderStars = (count) => {
        return [...Array(5)].map((_, i) => (
            <span key={i} style={{ color: i < count ? "#f5c518" : "#ddd", fontSize: 14 }}>★</span>
        ));
    };

    // Helper: relative time string
    const timeAgo = (dateStr) => {
        const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
        if (seconds < 60) return "Just now";
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        const weeks = Math.floor(days / 7);
        if (weeks < 4) return `${weeks}w ago`;
        return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    };

    // Handle profile picture upload
    const handlePicUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Client-side validation
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
        setShowPhotoOptions(false);
        try {
            const res = await API.post("/users/upload-profile-pic", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setUser(prev => ({ ...prev, profilePic: res.data.profilePic }));
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload profile picture.");
        } finally {
            setUploadingPic(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Remove profile picture
    const handleRemovePhoto = async () => {
        setShowPhotoOptions(false);
        setUploadingPic(true);
        try {
            await API.delete("/users/remove-profile-pic");
            setUser(prev => ({ ...prev, profilePic: "" }));
        } catch (err) {
            console.error("Remove photo error:", err);
            alert("Failed to remove profile picture.");
        } finally {
            setUploadingPic(false);
        }
    };

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="avatar-container" onClick={() => setShowPhotoOptions(true)} title="Change profile photo">
                    {user.profilePic ? (
                        <img
                            src={`${API_BASE}${user.profilePic}`}
                            alt={user.name}
                            className="profile-avatar-img"
                        />
                    ) : (
                        <div className="profile-avatar">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="camera-icon">📷</div>
                    {uploadingPic && <div className="profile-avatar-spinner">Uploading...</div>}
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        onChange={handlePicUpload}
                    />
                </div>
                <h2>{user.name}</h2>
                <p className="profile-email">{user.email}</p>
                <p className="profile-joined">
                    Joined: {new Date(user.createdAt).toLocaleDateString()}
                </p>

                <div className="profile-stats">
                    <div className="stat stat-clickable" onClick={openReviewsModal}>
                        <span className="stat-number">{user.reviewCount || 0}</span>
                        <span className="stat-label">Reviews</span>
                    </div>
                    <div className="stat stat-clickable" onClick={() => openModal("followers")}>
                        <span className="stat-number">{user.followers ? user.followers.length : 0}</span>
                        <span className="stat-label">Followers</span>
                    </div>
                    <div className="stat stat-clickable" onClick={() => openModal("following")}>
                        <span className="stat-number">{user.following ? user.following.length : 0}</span>
                        <span className="stat-label">Following</span>
                    </div>
                    <div className="stat stat-clickable" onClick={openBookingsModal}>
                        <span className="stat-number">{bookingCount}</span>
                        <span className="stat-label">Bookings</span>
                    </div>
                </div>

            </div>

            {/* Recent Activity Section */}
            <div className="profile-activity-card">
                <h3 className="activity-title">Recent Activity</h3>
                {activitiesLoading ? (
                    <div>
                        {[...Array(4)].map((_, i) => (
                            <ActivitySkeleton key={i} />
                        ))}
                    </div>
                ) : activities.length === 0 ? (
                    <p className="activity-empty">No recent activity yet.</p>
                ) : (
                    <div className="activity-list">
                        {activities.map((act, idx) => (
                            <div key={idx} className="activity-item">
                                <span className="activity-icon">{act.icon}</span>
                                <div className="activity-content">
                                    <span className="activity-text">
                                        {act.text}
                                        {act.type === "review" && act.rating && (
                                            <span className="activity-stars">
                                                {" "}{[...Array(act.rating)].map((_, i) => (
                                                    <span key={i} style={{ color: "#f5c518", fontSize: 13 }}>★</span>
                                                ))}
                                            </span>
                                        )}
                                    </span>
                                    <span className="activity-time">
                                        {timeAgo(act.createdAt)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Followers / Following Modal */}
            {modalType && (
                <div className="profile-modal-overlay" onClick={closeModal}>
                    <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="profile-modal-header">
                            <h3>{modalType === "followers" ? "Followers" : "Following"}</h3>
                            <button className="profile-modal-close" onClick={closeModal}>✕</button>
                        </div>
                        <div className="profile-modal-body">
                            {modalLoading ? (
                                <p className="profile-modal-loading">Loading...</p>
                            ) : modalList.length === 0 ? (
                                <p className="profile-modal-empty">
                                    {modalType === "followers" ? "No followers yet." : "Not following anyone yet."}
                                </p>
                            ) : (
                                <div className="profile-modal-list">
                                    {modalList.map(u => (
                                        <Link
                                            key={u._id}
                                            to={`/profile/${u._id}`}
                                            className="profile-modal-item"
                                            onClick={closeModal}
                                        >
                                            {u.profilePic ? (
                                                <img
                                                    src={`${API_BASE}${u.profilePic}`}
                                                    alt={u.name}
                                                    className="profile-modal-avatar-img"
                                                />
                                            ) : (
                                                <div className="profile-modal-avatar">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="profile-modal-name">{u.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reviews Modal */}
            {showReviewsModal && (
                <div className="profile-modal-overlay" onClick={closeReviewsModal}>
                    <div className="profile-modal profile-reviews-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="profile-modal-header">
                            <h3>Reviews by {user.name}</h3>
                            <button className="profile-modal-close" onClick={closeReviewsModal}>✕</button>
                        </div>
                        <div className="profile-modal-body">
                            {reviewsLoading ? (
                                <p className="profile-modal-loading">Loading...</p>
                            ) : userReviews.length === 0 ? (
                                <p className="profile-modal-empty">No reviews written yet.</p>
                            ) : (
                                <div className="profile-reviews-list">
                                    {userReviews.map(rev => (
                                        <div key={rev._id} className="profile-review-card">
                                            <div className="profile-review-top">
                                                <span className="profile-review-movie">
                                                    {rev.movie?.title || "Unknown Movie"}
                                                </span>
                                                <span className="profile-review-date">
                                                    {new Date(rev.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                                </span>
                                            </div>
                                            <div className="profile-review-stars">{renderStars(rev.rating)}</div>
                                            <p className="profile-review-text">{rev.comment}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Bookings Modal */}
            {showBookingsModal && (
                <div className="profile-modal-overlay" onClick={closeBookingsModal}>
                    <div className="profile-modal profile-bookings-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="profile-modal-header">
                            <h3>My Bookings</h3>
                            <button className="profile-modal-close" onClick={closeBookingsModal}>✕</button>
                        </div>
                        <div className="profile-modal-body">
                            {bookingsLoading ? (
                                <p className="profile-modal-loading">Loading...</p>
                            ) : userBookings.length === 0 ? (
                                <p className="profile-modal-empty">No bookings yet.</p>
                            ) : (
                                <div className="profile-bookings-list">
                                    {userBookings.map(b => (
                                        <div key={b._id} className="profile-booking-card">
                                            <div className="profile-booking-top">
                                                <span className="profile-booking-movie">
                                                    {b.showtime?.movie?.title || "Unknown Movie"}
                                                </span>
                                                <span className={`profile-booking-status status-${b.status}`}>
                                                    {b.status}
                                                </span>
                                            </div>
                                            <div className="profile-booking-details">
                                                <span>🎭 {b.showtime?.theater?.name || "Unknown Theater"}</span>
                                                <span>📅 {b.showtime?.date ? new Date(b.showtime.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}</span>
                                                <span>⏰ {b.showtime?.time || "N/A"}</span>
                                            </div>
                                            <div className="profile-booking-seats">
                                                💺 Seats: {b.seats?.join(", ") || "N/A"}
                                            </div>
                                            <div className="profile-booking-price">
                                                ₹{b.totalPrice || 0}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Options Modal (Instagram-style) */}
            {showPhotoOptions && (
                <div className="photo-options-overlay" onClick={() => setShowPhotoOptions(false)}>
                    <div className="photo-options-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="photo-options-title">Change Profile Photo</h3>
                        <button
                            className="photo-option-btn photo-option-upload"
                            onClick={() => { fileInputRef.current?.click(); }}
                        >
                            📷 Upload New Photo
                        </button>
                        {user.profilePic && (
                            <button
                                className="photo-option-btn photo-option-remove"
                                onClick={handleRemovePhoto}
                            >
                                🗑️ Remove Current Photo
                            </button>
                        )}
                        <button
                            className="photo-option-btn photo-option-cancel"
                            onClick={() => setShowPhotoOptions(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;
