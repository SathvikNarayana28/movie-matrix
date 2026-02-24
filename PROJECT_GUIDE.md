# Movie Matrix Project Guide

## Project Overview
This is a final-year BTech project.

We are building an AI Integrated Movie Ticket Booking and Recommendation Website.

The goal:
Help users discover movies, get suggestions, and book tickets in one platform.

This project must first function as a normal movie booking website. 
AI recommendation is an additional feature added later.

---

## Technology Stack (Fixed - Do not change)

Frontend:
- React (basic functional components)
- Axios for API calls
- No TypeScript
- No Redux

Backend:
- Node.js
- Express.js
- REST APIs

Database:
- MongoDB Atlas using Mongoose

Authentication:
- JWT based login system (already implemented)

AI Module (later phase):
- Python FastAPI microservice

---

## Current Progress (Already Completed)

Working features:
- MongoDB Atlas connected
- User registration API
- User login API
- Password hashing using bcrypt
- JWT token authentication
- Protected routes verified using Postman

Do NOT rewrite or replace authentication.

---

## Important Rules for AI Assistant

1. Implement project step-by-step (layered development)
2. Do not generate entire project at once
3. Do not redesign architecture
4. Keep code beginner friendly
5. Explain each file after writing code
6. Stop after each step and wait for testing confirmation
7. Use simple folder structure
8. Avoid advanced libraries or enterprise patterns

---

## Development Order (Must Follow)

Phase 1 — Core Website
- Movie database model
- Add movies
- List movies API
- Movie details API

Phase 2 — Booking System
- Theatres model
- Showtimes
- Seat selection
- Booking storage

Phase 3 — User Features
- Favorites
- Reviews
- Booking history

Phase 4 — AI Recommendation
- Suggest movies based on user preferences

Phase 5 — Payment
- Razorpay integration
