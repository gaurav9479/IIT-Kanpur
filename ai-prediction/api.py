"""
api.py
FastAPI server — Member 3 ka Node.js backend isse call karta hai.
RUN: uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

import time
import warnings
from datetime import datetime

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import (
    NUM_LANES, MAX_DRONES_PER_LANE, MAX_DRONES,
    BATTERY_LOW, HUBS, API_HOST, API_PORT, PEAK_HOURS,
)
from congestion_predictor import predict_congestion
from eta_predictor import predict_eta

warnings.filterwarnings("ignore")

app = FastAPI(
    title="IITK Drone Delivery — AI API",
    description="Member 4 AI predictions for drone delivery system.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()
COUNTER    = {"congestion": 0, "eta": 0}


class CongestionInput(BaseModel):
    lane_id:         int   = Field(..., ge=1, le=10)
    hour:            int   = Field(..., ge=0, le=23)
    num_drones:      int   = Field(..., ge=0, le=5)
    payload_kg:      float = Field(..., ge=0.0, le=5.0)
    wind_speed:      float = Field(..., ge=0.0, le=35.0)
    distance_km:     float = Field(..., ge=0.1, le=3.0)
    temperature:     float = Field(..., ge=8.0, le=45.0)
    visibility_km:   float = Field(..., ge=0.5, le=10.0)
    day_of_week:     int   = Field(..., ge=0, le=6)
    battery_level:   float = Field(..., ge=0.0, le=100.0)
    drone_speed_kmh: float = Field(40.0)
    hub_distance_km: float = Field(1.0)


class ETAInput(BaseModel):
    distance_km:     float = Field(..., ge=0.1, le=3.0)
    wind_speed:      float = Field(..., ge=0.0, le=35.0)
    payload_kg:      float = Field(..., ge=0.0, le=5.0)
    drone_speed_kmh: float = Field(40.0)
    num_drones:      int   = Field(0)
    temperature:     float = Field(25.0)
    visibility_km:   float = Field(10.0)
    battery_level:   float = Field(100.0)
    hour:            int   = Field(None)
    day_of_week:     int   = Field(None)
    congestion_score:float = Field(0.0)


@app.get("/health")
async def health():
    uptime = int(time.time() - START_TIME)
    return {
        "status":    "online",
        "uptime":    f"{uptime // 60}m {uptime % 60}s",
        "requests":  COUNTER,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/predict/congestion")
async def congestion_endpoint(req: CongestionInput):
    COUNTER["congestion"] += 1
    try:
        result = predict_congestion(
            lane_id=req.lane_id, hour=req.hour,
            num_drones=req.num_drones, payload_kg=req.payload_kg,
            wind_speed=req.wind_speed, distance_km=req.distance_km,
            temperature=req.temperature, visibility_km=req.visibility_km,
            day_of_week=req.day_of_week, battery_level=req.battery_level,
            drone_speed_kmh=req.drone_speed_kmh,
            hub_distance_km=req.hub_distance_km,
        )
        return {
            "congestionLevel": result["congestion_level"],
            "is_congested":    result["is_congested"],
            "confidence":      result["confidence"],
            "lane_id":         req.lane_id,
            "timestamp":       datetime.now().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/congestion/batch")
async def congestion_batch_endpoint(req_list: list[CongestionInput]):
    COUNTER["congestion"] += len(req_list)
    results = []
    try:
        for req in req_list:
            res = predict_congestion(
                lane_id=req.lane_id, hour=req.hour,
                num_drones=req.num_drones, payload_kg=req.payload_kg,
                wind_speed=req.wind_speed, distance_km=req.distance_km,
                temperature=req.temperature, visibility_km=req.visibility_km,
                day_of_week=req.day_of_week, battery_level=req.battery_level,
                drone_speed_kmh=req.drone_speed_kmh,
                hub_distance_km=req.hub_distance_km,
            )
            results.append({
                "lane_id": req.lane_id,
                "congestionLevel": res["congestion_level"],
                "is_congested": res["is_congested"],
                "confidence": res["confidence"]
            })
        return {"timestamp": datetime.now().isoformat(), "predictions": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/eta")
async def eta_endpoint(req: ETAInput):
    COUNTER["eta"] += 1
    try:
        result = predict_eta(
            distance_km=req.distance_km, wind_speed=req.wind_speed,
            payload_kg=req.payload_kg, drone_speed_kmh=req.drone_speed_kmh,
            num_drones=req.num_drones, temperature=req.temperature,
            visibility_km=req.visibility_km, battery_level=req.battery_level,
            hour=req.hour, day_of_week=req.day_of_week,
        )
        return {
            "etaMinutes":       result["etaMinutes"],
            "batteryUsed":      result["batteryUsed"],
            "estimatedArrival": result["estimatedArrival"],
            "safeToFly":        result["safeToFly"],
            "batteryAfter":     result["batteryAfter"],
            "timestamp":        datetime.now().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lanes/status")
async def lanes_status():
    now = datetime.now()
    rng = np.random.default_rng(int(time.time()) // 30)
    lanes = []
    for lane_id in range(1, NUM_LANES + 1):
        num_drones = int(rng.integers(0, MAX_DRONES_PER_LANE + 1))
        wind_speed = float(np.clip(rng.exponential(8.0), 0, 35))
        result = predict_congestion(
            lane_id=lane_id, hour=now.hour,
            num_drones=num_drones,
            payload_kg=float(rng.uniform(0.1, 5.0)),
            wind_speed=wind_speed, distance_km=1.5,
            temperature=float(rng.uniform(20, 38)),
            visibility_km=float(rng.uniform(2, 10)),
            day_of_week=now.weekday(),
            battery_level=float(rng.uniform(20, 100)),
        )
        lanes.append({
            "lane_id":          lane_id,
            "num_drones":       num_drones,
            "congestion_level": result["congestion_level"],
            "is_congested":     result["is_congested"],
            "confidence":       result["confidence"],
        })
    levels = [l["congestion_level"] for l in lanes]
    return {
        "timestamp": now.isoformat(),
        "summary":   {
            "low":    levels.count("low"),
            "medium": levels.count("medium"),
            "high":   levels.count("high")
        },
        "lanes": lanes,
    }


@app.get("/simulation/drones")
async def simulation_drones():
    rng       = np.random.default_rng(int(time.time()) // 10)
    hubs_list = list(HUBS.values())
    drones    = []
    for drone_id in range(1, MAX_DRONES + 1):
        is_active = bool(rng.random() > 0.4)
        if is_active:
            lat    = float(rng.uniform(26.505, 26.520))
            lon    = float(rng.uniform(80.228, 80.238))
            status = "delivering"
        else:
            hub    = hubs_list[drone_id % len(hubs_list)]
            lat, lon = hub[0], hub[1]
            status = "idle"
        battery = float(rng.uniform(15, 100))
        drones.append({
            "drone_id":  drone_id,
            "latitude":  round(lat, 6),
            "longitude": round(lon, 6),
            "status":    status,
            "battery":   round(battery, 1),
            "alert":     battery < BATTERY_LOW,
        })
    return {
        "timestamp": datetime.now().isoformat(),
        "total":     MAX_DRONES,
        "active":    sum(1 for d in drones if d["status"] == "delivering"),
        "alerts":    sum(1 for d in drones if d["alert"]),
        "drones":    drones,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host=API_HOST, port=API_PORT, reload=True)