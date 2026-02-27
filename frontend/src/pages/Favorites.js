import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import MovieCard from "../components/MovieCard";
import "./Favorites.css";

function Favorites() {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const fetchFavorites = async () => {
            try {
                const res = await API.get("/favorites");
                setFavorites(res.data);
            } catch (err) {
                console.error(err);
                setError("Failed to load favorites");
            } finally {
                setLoading(false);
            }
        };
        fetchFavorites();
    }, [navigate]);

    if (loading) return <p className="loading-text">Loading favorites...</p>;
    if (error) return <p className="error-text">{error}</p>;

    return (
        <div className="favorites-page">
            <h2>❤️ My Favorites</h2>
            {favorites.length === 0 ? (
                <p className="no-favorites">You haven't added any favorites yet.</p>
            ) : (
                <div className="movie-grid">
                    {favorites.map((movie) => (
                        <MovieCard key={movie._id} movie={movie} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Favorites;
