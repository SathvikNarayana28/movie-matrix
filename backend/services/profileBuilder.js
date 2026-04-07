const Booking = require("../models/Booking");
const User = require("../models/User");
const Review = require("../models/Review");
const Showtime = require("../models/Showtime");

const PROFILE_CACHE_TTL_MS = 2 * 60 * 1000;
const profileCache = new Map();

function cloneProfile(profile) {
    return JSON.parse(JSON.stringify(profile));
}

/**
 * Build a weighted user preference profile from their booking history and favorites.
 * 
 * Returns:
 * {
 *   genreWeights:    { "Thriller": 0.85, "Comedy": 0.4, ... },
 *   actorAffinities: { "Actor Name": count, ... },
 *   directorAffinities: { "Director Name": count, ... },
 *   languageWeights: { "English": 0.7, "Telugu": 0.9, ... },
 *   preferredTimeSlot: "night",
 *   theaterPreferences: [ { theaterId, theaterName, area, visitCount } ],
 *   watchedMovieIds:  [ "mongoId1", "mongoId2", ... ],
 *   totalBookings: number,
 *   favoriteGenres: [ "Thriller", "Sci-Fi" ]
 * }
 */
async function buildUserProfile(userId) {
    const cacheKey = String(userId);
    const cached = profileCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cloneProfile(cached.data);
    }

    // 1. Get all confirmed bookings with populated movie & theater data
    const [bookings, user, reviews] = await Promise.all([
        Booking.find({ user: userId, status: "confirmed" })
            .populate({
                path: "showtime",
                populate: [
                    { path: "movie", select: "title genre cast director language rating _id" },
                    { path: "theater", select: "name area city _id" }
                ]
            })
            .sort({ createdAt: -1 })
            .lean(),
        User.findById(userId)
            .populate("favorites", "title genre cast director language rating _id")
            .lean(),
        Review.find({ user: userId })
            .populate("movie", "title genre cast director language rating _id")
            .lean()
    ]);

    const HALF_LIFE_DAYS = 90;
    const now = Date.now();

    // Accumulators
    const genreCounts = {};
    const actorCounts = {};
    const directorCounts = {};
    const languageCounts = {};
    const timeSlotCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const theaterVisits = {};   // theaterId → { name, area, count }
    const watchedMovieIds = new Set();

    // 3. Process bookings (with time-decay weighting)
    for (const booking of bookings) {
        if (!booking.showtime || !booking.showtime.movie) continue;

        const movie = booking.showtime.movie;
        const theater = booking.showtime.theater;
        const showtime = booking.showtime;

        // Time decay: recent bookings matter more
        const daysAgo = (now - new Date(booking.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        const decay = Math.pow(0.5, daysAgo / HALF_LIFE_DAYS);
        const weight = Math.max(decay, 0.1); // minimum weight of 0.1

        // Track watched movies
        watchedMovieIds.add(movie._id.toString());

        // Genre weights
        if (Array.isArray(movie.genre)) {
            for (const g of movie.genre) {
                genreCounts[g] = (genreCounts[g] || 0) + weight;
            }
        }

        // Actor affinities
        if (Array.isArray(movie.cast)) {
            for (const actor of movie.cast) {
                actorCounts[actor] = (actorCounts[actor] || 0) + weight;
            }
        }

        // Director affinities
        if (movie.director) {
            directorCounts[movie.director] = (directorCounts[movie.director] || 0) + weight;
        }

        // Language weights
        if (movie.language) {
            languageCounts[movie.language] = (languageCounts[movie.language] || 0) + weight;
        }

        // Time slot preferences (parse showtime.time like "09:30 PM")
        if (showtime.time) {
            const slot = getTimeSlot(showtime.time);
            timeSlotCounts[slot] += weight;
        }

        // Theater preferences
        if (theater) {
            const tid = theater._id.toString();
            if (!theaterVisits[tid]) {
                theaterVisits[tid] = { theaterId: tid, theaterName: theater.name, area: theater.area || "", visitCount: 0 };
            }
            theaterVisits[tid].visitCount += 1;
        }
    }

    // 4. Boost weights from favorites (strong signal, weight = 0.8 each)
    const favoriteGenres = new Set();
    if (user && user.favorites) {
        for (const movie of user.favorites) {
            watchedMovieIds.add(movie._id.toString()); // treat favorites as "seen"

            if (Array.isArray(movie.genre)) {
                for (const g of movie.genre) {
                    genreCounts[g] = (genreCounts[g] || 0) + 0.8;
                    favoriteGenres.add(g);
                }
            }
            if (Array.isArray(movie.cast)) {
                for (const actor of movie.cast) {
                    actorCounts[actor] = (actorCounts[actor] || 0) + 0.6;
                }
            }
            if (movie.director) {
                directorCounts[movie.director] = (directorCounts[movie.director] || 0) + 0.6;
            }
            if (movie.language) {
                languageCounts[movie.language] = (languageCounts[movie.language] || 0) + 0.5;
            }
        }
    }

    // 5. Boost weights from user's reviews (strong engagement signal, weight scales with rating)

    for (const rev of reviews) {
        if (!rev.movie) continue;
        const movie = rev.movie;
        const ratingWeight = (rev.rating || 3) / 5; // 1-5 star → 0.2-1.0

        watchedMovieIds.add(movie._id.toString());

        if (Array.isArray(movie.genre)) {
            for (const g of movie.genre) {
                genreCounts[g] = (genreCounts[g] || 0) + ratingWeight;
                if (rev.rating >= 4) favoriteGenres.add(g);
            }
        }
        if (Array.isArray(movie.cast)) {
            for (const actor of movie.cast) {
                actorCounts[actor] = (actorCounts[actor] || 0) + (ratingWeight * 0.6);
            }
        }
        if (movie.director) {
            directorCounts[movie.director] = (directorCounts[movie.director] || 0) + (ratingWeight * 0.5);
        }
        if (movie.language) {
            languageCounts[movie.language] = (languageCounts[movie.language] || 0) + (ratingWeight * 0.5);
        }
    }

    // 6. Normalize weights to 0-1 range
    const genreWeights = normalize(genreCounts);
    const languageWeights = normalize(languageCounts);

    // 7. Determine preferred time slot
    const preferredTimeSlot = Object.entries(timeSlotCounts)
        .sort((a, b) => b[1] - a[1])[0][0];

    // 8. Sort theater preferences by visit count
    const theaterPreferences = Object.values(theaterVisits)
        .sort((a, b) => b.visitCount - a.visitCount);

    // 9. Get top actors/directors (top 5)
    const topActors = Object.entries(actorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

    const topDirectors = Object.entries(directorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

    const result = {
        genreWeights,
        actorAffinities: topActors,
        directorAffinities: topDirectors,
        languageWeights,
        preferredTimeSlot,
        theaterPreferences,
        watchedMovieIds: [...watchedMovieIds],
        totalBookings: bookings.length,
        favoriteGenres: [...favoriteGenres]
    };

    profileCache.set(cacheKey, {
        expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
        data: result
    });

    return cloneProfile(result);
}

/**
 * Parse a time string like "09:30 PM" into a time-of-day slot
 */
function getTimeSlot(timeStr) {
    try {
        const lower = timeStr.toLowerCase();
        const match = lower.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
        if (!match) return "evening";

        let hour = parseInt(match[1]);
        const ampm = match[3];

        if (ampm === "pm" && hour !== 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;

        if (hour < 12) return "morning";
        if (hour < 17) return "afternoon";
        if (hour < 20) return "evening";
        return "night";
    } catch {
        return "evening";
    }
}

/**
 * Normalize a { key: rawCount } object to { key: 0.0–1.0 }
 */
function normalize(obj) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return {};
    const max = Math.max(...entries.map(e => e[1]));
    if (max === 0) return {};
    const result = {};
    for (const [k, v] of entries) {
        result[k] = Math.round((v / max) * 100) / 100; // 2 decimal places
    }
    return result;
}

function invalidateUserProfileCache(userId) {
    profileCache.delete(String(userId));
}

module.exports = {
    buildUserProfile,
    getTimeSlot,
    invalidateUserProfileCache
};
