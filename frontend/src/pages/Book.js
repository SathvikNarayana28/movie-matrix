import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api";
import "./Book.css";

function Book() {
    const { showtimeId } = useParams();
    const navigate = useNavigate();

    const [showtime, setShowtime] = useState(null);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [bookingLoading, setBookingLoading] = useState(false);

    // ---- Seat locking state ----
    const [lockedSeats, setLockedSeats] = useState([]);       // seats locked by others
    const [myLockedSeats, setMyLockedSeats] = useState([]);   // seats locked by me
    const [lockExpiry, setLockExpiry] = useState(null);       // Date when my lock expires
    const [countdown, setCountdown] = useState(0);            // seconds remaining
    const [lockError, setLockError] = useState("");
    const timerRef = useRef(null);

    // Get userId: try localStorage first, fallback to decoding JWT
    const getUserId = () => {
        const stored = localStorage.getItem("userId");
        if (stored) return stored;
        try {
            const token = localStorage.getItem("token");
            if (!token) return null;
            const payload = JSON.parse(atob(token.split(".")[1]));
            return payload.id || null;
        } catch { return null; }
    };
    const userId = getUserId();

    // Fetch showtime data
    const fetchShowtime = useCallback(async () => {
        try {
            const res = await API.get(`/showtimes/${showtimeId}`);
            setShowtime(res.data);

            // Also fetch seat status (booked + locked)
            const seatRes = await API.get(`/bookings/seats/${showtimeId}`);
            setLockedSeats(seatRes.data.lockedSeats || []);
        } catch (err) {
            console.error(err);
            setError("Failed to load showtime data");
        } finally {
            setLoading(false);
        }
    }, [showtimeId]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }
        fetchShowtime();
    }, [navigate, fetchShowtime]);

    // Countdown timer for seat lock
    useEffect(() => {
        if (!lockExpiry) return;

        const tick = () => {
            const remaining = Math.max(0, Math.floor((lockExpiry.getTime() - Date.now()) / 1000));
            setCountdown(remaining);

            if (remaining <= 0) {
                // Lock expired — reset
                clearInterval(timerRef.current);
                timerRef.current = null;
                setLockExpiry(null);
                setMyLockedSeats([]);
                setSelectedSeats([]);
                setLockError("Session expired. Please select seats again.");
                fetchShowtime(); // refresh seat status
            }
        };

        tick(); // run immediately
        timerRef.current = setInterval(tick, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [lockExpiry, fetchShowtime]);

    // Cleanup: unlock seats when user leaves the page
    useEffect(() => {
        return () => {
            // Unlock on component unmount (e.g. navigating away within the app)
            if (myLockedSeats.length > 0) {
                API.post("/bookings/unlock-seats", { showtimeId }).catch(() => {});
            }
        };
    }, [myLockedSeats, showtimeId]);

    if (loading) return <p className="loading-text">Loading showtime...</p>;
    if (error && !showtime) return <p className="error-text">{error}</p>;
    if (!showtime) return <p className="error-text">Showtime not found</p>;

    // --- Build structured seat rows from showtime.seats ---
    const allSeats = showtime.seats || [];
    const availableCount = allSeats.filter(s => !s.isBooked).length;

    // Group seats by row letter
    const rowMap = {};
    allSeats.forEach(seat => {
        if (!rowMap[seat.row]) {
            rowMap[seat.row] = [];
        }
        rowMap[seat.row].push(seat);
    });

    // Sort rows alphabetically, seats by number
    const rows = Object.keys(rowMap).sort().map(rowLabel => ({
        rowLabel,
        seats: rowMap[rowLabel].sort((a, b) => a.number - b.number)
    }));

    // Check if a seat is locked by another user
    const isSeatLockedByOther = (seatId) => {
        return lockedSeats.some(l => l.seatId === seatId && l.lockedBy !== userId);
    };

    const handleSeatClick = (seat) => {
        if (seat.isBooked) return;
        if (isSeatLockedByOther(seat.seatId)) return;

        // If we already have a confirmed lock, don't allow changing selection
        if (myLockedSeats.length > 0 && !myLockedSeats.includes(seat.seatId)) {
            return; // can't add new seats to an active lock
        }

        if (selectedSeats.includes(seat.seatId)) {
            setSelectedSeats(selectedSeats.filter((s) => s !== seat.seatId));
        } else {
            if (selectedSeats.length < 10) {
                setSelectedSeats([...selectedSeats, seat.seatId]);
            } else {
                alert("You can select up to 10 seats at a time");
            }
        }
    };

    // Lock selected seats (called before confirming)
    const handleLockSeats = async () => {
        if (selectedSeats.length === 0) {
            setError("Please choose at least one seat.");
            return;
        }
        setLockError("");
        try {
            const res = await API.post("/bookings/lock-seats", {
                showtimeId,
                seats: selectedSeats
            });
            setMyLockedSeats([...selectedSeats]);
            setLockExpiry(new Date(res.data.lockExpiresAt));
            setError("");
        } catch (err) {
            console.error(err);
            setLockError(err.response?.data?.msg || "Failed to lock seats. Try again.");
            // Refresh seat status
            fetchShowtime();
        }
    };

    // Load Razorpay checkout script dynamically
    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleConfirm = async () => {
        if (selectedSeats.length === 0) {
            setError("Please choose at least one seat.");
            return;
        }
        setBookingLoading(true);
        setError("");

        try {
            // 1. Load Razorpay script
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                setError("Failed to load payment gateway. Check your internet connection.");
                setBookingLoading(false);
                return;
            }

            const totalAmount = selectedSeats.length * showtime.price;

            // 2. Create Razorpay order on backend
            const orderRes = await API.post("/payment/create-order", { amount: totalAmount });
            const { orderId, keyId } = orderRes.data;

            // 3. Open Razorpay checkout popup
            const options = {
                key: keyId,
                amount: totalAmount * 100,  // in paise
                currency: "INR",
                name: "Movie Matrix",
                description: `${selectedSeats.length} seat(s) — ${showtime.movie.title}`,
                order_id: orderId,
                handler: async function (response) {
                    // 4. Verify payment on backend
                    try {
                        const verifyRes = await API.post("/payment/verify", {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });

                        if (verifyRes.data.verified) {
                            // 5. Confirm booking with payment details
                            await API.post("/bookings", {
                                showtimeId,
                                seats: selectedSeats,
                                paymentId: response.razorpay_payment_id,
                                orderId: response.razorpay_order_id
                            });

                            // Clear lock timer
                            if (timerRef.current) clearInterval(timerRef.current);
                            setLockExpiry(null);
                            setMyLockedSeats([]);
                            setSuccess("Payment successful! Booking confirmed!");
                            setError("");
                            setLockError("");
                            setTimeout(() => {
                                navigate("/my-bookings");
                            }, 1500);
                        } else {
                            setError("Payment verification failed. Please contact support.");
                        }
                    } catch (verifyErr) {
                        console.error(verifyErr);
                        setError("Payment verification failed. If amount was deducted, contact support.");
                    } finally {
                        setBookingLoading(false);
                    }
                },
                prefill: {
                    name: localStorage.getItem("username") || "",
                    email: localStorage.getItem("email") || ""
                },
                theme: {
                    color: "#e50914"
                },
                modal: {
                    ondismiss: function () {
                        setBookingLoading(false);
                        setError("Payment cancelled. Your seats are still reserved.");
                    }
                }
            };

            const razorpay = new window.Razorpay(options);
            razorpay.on("payment.failed", function (response) {
                setError(`Payment failed: ${response.error.description}`);
                setBookingLoading(false);
            });
            razorpay.open();

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.msg || "Payment initiation failed");
            setBookingLoading(false);
        }
    };

    // Format countdown mm:ss
    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    // Are seats locked and ready to confirm?
    const seatsAreLocked = myLockedSeats.length > 0 && countdown > 0;

    return (
        <div className="book-container">
            <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
            <h2>Book tickets for {showtime.movie.title}</h2>
            <p>
                {showtime.theater.name}, {showtime.theater.area} &bull; {showtime.date} at {showtime.time}
            </p>
            <p>Price per seat: ₹{showtime.price}</p>
            <p>Seats available: {availableCount}</p>
            {selectedSeats.length > 0 && (
                <p className="selection-summary">
                    Selected: {selectedSeats.join(", ")} ({selectedSeats.length} seat{selectedSeats.length > 1 ? "s" : ""}) — Total: ₹{selectedSeats.length * showtime.price}
                </p>
            )}

            {/* Countdown timer */}
            {seatsAreLocked && (
                <div className={`lock-timer ${countdown <= 30 ? "lock-timer-warning" : ""}`}>
                    🔒 Seats reserved for <strong>{formatTime(countdown)}</strong>
                </div>
            )}

            {error && <p className="error-text">{error}</p>}
            {lockError && <p className="error-text">{lockError}</p>}
            {success && <p className="success-text">{success}</p>}

            {/* Screen indicator */}
            <div className="screen-indicator">
                <div className="screen-bar"></div>
                <p className="screen-label">SCREEN THIS WAY</p>
            </div>

            {/* Seat layout — row by row from showtime.seats */}
            <div className="seat-layout">
                {rows.map((row) => (
                    <div key={row.rowLabel} className="seat-row">
                        <span className="row-label">{row.rowLabel}</span>
                        <div className="seat-row-seats">
                            {row.seats.map((seat) => {
                                const isSelected = selectedSeats.includes(seat.seatId);
                                const isLockedOther = isSeatLockedByOther(seat.seatId);
                                return (
                                    <div
                                        key={seat.seatId}
                                        className={`seat ${seat.isBooked ? "booked" : ""} ${isSelected ? "selected" : ""} ${isLockedOther ? "locked-other" : ""}`}
                                        onClick={() => handleSeatClick(seat)}
                                        title={seat.isBooked ? "Already booked" : isLockedOther ? "Held by another user" : seat.seatId}
                                    >
                                        {seat.seatId}
                                    </div>
                                );
                            })}
                        </div>
                        <span className="row-label">{row.rowLabel}</span>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="legend">
                <span className="legend-item"><span className="legend-box available"></span> Available</span>
                <span className="legend-item"><span className="legend-box selected"></span> Selected</span>
                <span className="legend-item"><span className="legend-box booked"></span> Booked</span>
                <span className="legend-item"><span className="legend-box locked-other"></span> Held</span>
            </div>

            {/* Two-step: Lock first, then Confirm */}
            {!seatsAreLocked ? (
                <button className="confirm-btn lock-btn" onClick={handleLockSeats} disabled={selectedSeats.length === 0}>
                    🔒 Reserve Seats
                </button>
            ) : (
                <button className="confirm-btn" onClick={handleConfirm} disabled={bookingLoading || selectedSeats.length === 0}>
                    {bookingLoading ? <span className="spinner"></span> : `Pay ₹${selectedSeats.length * showtime.price}`}
                </button>
            )}
        </div>
    );
}

export default Book;
