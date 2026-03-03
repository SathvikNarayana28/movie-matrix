import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import MovieCard from "../components/MovieCard";
import "./Home.css";

function Home() {
    const [movies, setMovies] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("");
    const [selectedGenre, setSelectedGenre] = useState("");
    const [genres, setGenres] = useState([]);
    const [selectedLanguage, setSelectedLanguage] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [favoriteIds, setFavoriteIds] = useState([]);
    const [newReleases, setNewReleases] = useState([]);
    const [nearbyTheatres, setNearbyTheatres] = useState([]);
    const [selectedCity, setSelectedCity] = useState(() => localStorage.getItem("selectedCity") || "Hyderabad");
    const [recommendations, setRecommendations] = useState([]);

    // --- Suggestions state ---
    const [suggestions, setSuggestions] = useState({ local: [], external: [] });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const searchRef = useRef(null);
    const navigate = useNavigate();

    // Fetch movies from backend (with optional search + sort + genre + language)
    const fetchMovies = useCallback(async (search, sort, genre, language) => {
        try {
            setLoading(true);
            let url = "/movies";
            const params = [];
            if (search) params.push(`search=${encodeURIComponent(search)}`);
            if (sort) params.push(`sort=${sort}`);
            if (genre) params.push(`genre=${encodeURIComponent(genre)}`);
            if (language) params.push(`language=${encodeURIComponent(language)}`);
            if (params.length > 0) url += `?${params.join("&")}`;
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

    // Load genres, favorites, and recommendations once on mount
    useEffect(() => {
        fetchFavorites();
        // Fetch distinct genres for the dropdown
        API.get("/movies/genres")
            .then((res) => setGenres(res.data))
            .catch((err) => console.error("Error fetching genres:", err));
        // Fetch newly released movies
        API.get("/movies/new-releases")
            .then((res) => setNewReleases(res.data))
            .catch((err) => console.error("Error fetching new releases:", err));
        // Fetch AI-powered recommendations (only if logged in)
        const token = localStorage.getItem("token");
        if (token) {
            API.get("/ai/recommend")
                .then((res) => setRecommendations(res.data.recommendations || []))
                .catch((err) => console.error("Error fetching recommendations:", err));
        }
    }, [fetchFavorites]);

    // Fetch nearby theatres whenever selectedCity changes
    useEffect(() => {
        localStorage.setItem("selectedCity", selectedCity);
        API.get(`/theaters/nearby?city=${encodeURIComponent(selectedCity)}`)
            .then((res) => setNearbyTheatres(res.data))
            .catch((err) => console.error("Error fetching nearby theatres:", err));
    }, [selectedCity]);

    // Fetch movies whenever search/filter/sort changes (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMovies(searchTerm, sortBy, selectedGenre, selectedLanguage);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, sortBy, selectedGenre, selectedLanguage, fetchMovies]);

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

    // --- Debounced suggestions fetch (300ms) ---
    useEffect(() => {
        if (searchTerm.trim().length < 2) {
            setSuggestions({ local: [], external: [] });
            setShowSuggestions(false);
            return;
        }
        setSuggestionsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await API.get(`/movies/suggestions?query=${encodeURIComponent(searchTerm.trim())}`);
                setSuggestions(res.data);
                setShowSuggestions(true);
            } catch (err) {
                console.error("Suggestion fetch error:", err);
            } finally {
                setSuggestionsLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // --- Close dropdown when clicking outside ---
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Handle suggestion click ---
    const handleSuggestionClick = async (item, isExternal) => {
        setShowSuggestions(false);
        setSearchTerm("");

        if (!isExternal) {
            // Local movie — has MongoDB _id, navigate directly
            navigate(`/movie/${item._id}`);
        } else {
            // External (TMDB) movie — use hybrid search to save it, then navigate
            try {
                const res = await API.get(`/movies?search=${encodeURIComponent(item.title)}`);
                const saved = res.data.find(m => m.tmdbId === item.tmdbId);
                if (saved) {
                    navigate(`/movie/${saved._id}`);
                } else if (res.data.length > 0) {
                    navigate(`/movie/${res.data[0]._id}`);
                }
            } catch (err) {
                console.error("Error saving TMDB movie:", err);
            }
        }
    };

    return (
        <div className="home">
            {/* ===== Newly Released Section ===== */}
            {newReleases.length > 0 && (
                <div className="new-releases-section">
                    <h2 className="home-heading">🎬 Newly Released</h2>
                    <div className="new-releases-scroll">
                        {newReleases.map((movie) => (
                            <div key={movie._id} className="new-release-card-wrapper">
                                <span className="new-badge">NEW</span>
                                <MovieCard
                                    movie={movie}
                                    isFavorite={favoriteIds.includes(movie._id)}
                                    onToggleFavorite={handleToggleFavorite}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <h2 className="home-heading">🎬 Now Showing</h2>

            {/* ===== AI Recommended For You ===== */}
            {recommendations.length > 0 && (
                <div className="recommendations-section">
                    <h2 className="home-heading">🤖 Recommended For You</h2>
                    <div className="recommendations-scroll">
                        {recommendations.map((rec, idx) => (
                            <div
                                key={idx}
                                className="rec-card"
                                onClick={() => rec.suggestedShowtime
                                    ? navigate(`/book/${rec.suggestedShowtime.showtimeId}`)
                                    : navigate(`/movie/${rec.movie._id}`)}
                            >
                                <img
                                    src={rec.movie.posterUrl}
                                    alt={rec.movie.title}
                                    className="rec-poster"
                                    onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='180'%3E%3Crect width='120' height='180' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='14'%3EN/A%3C/text%3E%3C/svg%3E"; }}
                                />
                                <div className="rec-info">
                                    <span className="rec-title">{rec.movie.title}</span>
                                    <span className="rec-score">Match: {Math.round(rec.score * 100)}%</span>
                                    {rec.suggestedShowtime && (
                                        <span className="rec-showtime">
                                            📍 {rec.suggestedShowtime.theater} • {rec.suggestedShowtime.time}
                                        </span>
                                    )}
                                    <span className="rec-reason">{rec.reason}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== Theatres Near You Section ===== */}
            <div className="nearby-section">
                <div className="nearby-header">
                    <h2 className="home-heading">📍 Theatres Near You</h2>
                    <select
                        className="city-select"
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                    >
                        <option value="Hyderabad">Hyderabad</option>
                        <option value="Bangalore">Bangalore</option>
                        <option value="Chennai">Chennai</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Delhi">Delhi</option>
                        <option value="Kolkata">Kolkata</option>
                        <option value="Pune">Pune</option>
                    </select>
                </div>
                {nearbyTheatres.length > 0 ? (
                    <div className="nearby-theatres-scroll">
                        {nearbyTheatres.map((t) => (
                            <div key={t._id} className="theatre-card">
                                <div className="theatre-icon">🎬</div>
                                <h4 className="theatre-name">{t.name}</h4>
                                <p className="theatre-area">📍 {t.area}</p>
                                <p className="theatre-screens">{t.screens} Screens</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-theatres">No theatres found in {selectedCity}.</p>
                )}
            </div>

            <div className="search-bar">
                <div className="search-wrapper" ref={searchRef}>
                    <input
                        type="text"
                        placeholder="Search movies by title, genre or language..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => {
                            if (suggestions.local.length > 0 || suggestions.external.length > 0) {
                                setShowSuggestions(true);
                            }
                        }}
                        className="search-input"
                    />
                    {showSuggestions && (suggestions.local.length > 0 || suggestions.external.length > 0) && (
                        <div className="suggestions-dropdown">
                            {suggestionsLoading && (
                                <div className="suggestion-loading">Searching...</div>
                            )}
                            {suggestions.local.map((m) => (
                                <div
                                    key={m._id}
                                    className="suggestion-item"
                                    onMouseDown={() => handleSuggestionClick(m, false)}
                                >
                                    <img
                                        src={m.posterUrl}
                                        alt={m.title}
                                        className="suggestion-poster"
                                        onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='8'%3EN/A%3C/text%3E%3C/svg%3E"; }}
                                    />
                                    <div className="suggestion-info">
                                        <span className="suggestion-title">{m.title}</span>
                                        <span className="suggestion-meta">
                                            {Array.isArray(m.genre) ? m.genre.slice(0, 2).join(", ") : ""}
                                            {m.rating ? ` • ⭐ ${m.rating.toFixed(1)}` : ""}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {suggestions.external.length > 0 && suggestions.local.length > 0 && (
                                <div className="suggestion-divider">From TMDB</div>
                            )}
                            {suggestions.external.map((m) => (
                                <div
                                    key={m.tmdbId}
                                    className="suggestion-item suggestion-external"
                                    onMouseDown={() => handleSuggestionClick(m, true)}
                                >
                                    <img
                                        src={m.posterUrl}
                                        alt={m.title}
                                        className="suggestion-poster"
                                        onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='8'%3EN/A%3C/text%3E%3C/svg%3E"; }}
                                    />
                                    <div className="suggestion-info">
                                        <span className="suggestion-title">{m.title}</span>
                                        <span className="suggestion-meta">
                                            {Array.isArray(m.genre) ? m.genre.slice(0, 2).join(", ") : ""}
                                            {m.rating ? ` • ⭐ ${m.rating.toFixed(1)}` : ""}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <select
                    className="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="">Sort by Rating</option>
                    <option value="desc">Rating: High to Low</option>
                    <option value="asc">Rating: Low to High</option>
                </select>
                <select
                    className="genre-select"
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                >
                    <option value="">All Genres</option>
                    {genres.map((g) => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>
                <select
                    className="language-select"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                >
                    <option value="">All Languages</option>
                    {["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Punjabi", "Gujarati"].map((lang) => (
                        <option key={lang} value={lang}>{lang}</option>
                    ))}
                </select>
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
