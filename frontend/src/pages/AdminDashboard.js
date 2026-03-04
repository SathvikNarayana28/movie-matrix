import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import "./AdminDashboard.css";

function AdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("overview");

    // ---- Overview state ----
    const [overview, setOverview] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);

    // ---- TMDB search state ----
    const [searchQuery, setSearchQuery] = useState("");
    const [tmdbResults, setTmdbResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // ---- Movie form state ----
    const [movieForm, setMovieForm] = useState({
        tmdbId: "", title: "", genre: "", language: "", duration: "",
        releaseDate: "", rating: "", description: "",
        posterUrl: "", trailerUrl: "", cast: "", director: ""
    });

    // ---- Show fields (part of "Add Movie" form) ----
    const [showFields, setShowFields] = useState({
        theater: "", date: "", time: "", price: ""
    });

    // ---- Quick Add Show (for existing movies) ----
    const [quickShow, setQuickShow] = useState({
        movie: "", theater: "", date: "", time: "", price: ""
    });

    // ---- Theatre form state ----
    const [theatreForm, setTheatreForm] = useState({
        name: "", city: "", area: "", screens: "", totalSeatsPerScreen: ""
    });

    // ---- Data lists ----
    const [movies, setMovies] = useState([]);
    const [theatres, setTheatres] = useState([]);
    const [shows, setShows] = useState([]);
    const [users, setUsers] = useState([]);

    // ---- UI state ----
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [editingMovie, setEditingMovie] = useState(null);
    const [showFilter, setShowFilter] = useState("");

    // ---- Analytics state ----
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [revenueData, setRevenueData] = useState(null);
    const [revenueLoading, setRevenueLoading] = useState(false);

    // ---- Fetch functions ----
    const fetchOverview = useCallback(async () => {
        setOverviewLoading(true);
        try {
            const res = await API.get("/admin/overview");
            setOverview(res.data);
        } catch (err) {
            console.error("Failed to fetch overview");
        } finally {
            setOverviewLoading(false);
        }
    }, []);

    const fetchAnalytics = useCallback(async () => {
        setAnalyticsLoading(true);
        try {
            const res = await API.get("/admin/analytics");
            setAnalytics(res.data);
        } catch (err) {
            console.error("Failed to fetch analytics");
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    const fetchRevenueAnalytics = useCallback(async () => {
        setRevenueLoading(true);
        try {
            const res = await API.get("/admin/revenue-analytics");
            setRevenueData(res.data);
        } catch (err) {
            console.error("Failed to fetch revenue analytics");
        } finally {
            setRevenueLoading(false);
        }
    }, []);

    const fetchMovies = async () => {
        try {
            const res = await API.get("/admin/movies");
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

    const fetchUsers = async () => {
        try {
            const res = await API.get("/admin/users");
            setUsers(res.data);
        } catch (err) {
            console.error("Failed to fetch users");
        }
    };

    // Check admin role on mount
    useEffect(() => {
        const role = localStorage.getItem("role");
        if (role !== "admin") {
            navigate("/");
        }
    }, [navigate]);

    // Fetch data on mount
    useEffect(() => {
        fetchOverview();
        fetchMovies();
        fetchTheatres();
        fetchShows();
        fetchUsers();
    }, [fetchOverview]);

    // Fetch analytics when tab changes
    useEffect(() => {
        if (activeTab === "analytics") {
            fetchAnalytics();
            fetchRevenueAnalytics();
        }
    }, [activeTab, fetchAnalytics, fetchRevenueAnalytics]);

    // Auto-refresh analytics
    useEffect(() => {
        if (activeTab !== "analytics") return;
        const interval = setInterval(() => {
            fetchAnalytics();
            fetchRevenueAnalytics();
        }, 15000);
        return () => clearInterval(interval);
    }, [activeTab, fetchAnalytics, fetchRevenueAnalytics]);

    const clearMessages = () => { setMsg(""); setError(""); };

    // =============================================
    //  TMDB SEARCH
    // =============================================
    const handleTmdbSearch = async () => {
        if (!searchQuery.trim()) return;
        clearMessages();
        setSearching(true);
        setTmdbResults([]);
        try {
            const res = await API.get(`/admin/tmdb-search?query=${encodeURIComponent(searchQuery.trim())}`);
            if (res.data.length === 0) {
                setError("No movies found on TMDB. Fill details manually.");
            }
            setTmdbResults(res.data);
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to search TMDB");
        } finally {
            setSearching(false);
        }
    };

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
        setTmdbResults([]);
        setSearchQuery("");
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
        setEditingMovie(null);
    };

    // =============================================
    //  ADD MOVIE + SHOW
    // =============================================
    const handleAddMovieShow = async (e) => {
        e.preventDefault();
        clearMessages();
        setSubmitting(true);
        try {
            if (editingMovie) {
                await API.put(`/admin/movies/${editingMovie}`, {
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
                    director: movieForm.director
                });
                setMsg("Movie updated successfully!");
                resetMovieForm();
                fetchMovies();
            } else {
                const payload = {
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
                fetchOverview();
            }
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to add/update movie");
        } finally {
            setSubmitting(false);
        }
    };

    // =============================================
    //  QUICK ADD SHOW (for existing movies)
    // =============================================
    const handleQuickAddShow = async (e) => {
        e.preventDefault();
        clearMessages();
        setSubmitting(true);
        try {
            const res = await API.post("/admin/shows", {
                movie: quickShow.movie,
                theater: quickShow.theater,
                date: quickShow.date,
                time: quickShow.time,
                price: Number(quickShow.price)
            });
            setMsg(res.data.msg);
            setQuickShow({ movie: "", theater: "", date: "", time: "", price: "" });
            fetchShows();
            fetchOverview();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to add show");
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
                screens: Number(theatreForm.screens),
                totalSeatsPerScreen: Number(theatreForm.totalSeatsPerScreen)
            });
            setMsg(res.data.msg);
            setTheatreForm({ name: "", city: "", area: "", screens: "", totalSeatsPerScreen: "" });
            fetchTheatres();
            fetchOverview();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to add theatre");
        }
    };

    // =============================================
    //  MOVIE ACTIONS
    // =============================================
    const handleDeleteMovie = async (id) => {
        if (!window.confirm("Delete this movie and all its showtimes?")) return;
        clearMessages();
        try {
            const res = await API.delete(`/admin/movies/${id}`);
            setMsg(res.data.msg);
            fetchMovies();
            fetchOverview();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to delete movie");
        }
    };

    const handleToggleMovie = async (id) => {
        clearMessages();
        try {
            const res = await API.patch(`/admin/movies/${id}/toggle`);
            setMsg(res.data.msg);
            fetchMovies();
            fetchOverview();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to toggle movie");
        }
    };

    const handleEditMovie = (movie) => {
        setEditingMovie(movie._id);
        setMovieForm({
            tmdbId: movie.tmdbId || "",
            title: movie.title || "",
            genre: (movie.genre || []).join(", "),
            language: movie.language || "",
            duration: movie.duration || "",
            releaseDate: movie.releaseDate ? new Date(movie.releaseDate).toISOString().split("T")[0] : "",
            rating: movie.rating || "",
            description: movie.description || "",
            posterUrl: movie.posterUrl || "",
            trailerUrl: movie.trailerUrl || "",
            cast: (movie.cast || []).join(", "),
            director: movie.director || ""
        });
        setActiveTab("movies");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // =============================================
    //  THEATRE & SHOW DELETE
    // =============================================
    const handleDeleteTheatre = async (id) => {
        if (!window.confirm("Delete this theatre?")) return;
        clearMessages();
        try {
            const res = await API.delete(`/admin/theatres/${id}`);
            setMsg(res.data.msg);
            fetchTheatres();
            fetchOverview();
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
            fetchOverview();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to delete show");
        }
    };

    // =============================================
    //  USER ACTIONS
    // =============================================
    const handleToggleRole = async (id) => {
        clearMessages();
        try {
            const res = await API.patch(`/admin/users/${id}/role`);
            setMsg(res.data.msg);
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.msg || "Failed to change role");
        }
    };

    // Filtered shows
    const filteredShows = showFilter
        ? shows.filter(s =>
            s.movie?.title?.toLowerCase().includes(showFilter.toLowerCase()) ||
            s.theater?.name?.toLowerCase().includes(showFilter.toLowerCase())
        )
        : shows;

    // =============================================
    //  RENDER
    // =============================================
    return (
        <div className="admin-dashboard">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="sidebar-brand">
                    <span className="brand-icon">🎬</span>
                    <span className="brand-text">Admin Panel</span>
                </div>
                <nav className="sidebar-nav">
                    {[
                        { id: "overview", icon: "📊", label: "Overview" },
                        { id: "movies", icon: "🎥", label: "Movies" },
                        { id: "shows", icon: "🎫", label: "Showtimes" },
                        { id: "theatres", icon: "🏛️", label: "Theatres" },
                        { id: "users", icon: "👥", label: "Users" },
                        { id: "analytics", icon: "📈", label: "Analytics" },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`sidebar-btn ${activeTab === tab.id ? "active" : ""}`}
                            onClick={() => { setActiveTab(tab.id); clearMessages(); }}
                        >
                            <span className="sidebar-icon">{tab.icon}</span>
                            <span className="sidebar-label">{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                <header className="admin-header">
                    <h1 className="admin-title">
                        {activeTab === "overview" && "Dashboard Overview"}
                        {activeTab === "movies" && (editingMovie ? "Edit Movie" : "Manage Movies")}
                        {activeTab === "shows" && "Manage Showtimes"}
                        {activeTab === "theatres" && "Manage Theatres"}
                        {activeTab === "users" && "User Management"}
                        {activeTab === "analytics" && "Revenue Analytics"}
                    </h1>
                </header>

                {msg && <div className="admin-toast success" onClick={() => setMsg("")}>{msg}</div>}
                {error && <div className="admin-toast error" onClick={() => setError("")}>{error}</div>}

                {/* ===================== OVERVIEW TAB ===================== */}
                {activeTab === "overview" && (
                    <div className="admin-content">
                        {overviewLoading ? (
                            <p className="loading-text">Loading dashboard...</p>
                        ) : overview ? (
                            <>
                                {/* Stats Grid */}
                                <div className="stats-grid">
                                    <div className="stat-card stat-movies">
                                        <div className="stat-icon">🎥</div>
                                        <div className="stat-info">
                                            <span className="stat-value">{overview.nowShowingMovies}</span>
                                            <span className="stat-label">Now Showing</span>
                                        </div>
                                        <span className="stat-sub">{overview.totalMovies} total</span>
                                    </div>
                                    <div className="stat-card stat-theatres">
                                        <div className="stat-icon">🏛️</div>
                                        <div className="stat-info">
                                            <span className="stat-value">{overview.totalTheatres}</span>
                                            <span className="stat-label">Theatres</span>
                                        </div>
                                    </div>
                                    <div className="stat-card stat-shows">
                                        <div className="stat-icon">🎫</div>
                                        <div className="stat-info">
                                            <span className="stat-value">{overview.totalShows.toLocaleString()}</span>
                                            <span className="stat-label">Total Shows</span>
                                        </div>
                                    </div>
                                    <div className="stat-card stat-users">
                                        <div className="stat-icon">👥</div>
                                        <div className="stat-info">
                                            <span className="stat-value">{overview.totalUsers}</span>
                                            <span className="stat-label">Users</span>
                                        </div>
                                    </div>
                                    <div className="stat-card stat-bookings">
                                        <div className="stat-icon">📋</div>
                                        <div className="stat-info">
                                            <span className="stat-value">{overview.totalBookings}</span>
                                            <span className="stat-label">Total Bookings</span>
                                        </div>
                                        <span className="stat-sub">{overview.todayBookings} today</span>
                                    </div>
                                    <div className="stat-card stat-revenue">
                                        <div className="stat-icon">💰</div>
                                        <div className="stat-info">
                                            <span className="stat-value">₹{overview.totalRevenue.toLocaleString("en-IN")}</span>
                                            <span className="stat-label">Total Revenue</span>
                                        </div>
                                        <span className="stat-sub">₹{overview.todayRevenue.toLocaleString("en-IN")} today</span>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="quick-actions">
                                    <h2>Quick Actions</h2>
                                    <div className="action-buttons">
                                        <button className="action-btn" onClick={() => setActiveTab("movies")}>
                                            <span>➕</span> Add Movie
                                        </button>
                                        <button className="action-btn" onClick={() => setActiveTab("shows")}>
                                            <span>🎫</span> Add Showtime
                                        </button>
                                        <button className="action-btn" onClick={() => setActiveTab("theatres")}>
                                            <span>🏛️</span> Add Theatre
                                        </button>
                                        <button className="action-btn" onClick={() => setActiveTab("analytics")}>
                                            <span>📈</span> View Analytics
                                        </button>
                                    </div>
                                </div>

                                {/* Recent Bookings */}
                                <div className="recent-section">
                                    <h2>Recent Bookings</h2>
                                    {overview.recentBookings.length > 0 ? (
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>User</th>
                                                    <th>Movie</th>
                                                    <th>Theatre</th>
                                                    <th>Seats</th>
                                                    <th>Amount</th>
                                                    <th>Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {overview.recentBookings.map(b => (
                                                    <tr key={b._id}>
                                                        <td>
                                                            <div className="user-cell">
                                                                <strong>{b.user}</strong>
                                                                <small>{b.email}</small>
                                                            </div>
                                                        </td>
                                                        <td>{b.movie}</td>
                                                        <td>{b.theatre}</td>
                                                        <td>{b.seats}</td>
                                                        <td className="amount">₹{b.total}</td>
                                                        <td>{new Date(b.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="empty-text">No bookings yet.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="empty-text">Unable to load overview.</p>
                        )}
                    </div>
                )}

                {/* ===================== MOVIES TAB ===================== */}
                {activeTab === "movies" && (
                    <div className="admin-content">
                        {/* TMDB Search */}
                        {!editingMovie && (
                            <div className="card">
                                <h2 className="card-title">🔍 Search TMDB</h2>
                                <div className="search-row">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search for a movie on TMDB..."
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleTmdbSearch(); } }}
                                        className="search-input"
                                    />
                                    <button type="button" className="btn-primary" onClick={handleTmdbSearch} disabled={searching}>
                                        {searching ? "Searching..." : "Fetch"}
                                    </button>
                                </div>
                                {tmdbResults.length > 0 && (
                                    <div className="tmdb-results">
                                        {tmdbResults.map((m) => (
                                            <div key={m.tmdbId} className="tmdb-result-card" onClick={() => handleSelectTmdb(m)}>
                                                <img src={m.posterUrl} alt={m.title} className="tmdb-thumb" />
                                                <div className="tmdb-result-info">
                                                    <strong>{m.title}</strong>
                                                    <span>{(m.genre || []).join(", ")} | {m.releaseDate?.split("T")[0]}</span>
                                                    <span>⭐ {m.rating}/10 | {m.duration} min</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Movie Form */}
                        <div className="card">
                            <h2 className="card-title">
                                {editingMovie ? "✏️ Edit Movie" : "🎬 Movie Details"}
                                {editingMovie && (
                                    <button className="btn-secondary btn-sm" onClick={resetMovieForm}>Cancel Edit</button>
                                )}
                            </h2>
                            <form onSubmit={handleAddMovieShow}>
                                {movieForm.posterUrl && (
                                    <div className="poster-preview">
                                        <img src={movieForm.posterUrl} alt="Poster" />
                                    </div>
                                )}

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Title *</label>
                                        <input type="text" value={movieForm.title} onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Language</label>
                                        <input type="text" value={movieForm.language} onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })} placeholder="Telugu, Hindi, English..." />
                                    </div>
                                    <div className="form-group">
                                        <label>Genre</label>
                                        <input type="text" value={movieForm.genre} onChange={(e) => setMovieForm({ ...movieForm, genre: e.target.value })} placeholder="Action, Drama..." />
                                    </div>
                                    <div className="form-group">
                                        <label>Duration (min)</label>
                                        <input type="number" value={movieForm.duration} onChange={(e) => setMovieForm({ ...movieForm, duration: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Release Date</label>
                                        <input type="date" value={movieForm.releaseDate} onChange={(e) => setMovieForm({ ...movieForm, releaseDate: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Rating (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={movieForm.rating} onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea value={movieForm.description} onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })} rows="3" />
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Poster URL *</label>
                                        <input type="text" value={movieForm.posterUrl} onChange={(e) => setMovieForm({ ...movieForm, posterUrl: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Trailer URL</label>
                                        <input type="text" value={movieForm.trailerUrl} onChange={(e) => setMovieForm({ ...movieForm, trailerUrl: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Cast</label>
                                        <input type="text" value={movieForm.cast} onChange={(e) => setMovieForm({ ...movieForm, cast: e.target.value })} placeholder="Actor 1, Actor 2..." />
                                    </div>
                                    <div className="form-group">
                                        <label>Director</label>
                                        <input type="text" value={movieForm.director} onChange={(e) => setMovieForm({ ...movieForm, director: e.target.value })} />
                                    </div>
                                </div>

                                {/* Show details (only for new movies) */}
                                {!editingMovie && (
                                    <div className="show-section">
                                        <h3>🎫 First Show Details</h3>
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>Theatre *</label>
                                                <select value={showFields.theater} onChange={(e) => setShowFields({ ...showFields, theater: e.target.value })} required>
                                                    <option value="">Select Theatre</option>
                                                    {theatres.map((t) => (
                                                        <option key={t._id} value={t._id}>{t.name} — {t.area}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Price (₹) *</label>
                                                <input type="number" value={showFields.price} onChange={(e) => setShowFields({ ...showFields, price: e.target.value })} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Date *</label>
                                                <input type="date" value={showFields.date} onChange={(e) => setShowFields({ ...showFields, date: e.target.value })} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Time *</label>
                                                <input type="time" value={showFields.time} onChange={(e) => setShowFields({ ...showFields, time: e.target.value })} required />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="btn-primary btn-full" disabled={submitting}>
                                    {submitting ? "Processing..." : editingMovie ? "Update Movie" : "Add Movie & Show"}
                                </button>
                            </form>
                        </div>

                        {/* All Movies List */}
                        <div className="card">
                            <h2 className="card-title">📋 All Movies ({movies.length})</h2>
                            <div className="movie-list">
                                {movies.map((m) => (
                                    <div key={m._id} className={`movie-list-item ${!m.nowShowing ? "hidden-movie" : ""}`}>
                                        <div className="movie-list-poster">
                                            <img src={m.posterUrl} alt={m.title} />
                                        </div>
                                        <div className="movie-list-info">
                                            <strong>{m.title}</strong>
                                            <span>{(m.genre || []).join(", ")} | {m.language} | {m.duration}min</span>
                                            <span className={`status-badge ${m.nowShowing ? "showing" : "hidden"}`}>
                                                {m.nowShowing ? "Now Showing" : "Hidden"}
                                            </span>
                                        </div>
                                        <div className="movie-list-actions">
                                            <button className="btn-icon btn-edit" onClick={() => handleEditMovie(m)} title="Edit">✏️</button>
                                            <button className="btn-icon btn-toggle" onClick={() => handleToggleMovie(m._id)} title={m.nowShowing ? "Hide" : "Show"}>
                                                {m.nowShowing ? "👁️" : "🚫"}
                                            </button>
                                            <button className="btn-icon btn-delete" onClick={() => handleDeleteMovie(m._id)} title="Delete">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== SHOWS TAB ===================== */}
                {activeTab === "shows" && (
                    <div className="admin-content">
                        {/* Quick Add Show */}
                        <div className="card">
                            <h2 className="card-title">➕ Add Show for Existing Movie</h2>
                            <form onSubmit={handleQuickAddShow}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Movie *</label>
                                        <select value={quickShow.movie} onChange={(e) => setQuickShow({ ...quickShow, movie: e.target.value })} required>
                                            <option value="">Select Movie</option>
                                            {movies.filter(m => m.nowShowing).map((m) => (
                                                <option key={m._id} value={m._id}>{m.title} ({m.language})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Theatre *</label>
                                        <select value={quickShow.theater} onChange={(e) => setQuickShow({ ...quickShow, theater: e.target.value })} required>
                                            <option value="">Select Theatre</option>
                                            {theatres.map((t) => (
                                                <option key={t._id} value={t._id}>{t.name} — {t.area}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Date *</label>
                                        <input type="date" value={quickShow.date} onChange={(e) => setQuickShow({ ...quickShow, date: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Time *</label>
                                        <input type="time" value={quickShow.time} onChange={(e) => setQuickShow({ ...quickShow, time: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Price (₹) *</label>
                                        <input type="number" value={quickShow.price} onChange={(e) => setQuickShow({ ...quickShow, price: e.target.value })} required />
                                    </div>
                                </div>
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? "Adding..." : "Add Show"}
                                </button>
                            </form>
                        </div>

                        {/* Shows List */}
                        <div className="card">
                            <h2 className="card-title">📋 All Shows ({shows.length})</h2>
                            <div className="search-row" style={{ marginBottom: 16 }}>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Filter by movie or theatre..."
                                    value={showFilter}
                                    onChange={(e) => setShowFilter(e.target.value)}
                                />
                            </div>
                            <div className="shows-list">
                                {filteredShows.slice(0, 50).map((s) => (
                                    <div key={s._id} className="show-list-item">
                                        <div className="show-info">
                                            <strong>{s.movie?.title || "Unknown"}</strong>
                                            <span>{s.theater?.name || "Unknown"} ({s.theater?.area || ""})</span>
                                            <span>{s.date} • {s.time} • ₹{s.price}</span>
                                        </div>
                                        <button className="btn-icon btn-delete" onClick={() => handleDeleteShow(s._id)} title="Delete">🗑️</button>
                                    </div>
                                ))}
                                {filteredShows.length > 50 && (
                                    <p className="empty-text">Showing 50 of {filteredShows.length} shows. Use filter to narrow down.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== THEATRES TAB ===================== */}
                {activeTab === "theatres" && (
                    <div className="admin-content">
                        <div className="card">
                            <h2 className="card-title">➕ Add Theatre</h2>
                            <form onSubmit={handleAddTheatre}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Name *</label>
                                        <input type="text" value={theatreForm.name} onChange={(e) => setTheatreForm({ ...theatreForm, name: e.target.value })} placeholder="e.g. AMB Cinemas" required />
                                    </div>
                                    <div className="form-group">
                                        <label>City *</label>
                                        <input type="text" value={theatreForm.city} onChange={(e) => setTheatreForm({ ...theatreForm, city: e.target.value })} placeholder="e.g. Hyderabad" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Area *</label>
                                        <input type="text" value={theatreForm.area} onChange={(e) => setTheatreForm({ ...theatreForm, area: e.target.value })} placeholder="e.g. Gachibowli" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Screens *</label>
                                        <input type="number" value={theatreForm.screens} onChange={(e) => setTheatreForm({ ...theatreForm, screens: e.target.value })} placeholder="4" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Seats Per Screen *</label>
                                        <input type="number" value={theatreForm.totalSeatsPerScreen} onChange={(e) => setTheatreForm({ ...theatreForm, totalSeatsPerScreen: e.target.value })} placeholder="100" required />
                                    </div>
                                </div>
                                <button type="submit" className="btn-primary">Add Theatre</button>
                            </form>
                        </div>

                        <div className="card">
                            <h2 className="card-title">📋 All Theatres ({theatres.length})</h2>
                            <div className="theatre-grid">
                                {theatres.map((t) => (
                                    <div key={t._id} className="theatre-card">
                                        <div className="theatre-card-header">
                                            <h3>{t.name}</h3>
                                            <button className="btn-icon btn-delete" onClick={() => handleDeleteTheatre(t._id)}>🗑️</button>
                                        </div>
                                        <div className="theatre-card-body">
                                            <span>📍 {t.area}, {t.city}</span>
                                            <span>🖥️ {t.screens} screens</span>
                                            <span>💺 {t.totalSeatsPerScreen} seats/screen</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== USERS TAB ===================== */}
                {activeTab === "users" && (
                    <div className="admin-content">
                        <div className="card">
                            <h2 className="card-title">👥 All Users ({users.length})</h2>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Bookings</th>
                                        <th>Spent</th>
                                        <th>Joined</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u._id}>
                                            <td><strong>{u.name}</strong></td>
                                            <td>{u.email}</td>
                                            <td>
                                                <span className={`role-badge ${u.role}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td>{u.bookings}</td>
                                            <td className="amount">₹{u.spent.toLocaleString("en-IN")}</td>
                                            <td>{new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                                            <td>
                                                <button
                                                    className={`btn-sm ${u.role === "admin" ? "btn-warning" : "btn-success"}`}
                                                    onClick={() => handleToggleRole(u._id)}
                                                >
                                                    {u.role === "admin" ? "Revoke Admin" : "Make Admin"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ===================== ANALYTICS TAB ===================== */}
                {activeTab === "analytics" && (
                    <div className="admin-content">
                        <div className="analytics-header-bar">
                            <span className="auto-refresh-label">
                                {analyticsLoading || revenueLoading ? "Refreshing..." : "Auto-refreshing every 15s"}
                            </span>
                            <button className="btn-secondary" onClick={() => { fetchAnalytics(); fetchRevenueAnalytics(); }} disabled={analyticsLoading || revenueLoading}>
                                ↻ Refresh Now
                            </button>
                        </div>

                        {/* Summary Cards */}
                        {analytics && (
                            <div className="analytics-summary">
                                <div className="analytics-card">
                                    <h3>Total Bookings</h3>
                                    <p className="analytics-value">{analytics.totalBookings}</p>
                                </div>
                                <div className="analytics-card">
                                    <h3>Total Revenue</h3>
                                    <p className="analytics-value">₹{analytics.totalRevenue.toLocaleString("en-IN")}</p>
                                </div>
                                <div className="analytics-card">
                                    <h3>Top Movie</h3>
                                    <p className="analytics-value">{analytics.mostPopularMovie?.name || "N/A"}</p>
                                    <p className="analytics-sub">{analytics.mostPopularMovie?.count || 0} bookings</p>
                                </div>
                                <div className="analytics-card">
                                    <h3>Top Theatre</h3>
                                    <p className="analytics-value">{analytics.mostBookedTheatre?.name || "N/A"}</p>
                                    <p className="analytics-sub">{analytics.mostBookedTheatre?.count || 0} bookings</p>
                                </div>
                            </div>
                        )}

                        {/* Charts */}
                        {revenueData && (
                            <div className="charts-grid">
                                <div className="chart-card">
                                    <h3 className="chart-title">Daily Revenue (Last 7 Days)</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={revenueData.dailyRevenue}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis dataKey="date" stroke="#aaa" tick={{ fontSize: 12 }} />
                                            <YAxis stroke="#aaa" tick={{ fontSize: 12 }} />
                                            <Tooltip contentStyle={{ background: "#1a1b2e", border: "1px solid #333", borderRadius: 8 }} labelStyle={{ color: "#f5c518" }} itemStyle={{ color: "#fff" }} formatter={(value) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]} />
                                            <Legend />
                                            <Line type="monotone" dataKey="revenue" stroke="#e94560" strokeWidth={2} dot={{ fill: "#e94560", r: 4 }} name="Revenue (₹)" />
                                            <Line type="monotone" dataKey="count" stroke="#f5c518" strokeWidth={2} dot={{ fill: "#f5c518", r: 4 }} name="Bookings" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="chart-card">
                                    <h3 className="chart-title">Weekly Revenue (Last 4 Weeks)</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={revenueData.weeklyRevenue}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis dataKey="week" stroke="#aaa" tick={{ fontSize: 11 }} />
                                            <YAxis stroke="#aaa" tick={{ fontSize: 12 }} />
                                            <Tooltip contentStyle={{ background: "#1a1b2e", border: "1px solid #333", borderRadius: 8 }} labelStyle={{ color: "#f5c518" }} itemStyle={{ color: "#fff" }} formatter={(value) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]} />
                                            <Legend />
                                            <Bar dataKey="revenue" fill="#e94560" radius={[6, 6, 0, 0]} name="Revenue (₹)" />
                                            <Bar dataKey="count" fill="#f5c518" radius={[6, 6, 0, 0]} name="Bookings" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="chart-card">
                                    <h3 className="chart-title">Movie-wise Revenue (Top 5)</h3>
                                    {revenueData.movieRevenue.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie data={revenueData.movieRevenue} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name.length > 12 ? name.slice(0, 12) + "…" : name} (${(percent * 100).toFixed(0)}%)`}>
                                                    {revenueData.movieRevenue.map((entry, idx) => (
                                                        <Cell key={idx} fill={["#e94560", "#f5c518", "#00c49f", "#8884d8", "#ff8042"][idx % 5]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: "#1a1b2e", border: "1px solid #333", borderRadius: 8 }} itemStyle={{ color: "#fff" }} formatter={(value) => `₹${value.toLocaleString("en-IN")}`} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <p className="empty-text">No data</p>
                                    )}
                                </div>

                                <div className="chart-card">
                                    <h3 className="chart-title">Theatre-wise Revenue (Top 5)</h3>
                                    {revenueData.theatreRevenue.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={revenueData.theatreRevenue} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                <XAxis type="number" stroke="#aaa" tick={{ fontSize: 12 }} />
                                                <YAxis dataKey="name" type="category" stroke="#aaa" tick={{ fontSize: 11 }} width={120} />
                                                <Tooltip contentStyle={{ background: "#1a1b2e", border: "1px solid #333", borderRadius: 8 }} labelStyle={{ color: "#f5c518" }} itemStyle={{ color: "#fff" }} formatter={(value) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]} />
                                                <Legend />
                                                <Bar dataKey="revenue" fill="#00c49f" radius={[0, 6, 6, 0]} name="Revenue (₹)" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <p className="empty-text">No data</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default AdminDashboard;
