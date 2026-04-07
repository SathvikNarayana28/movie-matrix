const Theater = require("../models/Theater");
const { escapeRegex } = require("../utils/escapeRegex");

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
            filter.city = { $regex: new RegExp(`^${escapeRegex(req.query.city)}$`, "i") };
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

// GET NEARBY THEATERS sorted by distance from user
// GET /api/theaters/nearby?lat=17.44&lng=78.35&city=Hyderabad
exports.getNearbyTheaters = async (req, res) => {
    try {
        const city = req.query.city || "Hyderabad";
        const userLat = parseFloat(req.query.lat);
        const userLng = parseFloat(req.query.lng);

        const theaters = await Theater.find({
            city: { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") }
        }).lean();

        if (!isNaN(userLat) && !isNaN(userLng)) {
            // Haversine distance calculation
            const toRad = (deg) => deg * Math.PI / 180;
            const haversine = (lat1, lng1, lat2, lng2) => {
                const R = 6371; // Earth radius in km
                const dLat = toRad(lat2 - lat1);
                const dLng = toRad(lng2 - lng1);
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            };

            theaters.forEach(t => {
                if (t.lat && t.lng) {
                    t.distance = Math.round(haversine(userLat, userLng, t.lat, t.lng) * 10) / 10;
                } else {
                    t.distance = 999;
                }
            });
            theaters.sort((a, b) => a.distance - b.distance);
        } else {
            theaters.sort((a, b) => (a.area || "").localeCompare(b.area || ""));
        }

        res.json(theaters);
    } catch (err) {
        console.error("Error fetching nearby theaters:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
};
