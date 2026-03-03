import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./AiChat.css";

function AiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: "bot", text: "Hi! I'm your Movie Matrix AI assistant. Tell me your mood or what kind of movie you're looking for, and I'll find the perfect pick for you! 🎬" }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    const token = localStorage.getItem("token");

    // Auto-scroll to bottom on new message
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, loading]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 300);
        }
    }, [isOpen]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        // Add user message
        setMessages(prev => [...prev, { role: "user", text: trimmed }]);
        setInput("");
        setLoading(true);

        try {
            const res = await API.post("/ai/chat", { message: trimmed });
            const data = res.data;

            setMessages(prev => [
                ...prev,
                {
                    role: "bot",
                    text: data.message || "I couldn't find a good match. Try describing your mood differently!",
                    recommendations: data.recommendations || []
                }
            ]);
        } catch (err) {
            console.error("AI Chat error:", err);
            const errorMsg = err.response?.data?.msg || "Something went wrong. Please try again.";
            setMessages(prev => [...prev, { role: "bot", text: errorMsg }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleBookClick = (rec) => {
        if (rec.showtimeId) {
            navigate(`/book/${rec.showtimeId}`);
        } else if (rec.movieId) {
            navigate(`/movie/${rec.movieId}`);
        }
        setIsOpen(false);
    };

    // Don't render for logged-out users
    if (!token) return null;

    return (
        <>
            {/* Floating Action Button */}
            <button className="ai-chat-fab" onClick={() => setIsOpen(!isOpen)} title="AI Movie Assistant">
                {isOpen ? "✕" : "🤖"}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="ai-chat-window">
                    <div className="ai-chat-header">
                        <div>
                            🤖 Movie Matrix AI
                            <br />
                            <span>Powered by Gemini</span>
                        </div>
                        <button className="ai-chat-close" onClick={() => setIsOpen(false)}>✕</button>
                    </div>

                    <div className="ai-chat-messages">
                        {messages.map((msg, i) => (
                            <div key={i}>
                                <div className={`ai-msg ${msg.role}`}>
                                    {msg.text}
                                </div>
                                {/* Recommendation cards */}
                                {msg.recommendations && msg.recommendations.length > 0 && (
                                    <div className="ai-rec-cards">
                                        {msg.recommendations.map((rec, j) => (
                                            <div
                                                key={j}
                                                className="ai-rec-card"
                                                onClick={() => handleBookClick(rec)}
                                            >
                                                {rec.posterUrl && (
                                                    <img
                                                        src={rec.posterUrl}
                                                        alt={rec.title}
                                                        className="ai-rec-poster"
                                                        onError={(e) => { e.target.style.display = "none"; }}
                                                    />
                                                )}
                                                <div className="ai-rec-info">
                                                    <span className="ai-rec-title">{rec.title}</span>
                                                    {rec.theater && (
                                                        <span className="ai-rec-meta">
                                                            📍 {rec.theater} {rec.time ? `• ${rec.time}` : ""} {rec.date ? `• ${rec.date}` : ""}
                                                        </span>
                                                    )}
                                                    {rec.reason && (
                                                        <span className="ai-rec-meta">{rec.reason}</span>
                                                    )}
                                                    <span className="ai-rec-book">
                                                        {rec.showtimeId ? "🎟️ Book Now →" : "View Details →"}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {loading && (
                            <div className="ai-typing">
                                <span></span><span></span><span></span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="ai-chat-input-area">
                        <input
                            ref={inputRef}
                            className="ai-chat-input"
                            placeholder="Try: 'Something thrilling tonight'..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                        />
                        <button
                            className="ai-chat-send"
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                        >
                            ➤
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default AiChat;
