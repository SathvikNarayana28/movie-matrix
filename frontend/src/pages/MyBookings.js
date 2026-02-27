import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./MyBookings.css";

function MyBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cancellingId, setCancellingId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const fetchBookings = async () => {
            try {
                const res = await API.get("/bookings/my");
                setBookings(res.data);
            } catch (err) {
                console.error(err);
                setError("Failed to load bookings");
            } finally {
                setLoading(false);
            }
        };
        fetchBookings();
    }, [navigate]);

    if (loading) return <p className="loading-text">Loading your bookings...</p>;
    if (error) return <p className="error-text">{error}</p>;

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

    return (
        <div className="my-bookings">
            <h2>My Bookings</h2>
            {bookings.length === 0 ? (
                <p className="no-bookings">You haven't booked any tickets yet.</p>
            ) : (
                <div className="booking-list">
                    {bookings.map((b) => (
                        <div key={b._id} className="booking-card">
                            <h3>{b.showtime.movie.title}</h3>
                            <p>{b.showtime.theater.name}</p>
                            <p>
                                {b.showtime.date} at {b.showtime.time}
                            </p>
                            <p>Seats: {b.seats.join(", ")}</p>
                            <p>Total: ₹{b.totalPrice}</p>
                            <p>Status: {b.status}</p>
                            {b.status === "confirmed" && (
                                <button
                                    className="cancel-btn"
                                    onClick={() => handleCancel(b._id)}
                                    disabled={cancellingId === b._id}
                                >
                                    {cancellingId === b._id ? <span className="spinner"></span> : "Cancel"}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MyBookings;
