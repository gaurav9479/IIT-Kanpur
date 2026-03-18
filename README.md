# SkyTrace - Autonomous Drone Delivery System 🚁📦

SkyTrace is a state-of-the-art **Unmanned Traffic Management (UTM)** and **Drone Delivery Dashboard** designed for campus-scale operations (e.g., IIT Kanpur). It integrates real-time telemetry, 3D pathfinding, and AI-driven predictive analytics.

---

## 🚀 Features

-   **Intelligent 3D Pathfinding**: A* based navigation with altitude lane assignment.
-   **Real-time Fleet Management**: Live tracking of drone health, battery, and location.
-   **AI Analytics**: Predictive ETA and battery usage forecasting using dedicated ML models.
-   **No-Fly Zone (NFZ) Management**: Dynamic geofencing and safety protocol enforcement.
-   **Premium Dashboard**: Sleek, modern UI with real-time event logs and performance insights.

---

## 🛠️ Technology Stack

-   **Frontend**: React.js, Vite, TailwindCSS, Framer Motion, Leaflet.js
-   **Backend**: Node.js, Express.js, Socket.io, MongoDB Atlas
-   **AI Modules**: Python, FastAPI/Flask (for ETA and Congestion prediction)

---

## ⚙️ Setup Instructions

### 1. Prerequisites
-   Node.js (v18+)
-   MongoDB Atlas account
-   Git

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory:
```env
PORT=5001
MONGO_URI=your_mongodb_atlas_uri
NODE_ENV=development
```
Run the server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```
Run the dashboard:
```bash
npm run dev
```

### 4. AI Prediction (Optional)
If you wish to use the AI features, navigate to `ai-prediction/` and install dependencies:
```bash
cd ai-prediction
pip install -r requirements.txt
python api.py
```

---

## 📡 API Endpoints

-   `POST /api/v1/missions/dispatch`: Dispatch a drone mission.
-   `GET /api/v1/drones`: Fetch all registered drones.
-   `GET /api/v1/orders`: View all delivery orders.

---

## 🤝 Project Structure
-   `/frontend`: React application (Vite-powered).
-   `/backend`: Node.js/Express server with Mongoose models.
-   `/ai-prediction`: Python-based predictive analytics modules.

---

## 🛠️ Developer Tools
-   **Seeding Drones**: Run `node backend/seedDrones.js` to populate the DB with initial drones.
-   **Diagnosis**: Run `node backend/diagnose.js` to check DB status and drone health.

---

Designed for **Advanced Agentic Coding** & **Autonomous Systems Research**.
