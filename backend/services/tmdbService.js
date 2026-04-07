// services/tmdbService.js
// -------------------------------------------------------
// A simple helper that talks to the TMDB API.
// It fetches movie data and maps TMDB fields to our
// local Movie schema so they can be saved in MongoDB.
// -------------------------------------------------------

const axios = require("axios");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p/w500"; // poster base URL
const tmdbClient = axios.create({ timeout: 8000 });
const tmdbCache = new Map();

function getCached(key) {
    const entry = tmdbCache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.value;
    if (entry) tmdbCache.delete(key);
    return null;
}

function setCached(key, value, ttlMs) {
    tmdbCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
    });
    return value;
}

// TMDB genre IDs → readable names (subset of the official list)
const GENRE_MAP = {
    28: "Action", 12: "Adventure", 16: "Animation",
    35: "Comedy", 80: "Crime", 99: "Documentary",
    18: "Drama", 10751: "Family", 14: "Fantasy",
    36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
    10770: "TV Movie", 53: "Thriller", 10752: "War",
    37: "Western"
};

// TMDB language codes → full readable names
const LANGUAGE_MAP = {
    en: "English",
    hi: "Hindi",
    te: "Telugu",
    ta: "Tamil",
    kn: "Kannada",
    ml: "Malayalam",
    mr: "Marathi",
    bn: "Bengali",
    pa: "Punjabi",
    gu: "Gujarati",
    ur: "Urdu",
    ko: "Korean",
    ja: "Japanese",
    zh: "Chinese",
    fr: "French",
    es: "Spanish",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian"
};

/**
 * Fetch "Now Playing" movies from TMDB (page 1 = ~20 movies).
 * Returns an array of objects shaped to match our Movie schema.
 */
async function fetchNowPlaying() {
    const cached = getCached("now_playing");
    if (cached) return cached;

    const url = `${TMDB_BASE}/movie/now_playing?api_key=${TMDB_KEY}&language=en-US&page=1`;
    const res = await tmdbClient.get(url);
    const results = res.data.results || [];

    // Map each TMDB movie to our local schema shape
    const movies = results.map((m) => ({
        tmdbId: String(m.id),
        title: m.title,
        genre: (m.genre_ids || []).map(id => GENRE_MAP[id] || "Other"),
        language: LANGUAGE_MAP[m.original_language] || "Other",
        duration: 0,                                  // TMDB list doesn't include runtime
        releaseDate: m.release_date || "2026-01-01",
        rating: m.vote_average || 0,
        description: m.overview || "No description available.",
        posterUrl: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : "",
        trailerUrl: "",                               // filled by fetchMovieDetails if needed
        cast: [],
        director: "",
        nowShowing: true
    }));

    return setCached("now_playing", movies, 10 * 60 * 1000);
}

/**
 * Fetch detailed info for a single TMDB movie (runtime, credits).
 * Used to fill in duration, cast, and director after initial import.
 */
async function fetchMovieDetails(tmdbId) {
    const cacheKey = `details:${tmdbId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_KEY}&language=en-US&append_to_response=credits,videos`;
    const res = await tmdbClient.get(url);
    const d = res.data;

    // Extract runtime
    const duration = d.runtime || 120;

    // Extract top 5 cast names
    const cast = (d.credits?.cast || [])
        .slice(0, 5)
        .map(c => c.name);

    // Extract director
    const director = (d.credits?.crew || [])
        .find(c => c.job === "Director")?.name || "";

    // Extract YouTube trailer (first one found)
    const trailer = (d.videos?.results || [])
        .find(v => v.site === "YouTube" && v.type === "Trailer");
    const trailerUrl = trailer
        ? `https://www.youtube.com/watch?v=${trailer.key}`
        : "";

    // Genres from detail endpoint (more reliable than genre_ids)
    const genre = (d.genres || []).map(g => g.name);

    return setCached(cacheKey, { duration, cast, director, trailerUrl, genre }, 30 * 60 * 1000);
}

/**
 * Search TMDB for movies matching a query string.
 * Returns an array of objects shaped to match our Movie schema.
 */
async function searchMovies(query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const cacheKey = `search:${normalizedQuery}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1`;
    const res = await tmdbClient.get(url);
    const results = res.data.results || [];

    // Map each result to our local schema shape (same as fetchNowPlaying)
    // Filter out movies without a title or poster
    const movies = results
        .filter((m) => m.title && m.poster_path)
        .map((m) => ({
            tmdbId: String(m.id),
            title: m.title,
            genre: (m.genre_ids || []).map(id => GENRE_MAP[id] || "Other"),
            language: LANGUAGE_MAP[m.original_language] || "Other",
            duration: 0,
            releaseDate: m.release_date || "2026-01-01",
            rating: m.vote_average || 0,
            description: m.overview || "No description available.",
            posterUrl: `${TMDB_IMG}${m.poster_path}`,
            trailerUrl: "",
            cast: [],
            director: "",
            nowShowing: false
        }));

    return setCached(cacheKey, movies, 5 * 60 * 1000);
}

module.exports = { fetchNowPlaying, fetchMovieDetails, searchMovies, fetchTrending, fetchWatchProviders, discoverMoviesByGenre };

/**
 * Fetch trending movies from TMDB (weekly).
 * Returns top 15 trending movies globally.
 */
async function fetchTrending() {
    const cached = getCached("trending_week");
    if (cached) return cached;

    const url = `${TMDB_BASE}/trending/movie/week?api_key=${TMDB_KEY}&language=en-US`;
    const res = await tmdbClient.get(url);
    const results = (res.data.results || []).slice(0, 15);

    return setCached("trending_week", results
        .filter(m => m.title && m.poster_path)
        .map(m => ({
            tmdbId: String(m.id),
            title: m.title,
            genre: (m.genre_ids || []).map(id => GENRE_MAP[id] || "Other"),
            language: LANGUAGE_MAP[m.original_language] || "Other",
            releaseDate: m.release_date || "",
            rating: m.vote_average || 0,
            description: m.overview || "",
            posterUrl: `${TMDB_IMG}${m.poster_path}`
        })), 10 * 60 * 1000);
}

/**
 * Discover movies by genre ID from TMDB (sorted by popularity).
 * genreId: TMDB genre ID (e.g., 28 for Action)
 */
async function discoverMoviesByGenre(genreId) {
    const cacheKey = `discover:${genreId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=en-US&sort_by=popularity.desc&with_genres=${genreId}&page=1`;
    const res = await tmdbClient.get(url);
    const results = (res.data.results || []).slice(0, 10);

    return setCached(cacheKey, results
        .filter(m => m.title && m.poster_path)
        .map(m => ({
            tmdbId: String(m.id),
            title: m.title,
            genre: (m.genre_ids || []).map(id => GENRE_MAP[id] || "Other"),
            language: LANGUAGE_MAP[m.original_language] || "Other",
            releaseDate: m.release_date || "",
            rating: m.vote_average || 0,
            description: m.overview || "",
            posterUrl: `${TMDB_IMG}${m.poster_path}`
        })), 10 * 60 * 1000);
}

/**
 * Fetch OTT/streaming watch providers for a movie from TMDB.
 * Returns providers for India (IN) region by default.
 */
async function fetchWatchProviders(tmdbId, region = "IN") {
    const cacheKey = `providers:${tmdbId}:${region}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `${TMDB_BASE}/movie/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`;
    const res = await tmdbClient.get(url);
    const regionData = res.data.results?.[region] || res.data.results?.["US"] || {};

    const providers = [];

    // Flatrate = subscription streaming (Netflix, Prime, etc.)
    if (regionData.flatrate) {
        for (const p of regionData.flatrate) {
            providers.push({ name: p.provider_name, type: "Streaming" });
        }
    }
    // Rent
    if (regionData.rent) {
        for (const p of regionData.rent) {
            if (!providers.find(x => x.name === p.provider_name)) {
                providers.push({ name: p.provider_name, type: "Rent" });
            }
        }
    }
    // Buy
    if (regionData.buy) {
        for (const p of regionData.buy) {
            if (!providers.find(x => x.name === p.provider_name)) {
                providers.push({ name: p.provider_name, type: "Buy" });
            }
        }
    }

    return setCached(cacheKey, providers, 30 * 60 * 1000);
}
