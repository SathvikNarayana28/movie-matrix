// migrate_posters.js
// -------------------------------------------------------
// Migration script to fix broken poster URLs.
//
// Strategy:  For EVERY movie that has a tmdbId, fetch the
//            current poster_path from TMDB API and rebuild
//            the full URL.  This avoids hardcoded paths
//            that can go stale (TMDB changes poster paths).
//
// For seeded movies without tmdbId, we search TMDB by title
// to find and assign the correct tmdbId first.
//
// Usage:    node migrate_posters.js
// -------------------------------------------------------

const mongoose = require("mongoose");
require("dotenv").config();
const axios = require("axios");

const Movie = require("./models/Movie");

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

// Known seed movies → correct TMDB IDs (for movies that may lack tmdbId)
const SEED_TMDB_IDS = {
    "Inception":         "27205",
    "The Dark Knight":   "155",
    "Interstellar":      "157336",
    "RRR":               "579974",
    "Avengers: Endgame": "299534",
    "Baahubali 2":       "350312"
};

// Small delay to avoid TMDB rate limiting
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB\n");

        let fixed = 0;
        let skipped = 0;

        // --- Part 1: Ensure seed movies have correct tmdbId ---
        for (const [title, tmdbId] of Object.entries(SEED_TMDB_IDS)) {
            const movie = await Movie.findOne({ title });
            if (!movie) {
                console.log(`  ⏭  "${title}" not in DB — skipped`);
                skipped++;
                continue;
            }
            if (!movie.tmdbId || movie.tmdbId !== tmdbId) {
                movie.tmdbId = tmdbId;
                await movie.save();
                console.log(`  ✔  ${title}: tmdbId set to ${tmdbId}`);
            }
        }

        // --- Part 2: For ALL movies with tmdbId, fetch live poster from TMDB ---
        const allMovies = await Movie.find({ tmdbId: { $exists: true, $ne: "" } });
        console.log(`\nChecking ${allMovies.length} movie(s) with tmdbId...`);

        for (const movie of allMovies) {
            try {
                const url = `${TMDB_BASE}/movie/${movie.tmdbId}?api_key=${TMDB_KEY}`;
                const res = await axios.get(url);

                if (res.data.poster_path) {
                    const newPoster = `${TMDB_IMG}${res.data.poster_path}`;
                    if (movie.posterUrl !== newPoster) {
                        movie.posterUrl = newPoster;
                        await movie.save();
                        fixed++;
                        console.log(`  ✔  ${movie.title}: poster updated`);
                    } else {
                        skipped++;
                    }
                } else {
                    skipped++;
                    console.log(`  ⏭  ${movie.title}: no poster on TMDB`);
                }
                await delay(100); // respect rate limits
            } catch (err) {
                console.error(`  ✖  ${movie.title} (tmdbId: ${movie.tmdbId}): ${err.message}`);
                skipped++;
            }
        }

        console.log(`\n✅ Migration complete: ${fixed} fixed, ${skipped} unchanged`);
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
}

migrate();
