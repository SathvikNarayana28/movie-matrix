const Movie = require("../models/Movie");
const Showtime = require("../models/Showtime");
const { buildUserProfile, getTimeSlot } = require("./profileBuilder");

/**
 * Generate personalized movie recommendations for a user.
 * 
 * Scoring formula:
 *   Score = 0.30×genreMatch + 0.20×actorMatch + 0.10×directorMatch
 *         + 0.10×languageMatch + 0.10×popularity + 0.10×theaterFamiliarity
 *         + 0.05×timeSlotMatch + 0.05×diversityBonus
 * 
 * Returns top N movies with scores, reasons, and suggested showtimes.
 */
async function getRecommendations(userId, limit = 5) {
    // 1. Build user profile from history
    const profile = await buildUserProfile(userId);

    // 2. Get all currently showing movies
    const movies = await Movie.find({ nowShowing: true }).lean();

    if (movies.length === 0) {
        return { recommendations: [], profile };
    }

    // 3. Get active showtimes (today + next 2 days) grouped by movie
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }

    const showtimes = await Showtime.find({
        date: { $in: dates },
        movie: { $in: movies.map(m => m._id) }
    })
        .populate("theater", "name area city _id")
        .lean();

    // Group showtimes by movieId
    const showtimesByMovie = {};
    for (const st of showtimes) {
        const mid = st.movie.toString();
        if (!showtimesByMovie[mid]) showtimesByMovie[mid] = [];
        showtimesByMovie[mid].push(st);
    }

    // 4. Score each movie
    const scored = [];

    for (const movie of movies) {
        const mid = movie._id.toString();

        // Skip already-watched movies
        if (profile.watchedMovieIds.includes(mid)) continue;

        const movieShowtimes = showtimesByMovie[mid] || [];

        // --- Genre Match (0.30) ---
        let genreScore = 0;
        if (Array.isArray(movie.genre) && Object.keys(profile.genreWeights).length > 0) {
            const matches = movie.genre.filter(g => profile.genreWeights[g]);
            const matchWeights = matches.map(g => profile.genreWeights[g]);
            genreScore = matchWeights.length > 0
                ? matchWeights.reduce((a, b) => a + b, 0) / movie.genre.length
                : 0;
        }

        // --- Actor Match (0.20) ---
        let actorScore = 0;
        let matchedActor = null;
        if (Array.isArray(movie.cast) && Object.keys(profile.actorAffinities).length > 0) {
            for (const actor of movie.cast) {
                if (profile.actorAffinities[actor]) {
                    actorScore = Math.min(1, profile.actorAffinities[actor] / 3); // normalize
                    matchedActor = actor;
                    break;
                }
            }
        }

        // --- Director Match (0.10) ---
        let directorScore = 0;
        if (movie.director && profile.directorAffinities[movie.director]) {
            directorScore = Math.min(1, profile.directorAffinities[movie.director] / 2);
        }

        // --- Language Match (0.10) ---
        let languageScore = 0;
        if (movie.language && profile.languageWeights[movie.language]) {
            languageScore = profile.languageWeights[movie.language];
        }

        // --- Popularity Score (0.10) ---
        const popularityScore = (movie.rating || 5) / 10;

        // --- Theater Familiarity (0.10) ---
        let theaterScore = 0;
        let bestShowtime = null;

        if (movieShowtimes.length > 0 && profile.theaterPreferences.length > 0) {
            // Find showtime at user's most-visited theater
            for (const pref of profile.theaterPreferences) {
                const match = movieShowtimes.find(
                    st => st.theater && st.theater._id.toString() === pref.theaterId
                );
                if (match) {
                    theaterScore = Math.min(1, pref.visitCount / 5);
                    bestShowtime = match;
                    break;
                }
            }
        }

        // If no preferred theater match, pick closest time-slot match
        if (!bestShowtime && movieShowtimes.length > 0) {
            bestShowtime = movieShowtimes.find(st => getTimeSlot(st.time) === profile.preferredTimeSlot)
                || movieShowtimes[0];
        }

        // --- Time Slot Match (0.05) ---
        let timeScore = 0;
        if (bestShowtime && profile.totalBookings > 0) {
            timeScore = getTimeSlot(bestShowtime.time) === profile.preferredTimeSlot ? 1.0 : 0.3;
        }

        // --- Diversity Bonus (0.05) ---
        // Boost if genre is NOT in user's top-2 genres (breaks filter bubble)
        const topGenres = Object.entries(profile.genreWeights)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(e => e[0]);
        const isDiverse = Array.isArray(movie.genre) && !movie.genre.some(g => topGenres.includes(g));
        const diversityBonus = isDiverse ? 1.0 : 0.0;

        // --- Final Score ---
        const finalScore =
            (0.30 * genreScore) +
            (0.20 * actorScore) +
            (0.10 * directorScore) +
            (0.10 * languageScore) +
            (0.10 * popularityScore) +
            (0.10 * theaterScore) +
            (0.05 * timeScore) +
            (0.05 * diversityBonus);

        // --- Generate reason ---
        const reasons = [];
        if (genreScore > 0.3) reasons.push(`Matches your interest in ${movie.genre.filter(g => profile.genreWeights[g]).join(", ")}`);
        if (matchedActor) reasons.push(`Features ${matchedActor}`);
        if (directorScore > 0) reasons.push(`Directed by ${movie.director}`);
        if (theaterScore > 0 && bestShowtime) reasons.push(`Playing at your frequent theatre ${bestShowtime.theater?.name}`);
        if (popularityScore > 0.7) reasons.push(`Highly rated (${movie.rating}/10)`);
        if (isDiverse) reasons.push("Something different from your usual picks");
        if (reasons.length === 0) reasons.push("Popular right now");

        // Count available seats
        let availableSeats = 0;
        if (bestShowtime && bestShowtime.seats) {
            availableSeats = bestShowtime.seats.filter(s => !s.isBooked).length;
        }

        scored.push({
            movie: {
                _id: movie._id,
                title: movie.title,
                genre: movie.genre,
                language: movie.language,
                rating: movie.rating,
                posterUrl: movie.posterUrl,
                duration: movie.duration,
                cast: (movie.cast || []).slice(0, 3),
                director: movie.director
            },
            score: Math.round(finalScore * 100) / 100,
            reason: reasons.join(" • "),
            suggestedShowtime: bestShowtime ? {
                showtimeId: bestShowtime._id,
                theater: bestShowtime.theater?.name || "Unknown",
                area: bestShowtime.theater?.area || "",
                date: bestShowtime.date,
                time: bestShowtime.time,
                price: bestShowtime.price,
                availableSeats
            } : null
        });
    }

    // 5. Sort by score descending, return top N
    scored.sort((a, b) => b.score - a.score);

    // If user has no history, fall back to popularity
    if (profile.totalBookings === 0 && profile.favoriteGenres.length === 0) {
        scored.sort((a, b) => (b.movie.rating || 0) - (a.movie.rating || 0));
    }

    return {
        recommendations: scored.slice(0, limit),
        profile: {
            topGenres: Object.entries(profile.genreWeights)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(e => e[0]),
            preferredTimeSlot: profile.preferredTimeSlot,
            topTheater: profile.theaterPreferences[0]?.theaterName || null,
            totalBookings: profile.totalBookings
        }
    };
}

module.exports = { getRecommendations };
