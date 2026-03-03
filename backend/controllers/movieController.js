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
        const { search, sort, genre, language } = req.query;

        // Build sort option for rating
        let sortOption = {};
        if (sort === "asc") sortOption.rating = 1;
        else if (sort === "desc") sortOption.rating = -1;

        // Build genre filter (if provided)
        let genreFilter = {};
        if (genre && genre.trim() !== "") {
            genreFilter = { genre: { $in: [genre.trim()] } };
        }

        // Build language filter (if provided, case-insensitive)
        let languageFilter = {};
        if (language && language.trim() !== "") {
            languageFilter = { language: new RegExp(`^${language.trim()}$`, "i") };
        }

        // Combine all filters
        const baseFilter = { ...genreFilter, ...languageFilter };

        // --- Step 1: If no search query, return all "now showing" movies (with optional filters) ---
        if (!search || search.trim() === "") {
            const movies = await Movie.find({ ...baseFilter, nowShowing: true }).sort(sortOption);
            return res.json(movies);
        }

        // --- Step 2: Search MongoDB first (case-insensitive regex) ---
        const regex = new RegExp(search.trim(), "i");
        const filter = {
            $or: [
                { title: regex },
                { genre: regex },
                { language: regex }
            ],
            ...baseFilter
        };
        const localMovies = await Movie.find(filter).sort(sortOption);

        if (localMovies.length > 0) {
            // Found in MongoDB → return immediately
            return res.json(localMovies);
        }

        // --- Step 3: Nothing in MongoDB → search TMDB (read-only, no saving) ---
        // Only admins can add movies. Search results are returned but NOT saved to DB.
        console.log(`No local results for "${search}". Searching TMDB (read-only)...`);
        let tmdbResults = [];
        try {
            tmdbResults = await searchMovies(search.trim());
        } catch (tmdbErr) {
            console.error("TMDB search failed:", tmdbErr.message);
            return res.json([]);
        }

        if (tmdbResults.length === 0) {
            return res.json([]);
        }

        // Return TMDB results as preview data (not persisted)
        const previewMovies = tmdbResults.slice(0, 10).filter(m => m.posterUrl).map(m => ({
            _id: `tmdb_${m.tmdbId}`,  // temporary ID so frontend can identify it
            tmdbId: m.tmdbId,
            title: m.title,
            genre: (m.genre && m.genre.length > 0) ? m.genre : ["Other"],
            language: m.language || "Other",
            duration: m.duration || 120,
            releaseDate: m.releaseDate,
            rating: m.rating || 0,
            description: m.description || "No description available.",
            posterUrl: m.posterUrl,
            trailerUrl: m.trailerUrl || "",
            cast: m.cast || [],
            director: m.director || "",
            nowShowing: false,
            isPreview: true  // flag so frontend knows this isn't bookable
        }));

        console.log(`${previewMovies.length} TMDB preview(s) returned (not saved).`);
        return res.json(previewMovies);

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

// GET SEARCH SUGGESTIONS (local + TMDB, no saving)
exports.getSuggestions = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.trim().length < 2) {
            return res.json({ local: [], external: [] });
        }

        const regex = new RegExp(query.trim(), "i");

        // 1. Search MongoDB (limit 5)
        const localMovies = await Movie.find({ title: regex })
            .select("title posterUrl genre rating tmdbId")
            .limit(5);

        // 2. If local results < 5, fetch from TMDB (don't save)
        let externalMovies = [];
        if (localMovies.length < 5) {
            try {
                const tmdbResults = await searchMovies(query.trim());
                // Filter out movies that already exist locally (by tmdbId)
                const localTmdbIds = localMovies
                    .filter(m => m.tmdbId)
                    .map(m => m.tmdbId);

                externalMovies = tmdbResults
                    .filter(m => !localTmdbIds.includes(m.tmdbId))
                    .slice(0, 7 - localMovies.length)
                    .map(m => ({
                        tmdbId: m.tmdbId,
                        title: m.title,
                        posterUrl: m.posterUrl,
                        genre: m.genre,
                        rating: m.rating
                    }));
            } catch (tmdbErr) {
                console.error("TMDB suggestion fetch failed:", tmdbErr.message);
                // Continue with local results only
            }
        }

        res.json({ local: localMovies, external: externalMovies });
    } catch (err) {
        console.error("Error fetching suggestions:", err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET DISTINCT GENRES from all movies in the database
exports.getGenres = async (req, res) => {
    try {
        const genres = await Movie.distinct("genre");
        // Sort alphabetically for a clean dropdown
        genres.sort();
        res.json(genres);
    } catch (err) {
        console.error("Error fetching genres:", err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET DISTINCT LANGUAGES from all movies in the database
exports.getLanguages = async (req, res) => {
    try {
        const languages = await Movie.distinct("language");
        languages.sort();
        res.json(languages);
    } catch (err) {
        console.error("Error fetching languages:", err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET TRAILER for a movie (fetch from TMDB videos endpoint)
const axios = require("axios");
exports.getTrailer = async (req, res) => {
    try {
        const movie = await Movie.findById(req.params.id);
        if (!movie) {
            return res.status(404).json({ msg: "Movie not found" });
        }

        // If movie has no tmdbId, we can't fetch a trailer
        if (!movie.tmdbId) {
            return res.status(404).json({ msg: "Trailer not available" });
        }

        // Call TMDB videos endpoint
        const TMDB_KEY = process.env.TMDB_API_KEY;
        const url = `https://api.themoviedb.org/3/movie/${movie.tmdbId}/videos?api_key=${TMDB_KEY}&language=en-US`;
        const tmdbRes = await axios.get(url);
        const videos = tmdbRes.data.results || [];

        // Find a YouTube trailer
        const trailer = videos.find(
            (v) => v.site === "YouTube" && v.type === "Trailer"
        );

        if (!trailer) {
            return res.status(404).json({ msg: "Trailer not available" });
        }

        res.json({ key: trailer.key, name: trailer.name });
    } catch (err) {
        console.error("Error fetching trailer:", err.message);
        res.status(500).json({ msg: "Failed to fetch trailer" });
    }
};

// GET NEWLY RELEASED MOVIES (released within last 30 days)
exports.getNewReleases = async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const movies = await Movie.find({
            releaseDate: { $gte: thirtyDaysAgo }
        })
            .sort({ releaseDate: -1 })
            .limit(10);

        res.json(movies);
    } catch (err) {
        console.error("Error fetching new releases:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
};
