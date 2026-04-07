import axios from "axios";

// Auto-detect API base URL:
//   - In development (localhost): hit the local backend at port 5000
//   - In production: use relative /api (same origin, served by backend)
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const API = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL || (isLocalhost ? "http://localhost:5000/api" : "/api")
});

// log if baseURL not reachable (optional)
API.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.code === "ERR_NETWORK") {
            console.error("Network error: could not reach API at", API.defaults.baseURL);
        }
        return Promise.reject(err);
    }
);

// Automatically attach JWT token to every request (if logged in)
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default API;
