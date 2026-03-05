import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import API from "../api";
import TrailerModal from "../components/TrailerModal";
import "./Movie.css";

function Movie() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [movie, setMovie] = useState(null);
    const [showtimes, setShowtimes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFavorite, setIsFavorite] = useState(false);
    const [selectedCity, setSelectedCity] = useState("Hyderabad");
    const [selectedDate, setSelectedDate] = useState("");
    const [trailerKey, setTrailerKey] = useState(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const [trailerLoading, setTrailerLoading] = useState(false);
    const [trailerError, setTrailerError] = useState("");

    // Review state
    const [reviews, setReviews] = useState([]);
    const [avgRating, setAvgRating] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [reviewRating, setReviewRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewComment, setReviewComment] = useState("");
    const [reviewError, setReviewError] = useState("");
    const [reviewSuccess, setReviewSuccess] = useState("");
    const [editingReview, setEditingReview] = useState(null);
    const [userReview, setUserReview] = useState(null);
    const [hasBooked, setHasBooked] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const movieRes = await API.get(`/movies/${id}`);
                setMovie(movieRes.data);

                const showRes = await API.get(`/showtimes/movie/${id}`);
                setShowtimes(showRes.data);

                // check if this movie is in user's favorites
                const token = localStorage.getItem("token");
                if (token) {
                    const favRes = await API.get("/favorites");
                    const favIds = favRes.data.map(m => m._id);
                    setIsFavorite(favIds.includes(id));
                }
            } catch (err) {
                console.error("Error fetching movie or showtimes:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    // Fetch reviews, average rating, and eligibility
    const fetchReviews = async () => {
        try {
            const [revRes, avgRes] = await Promise.all([
                API.get(`/reviews/${id}`),
                API.get(`/reviews/${id}/average`)
            ]);
            setReviews(revRes.data);
            setAvgRating(avgRes.data.averageRating);
            setTotalReviews(avgRes.data.totalReviews);

            // Check eligibility and find user's own review
            const token = localStorage.getItem("token");
            if (token) {
                try {
                    const [eligRes, meRes] = await Promise.all([
                        API.get(`/reviews/${id}/eligibility`),
                        API.get("/auth/me")
                    ]);
                    setHasBooked(eligRes.data.hasBooked);
                    setCurrentUserId(meRes.data._id);
                    const myReview = revRes.data.find(r => r.user._id === meRes.data._id);
                    setUserReview(myReview || null);
                } catch (e) { /* not logged in */ }
            }
        } catch (err) {
            console.error("Error fetching reviews:", err);
        }
    };

    useEffect(() => {
        fetchReviews();
        // eslint-disable-next-line
    }, [id]);

    const handleToggleFavorite = async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }
        try {
            await API.put(`/favorites/${id}`);
            setIsFavorite(!isFavorite);
        } catch (err) {
            console.error("Error toggling favorite:", err);
        }
    };

    const handleBookClick = (showtimeId) => {
        // require login
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }
        navigate(`/book/${showtimeId}`);
    };

    // ---- Review Handlers ----
    const handleSubmitReview = async (e) => {
        e.preventDefault();
        setReviewError("");
        setReviewSuccess("");

        const token = localStorage.getItem("token");
        if (!token) { navigate("/login"); return; }

        if (reviewRating < 1 || reviewRating > 5) {
            setReviewError("Please select a rating (1–5 stars).");
            return;
        }
        if (!reviewComment.trim()) {
            setReviewError("Please write a comment.");
            return;
        }

        try {
            if (editingReview) {
                await API.put(`/reviews/${editingReview._id}`, { rating: reviewRating, comment: reviewComment });
                setReviewSuccess("Review updated!");
                setEditingReview(null);
            } else {
                await API.post(`/reviews/${id}`, { rating: reviewRating, comment: reviewComment });
                setReviewSuccess("Review submitted!");
            }
            setReviewRating(0);
            setReviewComment("");
            fetchReviews();
        } catch (err) {
            setReviewError(err.response?.data?.error || "Failed to submit review.");
        }
    };

    const handleEditReview = (review) => {
        setEditingReview(review);
        setReviewRating(review.rating);
        setReviewComment(review.comment);
        setReviewError("");
        setReviewSuccess("");
    };

    const handleCancelEdit = () => {
        setEditingReview(null);
        setReviewRating(0);
        setReviewComment("");
        setReviewError("");
        setReviewSuccess("");
    };

    const handleDeleteReview = async (reviewId) => {
        if (!window.confirm("Delete your review?")) return;
        try {
            await API.delete(`/reviews/${reviewId}`);
            setReviewSuccess("Review deleted.");
            setUserReview(null);
            fetchReviews();
        } catch (err) {
            setReviewError(err.response?.data?.error || "Failed to delete review.");
        }
    };

    const handleLikeReview = async (reviewId) => {
        const token = localStorage.getItem("token");
        if (!token) { navigate("/login"); return; }
        try {
            const res = await API.post(`/reviews/${reviewId}/like`);
            // Update like state locally
            setReviews(prev => prev.map(rev => {
                if (rev._id === reviewId) {
                    return {
                        ...rev,
                        likes: res.data.liked
                            ? [...(rev.likes || []), currentUserId]
                            : (rev.likes || []).filter(lid => lid !== currentUserId),
                    };
                }
                return rev;
            }));
        } catch (err) {
            console.error("Like error:", err);
        }
    };

    const renderStars = (count, size = 18) => {
        return [...Array(5)].map((_, i) => (
            <span key={i} style={{ color: i < count ? "#f5c518" : "#ccc", fontSize: size }}>
                ★
            </span>
        ));
    };

    const handleWatchTrailer = async () => {
        setTrailerLoading(true);
        setTrailerError("");
        try {
            const res = await API.get(`/movies/${id}/trailer`);
            setTrailerKey(res.data.key);
            setShowTrailer(true);
        } catch (err) {
            console.error("Trailer fetch error:", err);
            setTrailerError("Trailer not available for this movie.");
        } finally {
            setTrailerLoading(false);
        }
    };

    if (loading) return <p className="loading-text">Loading...</p>;
    if (!movie) return <p className="error-text">Movie not found.</p>;

    // Get unique cities from all showtimes for the city filter
    const cities = [...new Set(
        showtimes
            .filter(st => st.theater && st.theater.city)
            .map(st => st.theater.city)
    )];

    // Filter showtimes by selected city
    const cityFiltered = selectedCity
        ? showtimes.filter(st => st.theater && st.theater.city === selectedCity)
        : showtimes;

    // Extract unique dates from city-filtered showtimes, filter out past dates, sorted ascending
    const today = new Date().toISOString().split("T")[0];
    const availableDates = [...new Set(
        cityFiltered.map(st => st.date ? st.date.split("T")[0] : "")
    )].filter(d => d && d >= today).sort();

    // Auto-select today if available, otherwise first future date
    const activeDateRaw = selectedDate && availableDates.includes(selectedDate)
        ? selectedDate
        : availableDates.includes(today)
            ? today
            : availableDates[0] || "";

    // Filter by selected date
    const filteredShowtimes = activeDateRaw
        ? cityFiltered.filter(st => st.date && st.date.split("T")[0] === activeDateRaw)
        : cityFiltered;

    // Helper: format date string for tab label (e.g. "28 Feb")
    const formatDateTab = (dateStr) => {
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    };

    // Group filtered showtimes by theatre
    const groupedByTheatre = filteredShowtimes.reduce((acc, st) => {
        if (!st.theater) return acc;
        const theatreId = st.theater._id;
        if (!acc[theatreId]) {
            acc[theatreId] = {
                theatre: st.theater,
                shows: []
            };
        }
        acc[theatreId].shows.push(st);
        return acc;
    }, {});

    // Sort shows within each theatre by date + time
    Object.values(groupedByTheatre).forEach(group => {
        group.shows.sort((a, b) => {
            const dateA = new Date(`${a.date} ${a.time}`);
            const dateB = new Date(`${b.date} ${b.time}`);
            return dateA - dateB;
        });
    });

    // Compute available seats count from seats array
    const getAvailableCount = (st) => {
        if (!st.seats || !Array.isArray(st.seats)) return 0;
        return st.seats.filter(s => !s.isBooked).length;
    };

    return (
        <div className="movie-detail">
            <div className="movie-header">
                <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="detail-poster"
                    onError={(e) => {
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' fill='%23ccc'%3E%3Crect width='300' height='450' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='20'%3ENo Poster%3C/text%3E%3C/svg%3E";
                    }}
                />
                <div className="detail-info">
                    <h2>
                        {movie.title}
                        <button
                            className={`fav-btn ${isFavorite ? "fav-active" : ""}`}
                            onClick={handleToggleFavorite}
                            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                            {isFavorite ? "❤️" : "🤍"}
                        </button>
                    </h2>
                    <p className="genres">
                        {Array.isArray(movie.genre) ? movie.genre.join(", ") : movie.genre || ""}
                    </p>
                    <p className="rating">⭐ {movie.rating}/10</p>
                    <p className="language">{movie.language}</p>
                    <p className="duration">{movie.duration} min</p>
                    <p className="description">{movie.description}</p>
                    <p className="cast"><strong>Cast:</strong> {movie.cast.join(", ")}</p>
                    <p className="director"><strong>Director:</strong> {movie.director}</p>
                    <button
                        className="trailer-btn"
                        onClick={handleWatchTrailer}
                        disabled={trailerLoading}
                    >
                        {trailerLoading ? "Loading..." : "▶ Watch Trailer"}
                    </button>
                    {trailerError && <p className="trailer-error">{trailerError}</p>}
                </div>
            </div>

            <h3 className="showtimes-heading">Showtimes</h3>

            {/* City Filter */}
            {cities.length > 0 && (
                <div className="city-filter">
                    <label>City: </label>
                    <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setSelectedDate(""); }}>
                        <option value="">All Cities</option>
                        {cities.map(city => (
                            <option key={city} value={city}>{city}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Date Tabs */}
            {availableDates.length > 0 && (
                <div className="date-tabs">
                    {availableDates.map(dateStr => (
                        <button
                            key={dateStr}
                            className={`date-tab ${dateStr === activeDateRaw ? "date-tab-active" : ""}`}
                            onClick={() => setSelectedDate(dateStr)}
                        >
                            {formatDateTab(dateStr)}
                        </button>
                    ))}
                </div>
            )}

            {filteredShowtimes.length === 0 ? (
                <p className="no-showtimes">
                    {availableDates.length === 0
                        ? "No upcoming shows available."
                        : `No showtimes available${selectedCity ? ` in ${selectedCity}` : ""} on ${formatDateTab(activeDateRaw)}.`
                    }
                </p>
            ) : (
                <div className="theatre-group-list">
                    {Object.values(groupedByTheatre).map(({ theatre, shows }) => (
                        <div key={theatre._id} className="theatre-group">
                            <div className="theatre-group-header">
                                <div>
                                    <h4 className="theatre-group-name">{theatre.name}</h4>
                                    <p className="theatre-group-area">📍 {theatre.area}, {theatre.city}</p>
                                </div>
                                <span className="theatre-group-screens">{theatre.screens} Screens</span>
                            </div>
                            <div className="theatre-shows-row">
                                {shows.map((st) => {
                                    const available = getAvailableCount(st);
                                    const isSoldOut = available === 0;
                                    const fillingFast = !isSoldOut && available < 20;
                                    return (
                                        <button
                                            key={st._id}
                                            className={`show-slot ${isSoldOut ? "sold-out" : ""} ${fillingFast ? "filling-fast" : ""}`}
                                            onClick={() => !isSoldOut && handleBookClick(st._id)}
                                            disabled={isSoldOut}
                                            title={isSoldOut ? "Sold Out" : `${available} seats available`}
                                        >
                                            <span className="slot-time">{st.time}</span>
                                            <span className="slot-price">₹{st.price}</span>
                                            <span className={`slot-seats ${isSoldOut ? "seat-zero" : fillingFast ? "seat-low" : ""}`}>
                                                {isSoldOut ? "Sold Out" : `${available} seats left`}
                                            </span>
                                            {fillingFast && <span className="filling-fast-label">Filling Fast</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ========== Reviews Section ========== */}
            <div className="reviews-section">
                <h3 className="reviews-heading">User Reviews</h3>

                {/* Average Rating Summary */}
                <div className="review-summary">
                    <div className="review-avg-stars">
                        {renderStars(Math.round(avgRating), 24)}
                    </div>
                    <span className="review-avg-number">{avgRating > 0 ? avgRating : "—"}</span>
                    <span className="review-avg-count">
                        {totalReviews === 0 ? "No reviews yet" : `${totalReviews} review${totalReviews > 1 ? "s" : ""}`}
                    </span>
                </div>

                {/* Review Form — show if logged in AND booked AND (no existing review OR editing) */}
                {localStorage.getItem("token") && hasBooked && (!userReview || editingReview) && (
                    <form className="review-form" onSubmit={handleSubmitReview}>
                        <h4>{editingReview ? "Edit Your Review" : "Write a Review"}</h4>
                        <div className="star-picker">
                            {[1, 2, 3, 4, 5].map(star => (
                                <span
                                    key={star}
                                    className={`star-pick ${star <= (hoverRating || reviewRating) ? "star-active" : ""}`}
                                    onClick={() => setReviewRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                >
                                    ★
                                </span>
                            ))}
                            <span className="star-label">
                                {reviewRating > 0 ? `${reviewRating}/5` : "Select rating"}
                            </span>
                        </div>
                        <textarea
                            className="review-textarea"
                            placeholder="Share your thoughts about this movie..."
                            value={reviewComment}
                            onChange={e => setReviewComment(e.target.value)}
                            maxLength={1000}
                            rows={4}
                        />
                        <div className="review-form-actions">
                            <button type="submit" className="review-submit-btn">
                                {editingReview ? "Update Review" : "Submit Review"}
                            </button>
                            {editingReview && (
                                <button type="button" className="review-cancel-btn" onClick={handleCancelEdit}>
                                    Cancel
                                </button>
                            )}
                        </div>
                        {reviewError && <p className="review-error">{reviewError}</p>}
                        {reviewSuccess && <p className="review-success">{reviewSuccess}</p>}
                    </form>
                )}

                {/* Not logged in prompt */}
                {!localStorage.getItem("token") && (
                    <p className="review-login-prompt">
                        <span onClick={() => navigate("/login")} className="review-login-link">Log in</span> to write a review.
                    </p>
                )}

                {/* Logged in but hasn't booked this movie */}
                {localStorage.getItem("token") && !hasBooked && (
                    <p className="review-booking-prompt">
                        Only users who have booked this movie can leave a review.
                    </p>
                )}

                {/* Reviews List */}
                <div className="reviews-list">
                    {reviews.length === 0 && (
                        <p className="no-reviews">No reviews yet. Be the first to review!</p>
                    )}
                    {reviews.map(rev => {
                        const isLiked = currentUserId && (rev.likes || []).some(
                            lid => (typeof lid === "string" ? lid : lid?._id || lid) === currentUserId
                        );
                        const likesCount = (rev.likes || []).length;

                        return (
                            <div key={rev._id} className="review-card">
                                <div className="review-card-header">
                                    <div className="review-user-info">
                                        <Link to={`/profile/${rev.user?._id}`} className="review-user-name review-user-link">
                                            {rev.user?.name || "User"}
                                        </Link>
                                        {rev.verifiedViewer && (
                                            <span className="review-verified-badge" title="Verified Viewer — booked and watched this movie">
                                                ✓ Verified Viewer
                                            </span>
                                        )}
                                        <span className="review-date">
                                            {new Date(rev.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                        </span>
                                    </div>
                                    <div className="review-stars">{renderStars(rev.rating, 16)}</div>
                                </div>
                                <p className="review-comment">{rev.comment}</p>
                                <div className="review-bottom-actions">
                                    <button
                                        className={`review-like-btn ${isLiked ? "review-liked" : ""}`}
                                        onClick={() => handleLikeReview(rev._id)}
                                        title={isLiked ? "Unlike" : "Like"}
                                    >
                                        {isLiked ? "👍" : "👍"} {likesCount > 0 ? `${likesCount} like${likesCount !== 1 ? "s" : ""}` : "Like"}
                                    </button>
                                    {/* Show edit/delete only for the user's own review */}
                                    {userReview && userReview._id === rev._id && (
                                        <>
                                            <button className="review-edit-btn" onClick={() => handleEditReview(rev)}>Edit</button>
                                            <button className="review-delete-btn" onClick={() => handleDeleteReview(rev._id)}>Delete</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Trailer Modal */}
            {showTrailer && trailerKey && (
                <TrailerModal
                    videoKey={trailerKey}
                    onClose={() => setShowTrailer(false)}
                />
            )}
        </div>
    );
}

export default Movie;
