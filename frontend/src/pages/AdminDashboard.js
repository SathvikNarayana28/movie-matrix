import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./AdminDashboard.css";

function AdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("movies");

    // ---- TMDB search state ----
    const [searchQuery, setSearchQuery] = useState("");
    const [tmdbResults, setTmdbResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // ---- Movie form state (auto-filled from TMDB or manual) ----
    const [movieForm, setMovieForm] = useState({
        tmdbId: "", title: "", genre: "", language: "", duration: "",
        releaseDate: "", rating: "", description: "",
        posterUrl: "", trailerUrl: "", cast: "", director: ""
    });

    // ---- Show fields (part of the same "Add Movie" form) ----
    const [showFields, setShowFields] = useState({
        theater: "", date: "", time: "", price: ""
    });

    // ---- Theatre form state ----
    const [theatreForm, setTheatreForm] = useState({
        name: "", location: "", totalSeats: ""
    });

    // ---- Data lists ----
    const [movies, setMovies] = useState([]);
    const [theatres, setTheatres] = useState([]);
    const [shows, setShows] = useState([]);

    // ---- UI state ----
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Check admin role on mount
    useEffect(() => {
        const role = localStorage.getItem("role");
        if (role !== "admin") {
            navigate("/");
        }
    }, [navigate]);

    // Fetch data for lists and dropdowns
    useEffect(() => {
        fetchMovies();
        fetchTheatres();
        fetchShows();
    }, []);

    const fetchMovies = async () => {
        try {
            const res = await API.get("/movies");
            setMovies(res.data);
        } catch (err) {
            console.error("Failed to fetch movies");
        }
    };

    const fetchTheatres = async () => {
        try {
            const res = await API.get("/admin/theatres");
            setTheatres(res.data);
        } catch (err) {
            console.error("Failed to fetch theatres");
        }
    };

    const fetchShows = async () => {
        try {
            const res = await API.get("/admin/shows");
            setShows(res.data);
        } catch (err) {
            console.error("Failed to fetch shows");
        }
    };

    const clearMessages = () => { setMsg(""); setError(""); };

    // =============================================
    //  TMDB SEARCH — "Fetch Details" button
    // =============================================
    const handleTmdbSearch = async () => {
        if (!searchQuery.trim()) return;
        clearMessages();
        setSearching(true);
        setTmdbResults([]);
        try {
            const res = await API.get(`/admin/tmdb-search?query=${encodeURIComponent(searchQuery.trim())}`);
            if (res.data.length === 0) {
                setError("No movies found on TMDB. You can fill details manually.");
            }
            setTmdbResults(res.data);
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to search TMDB");
        } finally {
            setSearching(false);
        }
    };

    // When admin selects a TMDB result → auto-fill the form
    const handleSelectTmdb = (movie) => {
        setMovieForm({
            tmdbId: movie.tmdbId || "",
            title: movie.title || "",
            genre: (movie.genre || []).join(", "),
            language: movie.language || "EN",
            duration: movie.duration || "",
            releaseDate: movie.releaseDate ? movie.releaseDate.split("T")[0] : "",
            rating: movie.rating || "",
            description: movie.description || "",
            posterUrl: movie.posterUrl || "",
            trailerUrl: movie.trailerUrl || "",
            cast: (movie.cast || []).join(", "),
            director: movie.director || ""
        });
        setTmdbResults([]); // collapse search results
        setSearchQuery("");  // clear search box
    };

    const resetMovieForm = () => {
        setMovieForm({
            tmdbId: "", title: "", genre: "", language: "", duration: "",
            releaseDate: "", rating: "", description: "",
            posterUrl: "", trailerUrl: "", cast: "", director: ""
        });
        setShowFields({ theater: "", date: "", time: "", price: "" });
        setSearchQuery("");
        setTmdbResults([]);
    };

    // =============================================
    //  SUBMIT: Add Movie + Create Show
    // =============================================
    const handleAddMovieShow = async (e) => {
        e.preventDefault();
        clearMessages();
        setSubmitting(true);
        try {
            const payload = {
                // Movie fields
                tmdbId: movieForm.tmdbId || undefined,
                title: movieForm.title,
                genre: movieForm.genre,
                language: movieForm.language,
                duration: Number(movieForm.duration) || 120,
                releaseDate: movieForm.releaseDate,
                rating: Number(movieForm.rating) || 0,
                description: movieForm.description,
                posterUrl: movieForm.posterUrl,
                trailerUrl: movieForm.trailerUrl,
                cast: movieForm.cast,
                director: movieForm.director,
                // Show fields
                theater: showFields.theater,
                date: showFields.date,
                time: showFields.time,
                price: Number(showFields.price)
            };
            const res = await API.post("/admin/add-movie-show", payload);
            setMsg(res.data.msg);
            resetMovieForm();
            fetchMovies();
            fetchShows();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to add movie & show");
        } finally {
            setSubmitting(false);
        }
    };

    // =============================================
    //  ADD THEATRE
    // =============================================
    const handleAddTheatre = async (e) => {
        e.preventDefault();
        clearMessages();
        try {
            const res = await API.post("/admin/theatres", {
                ...theatreForm,
                totalSeats: Number(theatreForm.totalSeats)
            });
            setMsg(res.data.msg);
            setTheatreForm({ name: "", location: "", totalSeats: "" });
            fetchTheatres();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to add theatre");
        }
    };

    // =============================================
    //  DELETE HANDLERS
    // =============================================
    const handleDeleteMovie = async (id) => {
        if (!window.confirm("Delete this movie?")) return;
        clearMessages();
        try {
            const res = await API.delete(`/admin/movies/${id}`);
            setMsg(res.data.msg);
            fetchMovies();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to delete movie");
        }
    };

    const handleDeleteTheatre = async (id) => {
        if (!window.confirm("Delete this theatre?")) return;
        clearMessages();
        try {
            const res = await API.delete(`/admin/theatres/${id}`);
            setMsg(res.data.msg);
            fetchTheatres();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to delete theatre");
        }
    };

    const handleDeleteShow = async (id) => {
        if (!window.confirm("Delete this show?")) return;
        clearMessages();
        try {
            const res = await API.delete(`/admin/shows/${id}`);
            setMsg(res.data.msg);
            fetchShows();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to delete show");
        }
    };

    // =============================================
    //  RENDER
    // =============================================
    return (
        <div className="admin-container">
            <h1 className="admin-title">Admin Dashboard</h1>

            {msg && <p className="admin-msg success">{msg}</p>}
            {error && <p className="admin-msg error">{error}</p>}

            {/* Tab Navigation */}
            <div className="admin-tabs">
                <button className={activeTab === "movies" ? "tab active" : "tab"} onClick={() => { setActiveTab("movies"); clearMessages(); }}>Add Movie</button>
                <button className={activeTab === "theatres" ? "tab active" : "tab"} onClick={() => { setActiveTab("theatres"); clearMessages(); }}>Theatres</button>
                <button className={activeTab === "shows" ? "tab active" : "tab"} onClick={() => { setActiveTab("shows"); clearMessages(); }}>All Shows</button>
            </div>

            {/* ===================== ADD MOVIE TAB ===================== */}
            {activeTab === "movies" && (
                <div className="admin-section">

                    {/* ---- Step 1: TMDB Search ---- */}
                    <h2>Step 1 — Search Movie (TMDB)</h2>
                    <div className="admin-form tmdb-search-box">
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 3 }}>
                                <label>Movie Name</label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="e.g. Inception, Avengers, RRR..."
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleTmdbSearch(); } }}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                                <button type="button" className="fetch-btn" onClick={handleTmdbSearch} disabled={searching}>
                                    {searching ? "Searching..." : "Fetch Details"}
                                </button>
                            </div>
                        </div>
                        <p className="hint-text">Search TMDB to auto-fill movie details, or skip and fill manually below.</p>

                        {/* TMDB Search Results */}
                        {tmdbResults.length > 0 && (
                            <div className="tmdb-results">
                                <p className="tmdb-results-label">Select a movie:</p>
                                {tmdbResults.map((m) => (
                                    <div key={m.tmdbId} className="tmdb-result-card" onClick={() => handleSelectTmdb(m)}>
                                        <img src={m.posterUrl} alt={m.title} className="tmdb-thumb" />
                                        <div className="tmdb-result-info">
                                            <strong>{m.title}</strong>
                                            <span>{(m.genre || []).join(", ")} &middot; {m.releaseDate?.split("T")[0]}</span>
                                            <span>⭐ {m.rating}/10 &middot; {m.duration} min</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ---- Step 2: Movie Details Form ---- */}
                    <h2>Step 2 — Movie Details</h2>
                    <form className="admin-form" onSubmit={handleAddMovieShow}>

                        {/* Poster Preview */}
                        {movieForm.posterUrl && (
                            <div className="poster-preview">
                                <img src={movieForm.posterUrl} alt="Poster Preview" />
                            </div>
                        )}

                        <div className="form-row">
                            <div className="form-group">
                                <label>Title *</label>
                                <input type="text" value={movieForm.title} onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Language</label>
                                <input type="text" value={movieForm.language} onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })} placeholder="e.g. EN" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Genre</label>
                                <input type="text" value={movieForm.genre} onChange={(e) => setMovieForm({ ...movieForm, genre: e.target.value })} placeholder="e.g. Action, Thriller" />
                            </div>
                            <div className="form-group">
                                <label>Duration (min)</label>
                                <input type="number" value={movieForm.duration} onChange={(e) => setMovieForm({ ...movieForm, duration: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Release Date</label>
                                <input type="date" value={movieForm.releaseDate} onChange={(e) => setMovieForm({ ...movieForm, releaseDate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Rating</label>
                                <input type="number" step="0.1" min="0" max="10" value={movieForm.rating} onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group full-width">
                            <label>Description</label>
                            <textarea value={movieForm.description} onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })} rows="3" />
                        </div>
                        <div className="form-group full-width">
                            <label>Poster URL *</label>
                            <input type="text" value={movieForm.posterUrl} onChange={(e) => setMovieForm({ ...movieForm, posterUrl: e.target.value })} required />
                        </div>
                        <div className="form-group full-width">
                            <label>Trailer URL</label>
                            <input type="text" value={movieForm.trailerUrl} onChange={(e) => setMovieForm({ ...movieForm, trailerUrl: e.target.value })} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Cast</label>
                                <input type="text" value={movieForm.cast} onChange={(e) => setMovieForm({ ...movieForm, cast: e.target.value })} placeholder="e.g. Actor 1, Actor 2" />
                            </div>
                            <div className="form-group">
                                <label>Director</label>
                                <input type="text" value={movieForm.director} onChange={(e) => setMovieForm({ ...movieForm, director: e.target.value })} />
                            </div>
                        </div>

                        {/* ---- Step 3: Show Details ---- */}
                        <div className="show-details-divider">
                            <h3>Step 3 — Show Details</h3>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Theatre *</label>
                                <select value={showFields.theater} onChange={(e) => setShowFields({ ...showFields, theater: e.target.value })} required>
                                    <option value="">Select Theatre</option>
                                    {theatres.map((t) => (
                                        <option key={t._id} value={t._id}>{t.name} — {t.location}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Price (₹) *</label>
                                <input type="number" value={showFields.price} onChange={(e) => setShowFields({ ...showFields, price: e.target.value })} required />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Show Date *</label>
                                <input type="date" value={showFields.date} onChange={(e) => setShowFields({ ...showFields, date: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Show Time *</label>
                                <input type="time" value={showFields.time} onChange={(e) => setShowFields({ ...showFields, time: e.target.value })} required />
                            </div>
                        </div>

                        <button type="submit" className="admin-btn" disabled={submitting}>
                            {submitting ? "Adding..." : "Add Movie & Show"}
                        </button>
                    </form>

                    {/* ---- All Movies List ---- */}
                    <h2>All Movies ({movies.length})</h2>
                    <div className="admin-list">
                        {movies.map((m) => (
                            <div key={m._id} className="admin-list-item">
                                <div className="item-info">
                                    <strong>{m.title}</strong>
                                    <span>{(m.genre || []).join(", ")} &middot; {m.language}</span>
                                </div>
                                <button className="delete-btn" onClick={() => handleDeleteMovie(m._id)}>Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===================== THEATRES TAB ===================== */}
            {activeTab === "theatres" && (
                <div className="admin-section">
                    <h2>Add Theatre</h2>
                    <form className="admin-form" onSubmit={handleAddTheatre}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Name *</label>
                                <input type="text" value={theatreForm.name} onChange={(e) => setTheatreForm({ ...theatreForm, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Location *</label>
                                <input type="text" value={theatreForm.location} onChange={(e) => setTheatreForm({ ...theatreForm, location: e.target.value })} required />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Total Seats *</label>
                            <input type="number" value={theatreForm.totalSeats} onChange={(e) => setTheatreForm({ ...theatreForm, totalSeats: e.target.value })} required />
                        </div>
                        <button type="submit" className="admin-btn">Add Theatre</button>
                    </form>

                    <h2>All Theatres ({theatres.length})</h2>
                    <div className="admin-list">
                        {theatres.map((t) => (
                            <div key={t._id} className="admin-list-item">
                                <div className="item-info">
                                    <strong>{t.name}</strong>
                                    <span>{t.location} &middot; {t.totalSeats} seats</span>
                                </div>
                                <button className="delete-btn" onClick={() => handleDeleteTheatre(t._id)}>Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===================== SHOWS TAB ===================== */}
            {activeTab === "shows" && (
                <div className="admin-section">
                    <h2>All Shows ({shows.length})</h2>
                    <div className="admin-list">
                        {shows.map((s) => (
                            <div key={s._id} className="admin-list-item">
                                <div className="item-info">
                                    <strong>{s.movie?.title || "Unknown Movie"}</strong>
                                    <span>
                                        {s.theater?.name || "Unknown Theatre"} &middot;{" "}
                                        {new Date(s.date).toLocaleDateString()} &middot; {s.time} &middot; ₹{s.price}
                                    </span>
                                </div>
                                <button className="delete-btn" onClick={() => handleDeleteShow(s._id)}>Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
