import React from "react";
import "./Skeleton.css";

// ===== Movie Card Skeleton =====
export function MovieCardSkeleton() {
    return (
        <div className="skeleton-movie-card">
            <div className="skeleton-movie-poster skeleton" />
            <div className="skeleton-movie-info">
                <div className="skeleton-movie-title skeleton" />
                <div className="skeleton-movie-genre skeleton" />
                <div className="skeleton-movie-meta">
                    <div className="skeleton-movie-rating skeleton" />
                    <div className="skeleton-movie-lang skeleton" />
                </div>
            </div>
        </div>
    );
}

// ===== Review Card Skeleton =====
export function ReviewCardSkeleton() {
    return (
        <div className="skeleton-review-card">
            <div className="skeleton-review-poster skeleton" />
            <div className="skeleton-review-body">
                <div className="skeleton-review-header">
                    <div className="skeleton-review-name skeleton" />
                    <div className="skeleton-review-date skeleton" />
                </div>
                <div className="skeleton-review-movie-title skeleton" />
                <div className="skeleton-review-stars skeleton" />
                <div className="skeleton-review-text skeleton" />
                <div className="skeleton-review-text-short skeleton" />
                <div className="skeleton-review-actions">
                    <div className="skeleton-review-btn skeleton" />
                    <div className="skeleton-review-btn skeleton" />
                    <div className="skeleton-review-btn skeleton" />
                </div>
            </div>
        </div>
    );
}

// ===== Top Reviewer Skeleton =====
export function TopReviewerSkeleton() {
    return (
        <div className="skeleton-tr-card">
            <div className="skeleton-tr-rank skeleton" />
            <div className="skeleton-tr-avatar skeleton" />
            <div className="skeleton-tr-info">
                <div className="skeleton-tr-name skeleton" />
                <div className="skeleton-tr-stats skeleton" />
            </div>
        </div>
    );
}

// ===== Search User Row Skeleton =====
export function SearchUserSkeleton() {
    return (
        <div className="skeleton-user-row">
            <div className="skeleton-user-avatar skeleton" />
            <div className="skeleton-user-name skeleton" />
            <div className="skeleton-user-btn skeleton" />
        </div>
    );
}

// ===== Profile Card Skeleton =====
export function ProfileSkeleton() {
    return (
        <div className="skeleton-profile-card">
            <div className="skeleton-profile-avatar skeleton" />
            <div className="skeleton-profile-name skeleton" />
            <div className="skeleton-profile-email skeleton" />
            <div className="skeleton-profile-joined skeleton" />
            <div className="skeleton-profile-stats">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton-profile-stat">
                        <div className="skeleton-profile-stat-num skeleton" />
                        <div className="skeleton-profile-stat-label skeleton" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ===== Activity Item Skeleton =====
export function ActivitySkeleton() {
    return (
        <div className="skeleton-activity-item">
            <div className="skeleton-activity-icon skeleton" />
            <div className="skeleton-activity-content">
                <div className="skeleton-activity-text skeleton" />
                <div className="skeleton-activity-time skeleton" />
            </div>
        </div>
    );
}
