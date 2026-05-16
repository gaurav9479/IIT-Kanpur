/**
 * useAIPredictions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom hook that connects the React frontend to the Python AI FastAPI server.
 *
 * Features:
 *   • Polls /lanes/status every 30s for live lane congestion
 *   • On-demand ETA prediction   → predictETA(params)
 *   • On-demand battery drain    → predictBattery(params)
 *   • On-demand congestion check → predictCongestion(params)
 *   • AI health check            → checks /health on mount
 *
 * All calls go through the Node.js backend proxy (/api/v1/ai/*)
 * so the frontend never directly calls port 8000.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config/mapConfig';

const POLL_INTERVAL_MS = 30000; // 30 seconds

const DEFAULT_LANES = Array.from({ length: 10 }, (_, i) => ({
  lane_id: i + 1,
  num_drones: 0,
  congestion_level: 'low',
  is_congested: false,
  confidence: 0,
  altitude: 20 + (i + 1) * 10,
  direction: (i + 1) % 2 === 0 ? '→' : '←',
}));

export function useAIPredictions() {
  const [lanes, setLanes]           = useState(DEFAULT_LANES);
  const [aiOnline, setAiOnline]     = useState(false);
  const [aiHealth, setAiHealth]     = useState(null);
  const [laneLoading, setLaneLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);

  // ── Fetch lane status ──────────────────────────────────────────────────────
  const fetchLaneStatus = useCallback(async () => {
    setLaneLoading(true);
    try {
      const res = await axios.get(`${API_URL}/ai/lanes`, { timeout: 60000 });
      if (res.data?.lanes) {
        setLanes(res.data.lanes.map(l => ({
          ...l,
          altitude: 20 + l.lane_id * 10,
          direction: l.lane_id % 2 === 0 ? '→' : '←',
        })));
        setAiOnline(true);
        setLastUpdated(new Date());
      }
    } catch {
      setAiOnline(false);
    } finally {
      setLaneLoading(false);
    }
  }, []);

  // ── Health check ─────────────────────────────────────────────────────────
  const checkHealth = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/ai/health`, { timeout: 10000 });
      setAiOnline(true);
      setAiHealth(res.data);
    } catch {
      setAiOnline(false);
      setAiHealth(null);
    }
  }, []);

  // ── Poll on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    checkHealth();
    fetchLaneStatus();
    timerRef.current = setInterval(fetchLaneStatus, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchLaneStatus, checkHealth]);

  // ── On-demand predictions ──────────────────────────────────────────────────
  const predictETA = useCallback(async (params) => {
    const res = await axios.post(`${API_URL}/ai/predict-eta`, params, { timeout: 8000 });
    return res.data;
  }, []);

  const predictBattery = useCallback(async (params) => {
    const res = await axios.post(`${API_URL}/ai/predict-battery`, params, { timeout: 8000 });
    return res.data;
  }, []);

  const predictCongestion = useCallback(async (params) => {
    const res = await axios.post(`${API_URL}/ai/predict-congestion`, params, { timeout: 8000 });
    return res.data;
  }, []);

  return {
    lanes,
    aiOnline,
    aiHealth,
    laneLoading,
    lastUpdated,
    fetchLaneStatus,
    predictETA,
    predictBattery,
    predictCongestion,
  };
}
