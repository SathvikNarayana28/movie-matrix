const mongoose = require("mongoose");
require("dotenv").config();
const Movie = require("./models/Movie");

const movies = [
    {
        tmdbId: "157336",
        title: "Interstellar",
        genre: ["Sci-Fi", "Drama"],
        language: "English",
        duration: 169,
        releaseDate: "2014-11-07",
        rating: 8.6,
        description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
        posterUrl: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=zSWdZVtXT7E",
        cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
        director: "Christopher Nolan",
        nowShowing: true
    },
    {
        tmdbId: "155",
        title: "The Dark Knight",
        genre: ["Action", "Crime", "Drama"],
        language: "English",
        duration: 152,
        releaseDate: "2008-07-18",
        rating: 9.0,
        description: "When the menace known as the Joker wreaks havoc on Gotham, Batman must face one of the greatest tests.",
        posterUrl: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=EXeTwQWrcwY",
        cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart"],
        director: "Christopher Nolan",
        nowShowing: true
    },
    {
        tmdbId: "27205",
        title: "Inception",
        genre: ["Action", "Sci-Fi", "Thriller"],
        language: "English",
        duration: 148,
        releaseDate: "2010-07-16",
        rating: 8.8,
        description: "A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea.",
        posterUrl: "https://image.tmdb.org/t/p/w500/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=YoHD9XEInc0",
        cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
        director: "Christopher Nolan",
        nowShowing: true
    },
    {
        tmdbId: "579974",
        title: "RRR",
        genre: ["Action", "Drama"],
        language: "Telugu",
        duration: 187,
        releaseDate: "2022-03-25",
        rating: 8.0,
        description: "A fictitious story about two Indian revolutionaries and their journey far away from home.",
        posterUrl: "https://image.tmdb.org/t/p/w500/nEufeZlyAOLqO2brrs0yeF1lgXO.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=f_vbAtFSEc0",
        cast: ["N.T. Rama Rao Jr.", "Ram Charan", "Alia Bhatt"],
        director: "S.S. Rajamouli",
        nowShowing: true
    },
    {
        tmdbId: "299534",
        title: "Avengers: Endgame",
        genre: ["Action", "Adventure", "Sci-Fi"],
        language: "English",
        duration: 181,
        releaseDate: "2019-04-26",
        rating: 8.4,
        description: "After the devastating events of Infinity War, the Avengers assemble once more to reverse Thanos' actions.",
        posterUrl: "https://image.tmdb.org/t/p/w500/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=TcMBFSGVi1c",
        cast: ["Robert Downey Jr.", "Chris Evans", "Scarlett Johansson"],
        director: "Anthony Russo, Joe Russo",
        nowShowing: true
    },
    {
        tmdbId: "350312",
        title: "Baahubali 2",
        genre: ["Action", "Drama"],
        language: "Telugu",
        duration: 167,
        releaseDate: "2017-04-28",
        rating: 8.2,
        description: "When Shiva learns about his heritage, he begins to look for answers. His story is juxtaposed with past events.",
        posterUrl: "https://image.tmdb.org/t/p/w500/21sC2assImQIYCEDA84Qh9d1RsK.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=G62HrubdD6o",
        cast: ["Prabhas", "Rana Daggubati", "Anushka Shetty"],
        director: "S.S. Rajamouli",
        nowShowing: true
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Remove old movies first
        await Movie.deleteMany({});
        console.log("Old movies cleared");

        // Insert new movies
        await Movie.insertMany(movies);
        console.log("6 movies added successfully!");

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
        mongoose.connection.close();
    }
}

seed();
