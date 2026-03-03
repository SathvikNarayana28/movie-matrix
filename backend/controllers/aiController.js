const { GoogleGenerativeAI } = require("@google/generative-ai");
const Movie = require("../models/Movie");
const Showtime = require("../models/Showtime");
const { buildUserProfile } = require("../services/profileBuilder");
const { getRecommendations } = require("../services/recommendationEngine");

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
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ msg: "Message is required" });
        }

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
            .populate("theater", "name area city")
            .lean();

        // Build movie catalog string for the prompt
        const movieCatalog = movies.map(m => {
            const movieShowtimes = showtimes.filter(st => st.movie.toString() === m._id.toString());
            const showtimeInfo = movieShowtimes.slice(0, 3).map(st => {
                const available = st.seats ? st.seats.filter(s => !s.isBooked).length : 0;
                return `${st.theater?.name} (${st.theater?.area}) on ${st.date} at ${st.time} — ${available} seats, ₹${st.price}`;
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

        // 3. Call Gemini
        const systemPrompt = `You are Movie Matrix's AI assistant — a friendly, knowledgeable movie recommendation chatbot for a theatre booking platform in Hyderabad, India.

RULES:
1. ONLY recommend movies from the catalog below. NEVER invent or hallucinate movies.
2. Base your recommendation on the user's message + their preference profile.
3. Be conversational, warm, and concise (2-4 sentences max for the message).
4. If suggesting a movie, mention a specific showtime (theatre, date, time, price).
5. If the user asks about a movie NOT in the catalog, say it's not currently showing and suggest a similar one from the catalog.
6. If the user's request is vague, use their profile to personalize suggestions.
7. For new users with no history, recommend top-rated movies.

CURRENTLY PLAYING MOVIES:
${movieCatalog}

${profileSummary}

RESPONSE FORMAT — You MUST respond with valid JSON only, no markdown:
{
  "message": "Your conversational response here",
  "recommendations": [
    {
      "movieId": "the MongoDB _id from the catalog",
      "title": "Movie Title",
      "showtimeId": "if mentioning a specific showtime",
      "theater": "Theater Name",
      "time": "Show time",
      "date": "Show date",
      "reason": "Brief reason for this pick"
    }
  ]
}

If the user is just chatting (greeting, thank you, etc.), return recommendations as an empty array.
Always return valid JSON. Never include markdown backticks or other formatting around the JSON.`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: '{"message": "Ready to help!", "recommendations": []}' }] },
            { role: "user", parts: [{ text: message }] }
        ]);

        const responseText = result.response.text().trim();

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

        // 5. Validate movieIds exist in our DB
        if (parsed.recommendations && parsed.recommendations.length > 0) {
            const validMovieIds = movies.map(m => m._id.toString());
            parsed.recommendations = parsed.recommendations.filter(
                r => r.movieId && validMovieIds.includes(r.movieId)
            );

            // Attach poster URLs
            for (const rec of parsed.recommendations) {
                const movie = movies.find(m => m._id.toString() === rec.movieId);
                if (movie) {
                    rec.posterUrl = movie.posterUrl;
                    rec.rating = movie.rating;
                    rec.genre = movie.genre;
                }
            }
        }

        res.json(parsed);

    } catch (err) {
        console.error("AI Chat error:", err.message);
        if (err.message?.includes("API_KEY")) {
            return res.status(500).json({ msg: "Gemini API key is invalid. Check your GEMINI_API_KEY in .env" });
        }
        res.status(500).json({ msg: "AI assistant is temporarily unavailable. Please try again." });
    }
};
