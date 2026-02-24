const mongoose = require("mongoose");
require("dotenv").config();
const Movie = require("./models/Movie");

const movies = [
    {
        title: "Interstellar",
        genre: ["Sci-Fi", "Drama"],
        language: "English",
        duration: 169,
        releaseDate: "2014-11-07",
        rating: 8.6,
        description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
        posterUrl: "https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=zSWdZVtXT7E",
        cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
        director: "Christopher Nolan",
        nowShowing: true
    },
    {
        title: "The Dark Knight",
        genre: ["Action", "Crime", "Drama"],
        language: "English",
        duration: 152,
        releaseDate: "2008-07-18",
        rating: 9.0,
        description: "When the menace known as the Joker wreaks havoc on Gotham, Batman must face one of the greatest tests.",
        posterUrl: "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=EXeTwQWrcwY",
        cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart"],
        director: "Christopher Nolan",
        nowShowing: true
    },
    {
        title: "Inception",
        genre: ["Action", "Sci-Fi", "Thriller"],
        language: "English",
        duration: 148,
        releaseDate: "2010-07-16",
        rating: 8.8,
        description: "A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea.",
        posterUrl: "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=YoHD9XEInc0",
        cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
        director: "Christopher Nolan",
        nowShowing: true
    },
    {
        title: "RRR",
        genre: ["Action", "Drama"],
        language: "Telugu",
        duration: 187,
        releaseDate: "2022-03-25",
        rating: 8.0,
        description: "A fictitious story about two Indian revolutionaries and their journey far away from home.",
        posterUrl: "https://m.media-amazon.com/images/M/MV5BOGEzYzcxYjAtZmZiNi00YzI0LWIyY2QtMTczMWQ1MGJmYTBhXkEyXkFqcGc@._V1_.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=f_vbAtFSEc0",
        cast: ["N.T. Rama Rao Jr.", "Ram Charan", "Alia Bhatt"],
        director: "S.S. Rajamouli",
        nowShowing: true
    },
    {
        title: "Avengers: Endgame",
        genre: ["Action", "Adventure", "Sci-Fi"],
        language: "English",
        duration: 181,
        releaseDate: "2019-04-26",
        rating: 8.4,
        description: "After the devastating events of Infinity War, the Avengers assemble once more to reverse Thanos' actions.",
        posterUrl: "https://m.media-amazon.com/images/M/MV5BMTc5MDE2ODcwNV5BMl5BanBnXkFtZTgwMzI2NzQ2NzM@._V1_.jpg",
        trailerUrl: "https://www.youtube.com/watch?v=TcMBFSGVi1c",
        cast: ["Robert Downey Jr.", "Chris Evans", "Scarlett Johansson"],
        director: "Anthony Russo, Joe Russo",
        nowShowing: true
    },
    {
        title: "Baahubali 2",
        genre: ["Action", "Drama"],
        language: "Telugu",
        duration: 167,
        releaseDate: "2017-04-28",
        rating: 8.2,
        description: "When Shiva learns about his heritage, he begins to look for answers. His story is juxtaposed with past events.",
        posterUrl: "https://m.media-amazon.com/images/M/MV5BOGRmOGMxMmItZTBhYi00NzliLTlkZWUtYmNiY2VmNjE3MjUxXkEyXkFqcGc@._V1_.jpg",
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
