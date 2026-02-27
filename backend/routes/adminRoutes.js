const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { searchMovies, fetchMovieDetails } = require("../services/tmdbService");

const Movie = require("../models/Movie");
const Theater = require("../models/Theater");
const Showtime = require("../models/Showtime");

// All admin routes require: 1) valid JWT  2) role === "admin"
router.use(authMiddleware);
router.use(adminMiddleware);

// =============================================
//  TMDB SEARCH — for "Fetch Details" button
// =============================================

// Search TMDB and return top results with full details
router.get("/tmdb-search", async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || !query.trim()) {
            return res.status(400).json({ msg: "Search query is required" });
        }

        // Get basic search results from TMDB (already filtered for poster)
        const results = await searchMovies(query.trim());

        // Take only top 5 results to keep it fast
        const top5 = results.slice(0, 5);

        // Fetch detailed info (runtime, cast, director, trailer) for each
        const detailed = await Promise.all(
            top5.map(async (movie) => {
                try {
                    const details = await fetchMovieDetails(movie.tmdbId);
                    return {
                        ...movie,
                        duration: details.duration || 120,
                        cast: details.cast || [],
                        director: details.director || "",
                        trailerUrl: details.trailerUrl || "",
                        genre: details.genre.length > 0 ? details.genre : movie.genre
                    };
                } catch (err) {
                    // If detail fetch fails, return basic info
                    return { ...movie, duration: 120 };
                }
            })
        );

        res.json(detailed);
    } catch (err) {
        console.error("TMDB search error:", err.message);
        res.status(500).json({ msg: "Failed to search TMDB. Try again." });
    }
});

// =============================================
//  ADD MOVIE + CREATE SHOW (combined endpoint)
// =============================================

router.post("/add-movie-show", async (req, res) => {
    try {
        const {
            // Movie fields
            tmdbId, title, genre, language, duration,
            releaseDate, rating, description, posterUrl,
            trailerUrl, cast, director,
            // Show fields
            theater, date, time, price
        } = req.body;

        // --- Validate required fields ---
        if (!title || !posterUrl) {
            return res.status(400).json({ msg: "Title and Poster URL are required" });
        }
        if (!theater || !date || !time || !price) {
            return res.status(400).json({ msg: "Theatre, Date, Time, and Price are required for the show" });
        }

        // --- Step 1: Check if movie already exists (by tmdbId) ---
        let movie = null;
        if (tmdbId) {
            movie = await Movie.findOne({ tmdbId: String(tmdbId) });
        }

        // --- Step 2: If movie doesn't exist, create it ---
        if (!movie) {
            movie = new Movie({
                tmdbId: tmdbId ? String(tmdbId) : undefined,
                title,
                genre: Array.isArray(genre) ? genre : (genre || "").split(",").map(g => g.trim()).filter(Boolean),
                language: language || "EN",
                duration: Number(duration) || 120,
                releaseDate: releaseDate || new Date().toISOString().split("T")[0],
                rating: Number(rating) || 0,
                description: description || "No description available.",
                posterUrl,
                trailerUrl: trailerUrl || "",
                cast: Array.isArray(cast) ? cast : (cast || "").split(",").map(c => c.trim()).filter(Boolean),
                director: director || "",
                nowShowing: true
            });
            await movie.save();
        }

        // --- Step 3: Validate theatre exists ---
        const theaterDoc = await Theater.findById(theater);
        if (!theaterDoc) {
            return res.status(404).json({ msg: "Theatre not found" });
        }

        // --- Step 4: Create the show (showtime) ---
        const showtime = new Showtime({
            movie: movie._id,
            theater: theaterDoc._id,
            date,
            time,
            price: Number(price),
            availableSeats: theaterDoc.totalSeats
        });
        await showtime.save();

        res.status(201).json({
            msg: "Movie & Show added successfully",
            movie,
            showtime
        });

    } catch (err) {
        console.error("Admin add-movie-show error:", err.message);
        res.status(500).json({ msg: err.message || "Server Error" });
    }
});

// =============================================
//  MOVIES — Admin CRUD
// =============================================

// ADD MOVIE (saves to the same Movie collection everyone reads from)
router.post("/movies", async (req, res) => {
    try {
        const { title, genre, language, duration, releaseDate, rating, description, posterUrl, trailerUrl, cast, director, nowShowing } = req.body;

        const movie = new Movie({
            title,
            genre: Array.isArray(genre) ? genre : (genre || "").split(",").map(g => g.trim()),
            language,
            duration,
            releaseDate,
            rating: rating || 0,
            description,
            posterUrl,
            trailerUrl: trailerUrl || "",
            cast: Array.isArray(cast) ? cast : (cast || "").split(",").map(c => c.trim()),
            director: director || "",
            nowShowing: nowShowing !== undefined ? nowShowing : true
        });

        await movie.save();
        res.status(201).json({ msg: "Movie added successfully", movie });
    } catch (err) {
        console.error("Admin add movie error:", err.message);
        res.status(500).json({ msg: err.message || "Server Error" });
    }
});

// DELETE MOVIE
router.delete("/movies/:id", async (req, res) => {
    try {
        const movie = await Movie.findByIdAndDelete(req.params.id);
        if (!movie) return res.status(404).json({ msg: "Movie not found" });
        res.json({ msg: "Movie deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
});

// =============================================
//  THEATRES — Admin CRUD
// =============================================

// ADD THEATRE
router.post("/theatres", async (req, res) => {
    try {
        const { name, location, totalSeats } = req.body;

        const theater = new Theater({ name, location, totalSeats });
        await theater.save();
        res.status(201).json({ msg: "Theatre added successfully", theater });
    } catch (err) {
        console.error("Admin add theatre error:", err.message);
        res.status(500).json({ msg: err.message || "Server Error" });
    }
});

// GET ALL THEATRES (for populating dropdowns in admin dashboard)
router.get("/theatres", async (req, res) => {
    try {
        const theaters = await Theater.find();
        res.json(theaters);
    } catch (err) {
        res.status(500).json({ msg: "Server Error" });
    }
});

// DELETE THEATRE
router.delete("/theatres/:id", async (req, res) => {
    try {
        const theater = await Theater.findByIdAndDelete(req.params.id);
        if (!theater) return res.status(404).json({ msg: "Theatre not found" });
        res.json({ msg: "Theatre deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
});

// =============================================
//  SHOWS (SHOWTIMES) — Admin CRUD
// =============================================

// ADD SHOW (links Movie _id + Theatre _id)
router.post("/shows", async (req, res) => {
    try {
        const { movie, theater, date, time, price, availableSeats } = req.body;

        // Validate movie and theater exist
        const movieExists = await Movie.findById(movie);
        if (!movieExists) return res.status(404).json({ msg: "Movie not found" });

        const theaterExists = await Theater.findById(theater);
        if (!theaterExists) return res.status(404).json({ msg: "Theatre not found" });

        const showtime = new Showtime({
            movie,
            theater,
            date,
            time,
            price,
            availableSeats: availableSeats || theaterExists.totalSeats
        });

        await showtime.save();
        res.status(201).json({ msg: "Show added successfully", showtime });
    } catch (err) {
        console.error("Admin add show error:", err.message);
        res.status(500).json({ msg: err.message || "Server Error" });
    }
});

// GET ALL SHOWS (for admin dashboard listing)
router.get("/shows", async (req, res) => {
    try {
        const shows = await Showtime.find()
            .populate("movie", "title")
            .populate("theater", "name location")
            .sort({ date: -1 });
        res.json(shows);
    } catch (err) {
        res.status(500).json({ msg: "Server Error" });
    }
});

// DELETE SHOW
router.delete("/shows/:id", async (req, res) => {
    try {
        const show = await Showtime.findByIdAndDelete(req.params.id);
        if (!show) return res.status(404).json({ msg: "Show not found" });
        res.json({ msg: "Show deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
});

module.exports = router;
