const { GoogleGenerativeAI } = require("@google/generative-ai");
const Movie = require("../models/Movie");
const Showtime = require("../models/Showtime");
const { buildUserProfile } = require("../services/profileBuilder");
const { getRecommendations } = require("../services/recommendationEngine");
const { searchMovies, fetchTrending, fetchWatchProviders, fetchMovieDetails } = require("../services/tmdbService");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * GET /api/ai/recommend
 * Returns personalized recommendations for the logged-in user
 */
exports.getRecommendations = async (req, res) => {
    try {
        const result = await getRecommendations(req.user.id, 6);
        res.json(result);
    } catch (err) {
        console.error("Recommendation error:", err.message);
        res.status(500).json({ msg: "Failed to generate recommendations" });
    }
};

/**
 * GET /api/ai/profile
 * Returns the user's computed preference profile (useful for debugging / display)
 */
exports.getUserProfile = async (req, res) => {
    try {
        const profile = await buildUserProfile(req.user.id);
        res.json(profile);
    } catch (err) {
        console.error("Profile error:", err.message);
        res.status(500).json({ msg: "Failed to build profile" });
    }
};

/**
 * POST /api/ai/chat
 * Conversational AI assistant powered by Gemini
 * Body: { message: "I'm in the mood for a thriller" }
 */
exports.chat = async (req, res) => {
    try {
        const { message, history, userLat, userLng } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ msg: "Message is required" });
        }

        // Haversine distance helper
        const toRad = (deg) => deg * Math.PI / 180;
        const haversine = (lat1, lng1, lat2, lng2) => {
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        // 1. Build user profile
        const profile = await buildUserProfile(req.user.id);

        // 2. Get currently playing movies with showtimes
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 3; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates.push(d.toISOString().split("T")[0]);
        }

        const movies = await Movie.find({ nowShowing: true }).lean();
        const showtimes = await Showtime.find({
            date: { $in: dates },
            movie: { $in: movies.map(m => m._id) }
        })
            .populate("theater", "name area city lat lng")
            .lean();

        // Build movie catalog string for the prompt
        const movieCatalog = movies.map(m => {
            const movieShowtimes = showtimes.filter(st => st.movie.toString() === m._id.toString());

            // Prioritize showing different theatres — pick one showtime per unique theatre first
            const seenTheatres = new Set();
            const uniqueTheatreShowtimes = [];
            const remainingShowtimes = [];
            for (const st of movieShowtimes) {
                const theaterId = st.theater?._id?.toString();
                if (theaterId && !seenTheatres.has(theaterId)) {
                    seenTheatres.add(theaterId);
                    uniqueTheatreShowtimes.push(st);
                } else {
                    remainingShowtimes.push(st);
                }
            }
            // Combine: unique theatres first, then remaining — show ALL
            const selectedShowtimes = [...uniqueTheatreShowtimes, ...remainingShowtimes];

            const showtimeInfo = selectedShowtimes.map(st => {
                const available = st.seats ? st.seats.filter(s => !s.isBooked).length : 0;
                let distStr = "";
                if (!isNaN(userLat) && !isNaN(userLng) && st.theater?.lat && st.theater?.lng) {
                    const dist = Math.round(haversine(userLat, userLng, st.theater.lat, st.theater.lng) * 10) / 10;
                    distStr = ` [${dist} km away]`;
                }
                return `ShowtimeID:${st._id} @ ${st.theater?.name} (${st.theater?.area})${distStr} on ${st.date} at ${st.time} — ${available} seats, ₹${st.price}`;
            }).join("; ");

            return `- "${m.title}" [${(m.genre || []).join(", ")}] | ${m.language} | Rating: ${m.rating}/10 | Cast: ${(m.cast || []).slice(0, 3).join(", ")} | Director: ${m.director || "N/A"} | Showtimes: ${showtimeInfo || "No showtimes available"} | MovieID: ${m._id}`;
        }).join("\n");

        // Build user profile string
        const profileSummary = `
User preferences (derived from booking history):
- Favorite genres: ${Object.entries(profile.genreWeights).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g, w]) => `${g} (${Math.round(w * 100)}%)`).join(", ") || "No history yet"}
- Favorite actors: ${Object.keys(profile.actorAffinities).slice(0, 3).join(", ") || "None yet"}
- Favorite directors: ${Object.keys(profile.directorAffinities).join(", ") || "None yet"}
- Preferred language: ${Object.entries(profile.languageWeights).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l]) => l).join(", ") || "Any"}
- Preferred time: ${profile.preferredTimeSlot} shows
- Frequently visits: ${profile.theaterPreferences.slice(0, 2).map(t => t.theaterName).join(", ") || "No theatre preference yet"}
- Total past bookings: ${profile.totalBookings}
`.trim();

        // 3. Fetch TMDB trending movies with OTT info — for general recommendations
        let tmdbCatalog = "";
        try {
            const trending = await fetchTrending();
            // Filter out movies already in our now-showing list
            const localTitles = new Set(movies.map(m => m.title.toLowerCase()));
            const tmdbOnly = trending.filter(t => !localTitles.has(t.title.toLowerCase()));

            // Fetch OTT/watch providers for each TMDB movie (parallel, with timeout)
            const tmdbWithOTT = await Promise.all(
                tmdbOnly.slice(0, 10).map(async (m) => {
                    try {
                        const providers = await fetchWatchProviders(m.tmdbId);
                        const details = await fetchMovieDetails(m.tmdbId);
                        return {
                            ...m,
                            cast: details.cast || [],
                            director: details.director || "",
                            duration: details.duration || 0,
                            trailerUrl: details.trailerUrl || "",
                            ott: providers
                        };
                    } catch {
                        return { ...m, ott: [] };
                    }
                })
            );

            if (tmdbWithOTT.length > 0) {
                tmdbCatalog = tmdbWithOTT.map(m => {
                    const ottStr = m.ott.length > 0
                        ? m.ott.map(p => `${p.name} (${p.type})`).join(", ")
                        : "No OTT info available";
                    return `- "${m.title}" [${(m.genre || []).join(", ")}] | ${m.language} | Rating: ${m.rating}/10 | Cast: ${(m.cast || []).slice(0, 3).join(", ")} | Director: ${m.director || "N/A"} | Released: ${m.releaseDate} | OTT: ${ottStr} | TMDB_ID: ${m.tmdbId}`;
                }).join("\n");
            }
        } catch (tmdbErr) {
            console.error("TMDB trending fetch failed:", tmdbErr.message);
        }

        // Also search TMDB if user message looks like a specific movie query
        let tmdbSearchCatalog = "";
        try {
            const userMsg = message.toLowerCase();
            // Check if user is asking about a specific movie or OTT
            const isMovieQuery = userMsg.includes("where can i watch") || userMsg.includes("ott") || userMsg.includes("streaming") ||
                userMsg.includes("netflix") || userMsg.includes("prime") || userMsg.includes("hotstar") || userMsg.includes("available on") ||
                userMsg.includes("watch online") || userMsg.includes("not in theatres") || userMsg.includes("not in theaters") ||
                userMsg.includes("old movie") || userMsg.includes("recommend me");

            if (isMovieQuery || !movieCatalog.includes(message.split(" ").filter(w => w.length > 3)[0] || "")) {
                // Extract potential movie name — search TMDB
                const searchResults = await searchMovies(message.replace(/where can i watch|ott|streaming|available on|watch online/gi, "").trim());
                const filteredSearch = searchResults
                    .filter(m => !new Set(movies.map(mv => mv.title.toLowerCase())).has(m.title.toLowerCase()))
                    .slice(0, 5);

                if (filteredSearch.length > 0) {
                    const searchWithOTT = await Promise.all(
                        filteredSearch.map(async (m) => {
                            try {
                                const providers = await fetchWatchProviders(m.tmdbId);
                                const details = await fetchMovieDetails(m.tmdbId);
                                return { ...m, cast: details.cast || [], director: details.director || "", ott: providers };
                            } catch { return { ...m, ott: [] }; }
                        })
                    );
                    tmdbSearchCatalog = searchWithOTT.map(m => {
                        const ottStr = m.ott.length > 0
                            ? m.ott.map(p => `${p.name} (${p.type})`).join(", ")
                            : "No OTT info available";
                        return `- "${m.title}" [${(m.genre || []).join(", ")}] | ${m.language} | Rating: ${m.rating}/10 | Cast: ${(m.cast || []).slice(0, 3).join(", ")} | Director: ${m.director || "N/A"} | Released: ${m.releaseDate} | OTT: ${ottStr} | TMDB_ID: ${m.tmdbId}`;
                    }).join("\n");
                }
            }
        } catch (searchErr) {
            console.error("TMDB search for AI failed:", searchErr.message);
        }

        // 4. Call Gemini
        const systemPrompt = `You are Movie Matrix's AI assistant — a friendly, knowledgeable movie recommendation chatbot for a theatre booking platform in Hyderabad, India. You have deep knowledge of movies powered by TMDB (The Movie Database).

RULES:
1. For theatre bookings, ONLY recommend movies from the "CURRENTLY PLAYING" catalog below. NEVER invent movies.
2. Base your recommendation on the user's message + their preference profile.
3. Be conversational, warm, and concise (2-4 sentences max for the message).
4. If suggesting a currently playing movie, mention a specific showtime (theatre, date, time, price).
5. If the user asks about a movie NOT currently playing, check the "TMDB TRENDING" and "TMDB SEARCH RESULTS" sections. If found there, recommend it with OTT/streaming info. If not found anywhere, use your general movie knowledge to answer.
6. If the user's request is vague, use their profile to personalize suggestions.
7. For new users with no history, recommend top-rated movies.
8. CRITICAL: For showtimeId, you MUST use the exact ShowtimeID value from the catalog (a 24-character hex string). NEVER make up showtimeId values.
9. When recommending a currently playing movie, show options from MULTIPLE DIFFERENT theatres. Include 2-3 theatre options if available.
10. If the user asks "is it available in other theatres", list ALL available theatres for that movie.
11. When distance info like [X.X km away] is shown, PRIORITIZE recommending nearer theatres. Mention the distance.
12. If the user asks about nearby or closest theatres, recommend nearest options first.
13. If the user asks about OTT/streaming (e.g., "where can I watch X", "is X on Netflix", "watch at home"), provide OTT platform info from the catalog. Mention platform names like Netflix, Prime Video, Hotstar, etc.
14. You CAN recommend movies NOT currently playing in theatres — use TMDB data for these. For non-playing movies, do NOT include showtimeId or movieId. Instead provide the TMDB_ID and OTT info.
15. If asked for general movie recommendations (not specific to theatres), mix both currently playing AND TMDB movies based on what fits best.

CURRENTLY PLAYING IN THEATRES (bookable):
${movieCatalog}

${tmdbCatalog ? `TMDB TRENDING MOVIES (not in theatres — OTT/streaming only):\n${tmdbCatalog}` : ""}

${tmdbSearchCatalog ? `TMDB SEARCH RESULTS (not in theatres — OTT/streaming only):\n${tmdbSearchCatalog}` : ""}

${profileSummary}

RESPONSE FORMAT — You MUST respond with valid JSON only, no markdown:
{
  "message": "Your conversational response here",
  "recommendations": [
    {
      "movieId": "the exact MongoDB _id from the CURRENTLY PLAYING catalog (24-char hex) — ONLY for playing movies, omit for OTT",
      "title": "Movie Title",
      "showtimeId": "the exact ShowtimeID from the catalog (24-char hex) — ONLY for playing movies, omit for OTT",
      "theater": "Theater Name (for playing movies) or OTT platform name (for streaming movies)",
      "time": "Show time (for playing movies) or omit for OTT",
      "date": "Show date (for playing movies) or omit for OTT",
      "reason": "Brief reason for this pick",
      "tmdbId": "TMDB_ID string if this is a non-playing movie from TMDB catalog, omit for playing movies",
      "isOTT": false,
      "ottPlatforms": "Comma-separated OTT platforms if available (e.g., 'Netflix, Prime Video'), empty string if none"
    }
  ]
}

Set "isOTT": true for movies only available on streaming. Set "isOTT": false for currently playing movies.
If the user is just chatting (greeting, thank you, etc.), return recommendations as an empty array.
Always return valid JSON. Never include markdown backticks or other formatting around the JSON.`;

        // Try models in order — fallback if rate-limited
        const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
        let responseText = null;
        let lastErr = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`Trying model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                // Build chat history: system prompt + previous conversation
                const chatHistory = [
                    { role: "user", parts: [{ text: systemPrompt }] },
                    { role: "model", parts: [{ text: '{"message": "Ready to help!", "recommendations": []}' }] },
                ];

                // Add previous conversation turns for context continuity
                if (history && Array.isArray(history) && history.length > 1) {
                    // Skip the last message (it's the current one we'll send via sendMessage)
                    const pastMessages = history.slice(0, -1);
                    for (const msg of pastMessages) {
                        chatHistory.push({
                            role: msg.role === "user" ? "user" : "model",
                            parts: [{ text: msg.text || "..." }]
                        });
                    }
                }

                const chat = model.startChat({ history: chatHistory });
                const result = await chat.sendMessage(message);
                responseText = result.response.text().trim();
                console.log(`Success with model: ${modelName}`);
                break; // success — stop trying
            } catch (modelErr) {
                console.error(`Model ${modelName} failed:`, modelErr.message?.substring(0, 200));
                lastErr = modelErr;
                if (!modelErr.message?.includes("429") && !modelErr.message?.includes("quota") && !modelErr.message?.includes("404")) {
                    throw modelErr; // non-rate-limit/not-found error — don't retry
                }
                // rate-limited or model not found — try next model
            }
        }

        if (!responseText) {
            throw lastErr || new Error("All models rate-limited");
        }

        // 4. Parse Gemini response (handle potential markdown wrapping)
        let parsed;
        try {
            // Strip markdown code fences if present
            let clean = responseText;
            if (clean.startsWith("```")) {
                clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
            }
            parsed = JSON.parse(clean);
        } catch (parseErr) {
            console.error("Gemini response parse error:", parseErr.message);
            console.error("Raw response:", responseText);
            // Fallback: return just the text
            parsed = {
                message: responseText.substring(0, 500),
                recommendations: []
            };
        }

        // 5. Validate movieIds and showtimeIds exist in our DB
        if (parsed.recommendations && parsed.recommendations.length > 0) {
            const validMovieIds = movies.map(m => m._id.toString());
            const validShowtimeIds = showtimes.map(st => st._id.toString());

            // Separate OTT and theatre recommendations
            const validRecs = [];
            for (const rec of parsed.recommendations) {
                // OTT recommendations — keep as-is (no DB validation needed)
                if (rec.isOTT || rec.tmdbId) {
                    rec.isOTT = true;
                    // Build poster URL from TMDB ID if not present
                    if (!rec.posterUrl && rec.tmdbId) {
                        rec.posterUrl = `https://image.tmdb.org/t/p/w500/${rec.tmdbId}`;
                    }
                    validRecs.push(rec);
                    continue;
                }

                // Theatre recommendations — validate movieId
                if (!rec.movieId || !validMovieIds.includes(rec.movieId)) continue;

                // Validate showtimeId
                if (rec.showtimeId && !validShowtimeIds.includes(rec.showtimeId)) {
                    console.warn(`Invalid showtimeId from Gemini: "${rec.showtimeId}" — removing`);
                    delete rec.showtimeId;
                }

                // Attach poster URLs from DB
                const movie = movies.find(m => m._id.toString() === rec.movieId);
                if (movie) {
                    rec.posterUrl = movie.posterUrl;
                    rec.rating = movie.rating;
                    rec.genre = movie.genre;
                }

                // If no valid showtimeId, try to find a matching one
                if (!rec.showtimeId && rec.movieId) {
                    const matchingSt = showtimes.find(st =>
                        st.movie.toString() === rec.movieId &&
                        (!rec.date || st.date === rec.date) &&
                        (!rec.time || st.time === rec.time)
                    );
                    if (matchingSt) {
                        rec.showtimeId = matchingSt._id.toString();
                    }
                }

                rec.isOTT = false;
                validRecs.push(rec);
            }
            parsed.recommendations = validRecs;
        }

        res.json(parsed);

    } catch (err) {
        console.error("AI Chat error:", err.message);
        if (err.message?.includes("API_KEY")) {
            return res.status(500).json({ msg: "Gemini API key is invalid. Check your GEMINI_API_KEY in .env" });
        }
        if (err.message?.includes("429") || err.message?.includes("quota")) {
            return res.status(429).json({ msg: "AI quota limit reached. Please wait a minute and try again, or generate a new API key at aistudio.google.com/apikey" });
        }
        res.status(500).json({ msg: "AI assistant is temporarily unavailable. Please try again." });
    }
};
