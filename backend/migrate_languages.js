// migrate_languages.js
// -------------------------------------------------------
// One-time migration script to convert short language codes
// (EN, HI, TE, etc.) stored in existing movies to full names
// (English, Hindi, Telugu, etc.)
//
// Usage:  node migrate_languages.js
// -------------------------------------------------------

const mongoose = require("mongoose");
require("dotenv").config();

const Movie = require("./models/Movie");

// Map uppercase short codes → full names
const CODE_TO_NAME = {
    EN: "English",
    HI: "Hindi",
    TE: "Telugu",
    TA: "Tamil",
    KN: "Kannada",
    ML: "Malayalam",
    MR: "Marathi",
    BN: "Bengali",
    PA: "Punjabi",
    GU: "Gujarati",
    UR: "Urdu",
    KO: "Korean",
    JA: "Japanese",
    ZH: "Chinese",
    FR: "French",
    ES: "Spanish",
    DE: "German",
    IT: "Italian",
    PT: "Portuguese",
    RU: "Russian"
};

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const movies = await Movie.find({});
        console.log(`Found ${movies.length} movies in database`);

        let updated = 0;
        let skipped = 0;

        for (const movie of movies) {
            const current = (movie.language || "").trim();
            const upper = current.toUpperCase();

            if (CODE_TO_NAME[upper]) {
                movie.language = CODE_TO_NAME[upper];
                await movie.save();
                updated++;
                console.log(`  ✔ ${movie.title}: "${current}" → "${movie.language}"`);
            } else if (current.length <= 3) {
                // Short code not in our map — set to "Other"
                movie.language = "Other";
                await movie.save();
                updated++;
                console.log(`  ✔ ${movie.title}: "${current}" → "Other"`);
            } else {
                // Already a full name — skip
                skipped++;
            }
        }

        console.log(`\nMigration complete: ${updated} updated, ${skipped} skipped`);
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
}

migrate();
