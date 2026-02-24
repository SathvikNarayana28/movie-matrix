const Movie = require("../models/Movie");

// ADD A NEW MOVIE (Admin use)
exports.addMovie = async (req, res) => {
    try {
        const { title, genre, language, duration, releaseDate, rating, description, posterUrl, trailerUrl, cast, director, nowShowing } = req.body;

        const movie = new Movie({
            title,
            genre,
            language,
            duration,
            releaseDate,
            rating,
            description,
            posterUrl,
            trailerUrl,
            cast,
            director,
            nowShowing
        });

        await movie.save();
        res.status(201).json({ msg: "Movie added successfully", movie });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET ALL MOVIES
exports.getAllMovies = async (req, res) => {
    try {
        const movies = await Movie.find();
        res.json(movies);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// GET A SINGLE MOVIE BY ID
exports.getMovieById = async (req, res) => {
    try {
        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return res.status(404).json({ msg: "Movie not found" });
        }

        res.json(movie);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// UPDATE A MOVIE
exports.updateMovie = async (req, res) => {
    try {
        const movie = await Movie.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }   // return the updated document
        );

        if (!movie) {
            return res.status(404).json({ msg: "Movie not found" });
        }

        res.json({ msg: "Movie updated successfully", movie });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};

// DELETE A MOVIE
exports.deleteMovie = async (req, res) => {
    try {
        const movie = await Movie.findByIdAndDelete(req.params.id);

        if (!movie) {
            return res.status(404).json({ msg: "Movie not found" });
        }

        res.json({ msg: "Movie deleted successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
};
