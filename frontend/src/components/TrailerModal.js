import React from "react";
import "./TrailerModal.css";

function TrailerModal({ videoKey, onClose }) {
    // Close when clicking the dark overlay (not the iframe area)
    const handleOverlayClick = (e) => {
        if (e.target.className === "trailer-overlay") {
            onClose();
        }
    };

    return (
        <div className="trailer-overlay" onClick={handleOverlayClick}>
            <div className="trailer-modal">
                <button className="trailer-close-btn" onClick={onClose}>✕</button>
                <div className="trailer-iframe-wrapper">
                    <iframe
                        src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
                        title="Movie Trailer"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        </div>
    );
}

export default TrailerModal;
