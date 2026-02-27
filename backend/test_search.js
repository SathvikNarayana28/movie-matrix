// Temporary test script — delete after debugging
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 }).then(async () => {
    console.log('DB connected');
    const Movie = require('./models/Movie');
    const { searchMovies, fetchMovieDetails } = require('./services/tmdbService');

    const search = 'batman';
    const regex = new RegExp(search, 'i');
    const localMovies = await Movie.find({
        $or: [{ title: regex }, { genre: regex }, { language: regex }]
    });
    console.log('Step 2 - Local results:', localMovies.length);

    if (localMovies.length === 0) {
        console.log('Step 3 - Calling TMDB search...');
        try {
            const tmdbResults = await searchMovies(search);
            console.log('TMDB returned:', tmdbResults.length, 'movies');
            if (tmdbResults.length > 0) {
                console.log('First:', tmdbResults[0].title, '| tmdbId:', tmdbResults[0].tmdbId);
                const m = tmdbResults[0];
                const exists = await Movie.findOne({ tmdbId: m.tmdbId });
                console.log('Already in DB?', !!exists);
                if (!exists) {
                    try {
                        const details = await fetchMovieDetails(m.tmdbId);
                        m.duration = details.duration;
                        m.cast = details.cast;
                        m.director = details.director;
                        m.trailerUrl = details.trailerUrl;
                        if (details.genre.length > 0) m.genre = details.genre;
                    } catch(de) { console.log('Detail err:', de.message); }
                    const movie = new Movie(m);
                    await movie.save();
                    console.log('SAVED! _id:', movie._id);
                }
            }
        } catch (e) {
            console.error('searchMovies FAILED:', e.message);
            if (e.response) console.error('HTTP:', e.response.status, e.response.data);
        }
    }
    await mongoose.disconnect();
    console.log('Done.');
}).catch(e => console.error('DB Error:', e.message));
