const Theater = require("../models/Theater");

// ADD A NEW THEATER
exports.addTheater = async (req, res) => {
    try {
        const { name, location, totalSeats } = req.body;

        const theater = new Theater({ name, location, totalSeats });
        await theater.save();

        res.status(201).json({ msg: "Theater added successfully", theater });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET ALL THEATERS
exports.getAllTheaters = async (req, res) => {
    try {
        const theaters = await Theater.find();
        res.json(theaters);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET SINGLE THEATER BY ID
exports.getTheaterById = async (req, res) => {
    try {
        const theater = await Theater.findById(req.params.id);

        if (!theater) {
            return res.status(404).json({ msg: "Theater not found" });
        }

        res.json(theater);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// UPDATE A THEATER
exports.updateTheater = async (req, res) => {
    try {
        const theater = await Theater.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!theater) {
            return res.status(404).json({ msg: "Theater not found" });
        }

        res.json({ msg: "Theater updated successfully", theater });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// DELETE A THEATER
exports.deleteTheater = async (req, res) => {
    try {
        const theater = await Theater.findByIdAndDelete(req.params.id);

        if (!theater) {
            return res.status(404).json({ msg: "Theater not found" });
        }

        res.json({ msg: "Theater deleted successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};
