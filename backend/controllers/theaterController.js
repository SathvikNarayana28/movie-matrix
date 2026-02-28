const Theater = require("../models/Theater");

// ADD A NEW THEATER
exports.addTheater = async (req, res) => {
    try {
        const { name, city, area, screens, totalSeatsPerScreen } = req.body;

        const theater = new Theater({ name, city, area, screens, totalSeatsPerScreen });
        await theater.save();

        res.status(201).json({ msg: "Theater added successfully", theater });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET ALL THEATERS (with optional city filter)
// GET /api/theaters?city=Hyderabad
exports.getAllTheaters = async (req, res) => {
    try {
        const filter = {};
        if (req.query.city) {
            // Case-insensitive match
            filter.city = { $regex: new RegExp(`^${req.query.city}$`, "i") };
        }

        const theaters = await Theater.find(filter);
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

// GET NEARBY THEATERS (by city, defaults to Hyderabad)
// GET /api/theaters/nearby?city=Hyderabad
exports.getNearbyTheaters = async (req, res) => {
    try {
        const city = req.query.city || "Hyderabad";

        const theaters = await Theater.find({
            city: { $regex: new RegExp(`^${city}$`, "i") }
        })
            .select("name city area screens")
            .sort({ area: 1 })
            .limit(6);

        res.json(theaters);
    } catch (err) {
        console.error("Error fetching nearby theaters:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
};
