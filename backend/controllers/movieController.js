const Movie = require("../models/Movie");
const { fetchNowPlaying, fetchMovieDetails, searchMovies } = require("../services/tmdbService");

// ADD A NEW MOVIE (Admin use)
exports.addMovie = async (req, res) => {
    try {
        const { title, genre, language, duration, releaseDate, rating, description, posterUrl, trailerUrl, cast, director, nowShowing } = req.body;

        const movie = new Movie({
            title,
            genre,
            language,
            duration,
            releaseDate,
            rating,
            description,
            posterUrl,
            trailerUrl,
            cast,
            director,
            nowShowing
        });

        await movie.save();
        res.status(201).json({ msg: "Movie added successfully", movie });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET ALL MOVIES (supports ?search=keyword)
// HYBRID SEARCH: MongoDB first → if no results, fetch from TMDB and save
exports.getAllMovies = async (req, res) => {
    try {
        const { search } = req.query;

        // --- Step 1: If no search query, return all movies ---
        if (!search || search.trim() === "") {
            const movies = await Movie.find();
            return res.json(movies);
        }

        // --- Step 2: Search MongoDB first (case-insensitive regex) ---
        const regex = new RegExp(search.trim(), "i");
        const filter = {
            $or: [
                { title: regex },
                { genre: regex },
                { language: regex }
            ]
        };
        const localMovies = await Movie.find(filter);

        if (localMovies.length > 0) {
            // Found in MongoDB → return immediately
            return res.json(localMovies);
        }

        // --- Step 3: Nothing in MongoDB → search TMDB ---
        console.log(`No local results for "${search}". Searching TMDB...`);
        let tmdbResults = [];
        try {
            tmdbResults = await searchMovies(search.trim());
        } catch (tmdbErr) {
            console.error("TMDB search failed:", tmdbErr.message);
            // TMDB down → return empty array (no crash)
            return res.json([]);
        }

        if (tmdbResults.length === 0) {
            return res.json([]);
        }

        // --- Step 4: Save new movies to MongoDB (skip duplicates via tmdbId) ---
        // Limit to first 10 results to keep search fast
        const limitedResults = tmdbResults.slice(0, 10);
        const savedMovies = [];

        for (const m of limitedResults) {
            // Skip movies without a poster (required by schema)
            if (!m.posterUrl) continue;

            // Prevent duplicates: check if tmdbId already exists
            const exists = await Movie.findOne({ tmdbId: m.tmdbId });
            if (exists) {
                savedMovies.push(exists);
                continue;
            }

            // Try to fetch detailed info (runtime, cast, director, trailer)
            try {
                const details = await fetchMovieDetails(m.tmdbId);
                m.duration = details.duration || 120;
                m.cast = details.cast || [];
                m.director = details.director || "";
                m.trailerUrl = details.trailerUrl || "";
                if (details.genre && details.genre.length > 0) m.genre = details.genre;
            } catch (detailErr) {
                // Use basic data if detail fetch fails
                m.duration = m.duration || 120;
            }

            // Ensure all required fields have safe defaults before saving
            m.description = m.description || "No description available.";
            m.genre = (m.genre && m.genre.length > 0) ? m.genre : ["Other"];
            m.language = m.language || "EN";

            // Per-movie try/catch so one bad movie doesn't crash the batch
            try {
                const movie = new Movie(m);
                await movie.save();
                savedMovies.push(movie);
            } catch (saveErr) {
                console.error(`Could not save "${m.title}":`, saveErr.message);
                // Skip this movie and continue with the rest
            }
        }

        console.log(`${savedMovies.length} movie(s) returned from TMDB search.`);
        return res.json(savedMovies);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET A SINGLE MOVIE BY ID
exports.getMovieById = async (req, res) => {
    try {
        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return res.status(404).json({ msg: "Movie not found" });
        }

        res.json(movie);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// UPDATE A MOVIE
exports.updateMovie = async (req, res) => {
    try {
        const movie = await Movie.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }   // return the updated document
        );

        if (!movie) {
            return res.status(404).json({ msg: "Movie not found" });
        }

        res.json({ msg: "Movie updated successfully", movie });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// DELETE A MOVIE
exports.deleteMovie = async (req, res) => {
    try {
        const movie = await Movie.findByIdAndDelete(req.params.id);

        if (!movie) {
            return res.status(404).json({ msg: "Movie not found" });
        }

        res.json({ msg: "Movie deleted successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// SYNC "NOW PLAYING" MOVIES FROM TMDB INTO LOCAL DATABASE
// -------------------------------------------------------
// 1. Fetch the now-playing list from TMDB
// 2. For each movie, check if tmdbId already exists in our DB
// 3. If not, fetch full details (runtime, cast, director, trailer)
// 4. Save the new movie locally
// 5. Return how many were added
// -------------------------------------------------------
exports.syncMoviesFromTMDB = async (req, res) => {
    try {
        const tmdbMovies = await fetchNowPlaying();
        let addedCount = 0;

        for (const m of tmdbMovies) {
            // Skip if we already have this TMDB movie
            const exists = await Movie.findOne({ tmdbId: m.tmdbId });
            if (exists) continue;

            // Fetch detailed info (runtime, cast, director, trailer, genres)
            try {
                const details = await fetchMovieDetails(m.tmdbId);
                m.duration = details.duration;
                m.cast = details.cast;
                m.director = details.director;
                m.trailerUrl = details.trailerUrl;
                if (details.genre.length > 0) m.genre = details.genre;
            } catch (detailErr) {
                console.error(`Could not fetch details for TMDB ${m.tmdbId}:`, detailErr.message);
                // Use the basic data we already have; duration defaults to 0
                m.duration = m.duration || 120;
            }

            const movie = new Movie(m);
            await movie.save();
            addedCount++;
        }

        res.json({ msg: `TMDB sync complete. ${addedCount} new movie(s) added.` });

    } catch (err) {
        console.error("TMDB sync error:", err.message);
        res.status(500).json({ msg: "Failed to sync from TMDB. Existing movies still work." });
    }
};
