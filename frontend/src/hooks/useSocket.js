/**
 * useSocket.js — Custom React hook for all Socket.io communication.
 * Connects to backend, emits "join_admin", and distributes all events to state.
 */

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { SOCKET_URL, API_URL } from '../config/mapConfig';

const MAX_ALERTS    = 20;
const MAX_EVENT_LOG = 50;

export function useSocket() {
    const [drones,    setDrones]    = useState({}); // { droneId: telemetryPayload }
    const [alerts,    setAlerts]    = useState([]); // Last 20 safety alerts
    const [eventLog,  setEventLog]  = useState([]); // Last 50, newest first
    const [gridData,  setGridData]  = useState([]); // 100x100 congestion cells
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        const socket = io(SOCKET_URL, { 
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 10,
          timeout: 20000 
        });
        socketRef.current = socket;

        // --- Connection Events ---
        socket.on('connect', () => {
            setConnected(true);
            socket.emit('join_admin'); // Required: join admin dashboard room
        });

        // --- Fetch Initial State ---
        const fetchInitialState = async () => {
            try {
                const res = await axios.get(`${API_URL}/drones`);
                const droneMap = {};
                if (res.data && res.data.data) {
                    res.data.data.forEach(d => {
                        droneMap[d.droneId] = d;
                    });
                    setDrones(prev => ({ ...droneMap, ...prev }));
                }
            } catch (err) {
                console.error("Failed to fetch initial drones:", err);
            }
        };
        fetchInitialState();

        socket.on('disconnect', () => {
            setConnected(false);
        });

        // --- Event: telemetry_update (room: admin_dashboard) ---
        // Payload: { droneId, location:{lat,lng}, gridPos:{row,col},
        //            batteryLevel, altitude, speed,
        //            safety:{nfzViolation, proximityAlerts, emergencyLanding} }
        socket.on('telemetry_update', (data) => {
            setDrones(prev => ({ ...prev, [data.droneId]: data }));
        });

        // --- Event: drone_update_* (individual drone updates, broadcast) ---
        // We catch individual updates so we can update state by droneId.
        // The backend emits "drone_update_${droneId}" for each drone.
        // We listen generically via telemetry_update above (same payload).

        // --- Event: grid_update (broadcast) ---
        // Payload: Array of { x: row, y: col, density: number }
        socket.on('grid_update', (data) => {
            setGridData(Array.isArray(data) ? data : []);
        });

        // --- Event: safety_alert (room: admin_dashboard) ---
        // Payload: { droneId, nfzViolation, proximityAlerts, emergencyLanding }
        socket.on('safety_alert', (alert) => {
            setAlerts(prev => [
                { ...alert, timestamp: new Date().toISOString() },
                ...prev
            ].slice(0, MAX_ALERTS));
        });

        // --- Event: event_log (broadcast) ---
        // Payload: { message: string, type: "info"|"warning"|"error" }
        socket.on('event_log', (entry) => {
            setEventLog(prev => [
                { ...entry, timestamp: new Date().toISOString() },
                ...prev
            ].slice(0, MAX_EVENT_LOG));
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('telemetry_update');
            socket.off('grid_update');
            socket.off('safety_alert');
            socket.off('event_log');
            socket.disconnect();
        };
    }, []);

    return { drones, alerts, eventLog, gridData, connected };
}
