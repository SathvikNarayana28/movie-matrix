import React from "react";
import { Link } from "react-router-dom";
import "./MovieCard.css";

function MovieCard({ movie }) {
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
                <p className="movie-genre">{movie.genre.join(", ")}</p>
                <div className="movie-meta">
                    <span className="movie-rating">⭐ {movie.rating}/10</span>
                    <span className="movie-language">{movie.language}</span>
                </div>
            </div>
        </Link>
    );
}

export default MovieCard;
