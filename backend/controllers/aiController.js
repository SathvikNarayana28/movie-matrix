const { GoogleGenerativeAI } = require("@google/generative-ai");
const Movie = require("../models/Movie");
const Showtime = require("../models/Showtime");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { buildUserProfile } = require("../services/profileBuilder");
const { getRecommendations } = require("../services/recommendationEngine");
const { searchMovies, fetchTrending, fetchWatchProviders, fetchMovieDetails } = require("../services/tmdbService");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

        // 1. Build user profile (always — it's lightweight)
        const profile = await buildUserProfile(req.user.id);

        // 2. Fetch user details
        const currentUser = await User.findById(req.user.id).select("name email role favorites").lean();
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

        if (intent === "movie" || intent === "general") {
            const today = new Date();
            const dates = [];
            for (let i = 0; i < 3; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                dates.push(d.toISOString().split("T")[0]);
            }

            movies = await Movie.find({ nowShowing: true }).lean();
            showtimes = await Showtime.find({
                date: { $in: dates },
                movie: { $in: movies.map(m => m._id) }
            })
                .populate("theater", "name area city lat lng")
                .lean();

            // Build movie catalog string for the prompt
            movieCatalog = movies.map(m => {
                const movieShowtimes = showtimes.filter(st => st.movie.toString() === m._id.toString());

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
                const trending = await fetchTrending();
                const localTitles = new Set(movies.map(m => m.title.toLowerCase()));
                const tmdbOnly = trending.filter(t => !localTitles.has(t.title.toLowerCase()));

                const tmdbWithOTT = await Promise.all(
                    tmdbOnly.slice(0, 10).map(async (m) => {
                        try {
                            const providers = await fetchWatchProviders(m.tmdbId);
                            const details = await fetchMovieDetails(m.tmdbId);
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
        const systemPrompt = `You are Movie Matrix AI — a smart, friendly, and versatile assistant for the Movie Matrix theatre booking platform based in Hyderabad, India. You are NOT just a movie bot — you are a full-featured assistant who can help with ANYTHING.

YOUR CAPABILITIES:
1. **Movie Recommendations** — Suggest movies based on mood, genre, language, actors, etc. from currently playing + TMDB data.
2. **Booking Help** — Answer questions about user's bookings, how to book, cancel, view tickets.
3. **App Navigation** — Guide users to different pages and features of the Movie Matrix app.
4. **General Knowledge** — Answer ANY general question (science, history, math, trivia, coding, etc.) like a knowledgeable assistant.
5. **Entertainment & Fun** — Movie trivia, actor info, film history, fun facts, jokes, etc.
6. **Troubleshooting** — Help users with common issues on the platform.

PERSONALITY:
- Warm, helpful, and conversational
- Use the user's name (${userName}) occasionally to feel personal
- Be concise but thorough — 2-5 sentences for most replies, longer for complex questions
- Use emojis sparingly to add warmth

APP NAVIGATION GUIDE (for helping users navigate Movie Matrix):
- Home page (/) — Browse all now-showing movies, filter by genre/language, search
- Movie details (/movie/:id) — View full details, cast, trailer, showtimes for a specific movie
- Book tickets (/book/:showtimeId) — Select seats and book tickets for a specific showtime
- My Bookings (/my-bookings) — View all past and upcoming bookings, cancel bookings
- Favorites (/favorites) — View saved/wishlisted movies
- Profile (/profile) — View and manage account details
- Admin Dashboard (/admin) — Admin-only area for managing movies, theatres, showtimes
- Login (/login) — Sign in to your account
- Register (/register) — Create a new account

APP FEATURES KNOWLEDGE:
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
MOVIE RECOMMENDATION RULES:
1. For theatre bookings, ONLY recommend movies from the "CURRENTLY PLAYING" catalog. NEVER invent movies.
2. Base recommendations on the user's message + preference profile.
3. If suggesting a currently playing movie, mention a specific showtime (theatre, date, time, price).
4. CRITICAL: For showtimeId, use the EXACT ShowtimeID value from the catalog (24-char hex). NEVER make up IDs.
5. Show options from MULTIPLE DIFFERENT theatres (2-3 if available).
6. When distance info [X.X km away] is shown, PRIORITIZE nearer theatres.
7. For OTT/streaming queries, provide platform info from TMDB data.
8. For non-playing movies, do NOT include showtimeId or movieId — use tmdbId and OTT info.
9. If the user's request is vague, use their profile to personalize.

CURRENTLY PLAYING IN THEATRES (bookable):
${movieCatalog || "No movies currently showing."}

${tmdbCatalog ? `TMDB TRENDING MOVIES (not in theatres — OTT/streaming only):\n${tmdbCatalog}` : ""}
${tmdbSearchCatalog ? `TMDB SEARCH RESULTS (not in theatres — OTT/streaming only):\n${tmdbSearchCatalog}` : ""}
` : ""}

${bookingsSummary ? `USER'S RECENT BOOKINGS:\n${bookingsSummary}` : ""}

${profileSummary}

RESPONSE FORMAT — You MUST respond with valid JSON only, no markdown:
{
  "message": "Your conversational response here. For general knowledge, app help, or casual chat, just put your full answer here.",
  "recommendations": [
    {
      "movieId": "exact MongoDB _id from CURRENTLY PLAYING catalog (24-char hex) — ONLY for playing movies, omit for OTT",
      "title": "Movie Title",
      "showtimeId": "exact ShowtimeID from catalog (24-char hex) — ONLY for playing movies, omit for OTT",
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

IMPORTANT RULES FOR RESPONSE:
- "recommendations" should be an EMPTY array [] if no movie suggestions are relevant (e.g., for general chat, app help, knowledge questions).
- "actions" array is for suggesting navigation buttons. Include when guiding users to a page. Can be empty [].
  - type can be: "navigate" (go to a page), "link" (external URL)
  - For "navigate", route should be a valid app route like "/my-bookings", "/favorites", "/profile", etc.
- "quickReplies" are suggested follow-up messages the user might want to ask. Include 2-4 relevant ones. Can be empty [].
- Set "isOTT": true for streaming-only movies, false for currently playing.
- For general knowledge, trivia, math, science, coding, etc. — answer fully in the "message" field.
- If the user greets you, greet them back by name and suggest what you can help with.
- If the user asks what you can do, explain ALL your capabilities (not just movies).
- ALWAYS return valid JSON. Never include markdown backticks around the JSON.`;

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
