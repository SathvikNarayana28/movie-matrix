import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
