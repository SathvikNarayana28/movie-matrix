import React, { useState, useEffect, useCallback } from "react";
import API from "../api";
import MovieCard from "../components/MovieCard";
import "./Home.css";

function Home() {
    const [movies, setMovies] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [favoriteIds, setFavoriteIds] = useState([]);

    // Fetch movies from backend (with optional search query)
    const fetchMovies = useCallback(async (search) => {
        try {
            setLoading(true);
            const url = search ? `/movies?search=${encodeURIComponent(search)}` : "/movies";
            const res = await API.get(url);
            setMovies(res.data);
            setError("");
        } catch (err) {
            console.error("Error fetching movies:", err);
            setError("Failed to load movies. Please make sure the backend is running.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch user's favorite IDs (if logged in)
    const fetchFavorites = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token) return;
        try {
            const res = await API.get("/favorites");
            setFavoriteIds(res.data.map((m) => m._id));
        } catch (err) {
            console.error("Error fetching favorites:", err);
        }
    }, []);

    // Load movies + favorites on mount
    useEffect(() => {
        fetchMovies("");
        fetchFavorites();
    }, [fetchMovies, fetchFavorites]);

    // Debounced search — calls backend 400ms after user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMovies(searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, fetchMovies]);

    // Called by MovieCard when heart is toggled
    const handleToggleFavorite = async (movieId) => {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login";
            return;
        }
        try {
            await API.put(`/favorites/${movieId}`);
            // Update local list
            setFavoriteIds((prev) =>
                prev.includes(movieId)
                    ? prev.filter((id) => id !== movieId)
                    : [...prev, movieId]
            );
        } catch (err) {
            console.error("Error toggling favorite:", err);
        }
    };

    return (
        <div className="home">
            <h2 className="home-heading">🎬 Now Showing</h2>

            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search movies by title, genre or language..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            {loading && <p className="loading-text">Loading movies...</p>}

            {!loading && error && <p className="error-text">{error}</p>}

            {!loading && !error && movies.length === 0 && (
                <p className="no-movies">
                    {searchTerm
                        ? "No movies match your search."
                        : "No movies available right now."}
                </p>
            )}

            {!loading && !error && movies.length > 0 && (
                <div className="movie-grid">
                    {movies.map((movie) => (
                        <MovieCard
                            key={movie._id}
                            movie={movie}
                            isFavorite={favoriteIds.includes(movie._id)}
                            onToggleFavorite={handleToggleFavorite}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Home;
