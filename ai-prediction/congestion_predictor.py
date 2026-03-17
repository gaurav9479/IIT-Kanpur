"""
congestion_predictor.py
Loads congestion_model.pkl and predicts if a drone lane is congested.
"""

import os
import warnings
import pandas as pd
import joblib
from config import MODEL_PATH, PEAK_HOURS, CONGESTION_THRESHOLD

warnings.filterwarnings("ignore")

_model = None

def _load_model():
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"ERROR: {MODEL_PATH} not found.")
        _model = joblib.load(MODEL_PATH)
        print(f"[Congestion] Model loaded — {len(_model.estimators_)} trees")
    return _model

def predict_congestion(
    lane_id, hour, num_drones, payload_kg, wind_speed,
    distance_km, temperature, visibility_km, day_of_week,
    battery_level, drone_speed_kmh=40.0, hub_distance_km=1.0,
):
    model = _load_model()

    is_peak_hour = 1 if hour in PEAK_HOURS else 0
    is_weekday   = 1 if day_of_week < 5 else 0

    features = pd.DataFrame([{
        "lane_id": lane_id, "hour": hour, "num_drones": num_drones,
        "payload_kg": payload_kg, "wind_speed": wind_speed,
        "distance_km": distance_km, "temperature": temperature,
        "visibility_km": visibility_km, "day_of_week": day_of_week,
        "battery_level": battery_level, "drone_speed_kmh": drone_speed_kmh,
        "hub_distance_km": hub_distance_km,
        "is_peak_hour": is_peak_hour, "is_weekday": is_weekday,
    }])

    prediction      = model.predict(features)[0]
    probabilities   = model.predict_proba(features)[0]
    congestion_prob = float(probabilities[1])

    if congestion_prob >= CONGESTION_THRESHOLD:
        level = "high"
    elif congestion_prob >= 0.3:
        level = "medium"
    else:
        level = "low"

    return {
        "is_congested":     bool(prediction),
        "confidence":       round(congestion_prob, 3),
        "congestion_level": level,
    }

if __name__ == "__main__":
    r = predict_congestion(
        lane_id=3, hour=18, num_drones=5, payload_kg=4.0,
        wind_speed=25.0, distance_km=2.0, temperature=35.0,
        visibility_km=5.0, day_of_week=1, battery_level=40.0
    )
    print(r)