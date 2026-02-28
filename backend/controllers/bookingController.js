const Booking = require("../models/Booking");
const Showtime = require("../models/Showtime");

// LOCK SEATS — temporary 2-minute lock
exports.lockSeats = async (req, res) => {
    try {
        const { showtimeId, seats } = req.body;
        const userId = req.user.id;

        console.log("[LOCK] Request from user:", userId, "| Showtime:", showtimeId, "| Seats:", seats);

        if (!showtimeId || !seats || !Array.isArray(seats) || seats.length === 0) {
            return res.status(400).json({ msg: "showtimeId and seats array are required" });
        }

        // 1. Find show by ID
        const showtime = await Showtime.findById(showtimeId);
        if (!showtime) {
            return res.status(404).json({ msg: "Showtime not found" });
        }

        const now = new Date();

        // 2. Clean expired locks on ALL seats
        for (const seat of showtime.seats) {
            if (seat.isLocked === true && seat.lockExpiresAt && seat.lockExpiresAt < now) {
                console.log("[LOCK] Clearing expired lock on seat:", seat.seatId);
                seat.isLocked = false;
                seat.lockedBy = null;
                seat.lockExpiresAt = null;
            }
        }

        // 3. Validate each requested seat
        for (const seatId of seats) {
            const seatObj = showtime.seats.find(s => s.seatId === seatId);

            if (!seatObj) {
                return res.status(400).json({ msg: `Seat ${seatId} does not exist in this show` });
            }

            if (seatObj.isBooked === true) {
                return res.status(400).json({ msg: `Seat ${seatId} is already booked` });
            }

            if (
                seatObj.isLocked === true &&
                String(seatObj.lockedBy) !== String(userId) &&
                seatObj.lockExpiresAt > now
            ) {
                return res.status(400).json({ msg: `Seat ${seatId} is temporarily held by another user` });
            }
        }

        // 4. Lock the requested seats
        const lockExpiry = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes

        for (const seatId of seats) {
            const seatObj = showtime.seats.find(s => s.seatId === seatId);
            seatObj.isLocked = true;
            seatObj.lockedBy = userId;
            seatObj.lockExpiresAt = lockExpiry;
        }

        // 5. Mark nested array as modified and save
        showtime.markModified("seats");
        await showtime.save();

        console.log("[LOCK] SUCCESS — locked seats:", seats, "| expires:", lockExpiry);
        res.json({ msg: "Seats locked successfully", lockExpiresAt: lockExpiry });

    } catch (err) {
        console.error("[LOCK] ERROR:", err.message);
        console.error("[LOCK] Stack:", err.stack);
        res.status(500).json({ msg: "Lock failed: " + err.message });
    }
};

// UNLOCK SEATS — manually release locks (e.g. user deselects or navigates away)
exports.unlockSeats = async (req, res) => {
    try {
        const { showtimeId } = req.body;
        const userId = req.user.id;

        const showtime = await Showtime.findById(showtimeId);
        if (!showtime) {
            return res.status(404).json({ msg: "Showtime not found" });
        }

        for (const seat of showtime.seats) {
            if (seat.isLocked && String(seat.lockedBy) === String(userId)) {
                seat.isLocked = false;
                seat.lockedBy = null;
                seat.lockExpiresAt = null;
            }
        }

        showtime.markModified("seats");
        await showtime.save();
        res.json({ msg: "Seats unlocked" });

    } catch (err) {
        console.error("Unlock seats error:", err.message);
        res.status(500).json({ msg: "Unlock failed: " + err.message });
    }
};

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

        // Release expired locks first (in-memory, persisted by save below)
        const now = new Date();
        for (const seat of showtime.seats) {
            if (seat.isLocked === true && seat.lockExpiresAt && seat.lockExpiresAt < now) {
                seat.isLocked = false;
                seat.lockedBy = null;
                seat.lockExpiresAt = null;
            }
        }

        // 2. Check if any requested seats are already booked or locked by others
        const conflictSeats = [];
        for (const seatId of seats) {
            const seatObj = showtime.seats.find(s => s.seatId === seatId);
            if (!seatObj) {
                return res.status(400).json({ msg: `Seat ${seatId} does not exist in this show` });
            }
            if (seatObj.isBooked) {
                conflictSeats.push(seatId);
            } else if (seatObj.isLocked && seatObj.lockExpiresAt > now && String(seatObj.lockedBy) !== String(req.user.id)) {
                return res.status(400).json({ msg: `Seat ${seatId} is held by another user. Please wait.` });
            }
        }

        if (conflictSeats.length > 0) {
            return res.status(400).json({
                msg: `Seats already booked: ${conflictSeats.join(", ")}`
            });
        }

        // 3. Calculate total price
        const totalPrice = seats.length * showtime.price;

        // 4. Create the booking
        const booking = new Booking({
            user: req.user.id,
            showtime: showtimeId,
            seats,
            totalPrice
        });

        await booking.save();

        // 5. Mark seats as booked and clear locks in the showtime
        for (const seatId of seats) {
            const seatObj = showtime.seats.find(s => s.seatId === seatId);
            if (seatObj) {
                seatObj.isBooked = true;
                seatObj.isLocked = false;
                seatObj.lockedBy = null;
                seatObj.lockExpiresAt = null;
            }
        }

        showtime.markModified("seats");
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
                    { path: "movie", select: "title posterUrl language genre rating duration" },
                    { path: "theater", select: "name city area screens" }
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

        // Check if show has already started
        const showtime = await Showtime.findById(booking.showtime);
        if (showtime) {
            const showDateStr = showtime.date
                ? new Date(showtime.date).toISOString().split("T")[0]
                : "";
            const showTimeStr = showtime.time || "00:00";
            const showStart = new Date(`${showDateStr}T${showTimeStr}`);
            if (new Date() >= showStart) {
                return res.status(400).json({ msg: "Cannot cancel — the show has already started" });
            }
        }

        // 1. Mark booking as cancelled
        booking.status = "cancelled";
        await booking.save();

        // 2. Mark seats as available again in the showtime
        if (showtime) {
            for (const seatId of booking.seats) {
                const seatObj = showtime.seats.find(s => s.seatId === seatId);
                if (seatObj) seatObj.isBooked = false;
            }
            showtime.markModified("seats");
            await showtime.save();
        }

        res.json({ msg: "Booking cancelled successfully", booking });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET BOOKED SEATS FOR A SHOWTIME (used by frontend to show seat status)
exports.getBookedSeats = async (req, res) => {
    try {
        const showtime = await Showtime.findById(req.params.showtimeId);
        if (!showtime) {
            return res.status(404).json({ msg: "Showtime not found" });
        }

        // No need to call releaseExpiredLocks here — the lockedSeats filter
        // already checks lockExpiresAt > now, so expired locks are excluded.
        // (We don't save here, so in-memory mutation would be pointless.)

        // Return seats that are booked, and seats that are currently locked
        const bookedSeats = showtime.seats
            .filter(s => s.isBooked)
            .map(s => s.seatId);

        const now = new Date();
        const lockedSeats = showtime.seats
            .filter(s => s.isLocked && s.lockExpiresAt > now)
            .map(s => ({
                seatId: s.seatId,
                lockedBy: s.lockedBy ? s.lockedBy.toString() : null
            }));

        res.json({ bookedSeats, lockedSeats });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};
