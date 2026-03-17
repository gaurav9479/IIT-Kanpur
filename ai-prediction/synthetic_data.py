# ================================================================
# synthetic_data.py — Generate realistic IITK drone flight data
# ================================================================
# Data generation methodology:
# Based on IITK campus specifications:
# - Campus area: ~4km x 4km (source: IITK official map)
# - Kanpur temperature range: 8-45 degrees C (source: IMD weather data)
# - Drone physics: speed model based on DJI Matrice 300 specs
# - Peak hours: derived from IITK academic schedule
# - Wind: exponential distribution matching real meteorological data
# Synthetic approach is standard in robotics/aerospace research
# where physical systems are not yet deployed
# ================================================================

import numpy as np
import pandas as pd
from config import (NUM_LANES, MAX_DRONES_PER_LANE,
                    PEAK_HOURS, CONGESTION_THRESHOLD)

# Fixed seed — same data every run — scientific reproducibility
np.random.seed(42)


def generate_data(n_samples=5000):
    """
    Generate n_samples rows of realistic IITK drone flight data.
    14 features based on physical and campus-specific reasoning.
    Returns a pandas DataFrame.
    """

    # ── FEATURE 1: lane_id ──────────────────────────────────────
    # Which air lane — 1 to 10 (defined by Member 1's map)
    lane_id = np.random.randint(1, NUM_LANES + 1, n_samples)

    # ── FEATURE 2: hour ─────────────────────────────────────────
    # Hour of day — 0 (midnight) to 23 (11pm)
    hour = np.random.randint(0, 24, n_samples)

    # ── FEATURE 3: num_drones ───────────────────────────────────
    # Drones currently in lane — can exceed max (creates congestion)
    num_drones = np.random.randint(1, MAX_DRONES_PER_LANE + 4, n_samples)

    # ── FEATURE 4: payload_kg ───────────────────────────────────
    # 0.1kg = letter/document, 5kg = heavy package
    payload_kg = np.round(np.random.uniform(0.1, 5.0, n_samples), 2)

    # ── FEATURE 5: wind_speed ───────────────────────────────────
    # Exponential distribution — low wind common, high wind rare
    # Matches real meteorological data patterns
    wind_speed = np.round(
        np.random.exponential(scale=10, size=n_samples), 1)
    wind_speed = np.clip(wind_speed, 0, 50)

    # ── FEATURE 6: distance_km ──────────────────────────────────
    # IITK campus ~4x4km — max delivery distance ~3km
    distance_km = np.round(np.random.uniform(0.1, 3.0, n_samples), 2)

    # ── FEATURE 7: temperature ──────────────────────────────────
    # Kanpur climate: 8 degrees C (winter) to 45 degrees C (summer)
    # Heat degrades battery performance significantly
    temperature = np.round(np.random.uniform(8, 45, n_samples), 1)

    # ── FEATURE 8: visibility_km ────────────────────────────────
    # Kanpur winter fog: visibility drops to 0.5km
    # Low visibility forces drones to slow down
    visibility_km = np.round(np.random.uniform(0.5, 10.0, n_samples), 1)

    # ── FEATURE 9: day_of_week ──────────────────────────────────
    # 0=Monday to 6=Sunday
    # Weekdays busier — classes, labs, mess rush
    day_of_week = np.random.randint(0, 7, n_samples)

    # ── FEATURE 10: battery_level ───────────────────────────────
    # Minimum 20% — safety protocol prevents lower battery drones
    # from entering lanes (matches config.py BATTERY_LOW logic)
    battery_level = np.random.randint(20, 101, n_samples)

    # ── FEATURE 11: drone_speed_kmh ─────────────────────────────
    # Physics based — DJI Matrice 300 base speed ~40 kmh
    # Reduced by payload weight and wind resistance
    drone_speed_kmh = np.round(
        40 - (payload_kg * 2) - (wind_speed * 0.3) +
        np.random.normal(0, 2, n_samples), 1)
    drone_speed_kmh = np.clip(drone_speed_kmh, 10, 40)

    # ── FEATURE 12: hub_distance_km ─────────────────────────────
    # Distance from nearest hub (OAT or Shopping Complex)
    # Farther = harder emergency landing = higher risk
    hub_distance_km = np.round(
        np.random.uniform(0.1, 2.5, n_samples), 2)

    # ── DERIVED FEATURE 13: is_peak_hour ────────────────────────
    # 1 if hour matches IITK campus busy hours
    is_peak_hour = np.array(
        [1 if h in PEAK_HOURS else 0 for h in hour])

    # ── DERIVED FEATURE 14: is_weekday ──────────────────────────
    # 1 if Monday-Friday, 0 if Saturday-Sunday
    is_weekday = (day_of_week < 5).astype(int)

    # ── TARGET: is_congested ────────────────────────────────────
    # Weighted formula — all weights sum to exactly 1.0
    # Each weight justified by physical reasoning
    congestion_score = (
        # 35% — direct cause of congestion
        (num_drones / (MAX_DRONES_PER_LANE + 3)) * 0.35 +
        # 20% — campus activity pattern
        (is_peak_hour)                            * 0.20 +
        # 15% — wind slows drones, lane stays busy
        (wind_speed / 50)                         * 0.15 +
        # 10% — heavy payload slows drone
        (payload_kg / 5.0)                        * 0.10 +
        # 8%  — low visibility forces slower flight
        (1 - visibility_km / 10)                  * 0.08 +
        # 7%  — low battery = slower drone
        (1 - battery_level / 100)                 * 0.07 +
        # 5%  — weekday vs weekend activity
        (is_weekday)                              * 0.05
    )

    # Gaussian noise — real world is never perfectly predictable
    noise = np.random.normal(0, 0.04, n_samples)
    congestion_score = np.clip(congestion_score + noise, 0, 1)

    # Binary target — 1 if congested, 0 if free
    is_congested = (
        congestion_score >= CONGESTION_THRESHOLD).astype(int)

    # ── BUILD FINAL DATAFRAME ───────────────────────────────────
    df = pd.DataFrame({
        'lane_id'         : lane_id,
        'hour'            : hour,
        'num_drones'      : num_drones,
        'payload_kg'      : payload_kg,
        'wind_speed'      : wind_speed,
        'distance_km'     : distance_km,
        'temperature'     : temperature,
        'visibility_km'   : visibility_km,
        'day_of_week'     : day_of_week,
        'battery_level'   : battery_level,
        'drone_speed_kmh' : drone_speed_kmh,
        'hub_distance_km' : hub_distance_km,
        'is_peak_hour'    : is_peak_hour,
        'is_weekday'      : is_weekday,
        'is_congested'    : is_congested
    })

    return df


if __name__ == "__main__":
    df = generate_data(5000)

    # Save dataset
    df.to_csv("drone_data.csv", index=False)

    # Print summary
    print("=" * 55)
    print("✅ Dataset Generated Successfully")
    print("=" * 55)
    print(f"Total records      : {len(df)}")
    print(f"Total features     : {len(df.columns) - 1}")
    print(f"Congested cases    : {df['is_congested'].sum()}")
    print(f"Normal cases       : {(df['is_congested']==0).sum()}")
    print(f"Congestion rate    : {df['is_congested'].mean()*100:.1f}%")
    print("=" * 55)
    print("\nSample data (3 rows):")
    print(df.head(3).to_string())
    print("\nDataset statistics:")
    print(df.describe().round(2).to_string())