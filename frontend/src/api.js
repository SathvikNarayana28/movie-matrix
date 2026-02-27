import axios from "axios";

// allow overriding base URL via env (useful for deploys or proxies)
const API = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL || "http://localhost:5000/api"
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
        config.headers.Authorization = token;
    }
    return config;
});

export default API;
