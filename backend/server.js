const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const movieRoutes = require("./routes/movieRoutes");
const theaterRoutes = require("./routes/theaterRoutes");
const showtimeRoutes = require("./routes/showtimeRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();   // <-- app is created HERE

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/theaters", theaterRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/admin", adminRoutes);

// Protected route (NOW it is after app creation)
app.get("/api/protected", authMiddleware, (req, res) => {
    res.json({ msg: "You have accessed a protected route!", user: req.user });
});

// Test route
app.get("/", (req, res) => {
    res.send("Backend running");
});

// Database connection
const Movie = require("./models/Movie");
const Theater = require("./models/Theater");
const Showtime = require("./models/Showtime");
const { fetchNowPlaying, fetchMovieDetails } = require("./services/tmdbService");

mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000
})
.then(async () => {
    console.log("MongoDB Connected");
    try {
        // --- Sync Movies from TMDB ---
        const movieCount = await Movie.countDocuments();
        if (movieCount === 0) {
            console.log("No movies in DB. Fetching from TMDB...");
            try {
                const tmdbMovies = await fetchNowPlaying();
                let addedCount = 0;

                for (const m of tmdbMovies) {
                    const exists = await Movie.findOne({ tmdbId: m.tmdbId });
                    if (exists) continue;

                    // Fetch detailed info (runtime, cast, director, trailer)
                    try {
                        const details = await fetchMovieDetails(m.tmdbId);
                        m.duration = details.duration;
                        m.cast = details.cast;
                        m.director = details.director;
                        m.trailerUrl = details.trailerUrl;
                        if (details.genre.length > 0) m.genre = details.genre;
                    } catch (detailErr) {
                        console.error(`Detail fetch failed for TMDB ${m.tmdbId}:`, detailErr.message);
                        m.duration = m.duration || 120;
                    }

                    const movie = new Movie(m);
                    await movie.save();
                    addedCount++;
                }
                console.log(`${addedCount} movies synced from TMDB.`);
            } catch (tmdbErr) {
                console.error("TMDB sync failed:", tmdbErr.message);
                console.log("App will work without movies. Add them manually or retry sync via GET /api/movies/sync");
            }
        }

        // --- Seed Theaters ---
        const theaterCount = await Theater.countDocuments();
        if (theaterCount === 0) {
            console.log("Seeding default theaters...");
            const theaters = [
                { name: "PVR Cinemas", location: "Hyderabad, Forum Mall", totalSeats: 30 },
                { name: "INOX Multiplex", location: "Hyderabad, GVK One", totalSeats: 30 },
                { name: "Cinepolis", location: "Bangalore, Royal Meenakshi Mall", totalSeats: 30 }
            ];
            await Theater.insertMany(theaters);
            console.log("3 default theaters seeded.");
        }

        // --- Seed Showtimes (for movies that don't have any yet) ---
        const allMovies = await Movie.find();
        const allTheaters = await Theater.find();

        if (allMovies.length > 0 && allTheaters.length > 0) {
            // Clean up orphaned showtimes (reference movies that no longer exist)
            const movieIds = allMovies.map(m => m._id);
            const orphanCount = await Showtime.countDocuments({ movie: { $nin: movieIds } });
            if (orphanCount > 0) {
                await Showtime.deleteMany({ movie: { $nin: movieIds } });
                console.log(`Removed ${orphanCount} orphaned showtimes.`);
            }

            const times = ["10:00 AM", "01:30 PM", "06:30 PM", "09:30 PM"];

            // Use dynamic dates: today + next 2 days (so shows are never stale)
            const today = new Date();
            const dates = [];
            for (let i = 0; i < 3; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                dates.push(`${yyyy}-${mm}-${dd}`);
            }

            let newShowtimes = [];

            for (const movie of allMovies) {
                // Check if this movie already has showtimes
                const existing = await Showtime.countDocuments({ movie: movie._id });
                if (existing > 0) continue;

                // Create showtimes for this movie at each theater
                for (const theater of allTheaters) {
                    for (const date of dates) {
                        const t1 = times[Math.floor(Math.random() * 2)];
                        const t2 = times[2 + Math.floor(Math.random() * 2)];
                        newShowtimes.push({
                            movie: movie._id,
                            theater: theater._id,
                            date,
                            time: t1,
                            price: 200,
                            availableSeats: theater.totalSeats
                        });
                        newShowtimes.push({
                            movie: movie._id,
                            theater: theater._id,
                            date,
                            time: t2,
                            price: 250,
                            availableSeats: theater.totalSeats
                        });
                    }
                }
            }

            if (newShowtimes.length > 0) {
                await Showtime.insertMany(newShowtimes);
                console.log(`${newShowtimes.length} showtimes created for new movies.`);
            }
        }

    } catch (seedErr) {
        console.error("Seeding error", seedErr);
    }
})
.catch(err => console.log(err));



app.listen(5000, () => console.log("Server started on port 5000"));
