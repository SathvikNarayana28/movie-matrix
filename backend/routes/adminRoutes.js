const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { searchMovies, fetchMovieDetails } = require("../services/tmdbService");

const Movie = require("../models/Movie");
const Theater = require("../models/Theater");
const Showtime = require("../models/Showtime");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { generateSeats } = require("../models/Showtime");

// All admin routes require: 1) valid JWT  2) role === "admin"
router.use(authMiddleware);
router.use(adminMiddleware);

// =============================================
//  OVERVIEW — dashboard stats
// =============================================
router.get("/overview", async (req, res) => {
    try {
        const [totalMovies, nowShowingMovies, totalTheatres, totalShows, totalUsers, totalBookings, revenueResult, recentBookings] = await Promise.all([
            Movie.countDocuments(),
            Movie.countDocuments({ nowShowing: true }),
            Theater.countDocuments(),
            Showtime.countDocuments(),
            User.countDocuments(),
            Booking.countDocuments({ status: "confirmed" }),
            Booking.aggregate([
                { $match: { status: "confirmed" } },
                { $group: { _id: null, total: { $sum: "$totalPrice" } } }
            ]),
            Booking.find({ status: "confirmed" })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate({
                    path: "showtime",
                    populate: [
                        { path: "movie", select: "title" },
                        { path: "theater", select: "name area" }
                    ]
                })
                .populate("user", "name email")
        ]);

        // Today's bookings
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayBookings = await Booking.countDocuments({
            status: "confirmed",
            createdAt: { $gte: todayStart }
        });

        // Today's revenue
        const todayRevenueResult = await Booking.aggregate([
            { $match: { status: "confirmed", createdAt: { $gte: todayStart } } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);

        res.json({
            totalMovies,
            nowShowingMovies,
            totalTheatres,
            totalShows,
            totalUsers,
            totalBookings,
            totalRevenue: revenueResult.length > 0 ? revenueResult[0].total : 0,
            todayBookings,
            todayRevenue: todayRevenueResult.length > 0 ? todayRevenueResult[0].total : 0,
            recentBookings: recentBookings.map(b => ({
                _id: b._id,
                user: b.user?.name || "Unknown",
                email: b.user?.email || "",
                movie: b.showtime?.movie?.title || "Unknown",
                theatre: b.showtime?.theater?.name || "Unknown",
                seats: b.seats?.length || 0,
                total: b.totalPrice,
                date: b.createdAt
            }))
        });
    } catch (err) {
        console.error("Overview error:", err);
        res.status(500).json({ msg: "Failed to load overview" });
    }
});

// =============================================
//  USER MANAGEMENT
// =============================================
router.get("/users", async (req, res) => {
    try {
        const users = await User.find()
            .select("name email role createdAt")
            .sort({ createdAt: -1 });
        
        // Get booking count per user
        const userBookings = await Booking.aggregate([
            { $match: { status: "confirmed" } },
            { $group: { _id: "$user", count: { $sum: 1 }, spent: { $sum: "$totalPrice" } } }
        ]);
        const bookingMap = {};
        userBookings.forEach(u => { bookingMap[u._id] = { count: u.count, spent: u.spent }; });

        const usersWithStats = users.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            bookings: bookingMap[u._id]?.count || 0,
            spent: bookingMap[u._id]?.spent || 0
        }));

        res.json(usersWithStats);
    } catch (err) {
        console.error("Users error:", err);
        res.status(500).json({ msg: "Failed to load users" });
    }
});

// TOGGLE USER ROLE
router.patch("/users/:id/role", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });
        
        // Don't allow admin to remove their own admin role
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ msg: "Cannot change your own role" });
        }

        user.role = user.role === "admin" ? "user" : "admin";
        await user.save();
        res.json({ msg: `User role changed to ${user.role}`, user });
    } catch (err) {
        res.status(500).json({ msg: "Failed to update role" });
    }
});

// =============================================
//  TOGGLE MOVIE nowShowing
// =============================================
router.patch("/movies/:id/toggle", async (req, res) => {
    try {
        const movie = await Movie.findById(req.params.id);
        if (!movie) return res.status(404).json({ msg: "Movie not found" });
        movie.nowShowing = !movie.nowShowing;
        await movie.save();
        res.json({ msg: `"${movie.title}" is now ${movie.nowShowing ? "showing" : "hidden"}`, movie });
    } catch (err) {
        res.status(500).json({ msg: "Failed to toggle movie" });
    }
});

// =============================================
//  EDIT MOVIE
// =============================================
router.put("/movies/:id", async (req, res) => {
    try {
        const { title, genre, language, duration, releaseDate, rating, description, posterUrl, trailerUrl, cast, director, nowShowing } = req.body;
        const movie = await Movie.findById(req.params.id);
        if (!movie) return res.status(404).json({ msg: "Movie not found" });

        if (title) movie.title = title;
        if (genre) movie.genre = Array.isArray(genre) ? genre : genre.split(",").map(g => g.trim());
        if (language) movie.language = language;
        if (duration) movie.duration = Number(duration);
        if (releaseDate) movie.releaseDate = releaseDate;
        if (rating !== undefined) movie.rating = Number(rating);
        if (description) movie.description = description;
        if (posterUrl) movie.posterUrl = posterUrl;
        if (trailerUrl !== undefined) movie.trailerUrl = trailerUrl;
        if (cast) movie.cast = Array.isArray(cast) ? cast : cast.split(",").map(c => c.trim());
        if (director) movie.director = director;
        if (nowShowing !== undefined) movie.nowShowing = nowShowing;

        await movie.save();
        res.json({ msg: "Movie updated", movie });
    } catch (err) {
        res.status(500).json({ msg: "Failed to update movie" });
    }
});

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
            // Show fields — supports single show (legacy) or multiple shows
            theater, date, time, price,
            shows // array of { theater, date, time, price }
        } = req.body;

        // --- Validate required fields ---
        if (!title || !posterUrl) {
            return res.status(400).json({ msg: "Title and Poster URL are required" });
        }

        // Build show list: use `shows` array if provided, else fall back to single fields
        const showList = Array.isArray(shows) && shows.length > 0
            ? shows
            : (theater && date && time && price) ? [{ theater, date, time, price }] : [];

        if (showList.length === 0) {
            return res.status(400).json({ msg: "At least one show (Theatre, Date, Time, Price) is required" });
        }

        // Validate every show entry
        for (let i = 0; i < showList.length; i++) {
            const s = showList[i];
            if (!s.theater || !s.date || !s.time || !s.price) {
                return res.status(400).json({ msg: `Show #${i + 1}: Theatre, Date, Time, and Price are all required` });
            }
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

        // --- Step 3: Create all showtimes ---
        const createdShowtimes = [];
        for (const show of showList) {
            const theaterDoc = await Theater.findById(show.theater);
            if (!theaterDoc) {
                return res.status(404).json({ msg: `Theatre not found for show on ${show.date} at ${show.time}` });
            }

            const totalSeats = theaterDoc.totalSeatsPerScreen || 100;
            const seatsPerRow = 10;
            const rows = Math.ceil(totalSeats / seatsPerRow);
            const seats = generateSeats(rows, seatsPerRow);

            const showtime = new Showtime({
                movie: movie._id,
                theater: theaterDoc._id,
                date: show.date,
                time: show.time,
                price: Number(show.price),
                seats
            });
            await showtime.save();
            createdShowtimes.push(showtime);
        }

        res.status(201).json({
            msg: `Movie & ${createdShowtimes.length} show(s) added successfully`,
            movie,
            showtimes: createdShowtimes
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

// GET ALL MOVIES (admin — no nowShowing filter)
router.get("/movies", async (req, res) => {
    try {
        const movies = await Movie.find().sort({ createdAt: -1 });
        res.json(movies);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
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
        const { name, city, area, screens, totalSeatsPerScreen } = req.body;

        const theater = new Theater({ name, city, area, screens, totalSeatsPerScreen });
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

// ADD SHOW(S) (links Movie _id + Theatre _id) — auto-generates seat layout
// Accepts single show OR { shows: [...] } for bulk creation
router.post("/shows", async (req, res) => {
    try {
        const { movie, theater, date, time, price, shows } = req.body;

        // Build show list: array or single
        const showList = Array.isArray(shows) && shows.length > 0
            ? shows
            : [{ movie, theater, date, time, price }];

        // Validate all entries
        for (let i = 0; i < showList.length; i++) {
            const s = showList[i];
            if (!s.movie || !s.theater || !s.date || !s.time || !s.price) {
                return res.status(400).json({ msg: `Show #${i + 1}: Movie, Theatre, Date, Time, and Price are all required` });
            }
        }

        const createdShowtimes = [];
        for (const show of showList) {
            const movieExists = await Movie.findById(show.movie);
            if (!movieExists) return res.status(404).json({ msg: `Movie not found for show #${createdShowtimes.length + 1}` });

            const theaterExists = await Theater.findById(show.theater);
            if (!theaterExists) return res.status(404).json({ msg: `Theatre not found for show #${createdShowtimes.length + 1}` });

            const totalSeats = theaterExists.totalSeatsPerScreen || 100;
            const seatsPerRow = 10;
            const rows = Math.ceil(totalSeats / seatsPerRow);
            const seats = generateSeats(rows, seatsPerRow);

            const showtime = new Showtime({
                movie: show.movie,
                theater: show.theater,
                date: show.date,
                time: show.time,
                price: Number(show.price),
                seats
            });
            await showtime.save();
            createdShowtimes.push(showtime);
        }

        res.status(201).json({
            msg: `${createdShowtimes.length} show(s) added successfully`,
            showtimes: createdShowtimes
        });
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
            .populate("theater", "name city area")
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

// =============================================
//  ANALYTICS — aggregate booking statistics
// =============================================
router.get("/analytics", async (req, res) => {
    try {
        // 1. Total bookings count (only confirmed)
        const totalBookings = await Booking.countDocuments({ status: "confirmed" });

        // 2. Total revenue (sum of totalPrice for confirmed bookings)
        const revenueResult = await Booking.aggregate([
            { $match: { status: "confirmed" } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // 3. Most popular movie (most bookings)
        //    Booking → showtime → movie, so we first populate showtime,
        //    then group by movie.
        const movieAgg = await Booking.aggregate([
            { $match: { status: "confirmed" } },
            // Join with showtimes to get movie reference
            { $lookup: {
                from: "showtimes",
                localField: "showtime",
                foreignField: "_id",
                as: "showtimeData"
            }},
            { $unwind: "$showtimeData" },
            // Group by movie ObjectId
            { $group: {
                _id: "$showtimeData.movie",
                count: { $sum: 1 }
            }},
            { $sort: { count: -1 } },
            { $limit: 1 },
            // Join with movies to get movie title
            { $lookup: {
                from: "movies",
                localField: "_id",
                foreignField: "_id",
                as: "movieData"
            }},
            { $unwind: "$movieData" },
            { $project: {
                _id: 0,
                name: "$movieData.title",
                count: 1
            }}
        ]);
        const mostPopularMovie = movieAgg.length > 0
            ? movieAgg[0]
            : { name: "N/A", count: 0 };

        // 4. Most booked theatre (most bookings)
        const theatreAgg = await Booking.aggregate([
            { $match: { status: "confirmed" } },
            { $lookup: {
                from: "showtimes",
                localField: "showtime",
                foreignField: "_id",
                as: "showtimeData"
            }},
            { $unwind: "$showtimeData" },
            { $group: {
                _id: "$showtimeData.theater",
                count: { $sum: 1 }
            }},
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: {
                from: "theaters",
                localField: "_id",
                foreignField: "_id",
                as: "theatreData"
            }},
            { $unwind: "$theatreData" },
            { $project: {
                _id: 0,
                name: "$theatreData.name",
                count: 1
            }}
        ]);
        const mostBookedTheatre = theatreAgg.length > 0
            ? theatreAgg[0]
            : { name: "N/A", count: 0 };

        res.json({
            totalBookings,
            totalRevenue,
            mostPopularMovie,
            mostBookedTheatre
        });
    } catch (err) {
        console.error("Analytics error:", err);
        res.status(500).json({ msg: "Failed to load analytics" });
    }
});

// =============================================
//  REVENUE ANALYTICS — charts data
// =============================================
router.get("/revenue-analytics", async (req, res) => {
    try {
        // Helper: today string "YYYY-MM-DD"
        const todayDate = new Date();
        const toISO = (d) => d.toISOString().split("T")[0];

        // Build date strings for last 7 days
        const last7 = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(todayDate);
            d.setDate(d.getDate() - i);
            last7.push(toISO(d));
        }

        // Build week-start strings for last 4 weeks
        const last4Weeks = [];
        for (let i = 3; i >= 0; i--) {
            const start = new Date(todayDate);
            start.setDate(start.getDate() - (i * 7 + todayDate.getDay()));
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            last4Weeks.push({ start: toISO(start), end: toISO(end) });
        }

        // 1. Daily Revenue — last 7 days
        const dailyRevenue = await Booking.aggregate([
            { $match: { status: "confirmed" } },
            { $lookup: {
                from: "showtimes",
                localField: "showtime",
                foreignField: "_id",
                as: "showtimeData"
            }},
            { $unwind: "$showtimeData" },
            { $match: { "showtimeData.date": { $in: last7 } } },
            { $group: {
                _id: "$showtimeData.date",
                revenue: { $sum: "$totalPrice" },
                count: { $sum: 1 }
            }},
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", revenue: 1, count: 1 } }
        ]);

        // Fill missing days with zero
        const dailyMap = {};
        dailyRevenue.forEach(d => { dailyMap[d.date] = d; });
        const dailyResult = last7.map(date => {
            const label = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            return dailyMap[date]
                ? { date: label, revenue: dailyMap[date].revenue, count: dailyMap[date].count }
                : { date: label, revenue: 0, count: 0 };
        });

        // 2. Weekly Revenue — last 4 weeks
        const weeklyResult = [];
        for (let i = 0; i < last4Weeks.length; i++) {
            const { start, end } = last4Weeks[i];
            const weekAgg = await Booking.aggregate([
                { $match: { status: "confirmed" } },
                { $lookup: {
                    from: "showtimes",
                    localField: "showtime",
                    foreignField: "_id",
                    as: "showtimeData"
                }},
                { $unwind: "$showtimeData" },
                { $match: { "showtimeData.date": { $gte: start, $lte: end } } },
                { $group: {
                    _id: null,
                    revenue: { $sum: "$totalPrice" },
                    count: { $sum: 1 }
                }}
            ]);
            const startLabel = new Date(start + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            const endLabel = new Date(end + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            weeklyResult.push({
                week: `${startLabel} – ${endLabel}`,
                revenue: weekAgg.length > 0 ? weekAgg[0].revenue : 0,
                count: weekAgg.length > 0 ? weekAgg[0].count : 0
            });
        }

        // 3. Movie-wise Revenue — top 5
        const movieRevenue = await Booking.aggregate([
            { $match: { status: "confirmed" } },
            { $lookup: {
                from: "showtimes",
                localField: "showtime",
                foreignField: "_id",
                as: "showtimeData"
            }},
            { $unwind: "$showtimeData" },
            { $group: {
                _id: "$showtimeData.movie",
                revenue: { $sum: "$totalPrice" },
                count: { $sum: 1 }
            }},
            { $sort: { revenue: -1 } },
            { $limit: 5 },
            { $lookup: {
                from: "movies",
                localField: "_id",
                foreignField: "_id",
                as: "movieData"
            }},
            { $unwind: "$movieData" },
            { $project: {
                _id: 0,
                name: "$movieData.title",
                revenue: 1,
                count: 1
            }}
        ]);

        // 4. Theatre-wise Revenue — top 5
        const theatreRevenue = await Booking.aggregate([
            { $match: { status: "confirmed" } },
            { $lookup: {
                from: "showtimes",
                localField: "showtime",
                foreignField: "_id",
                as: "showtimeData"
            }},
            { $unwind: "$showtimeData" },
            { $group: {
                _id: "$showtimeData.theater",
                revenue: { $sum: "$totalPrice" },
                count: { $sum: 1 }
            }},
            { $sort: { revenue: -1 } },
            { $limit: 5 },
            { $lookup: {
                from: "theaters",
                localField: "_id",
                foreignField: "_id",
                as: "theatreData"
            }},
            { $unwind: "$theatreData" },
            { $project: {
                _id: 0,
                name: "$theatreData.name",
                revenue: 1,
                count: 1
            }}
        ]);

        res.json({
            dailyRevenue: dailyResult,
            weeklyRevenue: weeklyResult,
            movieRevenue,
            theatreRevenue
        });
    } catch (err) {
        console.error("Revenue analytics error:", err);
        res.status(500).json({ msg: "Failed to load revenue analytics" });
    }
});

module.exports = router;
