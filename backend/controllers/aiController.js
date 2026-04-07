const { GoogleGenerativeAI } = require("@google/generative-ai");
const Movie = require("../models/Movie");
const Showtime = require("../models/Showtime");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { buildShowDateTime } = require("../utils/dateTime");
const { buildUserProfile } = require("../services/profileBuilder");
const { getRecommendations } = require("../services/recommendationEngine");
const { searchMovies, fetchTrending, fetchWatchProviders, fetchMovieDetails } = require("../services/tmdbService");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const aiCache = {
    movieContext: new Map(),
    tmdbTrending: new Map(),
    tmdbSearch: new Map(),
    tmdbDetails: new Map(),
    tmdbProviders: new Map()
};

const CACHE_TTL = {
    movieContext: 60 * 1000,
    tmdbTrending: 10 * 60 * 1000,
    tmdbSearch: 3 * 60 * 1000,
    tmdbDetails: 30 * 60 * 1000,
    tmdbProviders: 30 * 60 * 1000
};

function buildFallbackAiResponse(intent, userName) {
    if (intent === "booking") {
        return {
            message: `${userName}, I couldn't load the AI reply right now, but you can still check your bookings and ticket details from My Bookings.`,
            recommendations: [],
            actions: [{ label: "Open My Bookings", route: "/my-bookings", type: "navigate" }],
            quickReplies: ["Show my latest booking", "How do I cancel a booking?"]
        };
    }

    if (intent === "movie") {
        return {
            message: `${userName}, AI is temporarily slow, but you can still browse movies currently playing and book from the Home page.`,
            recommendations: [],
            actions: [{ label: "Browse Movies", route: "/", type: "navigate" }],
            quickReplies: ["Recommend an action movie", "What is playing tonight?"]
        };
    }

    return {
        message: `${userName}, AI is temporarily unavailable. You can still browse movies, bookings, and favorites normally in Movie Matrix.`,
        recommendations: [],
        actions: [],
        quickReplies: ["What can you do?", "Show movies playing now"]
    };
}

async function cachedGet(store, key, ttlMs, loader) {
    const cached = store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const value = await loader();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
}

function invalidateAiContextCache() {
    aiCache.movieContext.clear();
}

/**
 * Classify user intent to decide what context to fetch.
 * Returns: "movie" | "booking" | "app_help" | "general"
 */
function classifyIntent(message) {
    const msg = message.toLowerCase();

    // Booking-related
    const bookingKeywords = [
        "my booking", "my ticket", "cancel", "cancellation", "refund",
        "booked", "booking history", "past booking", "upcoming booking",
        "order", "receipt", "payment", "transaction", "how many tickets",
        "where are my tickets", "confirm", "confirmation", "e-ticket"
    ];
    if (bookingKeywords.some(k => msg.includes(k))) return "booking";

    // App help / navigation
    const appKeywords = [
        "how to", "how do i", "where is", "navigate", "find the",
        "sign up", "register", "login", "log in", "sign in", "password",
        "profile", "account", "settings", "favorite", "favourites", "wishlist",
        "delete account", "change password", "update profile", "edit profile",
        "what can you do", "help me", "features", "how does this work",
        "home page", "admin", "dashboard", "app", "website", "what is movie matrix",
        "book a ticket", "how to book", "seat selection", "payment method",
        "contact", "support", "bug", "not working", "error", "issue"
    ];
    if (appKeywords.some(k => msg.includes(k))) return "app_help";

    // Movie-related
    const movieKeywords = [
        "movie", "film", "watch", "suggest", "recommend", "genre", "thriller",
        "comedy", "action", "drama", "horror", "romance", "sci-fi", "animation",
        "telugu", "hindi", "english", "tamil", "bollywood", "hollywood", "tollywood",
        "director", "actor", "actress", "cast", "trailer", "rating", "review",
        "showtime", "theatre", "theater", "screen", "seat", "show", "playing",
        "now showing", "new release", "trending", "ott", "netflix", "prime",
        "hotstar", "streaming", "in the mood", "tonight", "weekend",
        "what should i watch", "something like", "similar to"
    ];
    if (movieKeywords.some(k => msg.includes(k))) return "movie";

    // If it's a short greeting or conversational
    const conversationalPatterns = [
        /^(hi|hey|hello|hola|yo|sup|good morning|good evening|good afternoon|good night)/,
        /^(thanks|thank you|thx|bye|goodbye|see you|ok|okay|cool|great|nice|awesome)/,
        /^(who are you|what are you|what's your name|your name)/,
        /\?$/ // ends with a question mark — could be general
    ];
    if (conversationalPatterns.some(p => p.test(msg))) return "general";

    // Default: treat as general (Gemini can handle anything)
    return "general";
}

/**
 * GET /api/ai/recommend
 * Returns personalized recommendations for the logged-in user
 */
exports.getRecommendations = async (req, res) => {
    try {
        const result = await getRecommendations(req.user.id, 8);
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

        // Classify intent to decide what data to fetch
        const intent = classifyIntent(message);
        console.log(`[AI Chat] Intent: ${intent} | Message: "${message.substring(0, 80)}"`);

        // Haversine distance helper
        const toRad = (deg) => deg * Math.PI / 180;
        const haversine = (lat1, lng1, lat2, lng2) => {
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        // 1. Build profile + fetch user details in parallel
        const [profile, currentUser] = await Promise.all([
            buildUserProfile(req.user.id),
            User.findById(req.user.id).select("name email role favorites").lean()
        ]);
        const userName = currentUser?.name || "User";

        // 3. Fetch booking info if booking-related or general (for context)
        let bookingsSummary = "";
        if (intent === "booking" || intent === "app_help") {
            try {
                const bookings = await Booking.find({ user: req.user.id })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate({
                        path: "showtime",
                        populate: [
                            { path: "movie", select: "title genre language posterUrl" },
                            { path: "theater", select: "name area city" }
                        ]
                    })
                    .lean();

                if (bookings.length > 0) {
                    bookingsSummary = bookings.map((b, i) => {
                        const movieTitle = b.showtime?.movie?.title || "Unknown Movie";
                        const theater = b.showtime?.theater?.name || "Unknown Theater";
                        const area = b.showtime?.theater?.area || "";
                        const date = b.showtime?.date || "N/A";
                        const time = b.showtime?.time || "N/A";
                        const seats = (b.seats || []).join(", ");
                        const status = b.status || "confirmed";
                        const price = b.totalPrice || 0;
                        const bookingDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN") : "N/A";
                        return `${i + 1}. "${movieTitle}" @ ${theater} (${area}) | Date: ${date} | Time: ${time} | Seats: ${seats} | ₹${price} | Status: ${status} | Booked on: ${bookingDate} | BookingID: ${b._id}`;
                    }).join("\n");
                } else {
                    bookingsSummary = "No bookings found.";
                }
            } catch (bookErr) {
                console.error("Booking fetch for AI failed:", bookErr.message);
                bookingsSummary = "Could not fetch booking data.";
            }
        }

        // 4. Get currently playing movies with showtimes (only for movie intent)
        let movieCatalog = "";
        let movies = [];
        let showtimes = [];
        const localTitles = new Set();

        if (intent === "movie" || intent === "general") {
            const movieContext = await cachedGet(aiCache.movieContext, "current_context", CACHE_TTL.movieContext, async () => {
                const today = new Date();
                const dates = [];
                for (let i = 0; i < 3; i++) {
                    const d = new Date(today);
                    d.setDate(today.getDate() + i);
                    dates.push(d.toISOString().split("T")[0]);
                }

                const contextMovies = await Movie.find({
                    $or: [
                        { status: "In Theatres" },
                        { nowShowing: true }
                    ]
                })
                    .select("title genre language rating cast director posterUrl")
                    .lean();

                const rawShowtimes = await Showtime.find({
                    date: { $in: dates },
                    movie: { $in: contextMovies.map(m => m._id) }
                })
                    .select("movie theater date time seats price")
                    .populate("theater", "name area city lat lng")
                    .lean();

                const now = new Date();
                const contextShowtimes = rawShowtimes.filter((st) => {
                    const showDateTime = buildShowDateTime(st.date, st.time);
                    return showDateTime && showDateTime > now;
                });

                return { movies: contextMovies, showtimes: contextShowtimes };
            });

            movies = movieContext.movies;
            showtimes = movieContext.showtimes;

            const showtimesByMovie = new Map();
            for (const st of showtimes) {
                const movieId = st.movie?.toString();
                if (!movieId) continue;
                if (!showtimesByMovie.has(movieId)) showtimesByMovie.set(movieId, []);
                showtimesByMovie.get(movieId).push(st);
            }

            for (const movie of movies) {
                localTitles.add(movie.title.toLowerCase());
            }

            movieCatalog = movies.map(m => {
                const movieShowtimes = showtimesByMovie.get(m._id.toString()) || [];

                const seenTheatres = new Set();
                const selectedShowtimes = [];
                for (const st of movieShowtimes) {
                    const theaterId = st.theater?._id?.toString();
                    if (!theaterId || seenTheatres.has(theaterId)) continue;
                    seenTheatres.add(theaterId);
                    selectedShowtimes.push(st);
                    if (selectedShowtimes.length >= 3) break;
                }

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
        }

        // Build user profile string
        const profileSummary = `
User: ${userName} (${currentUser?.email || "N/A"}) | Role: ${currentUser?.role || "user"}
Favorites: ${currentUser?.favorites?.length || 0} movies saved
Preferences (from booking history):
- Favorite genres: ${Object.entries(profile.genreWeights).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g, w]) => `${g} (${Math.round(w * 100)}%)`).join(", ") || "No history yet"}
- Favorite actors: ${Object.keys(profile.actorAffinities).slice(0, 3).join(", ") || "None yet"}
- Favorite directors: ${Object.keys(profile.directorAffinities).join(", ") || "None yet"}
- Preferred language: ${Object.entries(profile.languageWeights).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l]) => l).join(", ") || "Any"}
- Preferred time: ${profile.preferredTimeSlot} shows
- Frequently visits: ${profile.theaterPreferences.slice(0, 2).map(t => t.theaterName).join(", ") || "No theatre preference yet"}
- Total past bookings: ${profile.totalBookings}
`.trim();

        // 5. Fetch TMDB data (only for movie intent)
        let tmdbCatalog = "";
        let tmdbSearchCatalog = "";

        if (intent === "movie") {
            try {
                const trending = await cachedGet(aiCache.tmdbTrending, "weekly_trending", CACHE_TTL.tmdbTrending, () => fetchTrending());
                const tmdbOnly = trending.filter(t => !localTitles.has(t.title.toLowerCase()));

                const tmdbWithOTT = await Promise.all(
                    tmdbOnly.slice(0, 10).map(async (m) => {
                        try {
                            const [providers, details] = await Promise.all([
                                cachedGet(aiCache.tmdbProviders, `providers:${m.tmdbId}`, CACHE_TTL.tmdbProviders, () => fetchWatchProviders(m.tmdbId)),
                                cachedGet(aiCache.tmdbDetails, `details:${m.tmdbId}`, CACHE_TTL.tmdbDetails, () => fetchMovieDetails(m.tmdbId))
                            ]);
                            return { ...m, cast: details.cast || [], director: details.director || "", duration: details.duration || 0, trailerUrl: details.trailerUrl || "", ott: providers };
                        } catch { return { ...m, ott: [] }; }
                    })
                );

                if (tmdbWithOTT.length > 0) {
                    tmdbCatalog = tmdbWithOTT.map(m => {
                        const ottStr = m.ott.length > 0 ? m.ott.map(p => `${p.name} (${p.type})`).join(", ") : "No OTT info available";
                        return `- "${m.title}" [${(m.genre || []).join(", ")}] | ${m.language} | Rating: ${m.rating}/10 | Cast: ${(m.cast || []).slice(0, 3).join(", ")} | Director: ${m.director || "N/A"} | Released: ${m.releaseDate} | OTT: ${ottStr} | TMDB_ID: ${m.tmdbId}`;
                    }).join("\n");
                }
            } catch (tmdbErr) {
                console.error("TMDB trending fetch failed:", tmdbErr.message);
            }

            // Also search TMDB if user message looks like a specific movie query
            try {
                const userMsg = message.toLowerCase();
                const isMovieQuery = userMsg.includes("where can i watch") || userMsg.includes("ott") || userMsg.includes("streaming") ||
                    userMsg.includes("netflix") || userMsg.includes("prime") || userMsg.includes("hotstar") || userMsg.includes("available on") ||
                    userMsg.includes("watch online") || userMsg.includes("not in theatres") || userMsg.includes("not in theaters") ||
                    userMsg.includes("old movie") || userMsg.includes("recommend me");

                if (isMovieQuery || !movieCatalog.includes(message.split(" ").filter(w => w.length > 3)[0] || "")) {
                    const searchQuery = message.replace(/where can i watch|ott|streaming|available on|watch online/gi, "").trim();
                    const searchResults = await cachedGet(
                        aiCache.tmdbSearch,
                        `search:${searchQuery.toLowerCase()}`,
                        CACHE_TTL.tmdbSearch,
                        () => searchMovies(searchQuery)
                    );
                    const filteredSearch = searchResults
                        .filter(m => !localTitles.has(m.title.toLowerCase()))
                        .slice(0, 5);

                    if (filteredSearch.length > 0) {
                        const searchWithOTT = await Promise.all(
                            filteredSearch.map(async (m) => {
                                try {
                                    const [providers, details] = await Promise.all([
                                        cachedGet(aiCache.tmdbProviders, `providers:${m.tmdbId}`, CACHE_TTL.tmdbProviders, () => fetchWatchProviders(m.tmdbId)),
                                        cachedGet(aiCache.tmdbDetails, `details:${m.tmdbId}`, CACHE_TTL.tmdbDetails, () => fetchMovieDetails(m.tmdbId))
                                    ]);
                                    return { ...m, cast: details.cast || [], director: details.director || "", ott: providers };
                                } catch { return { ...m, ott: [] }; }
                            })
                        );
                        tmdbSearchCatalog = searchWithOTT.map(m => {
                            const ottStr = m.ott.length > 0 ? m.ott.map(p => `${p.name} (${p.type})`).join(", ") : "No OTT info available";
                            return `- "${m.title}" [${(m.genre || []).join(", ")}] | ${m.language} | Rating: ${m.rating}/10 | Cast: ${(m.cast || []).slice(0, 3).join(", ")} | Director: ${m.director || "N/A"} | Released: ${m.releaseDate} | OTT: ${ottStr} | TMDB_ID: ${m.tmdbId}`;
                        }).join("\n");
                    }
                }
            } catch (searchErr) {
                console.error("TMDB search for AI failed:", searchErr.message);
            }
        }

        // 6. Build system prompt based on intent
        const systemPrompt = `You are Movie Matrix AI, the in-app assistant for Movie Matrix in Hyderabad.

    GOALS:
    - Be accurate, concise, and helpful.
    - Prefer exact app data over guesses.
    - Keep most answers under 120 words unless the question needs more detail.
    - Use simple language and avoid filler.

    APP NAVIGATION GUIDE:
- Home page (/) — Browse all now-showing movies, filter by genre/language, search
- Movie details (/movie/:id) — View full details, cast, trailer, showtimes for a specific movie
- Book tickets (/book/:showtimeId) — Select seats and book tickets for a specific showtime
- My Bookings (/my-bookings) — View all past and upcoming bookings, cancel bookings
- Favorites (/favorites) — View saved/wishlisted movies
- Profile (/profile) — View and manage account details
- Admin Dashboard (/admin) — Admin-only area for managing movies, theatres, showtimes
- Login (/login) — Sign in to your account
- Register (/register) — Create a new account

    APP FEATURES:
- Users can search movies by title on the home page search bar
- Movies can be filtered by genre and language on the home page
- Users can add movies to favorites by clicking the heart icon on movie cards
- Booking flow: Select movie → Pick showtime → Choose seats → Pay → Get confirmation
- Seat selection shows real-time availability with color coding (available=green, booked=red, selected=blue)
- Seats are temporarily locked for 2 minutes during booking to prevent double-booking
- Users can cancel bookings from the My Bookings page
- Payment is handled through Razorpay payment gateway
- Booking confirmation is sent via email
- The AI chatbot (that's you!) is accessible via the floating 🤖 button

${intent === "movie" || intent === "general" ? `
MOVIE RESPONSE RULES:
1. For theatre bookings, ONLY recommend movies from the "CURRENTLY PLAYING" catalog. NEVER invent movies.
2. Base recommendations on the user's message + preference profile.
3. If suggesting a currently playing movie, mention one specific showtime.
4. Use the EXACT ShowtimeID and MovieID values from the catalog. Never invent IDs.
5. For OTT queries, use TMDB platform info if available.
6. For non-playing movies, do not include showtimeId or movieId.
7. If the request is vague, personalize using the profile.

CURRENTLY PLAYING IN THEATRES (bookable):
${movieCatalog || "No movies currently showing."}

${tmdbCatalog ? `TMDB TRENDING MOVIES (not in theatres — OTT/streaming only):\n${tmdbCatalog}` : ""}
${tmdbSearchCatalog ? `TMDB SEARCH RESULTS (not in theatres — OTT/streaming only):\n${tmdbSearchCatalog}` : ""}
` : ""}

${bookingsSummary ? `USER'S RECENT BOOKINGS:\n${bookingsSummary}` : ""}

${profileSummary}

RESPONSE FORMAT — return valid JSON only, no markdown:
{
    "message": "Main answer here.",
  "recommendations": [
    {
            "movieId": "exact MongoDB _id from CURRENTLY PLAYING catalog, omit for OTT",
      "title": "Movie Title",
            "showtimeId": "exact ShowtimeID from catalog, omit for OTT",
      "theater": "Theater Name or OTT platform",
      "time": "Show time (for playing movies) or omit for OTT",
      "date": "Show date (for playing movies) or omit for OTT",
      "reason": "Brief reason",
      "tmdbId": "TMDB_ID for non-playing movies, omit for playing",
      "isOTT": false,
      "ottPlatforms": "Comma-separated OTT platforms if available"
    }
  ],
  "actions": [
    {
      "label": "Button label text",
      "route": "/route-to-navigate-to",
      "type": "navigate"
    }
  ],
  "quickReplies": ["Suggested follow-up 1", "Suggested follow-up 2"]
}

RULES:
- recommendations must be [] when not relevant.
- actions can be [] when not needed.
- quickReplies should have 2 to 4 short follow-ups when possible.
- Set isOTT true only for streaming-only results.
- Answer general/app-help questions directly in message.
- Always return valid JSON without markdown fences.`;

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
                recommendations: [],
                actions: [],
                quickReplies: []
            };
        }

        // Ensure actions and quickReplies are arrays
        if (!Array.isArray(parsed.actions)) parsed.actions = [];
        if (!Array.isArray(parsed.quickReplies)) parsed.quickReplies = [];

        // Validate action routes
        const validRoutes = ["/", "/login", "/register", "/my-bookings", "/favorites", "/profile", "/admin"];
        parsed.actions = parsed.actions.filter(a => {
            if (a.type === "navigate") {
                return validRoutes.some(r => a.route === r || a.route?.startsWith("/movie/") || a.route?.startsWith("/book/"));
            }
            return a.type === "link" && a.route;
        });

        // 7. Validate movieIds and showtimeIds exist in our DB
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

        if (!parsed.message || typeof parsed.message !== "string") {
            parsed.message = buildFallbackAiResponse(intent, userName).message;
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
        res.status(200).json(buildFallbackAiResponse(classifyIntent(req.body?.message || ""), "User"));
    }
};

exports.invalidateAiContextCache = invalidateAiContextCache;
