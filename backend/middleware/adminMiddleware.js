// Admin authorization middleware
// Must be used AFTER authMiddleware (which sets req.user from JWT)

module.exports = function (req, res, next) {
    // req.user is set by authMiddleware (contains id and role from JWT)
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ msg: "Access denied. Admin only." });
    }
    next();
};
