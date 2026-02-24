const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    bookTickets,
    getMyBookings,
    cancelBooking,
    getBookedSeats
} = require("../controllers/bookingController");

// All booking routes need login (authMiddleware)
router.post("/", authMiddleware, bookTickets);                           // POST   /api/bookings
router.get("/my", authMiddleware, getMyBookings);                        // GET    /api/bookings/my
router.put("/cancel/:id", authMiddleware, cancelBooking);                // PUT    /api/bookings/cancel/:id

// Public - frontend needs this to show which seats are taken
router.get("/seats/:showtimeId", getBookedSeats);                        // GET    /api/bookings/seats/:showtimeId

module.exports = router;
