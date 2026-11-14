# CivicSathi AI project instructions

## Project

CivicSathi AI is a civic issue reporting platform for pothole and garbage reports.

## Stack

- Frontend: React with Vite, Tailwind CSS, and react-leaflet in `/frontend`.
- Backend: Python with FastAPI, SQLAlchemy, and SQLite in `/backend`.

## Project rules

- Keep code simple and add comments that help students explain how it works.
- Never hard-code API keys. Load secrets from `.env` using `python-dotenv` on the backend.
- Never fake or randomize AI detection results.
- Mark all seeded data with `is_demo_data=true`.
- Do not add a login system.
- Support only these issue categories: `pothole` and `garbage`.
- Calculate priority on a 0–100 scale using these weights: 40% severity, 30% location sensitivity, 20% duplicate count, and 10% age.

Follow these instructions when changing this project.
