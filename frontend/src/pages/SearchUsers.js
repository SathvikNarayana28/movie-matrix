import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import { SearchUserSkeleton } from "../components/Skeleton";
import "./SearchUsers.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL
    ? process.env.REACT_APP_API_BASE_URL.replace("/api", "")
    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000"
        : "";

// SearchUsers — embeddable section component for the Reviews Feed page
// Calls GET /api/users/search?query=<name> with 400ms debounce

function SearchUsers() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    // Debounced search — triggers 400ms after user stops typing
    useEffect(() => {
        if (query.trim().length === 0) {
            setResults([]);
            setSearched(false);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            setSearched(true);
            try {
                const res = await API.get(`/users/search?query=${encodeURIComponent(query.trim())}`);
                setResults(res.data);
            } catch (err) {
                console.error("Search error:", err);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query]);

    const handleFollow = async (userId) => {
        try {
            await API.post(`/users/follow/${userId}`);
            setResults(prev => prev.map(u =>
                u._id === userId ? { ...u, isFollowing: true, followersCount: u.followersCount + 1 } : u
            ));
        } catch (err) {
            console.error("Follow error:", err);
        }
    };

    const handleUnfollow = async (userId) => {
        try {
            await API.post(`/users/unfollow/${userId}`);
            setResults(prev => prev.map(u =>
                u._id === userId ? { ...u, isFollowing: false, followersCount: u.followersCount - 1 } : u
            ));
        } catch (err) {
            console.error("Unfollow error:", err);
        }
    };

    return (
        <div className="search-section">
            <h3 className="section-title">🔍 Search Users</h3>
            <p className="section-subtitle">Find and follow other movie enthusiasts</p>

            {/* Search Bar */}
            <div className="search-bar-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Type a name to search..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {loading && <span className="search-spinner">Searching...</span>}
            </div>

            {/* Loading skeletons */}
            {loading && (
                <div className="search-results">
                    {[...Array(3)].map((_, i) => (
                        <SearchUserSkeleton key={i} />
                    ))}
                </div>
            )}

            {/* No Results */}
            {searched && !loading && results.length === 0 && (
                <p className="search-no-results">No users found for "{query}".</p>
            )}

            {/* Result Cards */}
            {results.length > 0 && (
                <div className="search-results">
                    {results.map(user => (
                        <div key={user._id} className="search-result-card">
                            <div className="search-result-left">
                                <Link to={`/profile/${user._id}`} className="search-avatar-link">
                                    {user.profilePic ? (
                                        <img src={`${API_BASE}${user.profilePic}`} alt={user.name} className="search-avatar-img" />
                                    ) : (
                                        <span className="search-avatar">{user.name.charAt(0).toUpperCase()}</span>
                                    )}
                                </Link>
                                <Link to={`/profile/${user._id}`} className="search-user-name">
                                    {user.name}
                                </Link>
                            </div>
                            <button
                                className={`search-follow-btn ${user.isFollowing ? "search-following" : ""}`}
                                onClick={() => user.isFollowing ? handleUnfollow(user._id) : handleFollow(user._id)}
                            >
                                {user.isFollowing ? "Following" : "Follow"}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default SearchUsers;
