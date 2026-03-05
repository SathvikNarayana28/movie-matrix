import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import "./SearchUsers.css";

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
                                <div className="search-avatar">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="search-user-info">
                                    <Link to={`/profile/${user._id}`} className="search-user-name">
                                        {user.name}
                                    </Link>
                                    <span className="search-user-stats">
                                        {user.followersCount} follower{user.followersCount !== 1 ? "s" : ""} · {user.followingCount} following
                                    </span>
                                </div>
                            </div>
                            <div className="search-result-actions">
                                <button
                                    className={`search-follow-btn ${user.isFollowing ? "search-following" : ""}`}
                                    onClick={() => user.isFollowing ? handleUnfollow(user._id) : handleFollow(user._id)}
                                >
                                    {user.isFollowing ? "Unfollow" : "Follow"}
                                </button>
                                <Link to={`/profile/${user._id}`} className="search-profile-btn">
                                    View Profile
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default SearchUsers;
