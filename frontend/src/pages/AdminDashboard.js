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

    // ---- Quick Add Show ----
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
        try { const res = await API.get("/admin/movies"); setMovies(res.data); }
        catch (err) { console.error("Failed to fetch movies"); }
    };

    const fetchTheatres = async () => {
        try { const res = await API.get("/admin/theatres"); setTheatres(res.data); }
        catch (err) { console.error("Failed to fetch theatres"); }
    };

    const fetchShows = async () => {
        try { const res = await API.get("/admin/shows"); setShows(res.data); }
        catch (err) { console.error("Failed to fetch shows"); }
    };

    const fetchUsers = async () => {
        try { const res = await API.get("/admin/users"); setUsers(res.data); }
        catch (err) { console.error("Failed to fetch users"); }
    };

    useEffect(() => {
        const role = localStorage.getItem("role");
        if (role !== "admin") navigate("/");
    }, [navigate]);

    useEffect(() => {
        fetchOverview(); fetchMovies(); fetchTheatres(); fetchShows(); fetchUsers();
    }, [fetchOverview]);

    useEffect(() => {
        if (activeTab === "analytics") { fetchAnalytics(); fetchRevenueAnalytics(); }
    }, [activeTab, fetchAnalytics, fetchRevenueAnalytics]);

    useEffect(() => {
        if (activeTab !== "analytics") return;
        const interval = setInterval(() => { fetchAnalytics(); fetchRevenueAnalytics(); }, 15000);
        return () => clearInterval(interval);
    }, [activeTab, fetchAnalytics, fetchRevenueAnalytics]);

    const clearMessages = () => { setMsg(""); setError(""); };

    // ---- TMDB Search ----
    const handleTmdbSearch = async () => {
        if (!searchQuery.trim()) return;
        clearMessages(); setSearching(true); setTmdbResults([]);
        try {
            const res = await API.get(`/admin/tmdb-search?query=${encodeURIComponent(searchQuery.trim())}`);
            if (res.data.length === 0) setError("No movies found on TMDB.");
            setTmdbResults(res.data);
        } catch (err) { setError(err.response?.data?.msg || "TMDB search failed"); }
        finally { setSearching(false); }
    };

    const handleSelectTmdb = (movie) => {
        setMovieForm({
            tmdbId: movie.tmdbId || "", title: movie.title || "",
            genre: (movie.genre || []).join(", "), language: movie.language || "EN",
            duration: movie.duration || "",
            releaseDate: movie.releaseDate ? movie.releaseDate.split("T")[0] : "",
            rating: movie.rating || "", description: movie.description || "",
            posterUrl: movie.posterUrl || "", trailerUrl: movie.trailerUrl || "",
            cast: (movie.cast || []).join(", "), director: movie.director || ""
        });
        setTmdbResults([]); setSearchQuery("");
    };

    const resetMovieForm = () => {
        setMovieForm({ tmdbId: "", title: "", genre: "", language: "", duration: "", releaseDate: "", rating: "", description: "", posterUrl: "", trailerUrl: "", cast: "", director: "" });
        setShowFields({ theater: "", date: "", time: "", price: "" });
        setSearchQuery(""); setTmdbResults([]); setEditingMovie(null);
    };

    // ---- Add Movie + Show ----
    const handleAddMovieShow = async (e) => {
        e.preventDefault(); clearMessages(); setSubmitting(true);
        try {
            if (editingMovie) {
                await API.put(`/admin/movies/${editingMovie}`, {
                    title: movieForm.title, genre: movieForm.genre, language: movieForm.language,
                    duration: Number(movieForm.duration) || 120, releaseDate: movieForm.releaseDate,
                    rating: Number(movieForm.rating) || 0, description: movieForm.description,
                    posterUrl: movieForm.posterUrl, trailerUrl: movieForm.trailerUrl,
                    cast: movieForm.cast, director: movieForm.director
                });
                setMsg("Movie updated successfully!"); resetMovieForm(); fetchMovies();
            } else {
                const payload = {
                    tmdbId: movieForm.tmdbId || undefined, title: movieForm.title,
                    genre: movieForm.genre, language: movieForm.language,
                    duration: Number(movieForm.duration) || 120, releaseDate: movieForm.releaseDate,
                    rating: Number(movieForm.rating) || 0, description: movieForm.description,
                    posterUrl: movieForm.posterUrl, trailerUrl: movieForm.trailerUrl,
                    cast: movieForm.cast, director: movieForm.director,
                    theater: showFields.theater, date: showFields.date,
                    time: showFields.time, price: Number(showFields.price)
                };
                const res = await API.post("/admin/add-movie-show", payload);
                setMsg(res.data.msg); resetMovieForm(); fetchMovies(); fetchShows(); fetchOverview();
            }
        } catch (err) { setError(err.response?.data?.msg || "Failed to add/update movie"); }
        finally { setSubmitting(false); }
    };

    // ---- Quick Add Show ----
    const handleQuickAddShow = async (e) => {
        e.preventDefault(); clearMessages(); setSubmitting(true);
        try {
            const res = await API.post("/admin/shows", {
                movie: quickShow.movie, theater: quickShow.theater,
                date: quickShow.date, time: quickShow.time, price: Number(quickShow.price)
            });
            setMsg(res.data.msg);
            setQuickShow({ movie: "", theater: "", date: "", time: "", price: "" });
            fetchShows(); fetchOverview();
        } catch (err) { setError(err.response?.data?.msg || "Failed to add show"); }
        finally { setSubmitting(false); }
    };

    // ---- Add Theatre ----
    const handleAddTheatre = async (e) => {
        e.preventDefault(); clearMessages();
        try {
            const res = await API.post("/admin/theatres", {
                ...theatreForm, screens: Number(theatreForm.screens),
                totalSeatsPerScreen: Number(theatreForm.totalSeatsPerScreen)
            });
            setMsg(res.data.msg);
            setTheatreForm({ name: "", city: "", area: "", screens: "", totalSeatsPerScreen: "" });
            fetchTheatres(); fetchOverview();
        } catch (err) { setError(err.response?.data?.msg || "Failed to add theatre"); }
    };

    // ---- Movie Actions ----
    const handleDeleteMovie = async (id) => {
        if (!window.confirm("Delete this movie and all its showtimes?")) return;
        clearMessages();
        try { const res = await API.delete(`/admin/movies/${id}`); setMsg(res.data.msg); fetchMovies(); fetchOverview(); }
        catch (err) { setError(err.response?.data?.msg || "Failed to delete movie"); }
    };

    const handleToggleMovie = async (id) => {
        clearMessages();
        try { const res = await API.patch(`/admin/movies/${id}/toggle`); setMsg(res.data.msg); fetchMovies(); fetchOverview(); }
        catch (err) { setError(err.response?.data?.msg || "Failed to toggle movie"); }
    };

    const handleEditMovie = (movie) => {
        setEditingMovie(movie._id);
        setMovieForm({
            tmdbId: movie.tmdbId || "", title: movie.title || "",
            genre: (movie.genre || []).join(", "), language: movie.language || "",
            duration: movie.duration || "",
            releaseDate: movie.releaseDate ? new Date(movie.releaseDate).toISOString().split("T")[0] : "",
            rating: movie.rating || "", description: movie.description || "",
            posterUrl: movie.posterUrl || "", trailerUrl: movie.trailerUrl || "",
            cast: (movie.cast || []).join(", "), director: movie.director || ""
        });
        setActiveTab("movies"); window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ---- Delete Theatre / Show ----
    const handleDeleteTheatre = async (id) => {
        if (!window.confirm("Delete this theatre?")) return; clearMessages();
        try { const res = await API.delete(`/admin/theatres/${id}`); setMsg(res.data.msg); fetchTheatres(); fetchOverview(); }
        catch (err) { setError(err.response?.data?.msg || "Failed to delete theatre"); }
    };

    const handleDeleteShow = async (id) => {
        if (!window.confirm("Delete this show?")) return; clearMessages();
        try { const res = await API.delete(`/admin/shows/${id}`); setMsg(res.data.msg); fetchShows(); fetchOverview(); }
        catch (err) { setError(err.response?.data?.msg || "Failed to delete show"); }
    };

    // ---- User Actions ----
    const handleToggleRole = async (id) => {
        clearMessages();
        try { const res = await API.patch(`/admin/users/${id}/role`); setMsg(res.data.msg); fetchUsers(); }
        catch (err) { setError(err.response?.data?.msg || "Failed to change role"); }
    };

    const filteredShows = showFilter
        ? shows.filter(s => s.movie?.title?.toLowerCase().includes(showFilter.toLowerCase()) || s.theater?.name?.toLowerCase().includes(showFilter.toLowerCase()))
        : shows;

    const TABS = [
        { id: "overview", label: "Overview" },
        { id: "movies", label: "Movies" },
        { id: "shows", label: "Showtimes" },
        { id: "theatres", label: "Theatres" },
        { id: "users", label: "Users" },
        { id: "analytics", label: "Analytics" },
    ];

    return (
        <div className="admin-container">
            {/* Page Heading */}
            <div className="admin-page-header">
                <h2>Admin Dashboard</h2>
                <p className="admin-subtitle">Manage movies, theatres, showtimes and users</p>
            </div>

            {/* Tab Navigation */}
            <div className="admin-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`admin-tab ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => { setActiveTab(tab.id); clearMessages(); }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Feedback Messages */}
            {msg && <div className="admin-msg success" onClick={() => setMsg("")}>{msg}</div>}
            {error && <div className="admin-msg error" onClick={() => setError("")}>{error}</div>}

            {/* ===================== OVERVIEW ===================== */}
            {activeTab === "overview" && (
                <div className="tab-content">
                    {overviewLoading ? (
                        <p className="loading-text">Loading dashboard...</p>
                    ) : overview ? (
                        <>
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-number">{overview.nowShowingMovies}</div>
                                    <div className="stat-label">Now Showing</div>
                                    <div className="stat-secondary">{overview.totalMovies} total movies</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-number">{overview.totalTheatres}</div>
                                    <div className="stat-label">Theatres</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-number">{overview.totalShows.toLocaleString()}</div>
                                    <div className="stat-label">Total Shows</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-number">{overview.totalUsers}</div>
                                    <div className="stat-label">Users</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-number">{overview.totalBookings}</div>
                                    <div className="stat-label">Bookings</div>
                                    <div className="stat-secondary">{overview.todayBookings} today</div>
                                </div>
                                <div className="stat-card accent">
                                    <div className="stat-number">₹{overview.totalRevenue.toLocaleString("en-IN")}</div>
                                    <div className="stat-label">Revenue</div>
                                    <div className="stat-secondary">₹{overview.todayRevenue.toLocaleString("en-IN")} today</div>
                                </div>
                            </div>

                            <div className="quick-actions">
                                <button className="quick-btn" onClick={() => setActiveTab("movies")}>+ Add Movie</button>
                                <button className="quick-btn" onClick={() => setActiveTab("shows")}>+ Add Show</button>
                                <button className="quick-btn" onClick={() => setActiveTab("theatres")}>+ Add Theatre</button>
                                <button className="quick-btn outline" onClick={() => setActiveTab("analytics")}>View Analytics</button>
                            </div>

                            <div className="section-card">
                                <h3>Recent Bookings</h3>
                                {overview.recentBookings.length > 0 ? (
                                    <div className="table-wrap">
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
                                                                <span className="user-name">{b.user}</span>
                                                                <span className="user-email">{b.email}</span>
                                                            </div>
                                                        </td>
                                                        <td>{b.movie}</td>
                                                        <td>{b.theatre}</td>
                                                        <td>{b.seats}</td>
                                                        <td className="text-accent">₹{b.total}</td>
                                                        <td>{new Date(b.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
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

            {/* ===================== MOVIES ===================== */}
            {activeTab === "movies" && (
                <div className="tab-content">
                    {/* TMDB Search */}
                    {!editingMovie && (
                        <div className="section-card">
                            <h3>Search TMDB</h3>
                            <div className="input-row">
                                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search for a movie on TMDB..."
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleTmdbSearch(); } }} />
                                <button className="btn-primary" onClick={handleTmdbSearch} disabled={searching}>
                                    {searching ? "Searching..." : "Fetch"}
                                </button>
                            </div>
                            {tmdbResults.length > 0 && (
                                <div className="tmdb-results">
                                    {tmdbResults.map((m) => (
                                        <div key={m.tmdbId} className="tmdb-card" onClick={() => handleSelectTmdb(m)}>
                                            <img src={m.posterUrl} alt={m.title} className="tmdb-img" />
                                            <div className="tmdb-info">
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
                    <div className="section-card">
                        <div className="section-header">
                            <h3>{editingMovie ? "Edit Movie" : "Movie Details"}</h3>
                            {editingMovie && <button className="btn-outline btn-sm" onClick={resetMovieForm}>Cancel</button>}
                        </div>
                        <form onSubmit={handleAddMovieShow}>
                            {movieForm.posterUrl && (
                                <div className="poster-preview">
                                    <img src={movieForm.posterUrl} alt="Poster" />
                                </div>
                            )}
                            <div className="form-row">
                                <div className="form-group"><label>Title *</label><input type="text" value={movieForm.title} onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })} required /></div>
                                <div className="form-group"><label>Language</label><input type="text" value={movieForm.language} onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })} placeholder="Telugu, Hindi..." /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Genre</label><input type="text" value={movieForm.genre} onChange={(e) => setMovieForm({ ...movieForm, genre: e.target.value })} placeholder="Action, Drama..." /></div>
                                <div className="form-group"><label>Duration (min)</label><input type="number" value={movieForm.duration} onChange={(e) => setMovieForm({ ...movieForm, duration: e.target.value })} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Release Date</label><input type="date" value={movieForm.releaseDate} onChange={(e) => setMovieForm({ ...movieForm, releaseDate: e.target.value })} /></div>
                                <div className="form-group"><label>Rating (0-10)</label><input type="number" step="0.1" min="0" max="10" value={movieForm.rating} onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })} /></div>
                            </div>
                            <div className="form-group"><label>Description</label><textarea value={movieForm.description} onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })} rows="3" /></div>
                            <div className="form-row">
                                <div className="form-group"><label>Poster URL *</label><input type="text" value={movieForm.posterUrl} onChange={(e) => setMovieForm({ ...movieForm, posterUrl: e.target.value })} required /></div>
                                <div className="form-group"><label>Trailer URL</label><input type="text" value={movieForm.trailerUrl} onChange={(e) => setMovieForm({ ...movieForm, trailerUrl: e.target.value })} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Cast</label><input type="text" value={movieForm.cast} onChange={(e) => setMovieForm({ ...movieForm, cast: e.target.value })} placeholder="Actor 1, Actor 2..." /></div>
                                <div className="form-group"><label>Director</label><input type="text" value={movieForm.director} onChange={(e) => setMovieForm({ ...movieForm, director: e.target.value })} /></div>
                            </div>

                            {!editingMovie && (
                                <div className="show-subsection">
                                    <h4>First Show Details</h4>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Theatre *</label>
                                            <select value={showFields.theater} onChange={(e) => setShowFields({ ...showFields, theater: e.target.value })} required>
                                                <option value="">Select Theatre</option>
                                                {theatres.map(t => <option key={t._id} value={t._id}>{t.name} — {t.area}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group"><label>Price (₹) *</label><input type="number" value={showFields.price} onChange={(e) => setShowFields({ ...showFields, price: e.target.value })} required /></div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group"><label>Date *</label><input type="date" value={showFields.date} onChange={(e) => setShowFields({ ...showFields, date: e.target.value })} required /></div>
                                        <div className="form-group"><label>Time *</label><input type="time" value={showFields.time} onChange={(e) => setShowFields({ ...showFields, time: e.target.value })} required /></div>
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="btn-primary btn-full" disabled={submitting}>
                                {submitting ? "Processing..." : editingMovie ? "Update Movie" : "Add Movie & Show"}
                            </button>
                        </form>
                    </div>

                    {/* Movie List */}
                    <div className="section-card">
                        <h3>All Movies ({movies.length})</h3>
                        <div className="movie-list">
                            {movies.map(m => (
                                <div key={m._id} className={`movie-row ${!m.nowShowing ? "movie-hidden" : ""}`}>
                                    <img src={m.posterUrl} alt={m.title} className="movie-row-poster" />
                                    <div className="movie-row-info">
                                        <strong>{m.title}</strong>
                                        <span>{(m.genre || []).join(", ")} | {m.language} | {m.duration}min</span>
                                        <span className={`badge ${m.nowShowing ? "badge-green" : "badge-orange"}`}>
                                            {m.nowShowing ? "Now Showing" : "Hidden"}
                                        </span>
                                    </div>
                                    <div className="row-actions">
                                        <button className="action-icon" onClick={() => handleEditMovie(m)} title="Edit">✏️</button>
                                        <button className="action-icon" onClick={() => handleToggleMovie(m._id)} title={m.nowShowing ? "Hide" : "Show"}>
                                            {m.nowShowing ? "👁️" : "🚫"}
                                        </button>
                                        <button className="action-icon danger" onClick={() => handleDeleteMovie(m._id)} title="Delete">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== SHOWS ===================== */}
            {activeTab === "shows" && (
                <div className="tab-content">
                    <div className="section-card">
                        <h3>Add Show for Existing Movie</h3>
                        <form onSubmit={handleQuickAddShow}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Movie *</label>
                                    <select value={quickShow.movie} onChange={(e) => setQuickShow({ ...quickShow, movie: e.target.value })} required>
                                        <option value="">Select Movie</option>
                                        {movies.filter(m => m.nowShowing).map(m => <option key={m._id} value={m._id}>{m.title} ({m.language})</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Theatre *</label>
                                    <select value={quickShow.theater} onChange={(e) => setQuickShow({ ...quickShow, theater: e.target.value })} required>
                                        <option value="">Select Theatre</option>
                                        {theatres.map(t => <option key={t._id} value={t._id}>{t.name} — {t.area}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Date *</label><input type="date" value={quickShow.date} onChange={(e) => setQuickShow({ ...quickShow, date: e.target.value })} required /></div>
                                <div className="form-group"><label>Time *</label><input type="time" value={quickShow.time} onChange={(e) => setQuickShow({ ...quickShow, time: e.target.value })} required /></div>
                                <div className="form-group"><label>Price (₹) *</label><input type="number" value={quickShow.price} onChange={(e) => setQuickShow({ ...quickShow, price: e.target.value })} required /></div>
                            </div>
                            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Adding..." : "Add Show"}</button>
                        </form>
                    </div>

                    <div className="section-card">
                        <h3>All Shows ({shows.length})</h3>
                        <div className="input-row" style={{ marginBottom: 14 }}>
                            <input type="text" placeholder="Filter by movie or theatre..." value={showFilter} onChange={(e) => setShowFilter(e.target.value)} />
                        </div>
                        <div className="list-stack">
                            {filteredShows.slice(0, 50).map(s => (
                                <div key={s._id} className="list-row">
                                    <div className="list-row-info">
                                        <strong>{s.movie?.title || "Unknown"}</strong>
                                        <span>{s.theater?.name || "Unknown"} ({s.theater?.area || ""})</span>
                                        <span>{s.date} • {s.time} • ₹{s.price}</span>
                                    </div>
                                    <button className="action-icon danger" onClick={() => handleDeleteShow(s._id)} title="Delete">🗑️</button>
                                </div>
                            ))}
                            {filteredShows.length > 50 && <p className="empty-text">Showing 50 of {filteredShows.length}. Use filter to narrow.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== THEATRES ===================== */}
            {activeTab === "theatres" && (
                <div className="tab-content">
                    <div className="section-card">
                        <h3>Add Theatre</h3>
                        <form onSubmit={handleAddTheatre}>
                            <div className="form-row">
                                <div className="form-group"><label>Name *</label><input type="text" value={theatreForm.name} onChange={(e) => setTheatreForm({ ...theatreForm, name: e.target.value })} placeholder="AMB Cinemas" required /></div>
                                <div className="form-group"><label>City *</label><input type="text" value={theatreForm.city} onChange={(e) => setTheatreForm({ ...theatreForm, city: e.target.value })} placeholder="Hyderabad" required /></div>
                                <div className="form-group"><label>Area *</label><input type="text" value={theatreForm.area} onChange={(e) => setTheatreForm({ ...theatreForm, area: e.target.value })} placeholder="Gachibowli" required /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Screens *</label><input type="number" value={theatreForm.screens} onChange={(e) => setTheatreForm({ ...theatreForm, screens: e.target.value })} required /></div>
                                <div className="form-group"><label>Seats Per Screen *</label><input type="number" value={theatreForm.totalSeatsPerScreen} onChange={(e) => setTheatreForm({ ...theatreForm, totalSeatsPerScreen: e.target.value })} required /></div>
                            </div>
                            <button type="submit" className="btn-primary">Add Theatre</button>
                        </form>
                    </div>

                    <div className="section-card">
                        <h3>All Theatres ({theatres.length})</h3>
                        <div className="theatre-grid">
                            {theatres.map(t => (
                                <div key={t._id} className="theatre-card">
                                    <div className="theatre-top">
                                        <h4>{t.name}</h4>
                                        <button className="action-icon danger" onClick={() => handleDeleteTheatre(t._id)}>🗑️</button>
                                    </div>
                                    <p>📍 {t.area}, {t.city}</p>
                                    <p>🖥️ {t.screens} screens &nbsp;|&nbsp; 💺 {t.totalSeatsPerScreen} seats/screen</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== USERS ===================== */}
            {activeTab === "users" && (
                <div className="tab-content">
                    <div className="section-card">
                        <h3>All Users ({users.length})</h3>
                        <div className="table-wrap">
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
                                            <td><span className={`badge ${u.role === "admin" ? "badge-red" : "badge-green"}`}>{u.role}</span></td>
                                            <td>{u.bookings}</td>
                                            <td className="text-accent">₹{u.spent.toLocaleString("en-IN")}</td>
                                            <td>{new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                                            <td>
                                                <button className={`btn-sm ${u.role === "admin" ? "btn-warning" : "btn-success"}`} onClick={() => handleToggleRole(u._id)}>
                                                    {u.role === "admin" ? "Revoke Admin" : "Make Admin"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== ANALYTICS ===================== */}
            {activeTab === "analytics" && (
                <div className="tab-content">
                    <div className="analytics-bar">
                        <span>{analyticsLoading || revenueLoading ? "Refreshing..." : "Auto-refreshing every 15s"}</span>
                        <button className="btn-outline" onClick={() => { fetchAnalytics(); fetchRevenueAnalytics(); }} disabled={analyticsLoading || revenueLoading}>↻ Refresh</button>
                    </div>

                    {analytics && (
                        <div className="stats-grid">
                            <div className="stat-card"><div className="stat-number">{analytics.totalBookings}</div><div className="stat-label">Total Bookings</div></div>
                            <div className="stat-card accent"><div className="stat-number">₹{analytics.totalRevenue.toLocaleString("en-IN")}</div><div className="stat-label">Total Revenue</div></div>
                            <div className="stat-card"><div className="stat-number">{analytics.mostPopularMovie?.name || "N/A"}</div><div className="stat-label">Top Movie</div><div className="stat-secondary">{analytics.mostPopularMovie?.count || 0} bookings</div></div>
                            <div className="stat-card"><div className="stat-number">{analytics.mostBookedTheatre?.name || "N/A"}</div><div className="stat-label">Top Theatre</div><div className="stat-secondary">{analytics.mostBookedTheatre?.count || 0} bookings</div></div>
                        </div>
                    )}

                    {revenueData && (
                        <div className="charts-grid">
                            <div className="chart-card">
                                <h3>Daily Revenue (Last 7 Days)</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={revenueData.dailyRevenue}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis dataKey="date" stroke="#888" tick={{ fontSize: 12 }} />
                                        <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                                        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                                        <Legend />
                                        <Line type="monotone" dataKey="revenue" stroke="#e94560" strokeWidth={2} dot={{ fill: "#e94560", r: 4 }} name="Revenue (₹)" />
                                        <Line type="monotone" dataKey="count" stroke="#1a1a2e" strokeWidth={2} dot={{ fill: "#1a1a2e", r: 4 }} name="Bookings" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card">
                                <h3>Weekly Revenue (Last 4 Weeks)</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={revenueData.weeklyRevenue}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis dataKey="week" stroke="#888" tick={{ fontSize: 11 }} />
                                        <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                                        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6 }} formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                                        <Legend />
                                        <Bar dataKey="revenue" fill="#e94560" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
                                        <Bar dataKey="count" fill="#1a1a2e" radius={[4, 4, 0, 0]} name="Bookings" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card">
                                <h3>Movie-wise Revenue (Top 5)</h3>
                                {revenueData.movieRevenue.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie data={revenueData.movieRevenue} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={({ name, percent }) => `${name.length > 12 ? name.slice(0, 12) + "…" : name} (${(percent * 100).toFixed(0)}%)`}>
                                                {revenueData.movieRevenue.map((e, i) => (
                                                    <Cell key={i} fill={["#e94560", "#1a1a2e", "#4caf50", "#ff9800", "#2196f3"][i % 5]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => `₹${v.toLocaleString("en-IN")}`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <p className="empty-text">No data</p>}
                            </div>

                            <div className="chart-card">
                                <h3>Theatre-wise Revenue (Top 5)</h3>
                                {revenueData.theatreRevenue.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={revenueData.theatreRevenue} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                            <XAxis type="number" stroke="#888" tick={{ fontSize: 12 }} />
                                            <YAxis dataKey="name" type="category" stroke="#888" tick={{ fontSize: 11 }} width={110} />
                                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6 }} formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                                            <Legend />
                                            <Bar dataKey="revenue" fill="#4caf50" radius={[0, 4, 4, 0]} name="Revenue (₹)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <p className="empty-text">No data</p>}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
