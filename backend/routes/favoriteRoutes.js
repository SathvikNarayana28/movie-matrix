const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    toggleFavorite,
    getMyFavorites
} = require("../controllers/favoriteController");

// All favorite routes need login
router.put("/:movieId", authMiddleware, toggleFavorite);    // PUT  /api/favorites/:movieId  (toggle)
router.get("/", authMiddleware, getMyFavorites);            // GET  /api/favorites           (list)

module.exports = router;
