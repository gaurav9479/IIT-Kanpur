# ================================================================
# config.py — Central settings for Member 4 (AI & Prediction)
# All numbers live here. Never hardcode values in other files.
# ================================================================

# ─── LANES ───────────────────────────────────────────────────────
NUM_LANES = 10                # Total air lanes on IITK campus
MAX_DRONES_PER_LANE = 5       # More than this = congested lane

# ─── ALTITUDE ────────────────────────────────────────────────────
ALTITUDE_BUFFER = 10          # Metres of safety gap between lanes
MIN_ALTITUDE = 20             # Lowest a drone can fly (metres)
MAX_ALTITUDE = 120            # Highest a drone can fly (metres)

# ─── BATTERY ─────────────────────────────────────────────────────
BATTERY_LOW = 15              # Below this → emergency alert
BATTERY_CRITICAL = 8          # Below this → force land immediately
BATTERY_FULL = 100

# ─── TIMING ──────────────────────────────────────────────────────
PEAK_HOURS = [8, 9, 12, 13, 17, 18, 19]  # Busy hours on campus
TIME_SLOT_DURATION = 5        # Each time slot = 5 minutes

# ─── CONGESTION ──────────────────────────────────────────────────
CONGESTION_THRESHOLD = 0.6    # AI score above this = congested

# ─── HUBS ────────────────────────────────────────────────────────
HUBS = {
    "OAT": [26.5127, 80.2325],
    "Shopping_Complex": [26.5098, 80.2317]
}

# ─── SIMULATION ──────────────────────────────────────────────────
MAX_DRONES = 20               # Total drones in the system
SIMULATION_SPEED = 1          # Seconds per simulation tick

# ─── MODEL ───────────────────────────────────────────────────────
MODEL_PATH = "congestion_model.pkl"
ETA_MODEL_PATH = "eta_model.pkl"

# ─── API ─────────────────────────────────────────────────────────
API_HOST = "0.0.0.0"          # Accessible from any device on network
API_PORT = 8000               # FastAPI runs here
DASHBOARD_PORT = 8501         # Streamlit runs here