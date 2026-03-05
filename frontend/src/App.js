import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import AiChat from "./components/AiChat";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Movie from "./pages/Movie";
import Book from "./pages/Book";
import MyBookings from "./pages/MyBookings";
import Favorites from "./pages/Favorites";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/movie/:id" element={<Movie />} />
                <Route path="/book/:showtimeId" element={<Book />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                {/* catch-all to avoid blank screens when unknown path */}
                <Route path="*" element={<p style={{padding: '20px', textAlign:'center'}}>Page not found</p>} />
            </Routes>
            <AiChat />
        </BrowserRouter>
    );
}

export default App;
