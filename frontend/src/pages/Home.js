import React, { useState, useEffect } from "react";
import API from "../api";
import MovieCard from "../components/MovieCard";
import "./Home.css";

function Home() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMovies = async () => {
            try {
                const res = await API.get("/movies");
                setMovies(res.data);
            } catch (err) {
                console.error("Error fetching movies:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMovies();
    }, []);

    if (loading) {
        return <p className="loading-text">Loading movies...</p>;
    }

    return (
        <div className="home">
            <h2 className="home-heading">🎬 Now Showing</h2>
            {movies.length === 0 ? (
                <p className="no-movies">No movies available right now.</p>
            ) : (
                <div className="movie-grid">
                    {movies.map((movie) => (
                        <MovieCard key={movie._id} movie={movie} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Home;
