import React from "react";
import { Link } from "react-router-dom";
import "./MovieCard.css";

function MovieCard({ movie, isFavorite, onToggleFavorite }) {

    const handleHeartClick = (e) => {
        e.preventDefault();   // prevent navigating to movie detail
        e.stopPropagation();
        if (onToggleFavorite) {
            onToggleFavorite(movie._id);
        }
    };

    return (
        <Link to={`/movie/${movie._id}`} className="movie-card">
            <img
                src={movie.posterUrl}
                alt={movie.title}
                className="movie-poster"
                onError={(e) => {
                    e.target.src = "https://via.placeholder.com/300x450?text=No+Poster";
                }}
            />
            <div className="movie-info">
                <h3 className="movie-title">{movie.title}</h3>
                <p className="movie-genre">{Array.isArray(movie.genre) ? movie.genre.join(", ") : movie.genre || ""}</p>
                <div className="movie-meta">
                    <span className="movie-rating">⭐ {movie.rating}/10</span>
                    <span className="movie-language">{movie.language}</span>
                </div>
            </div>
            {/* Heart icon at top-right of the card */}
            <button
                className={`card-heart-btn ${isFavorite ? "heart-active" : ""}`}
                onClick={handleHeartClick}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
                {isFavorite ? "❤️" : "🤍"}
            </button>
        </Link>
    );
}

export default MovieCard;
