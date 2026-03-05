import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./AiChat.css";

function AiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: "bot",
            text: "Hi! I'm your Movie Matrix AI assistant. I can help you with:\n\n🎬 Movie recommendations & info\n🎟️ Booking tickets & managing bookings\n📍 Finding nearby theatres\n❓ General questions — ask me anything!\n\nWhat can I help you with?",
            quickReplies: ["What's playing today?", "Show my bookings", "How do I book tickets?", "Surprise me with a movie!"]
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    const token = localStorage.getItem("token");

    // Request browser geolocation on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    console.log("User location acquired:", pos.coords.latitude, pos.coords.longitude);
                },
                (err) => {
                    console.log("Geolocation denied or unavailable:", err.message);
                }
            );
        }
    }, []);

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
        const updatedMessages = [...messages, { role: "user", text: trimmed }];
        setMessages(updatedMessages);
        setInput("");
        setLoading(true);

        try {
            // Send conversation history for context continuity
            const history = updatedMessages
                .filter(m => m.role === "user" || m.role === "bot")
                .slice(-10) // last 10 messages for context
                .map(m => ({ role: m.role === "user" ? "user" : "model", text: m.text }));

            const payload = { message: trimmed, history };
            if (userLocation) {
                payload.userLat = userLocation.lat;
                payload.userLng = userLocation.lng;
            }
            const res = await API.post("/ai/chat", payload);
            const data = res.data;

            setMessages(prev => [
                ...prev,
                {
                    role: "bot",
                    text: data.message || "I couldn't understand that. Could you rephrase?",
                    recommendations: data.recommendations || [],
                    actions: data.actions || [],
                    quickReplies: data.quickReplies || []
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
        if (rec.isOTT) {
            // OTT movies — no navigation, just informational
            return;
        }
        if (rec.showtimeId) {
            navigate(`/book/${rec.showtimeId}`);
        } else if (rec.movieId) {
            navigate(`/movie/${rec.movieId}`);
        }
        setIsOpen(false);
    };

    const handleActionClick = (action) => {
        if (action.type === "navigate" && action.route) {
            navigate(action.route);
            setIsOpen(false);
        } else if (action.type === "link" && action.route) {
            window.open(action.route, "_blank");
        }
    };

    const handleQuickReply = (text) => {
        if (loading) return;
        setInput(text);
        // Trigger send after setting input
        setTimeout(() => {
            const updatedMessages = [...messages, { role: "user", text }];
            setMessages(updatedMessages);
            setInput("");
            setLoading(true);

            const sendHistory = updatedMessages
                .filter(m => m.role === "user" || m.role === "bot")
                .slice(-10)
                .map(m => ({ role: m.role === "user" ? "user" : "model", text: m.text }));

            const sendPayload = { message: text, history: sendHistory };
            if (userLocation) {
                sendPayload.userLat = userLocation.lat;
                sendPayload.userLng = userLocation.lng;
            }

            API.post("/ai/chat", sendPayload)
                .then(res => {
                    setMessages(prev => [
                        ...prev,
                        {
                            role: "bot",
                            text: res.data.message || "I couldn't understand that. Could you rephrase?",
                            recommendations: res.data.recommendations || [],
                            actions: res.data.actions || [],
                            quickReplies: res.data.quickReplies || []
                        }
                    ]);
                })
                .catch(err => {
                    const errorMsg = err.response?.data?.msg || "Something went wrong. Please try again.";
                    setMessages(prev => [...prev, { role: "bot", text: errorMsg }]);
                })
                .finally(() => setLoading(false));
        }, 50);
    };

    // Format bot message text with basic markdown-like formatting
    const formatMessage = (text) => {
        if (!text) return text;
        // Split by newlines and render
        return text.split("\n").map((line, i) => {
            // Bold text: **text**
            const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={j}>{part.slice(2, -2)}</strong>;
                }
                return part;
            });
            return (
                <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {parts}
                </React.Fragment>
            );
        });
    };

    // Don't render for logged-out users
    if (!token) return null;

    return (
        <div className="ai-chat-container">
            {/* Floating Action Button — always visible */}
            <button
                className="ai-chat-fab"
                onClick={() => setIsOpen(prev => !prev)}
                title="AI Movie Assistant"
            >
                {isOpen ? "✕" : "🤖"}
            </button>

            {/* Chat Window — always in DOM, toggled via CSS class */}
            <div className={`ai-chat-window ${isOpen ? "open" : ""}`}>
                <div className="ai-chat-header">
                    <div className="ai-chat-header-info">
                        <span className="ai-chat-header-title">🤖 Movie Matrix AI</span>
                        <span className="ai-chat-header-subtitle">Your smart assistant</span>
                    </div>
                    <button className="ai-chat-close" onClick={() => setIsOpen(false)}>✕</button>
                </div>

                <div className="ai-chat-messages">
                    {messages.map((msg, i) => (
                        <div key={i}>
                            <div className={`ai-msg ${msg.role}`}>
                                {msg.role === "bot" ? formatMessage(msg.text) : msg.text}
                            </div>
                            {/* Recommendation cards */}
                            {msg.recommendations && msg.recommendations.length > 0 && (
                                <div className="ai-rec-cards">
                                    {msg.recommendations.map((rec, j) => (
                                        <div
                                            key={j}
                                            className={`ai-rec-card ${rec.isOTT ? "ott-card" : ""}`}
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
                                                <span className="ai-rec-title">
                                                    {rec.title}
                                                    {rec.isOTT && <span className="ott-badge">OTT</span>}
                                                </span>
                                                {rec.isOTT && rec.ottPlatforms && (
                                                    <span className="ai-rec-meta ott-platforms">
                                                        📺 {rec.ottPlatforms}
                                                    </span>
                                                )}
                                                {!rec.isOTT && rec.theater && (
                                                    <span className="ai-rec-meta">
                                                        📍 {rec.theater} {rec.time ? `• ${rec.time}` : ""} {rec.date ? `• ${rec.date}` : ""}
                                                    </span>
                                                )}
                                                {rec.reason && (
                                                    <span className="ai-rec-meta">{rec.reason}</span>
                                                )}
                                                <span className="ai-rec-book">
                                                    {rec.isOTT ? "📺 Stream at Home" : rec.showtimeId ? "🎟️ Book Now →" : "View Details →"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Action buttons */}
                            {msg.actions && msg.actions.length > 0 && (
                                <div className="ai-action-buttons">
                                    {msg.actions.map((action, j) => (
                                        <button
                                            key={j}
                                            className="ai-action-btn"
                                            onClick={() => handleActionClick(action)}
                                        >
                                            {action.type === "navigate" ? "📄 " : "🔗 "}
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {/* Quick reply chips */}
                            {msg.quickReplies && msg.quickReplies.length > 0 && i === messages.length - 1 && (
                                <div className="ai-quick-replies">
                                    {msg.quickReplies.map((qr, j) => (
                                        <button
                                            key={j}
                                            className="ai-quick-reply-chip"
                                            onClick={() => handleQuickReply(qr)}
                                            disabled={loading}
                                        >
                                            {qr}
                                        </button>
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
                        placeholder="Ask me anything..."
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
        </div>
    );
}

export default AiChat;
