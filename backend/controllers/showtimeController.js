const Showtime = require("../models/Showtime");
const Theater = require("../models/Theater");
const { generateSeats } = require("../models/Showtime");

// ADD A NEW SHOWTIME (with auto-generated seats)
exports.addShowtime = async (req, res) => {
    try {
        const { movie, theater, date, time, price } = req.body;

        // Look up the theatre to get totalSeatsPerScreen
        const theaterDoc = await Theater.findById(theater);
        if (!theaterDoc) {
            return res.status(404).json({ msg: "Theater not found" });
        }

        const totalSeats = theaterDoc.totalSeatsPerScreen || 100;
        const seatsPerRow = 10;
        const rows = Math.ceil(totalSeats / seatsPerRow);
        const seats = generateSeats(rows, seatsPerRow);

        const showtime = new Showtime({
            movie,
            theater,
            date,
            time,
            price,
            seats
        });

        await showtime.save();
        res.status(201).json({ msg: "Showtime added successfully", showtime });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET ALL SHOWTIMES (with movie and theater names filled in)
exports.getAllShowtimes = async (req, res) => {
    try {
        const showtimes = await Showtime.find()
            .populate("movie", "title posterUrl language")     // fill in movie details
            .populate("theater", "name city area");            // fill in theater details

        res.json(showtimes);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET SHOWTIMES FOR A SPECIFIC MOVIE
exports.getShowtimesByMovie = async (req, res) => {
    try {
        const showtimes = await Showtime.find({ movie: req.params.movieId })
            .populate("movie", "title posterUrl language")
            .populate("theater", "name city area");

        res.json(showtimes);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET SINGLE SHOWTIME BY ID
exports.getShowtimeById = async (req, res) => {
    try {
        const showtime = await Showtime.findById(req.params.id)
            .populate("movie", "title posterUrl language")
            .populate("theater", "name city area");

        if (!showtime) {
            return res.status(404).json({ msg: "Showtime not found" });
        }

        res.json(showtime);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// UPDATE A SHOWTIME
exports.updateShowtime = async (req, res) => {
    try {
        const showtime = await Showtime.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!showtime) {
            return res.status(404).json({ msg: "Showtime not found" });
        }

        res.json({ msg: "Showtime updated successfully", showtime });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// DELETE A SHOWTIME
exports.deleteShowtime = async (req, res) => {
    try {
        const showtime = await Showtime.findByIdAndDelete(req.params.id);

        if (!showtime) {
            return res.status(404).json({ msg: "Showtime not found" });
        }

        res.json({ msg: "Showtime deleted successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};
