const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    addTheater,
    getAllTheaters,
    getTheaterById,
    updateTheater,
    deleteTheater
} = require("../controllers/theaterController");

// Public routes
router.get("/", getAllTheaters);            // GET    /api/theaters
router.get("/:id", getTheaterById);        // GET    /api/theaters/:id

// Protected routes (admin use)
router.post("/", authMiddleware, addTheater);            // POST   /api/theaters
router.put("/:id", authMiddleware, updateTheater);       // PUT    /api/theaters/:id
router.delete("/:id", authMiddleware, deleteTheater);    // DELETE /api/theaters/:id

module.exports = router;
