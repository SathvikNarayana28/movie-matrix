const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    addMovie,
    getAllMovies,
    getMovieById,
    updateMovie,
    deleteMovie,
    syncMoviesFromTMDB
} = require("../controllers/movieController");

// Public routes  - anyone can view movies
router.get("/", getAllMovies);           // GET    /api/movies
router.get("/sync", syncMoviesFromTMDB); // GET    /api/movies/sync  (fetch from TMDB)
router.get("/:id", getMovieById);       // GET    /api/movies/:id

// Protected routes - only logged-in users (later: admin only)
router.post("/", authMiddleware, addMovie);           // POST   /api/movies
router.put("/:id", authMiddleware, updateMovie);      // PUT    /api/movies/:id
router.delete("/:id", authMiddleware, deleteMovie);   // DELETE /api/movies/:id

module.exports = router;
