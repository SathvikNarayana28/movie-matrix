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
                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' fill='%23ccc'%3E%3Crect width='300' height='450' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='20'%3ENo Poster%3C/text%3E%3C/svg%3E";
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
