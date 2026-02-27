import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api";
import "./Book.css";

function Book() {
    const { showtimeId } = useParams();
    const navigate = useNavigate();

    const [showtime, setShowtime] = useState(null);
    const [bookedSeats, setBookedSeats] = useState([]);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [bookingLoading, setBookingLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const fetchData = async () => {
            try {
                const res = await API.get(`/showtimes/${showtimeId}`);
                setShowtime(res.data);
                const seatsRes = await API.get(`/bookings/seats/${showtimeId}`);
                setBookedSeats(seatsRes.data.bookedSeats || []);
            } catch (err) {
                console.error(err);
                setError("Failed to load showtime data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [showtimeId, navigate]);

    if (loading) return <p className="loading-text">Loading showtime...</p>;
    if (error) return <p className="error-text">{error}</p>;
    if (!showtime) return <p className="error-text">Showtime not found</p>;

    // --- Build structured seat rows ---
    // Total capacity = available seats + already booked seats
    const capacity = showtime.availableSeats + bookedSeats.length;
    const seatsPerRow = 6;
    const totalRows = Math.ceil(capacity / seatsPerRow);

    // Build rows: each row has { rowLabel, seats: [{ seatId, row, number, isBooked }] }
    const rows = [];
    let seatCount = 0;
    for (let r = 0; r < totalRows; r++) {
        const rowLabel = String.fromCharCode(65 + r); // A, B, C, D, ...
        const seatsInRow = [];
        for (let c = 1; c <= seatsPerRow; c++) {
            seatCount++;
            if (seatCount > capacity) break;
            const seatId = `${rowLabel}${c}`;
            seatsInRow.push({
                seatId,
                row: rowLabel,
                number: c,
                isBooked: bookedSeats.includes(seatId)
            });
        }
        if (seatsInRow.length > 0) {
            rows.push({ rowLabel, seats: seatsInRow });
        }
    }

    const handleSeatClick = (seat) => {
        if (seat.isBooked) return;
        if (selectedSeats.includes(seat.seatId)) {
            setSelectedSeats(selectedSeats.filter((s) => s !== seat.seatId));
        } else {
            if (selectedSeats.length < showtime.availableSeats) {
                setSelectedSeats([...selectedSeats, seat.seatId]);
            } else {
                alert(`You can select up to ${showtime.availableSeats} seats`);
            }
        }
    };

    const handleConfirm = async () => {
        if (selectedSeats.length === 0) {
            setError("Please choose at least one seat.");
            return;
        }
        setBookingLoading(true);
        try {
            await API.post("/bookings", {
                showtimeId,
                seats: selectedSeats
            });
            setSuccess("Booking confirmed!");
            setError("");
            setTimeout(() => {
                navigate("/my-bookings");
            }, 1000);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.msg || "Booking failed");
        } finally {
            setBookingLoading(false);
        }
    };

    return (
        <div className="book-container">
            <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
            <h2>Book tickets for {showtime.movie.title}</h2>
            <p>
                {showtime.theater.name} &bull; {showtime.date} at {showtime.time}
            </p>
            <p>Price per seat: ₹{showtime.price}</p>
            <p>Seats available: {showtime.availableSeats}</p>
            {selectedSeats.length > 0 && (
                <p className="selection-summary">
                    Selected: {selectedSeats.join(", ")} ({selectedSeats.length} seat{selectedSeats.length > 1 ? "s" : ""}) — Total: ₹{selectedSeats.length * showtime.price}
                </p>
            )}

            {error && <p className="error-text">{error}</p>}
            {success && <p className="success-text">{success}</p>}

            {/* Screen indicator */}
            <div className="screen-indicator">
                <div className="screen-bar"></div>
                <p className="screen-label">SCREEN THIS WAY</p>
            </div>

            {/* Seat layout — row by row */}
            <div className="seat-layout">
                {rows.map((row) => (
                    <div key={row.rowLabel} className="seat-row">
                        <span className="row-label">{row.rowLabel}</span>
                        <div className="seat-row-seats">
                            {row.seats.map((seat) => {
                                const isSelected = selectedSeats.includes(seat.seatId);
                                return (
                                    <div
                                        key={seat.seatId}
                                        className={`seat ${seat.isBooked ? "booked" : ""} ${isSelected ? "selected" : ""}`}
                                        onClick={() => handleSeatClick(seat)}
                                        title={seat.isBooked ? "Already booked" : seat.seatId}
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
            </div>

            <button className="confirm-btn" onClick={handleConfirm} disabled={bookingLoading || selectedSeats.length === 0}>
                {bookingLoading ? <span className="spinner"></span> : "Confirm Booking"}
            </button>
        </div>
    );
}

export default Book;
