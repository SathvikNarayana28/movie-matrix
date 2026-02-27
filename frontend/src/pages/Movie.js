import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api";
import "./Movie.css";

function Movie() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [movie, setMovie] = useState(null);
    const [showtimes, setShowtimes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFavorite, setIsFavorite] = useState(false);

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

    if (loading) return <p className="loading-text">Loading...</p>;
    if (!movie) return <p className="error-text">Movie not found.</p>;

    return (
        <div className="movie-detail">
            <div className="movie-header">
                <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="detail-poster"
                    onError={(e) => {
                        e.target.src = "https://via.placeholder.com/300x450?text=No+Poster";
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
                </div>
            </div>

            <h3 className="showtimes-heading">Showtimes</h3>
            {showtimes.length === 0 ? (
                <p className="no-showtimes">No showtimes available.</p>
            ) : (
                <div className="showtime-list">
                    {showtimes.map((st) => (
                        <div key={st._id} className="showtime-card">
                            <p className="theater-name">{st.theater.name}</p>
                            <p className="datetime">
                                {st.date} {st.time}
                            </p>
                            <p className="price">₹ {st.price}</p>
                            {st.availableSeats > 0 ? (
                            <button
                                className="book-btn"
                                onClick={() => handleBookClick(st._id)}
                            >
                                Book
                            </button>
                        ) : (
                            <button className="book-btn" disabled>Sold Out</button>
                        )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Movie;
