import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import API from "../api";
import "./MyBookings.css";

function MyBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cancellingId, setCancellingId] = useState(null);
    const [reviewedMovieIds, setReviewedMovieIds] = useState([]);
    const [activeReviewBookingId, setActiveReviewBookingId] = useState(null);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState("");
    const [reviewSubmittingBookingId, setReviewSubmittingBookingId] = useState(null);
    const [reviewError, setReviewError] = useState("");
    const navigate = useNavigate();

    const getUserId = () => {
        const stored = localStorage.getItem("userId");
        if (stored) return stored;
        try {
            const token = localStorage.getItem("token");
            if (!token) return null;
            const payload = JSON.parse(atob(token.split(".")[1]));
            return payload.id || null;
        } catch {
            return null;
        }
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const fetchBookings = async () => {
            try {
                const userId = getUserId();
                const bookingsRes = await API.get("/bookings/my");
                let reviewsRes = { data: [] };

                if (userId && /^[a-f\d]{24}$/i.test(userId)) {
                    try {
                        reviewsRes = await API.get(`/reviews/user/${userId}`);
                    } catch (reviewErr) {
                        console.error("Failed to fetch user reviews:", reviewErr);
                    }
                }

                setBookings(bookingsRes.data);

                const reviewedIds = reviewsRes.data
                    .map((review) => review.movie?._id || review.movie)
                    .filter(Boolean)
                    .map((id) => id.toString());
                setReviewedMovieIds([...new Set(reviewedIds)]);
            } catch (err) {
                console.error(err);
                setError("Failed to load bookings");
            } finally {
                setLoading(false);
            }
        };
        fetchBookings();
    }, [navigate]);

    const handleCancel = async (id) => {
        const ok = window.confirm("Are you sure you want to cancel this booking?");
        if (!ok) return;
        setCancellingId(id);
        try {
            await API.put(`/bookings/cancel/${id}`);
            setBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b));
        } catch (err) {
            console.error(err);
            setError("Failed to cancel booking.");
        } finally {
            setCancellingId(null);
        }
    };

    // Format date nicely: "2026-03-01" → "01 Mar 2026"
    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    // Generate and download PDF ticket
    const handleDownloadPDF = (b) => {
        const doc = new jsPDF();
        const movieTitle = b.showtime?.movie?.title || "Unknown";
        const theaterName = b.showtime?.theater?.name || "Unknown";
        const theaterArea = b.showtime?.theater?.area || "";
        const theaterCity = b.showtime?.theater?.city || "";
        const showDate = formatDate(b.showtime?.date);
        const showTime = b.showtime?.time || "";
        const seats = b.seats.join(", ");
        const totalPrice = b.totalPrice;
        const bookingId = b._id;
        const status = b.status === "confirmed" ? "CONFIRMED" : "CANCELLED";

        const pageW = doc.internal.pageSize.getWidth();
        let y = 30;

        // Title
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("MOVIE TICKET", pageW / 2, y, { align: "center" });
        y += 6;

        // Top line
        doc.setLineWidth(0.5);
        doc.line(30, y, pageW - 30, y);
        y += 14;

        // Ticket details
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Movie:", 35, y);
        doc.setFont("helvetica", "normal");
        doc.text(movieTitle, 80, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("Theatre:", 35, y);
        doc.setFont("helvetica", "normal");
        doc.text(`${theaterName} — ${theaterArea}, ${theaterCity}`, 80, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("Date:", 35, y);
        doc.setFont("helvetica", "normal");
        doc.text(showDate, 80, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("Time:", 35, y);
        doc.setFont("helvetica", "normal");
        doc.text(showTime, 80, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("Seats:", 35, y);
        doc.setFont("helvetica", "normal");
        doc.text(seats, 80, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("Amount:", 35, y);
        doc.setFont("helvetica", "normal");
        doc.text(`Rs. ${totalPrice}`, 80, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("Status:", 35, y);
        doc.setFont("helvetica", "normal");
        doc.text(status, 80, y);
        y += 6;

        // Bottom line
        doc.line(30, y, pageW - 30, y);
        y += 10;

        // Booking ID (smaller)
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(`Booking ID: ${bookingId}`, pageW / 2, y, { align: "center" });
        y += 8;
        doc.text("Thank you for choosing Movie Matrix!", pageW / 2, y, { align: "center" });

        doc.save(`ticket_${bookingId}.pdf`);
    };

    const buildShowDateTime = (date, time) => {
        if (!date || !time) return null;

        const datePart = String(date).split("T")[0];
        const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) return null;

        const timePart = String(time).trim();
        const meridiemMatch = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        const hour24Match = timePart.match(/^(\d{1,2}):(\d{2})$/);

        let hours;
        let minutes;

        if (meridiemMatch) {
            hours = parseInt(meridiemMatch[1], 10);
            minutes = parseInt(meridiemMatch[2], 10);
            const meridiem = meridiemMatch[3].toUpperCase();

            if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

            if (meridiem === "PM" && hours !== 12) hours += 12;
            if (meridiem === "AM" && hours === 12) hours = 0;
        } else if (hour24Match) {
            hours = parseInt(hour24Match[1], 10);
            minutes = parseInt(hour24Match[2], 10);

            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        } else {
            return null;
        }

        const [, year, month, day] = dateMatch;
        return new Date(Number(year), Number(month) - 1, Number(day), hours, minutes, 0, 0);
    };

    const isShowStarted = (booking) => {
        const showDateTime = buildShowDateTime(booking.showtime?.date, booking.showtime?.time);
        if (!showDateTime) return true;
        return new Date() >= showDateTime;
    };

    const getMovieIdFromBooking = (booking) => booking.showtime?.movie?._id?.toString() || "";

    const openReviewForm = (bookingId) => {
        setActiveReviewBookingId(bookingId);
        setReviewRating(0);
        setReviewComment("");
        setReviewError("");
    };

    const closeReviewForm = () => {
        setActiveReviewBookingId(null);
        setReviewRating(0);
        setReviewComment("");
        setReviewError("");
    };

    const handleSubmitReview = async (booking) => {
        const movieId = getMovieIdFromBooking(booking);
        if (!movieId) {
            setReviewError("Movie details are missing for this booking.");
            return;
        }
        if (reviewRating < 1 || reviewRating > 5) {
            setReviewError("Please select a rating between 1 and 5 stars.");
            return;
        }
        if (!reviewComment.trim()) {
            setReviewError("Please enter a review comment.");
            return;
        }

        try {
            setReviewSubmittingBookingId(booking._id);
            setReviewError("");

            await API.post("/reviews", {
                movieId,
                rating: reviewRating,
                comment: reviewComment.trim()
            });

            setReviewedMovieIds((prev) =>
                prev.includes(movieId) ? prev : [...prev, movieId]
            );
            closeReviewForm();
        } catch (err) {
            console.error("Review submit error:", err);
            setReviewError(err.response?.data?.error || "Failed to submit review.");
        } finally {
            setReviewSubmittingBookingId(null);
        }
    };

    if (loading) return <p className="loading-text">Loading your bookings...</p>;
    if (error) return <p className="error-text">{error}</p>;

    return (
        <div className="my-bookings">
            <h2>🎟️ My Bookings</h2>
            {bookings.length === 0 ? (
                <p className="no-bookings">You haven't booked any tickets yet.</p>
            ) : (
                <div className="booking-list">
                    {bookings.map((b) => {
                        const movieId = getMovieIdFromBooking(b);
                        const reviewSubmitted = reviewedMovieIds.includes(movieId);
                        const hasShowtimeData = !!(b.showtime?.date && b.showtime?.time && movieId);
                        const canReview = b.status === "confirmed" && hasShowtimeData && isShowStarted(b);
                        return (
                        <div
                            key={b._id}
                            className={`ticket-card ${b.status === "cancelled" ? "ticket-cancelled" : ""}`}
                        >
                            {/* Left: Poster */}
                            <div className="ticket-poster">
                                <img
                                    src={b.showtime?.movie?.posterUrl}
                                    alt={b.showtime?.movie?.title}
                                    onError={(e) => {
                                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='180' fill='%23ccc'%3E%3Crect width='120' height='180' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='12'%3ENo Poster%3C/text%3E%3C/svg%3E";
                                    }}
                                />
                            </div>

                            {/* Middle: Details */}
                            <div className="ticket-details">
                                <h3 className="ticket-movie-title">
                                    {b.showtime?.movie?.title || "Unknown Movie"}
                                </h3>
                                <p className="ticket-genre">
                                    {Array.isArray(b.showtime?.movie?.genre)
                                        ? b.showtime.movie.genre.join(", ")
                                        : ""}
                                </p>
                                <div className="ticket-info-grid">
                                    <div className="ticket-info-item">
                                        <span className="ticket-label">Theatre</span>
                                        <span className="ticket-value">
                                            {b.showtime?.theater?.name} — {b.showtime?.theater?.area}
                                        </span>
                                    </div>
                                    <div className="ticket-info-item">
                                        <span className="ticket-label">Date</span>
                                        <span className="ticket-value">{formatDate(b.showtime?.date)}</span>
                                    </div>
                                    <div className="ticket-info-item">
                                        <span className="ticket-label">Time</span>
                                        <span className="ticket-value">{b.showtime?.time}</span>
                                    </div>
                                    <div className="ticket-info-item">
                                        <span className="ticket-label">Seats</span>
                                        <span className="ticket-value">{b.seats.join(", ")}</span>
                                    </div>
                                    <div className="ticket-info-item">
                                        <span className="ticket-label">Amount</span>
                                        <span className="ticket-value ticket-price">₹{b.totalPrice}</span>
                                    </div>
                                </div>
                                <p className="ticket-id">Booking ID: {b._id}</p>

                                {canReview && !reviewSubmitted && (
                                    <div className="review-section-inline">
                                        {activeReviewBookingId === b._id ? (
                                            <div className="review-inline-form">
                                                <div className="review-star-row">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            className={`review-star-btn ${star <= reviewRating ? "active" : ""}`}
                                                            onClick={() => setReviewRating(star)}
                                                        >
                                                            ★
                                                        </button>
                                                    ))}
                                                </div>
                                                <textarea
                                                    className="review-comment-input"
                                                    placeholder="Write your review..."
                                                    value={reviewComment}
                                                    onChange={(e) => setReviewComment(e.target.value)}
                                                    rows={3}
                                                    maxLength={1000}
                                                />
                                                {reviewError && <p className="review-error-text">{reviewError}</p>}
                                                <div className="review-inline-actions">
                                                    <button
                                                        className="submit-review-btn"
                                                        onClick={() => handleSubmitReview(b)}
                                                        disabled={reviewSubmittingBookingId === b._id}
                                                    >
                                                        {reviewSubmittingBookingId === b._id ? "Submitting..." : "Submit Review"}
                                                    </button>
                                                    <button
                                                        className="cancel-review-btn"
                                                        onClick={closeReviewForm}
                                                        disabled={reviewSubmittingBookingId === b._id}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                className="write-review-btn"
                                                onClick={() => openReviewForm(b._id)}
                                            >
                                                Write Review
                                            </button>
                                        )}
                                    </div>
                                )}

                                {canReview && reviewSubmitted && (
                                    <p className="review-submitted-label">Review Submitted</p>
                                )}
                            </div>

                            {/* Right: Status + Actions */}
                            <div className="ticket-actions">
                                <span className={`ticket-badge ${b.status}`}>
                                    {b.status === "confirmed" ? "✓ Confirmed" : "✕ Cancelled"}
                                </span>

                                {b.status === "confirmed" && (
                                    <>
                                        <button
                                            className="download-btn"
                                            onClick={() => handleDownloadPDF(b)}
                                        >
                                            📄 Download Ticket
                                        </button>
                                        {isShowStarted(b) ? (
                                            <span className="show-passed-label">Show has started</span>
                                        ) : (
                                            <button
                                                className="cancel-btn"
                                                onClick={() => handleCancel(b._id)}
                                                disabled={cancellingId === b._id}
                                            >
                                                {cancellingId === b._id ? <span className="spinner"></span> : "Cancel Booking"}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MyBookings;
