"""
eta_predictor.py
Loads eta_model.pkl and battery_model.pkl and predicts ETA and battery usage.
"""

import os
import warnings
from datetime import datetime, timedelta
import pandas as pd
import joblib
from config import ETA_MODEL_PATH, BATTERY_LOW

warnings.filterwarnings("ignore")

BATTERY_MODEL_PATH = "battery_model.pkl"

_eta_model     = None
_battery_model = None

def _load_models():
    global _eta_model, _battery_model

    if _eta_model is None:
        if not os.path.exists(ETA_MODEL_PATH):
            raise FileNotFoundError(f"ERROR: {ETA_MODEL_PATH} not found.")
        _eta_model = joblib.load(ETA_MODEL_PATH)
        print(f"[ETA] Model loaded — {len(_eta_model.estimators_)} trees")

    if _battery_model is None:
        if not os.path.exists(BATTERY_MODEL_PATH):
            raise FileNotFoundError(f"ERROR: {BATTERY_MODEL_PATH} not found.")
        _battery_model = joblib.load(BATTERY_MODEL_PATH)
        print(f"[Battery] Model loaded — {len(_battery_model.estimators_)} trees")

    return _eta_model, _battery_model

def predict_eta(
    distance_km, wind_speed, payload_kg,
    drone_speed_kmh=40.0, num_drones=0,
    temperature=25.0, visibility_km=10.0,
    battery_level=100.0, hour=None,
    day_of_week=None, congestion_score=0.0,
):
    now = datetime.now()
    if hour is None:
        hour = now.hour
    if day_of_week is None:
        day_of_week = now.weekday()

    eta_m, bat_m = _load_models()

    features = pd.DataFrame([{
        "distance_km":     distance_km,
        "wind_speed":      wind_speed,
        "payload_kg":      payload_kg,
        "drone_speed_kmh": drone_speed_kmh,
        "num_drones":      num_drones,
        "temperature":     temperature,
        "visibility_km":   visibility_km,
        "battery_level":   battery_level,
        "hour":            hour,
        "day_of_week":     day_of_week,
    }])

    eta_pred = float(eta_m.predict(features)[0])
    bat_pred = float(bat_m.predict(features)[0])

    eta_pred = round(max(1.0, min(eta_pred, 60.0)), 2)
    bat_pred = round(max(1.0, min(bat_pred, 80.0)), 2)

    battery_after = round(battery_level - bat_pred, 2)
    arrival_str   = (now + timedelta(minutes=eta_pred)).strftime("%H:%M:%S")
    safe_to_fly   = battery_after >= BATTERY_LOW

    return {
        "etaMinutes":       eta_pred,
        "batteryUsed":      bat_pred,
        "estimatedArrival": arrival_str,
        "safeToFly":        safe_to_fly,
        "batteryAfter":     battery_after,
    }

if __name__ == "__main__":
    r = predict_eta(
        distance_km=1.5, wind_speed=10.0,
        payload_kg=2.0, battery_level=85.0,
        hour=12, day_of_week=1
    )
    print(r)