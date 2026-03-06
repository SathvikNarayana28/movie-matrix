const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const movieRoutes = require("./routes/movieRoutes");
const theaterRoutes = require("./routes/theaterRoutes");
const showtimeRoutes = require("./routes/showtimeRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const aiRoutes = require("./routes/aiRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const userRoutes = require("./routes/userRoutes");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();   // <-- app is created HERE

app.use(cors());
app.use(express.json());

// Serve uploaded files (profile pics, etc.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/theaters", theaterRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);

// Protected route (NOW it is after app creation)
app.get("/api/protected", authMiddleware, (req, res) => {
    res.json({ msg: "You have accessed a protected route!", user: req.user });
});

// In production, serve React frontend build
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "..", "frontend", "build")));
} else {
    // Test route (only in development)
    app.get("/", (req, res) => {
        res.send("Backend running");
    });
}

// Database connection
const Movie = require("./models/Movie");
const Theater = require("./models/Theater");
const Showtime = require("./models/Showtime");
const { generateSeats } = require("./models/Showtime");
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

        // --- Seed Theaters (Hyderabad realistic dataset) ---
        const theaterCount = await Theater.countDocuments();
        if (theaterCount === 0) {
            console.log("Seeding Hyderabad theatres...");
            const theaters = [
                { name: "AMB Cinemas", city: "Hyderabad", area: "Gachibowli", location: "AMB Cinemas, Gachibowli, Hyderabad, Telangana", screens: 4, totalSeatsPerScreen: 100 },
                { name: "PVR Next Galleria", city: "Hyderabad", area: "Panjagutta", location: "PVR Next Galleria Mall, Panjagutta, Hyderabad, Telangana", screens: 5, totalSeatsPerScreen: 80 },
                { name: "Asian Cinemas", city: "Hyderabad", area: "Uppal", location: "Asian Cinemas, Uppal, Hyderabad, Telangana", screens: 3, totalSeatsPerScreen: 120 },
                { name: "Prasads Multiplex", city: "Hyderabad", area: "Necklace Road", location: "Prasads Multiplex, Necklace Road, Hyderabad, Telangana", screens: 6, totalSeatsPerScreen: 100 },
                { name: "INOX GVK One", city: "Hyderabad", area: "Banjara Hills", location: "INOX GVK One Mall, Banjara Hills, Hyderabad, Telangana", screens: 4, totalSeatsPerScreen: 90 },
                { name: "Cinepolis", city: "Hyderabad", area: "Kompally", location: "Cinepolis, Kompally, Hyderabad, Telangana", screens: 3, totalSeatsPerScreen: 100 },
                { name: "Sudarshan 35mm", city: "Hyderabad", area: "RTC X Roads", location: "Sudarshan 35mm, RTC X Roads, Hyderabad, Telangana", screens: 1, totalSeatsPerScreen: 150 },
                { name: "Miraj Cinemas", city: "Hyderabad", area: "Kukatpally", location: "Miraj Cinemas, Kukatpally, Hyderabad, Telangana", screens: 4, totalSeatsPerScreen: 80 }
            ];
            await Theater.insertMany(theaters);
            console.log(`${theaters.length} Hyderabad theatres seeded.`);
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
                    // Generate seats based on the theatre's totalSeatsPerScreen
                    const totalSeats = theater.totalSeatsPerScreen || 100;
                    const seatsPerRow = 10;
                    const rows = Math.ceil(totalSeats / seatsPerRow);

                    for (const date of dates) {
                        const t1 = times[Math.floor(Math.random() * 2)];
                        const t2 = times[2 + Math.floor(Math.random() * 2)];
                        newShowtimes.push({
                            movie: movie._id,
                            theater: theater._id,
                            date,
                            time: t1,
                            price: 200,
                            seats: generateSeats(rows, seatsPerRow)
                        });
                        newShowtimes.push({
                            movie: movie._id,
                            theater: theater._id,
                            date,
                            time: t2,
                            price: 250,
                            seats: generateSeats(rows, seatsPerRow)
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



// In production, serve React app for any unknown route (client-side routing)
if (process.env.NODE_ENV === "production") {
    app.get("/{*splat}", (req, res) => {
        res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
    });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
