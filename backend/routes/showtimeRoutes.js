const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    addShowtime,
    getAllShowtimes,
    getShowtimesByMovie,
    getShowtimeById,
    updateShowtime,
    deleteShowtime
} = require("../controllers/showtimeController");

// Public routes
router.get("/", getAllShowtimes);                       // GET    /api/showtimes
router.get("/movie/:movieId", getShowtimesByMovie);    // GET    /api/showtimes/movie/:movieId
router.get("/:id", getShowtimeById);                   // GET    /api/showtimes/:id

// Protected routes (admin use)
router.post("/", authMiddleware, addShowtime);            // POST   /api/showtimes
router.put("/:id", authMiddleware, updateShowtime);       // PUT    /api/showtimes/:id
router.delete("/:id", authMiddleware, deleteShowtime);    // DELETE /api/showtimes/:id

module.exports = router;
