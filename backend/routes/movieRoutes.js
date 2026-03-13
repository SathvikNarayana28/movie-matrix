const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    addMovie,
    getAllMovies,
    getMovieById,
    updateMovie,
    deleteMovie,
    syncMoviesFromTMDB,
    getGenres,
    getLanguages,
    getTrailer,
    getSuggestions,
    getNewReleases,
    getOttProviders
} = require("../controllers/movieController");

// Public routes  - anyone can view movies
router.get("/", getAllMovies);                // GET    /api/movies
router.get("/genres", getGenres);             // GET    /api/movies/genres
router.get("/languages", getLanguages);       // GET    /api/movies/languages
router.get("/suggestions", getSuggestions);   // GET    /api/movies/suggestions?query=...
router.get("/new-releases", getNewReleases);  // GET    /api/movies/new-releases
router.get("/sync", syncMoviesFromTMDB);      // GET    /api/movies/sync
router.get("/:id/trailer", getTrailer);       // GET    /api/movies/:id/trailer
router.get("/:id/ott", getOttProviders);        // GET    /api/movies/:id/ott
router.get("/:id", getMovieById);            // GET    /api/movies/:id

// Protected routes - only logged-in users (later: admin only)
router.post("/", authMiddleware, addMovie);           // POST   /api/movies
router.put("/:id", authMiddleware, updateMovie);      // PUT    /api/movies/:id
router.delete("/:id", authMiddleware, deleteMovie);   // DELETE /api/movies/:id

module.exports = router;
