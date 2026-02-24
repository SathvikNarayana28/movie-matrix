const Booking = require("../models/Booking");
const Showtime = require("../models/Showtime");

// BOOK TICKETS
exports.bookTickets = async (req, res) => {
    try {
        const { showtimeId, seats } = req.body;
        // req.user.id comes from the JWT auth middleware

        // 1. Find the showtime
        const showtime = await Showtime.findById(showtimeId);
        if (!showtime) {
            return res.status(404).json({ msg: "Showtime not found" });
        }

        // 2. Check if enough seats are available
        if (seats.length > showtime.availableSeats) {
            return res.status(400).json({
                msg: `Only ${showtime.availableSeats} seats available, but you requested ${seats.length}`
            });
        }

        // 3. Check if any of the requested seats are already booked
        const existingBookings = await Booking.find({
            showtime: showtimeId,
            status: "confirmed"
        });

        // Collect all seats that are already booked for this showtime
        const alreadyBookedSeats = [];
        existingBookings.forEach(booking => {
            booking.seats.forEach(seat => {
                alreadyBookedSeats.push(seat);
            });
        });

        // Check for conflicts
        const conflictSeats = seats.filter(seat => alreadyBookedSeats.includes(seat));
        if (conflictSeats.length > 0) {
            return res.status(400).json({
                msg: `Seats already booked: ${conflictSeats.join(", ")}`
            });
        }

        // 4. Calculate total price
        const totalPrice = seats.length * showtime.price;

        // 5. Create the booking
        const booking = new Booking({
            user: req.user.id,
            showtime: showtimeId,
            seats,
            totalPrice
        });

        await booking.save();

        // 6. Reduce available seats in the showtime
        showtime.availableSeats = showtime.availableSeats - seats.length;
        await showtime.save();

        res.status(201).json({ msg: "Booking confirmed!", booking });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET ALL BOOKINGS OF THE LOGGED-IN USER
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user.id })
            .populate({
                path: "showtime",
                populate: [
                    { path: "movie", select: "title posterUrl language" },
                    { path: "theater", select: "name location" }
                ]
            })
            .sort({ createdAt: -1 });   // newest bookings first

        res.json(bookings);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// CANCEL A BOOKING
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ msg: "Booking not found" });
        }

        // Make sure the user can only cancel their own booking
        if (booking.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized to cancel this booking" });
        }

        if (booking.status === "cancelled") {
            return res.status(400).json({ msg: "Booking is already cancelled" });
        }

        // 1. Mark booking as cancelled
        booking.status = "cancelled";
        await booking.save();

        // 2. Add the seats back to the showtime
        const showtime = await Showtime.findById(booking.showtime);
        if (showtime) {
            showtime.availableSeats = showtime.availableSeats + booking.seats.length;
            await showtime.save();
        }

        res.json({ msg: "Booking cancelled successfully", booking });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET BOOKED SEATS FOR A SHOWTIME (used by frontend to disable taken seats)
exports.getBookedSeats = async (req, res) => {
    try {
        const bookings = await Booking.find({
            showtime: req.params.showtimeId,
            status: "confirmed"
        });

        const bookedSeats = [];
        bookings.forEach(booking => {
            booking.seats.forEach(seat => {
                bookedSeats.push(seat);
            });
        });

        res.json({ bookedSeats });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};
