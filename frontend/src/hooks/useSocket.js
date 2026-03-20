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
    const [warningDrones, setWarningDrones] = useState(new Set()); // Set of droneIds with active warnings
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    // --- Helper to add/remove warning drones ---
    const triggerWarning = (droneId) => {
      setWarningDrones(prev => {
        const next = new Set(prev);
        next.add(droneId);
        return next;
      });
      // Clear after 10s
      setTimeout(() => {
        setWarningDrones(prev => {
          const next = new Set(prev);
          next.delete(droneId);
          return next;
        });
      }, 10000);
    };

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
            socket.emit('join_admin'); 
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

        // --- Event: telemetry_update ---
        socket.on('telemetry_update', (data) => {
            setDrones(prev => ({ ...prev, [data.droneId]: data }));
        });

        // --- Event: grid_update ---
        socket.on('grid_update', (data) => {
            setGridData(Array.isArray(data) ? data : []);
        });

        // --- Event: safety_alert ---
        socket.on('safety_alert', (alert) => {
            setAlerts(prev => [
                { ...alert, timestamp: new Date().toISOString() },
                ...prev
            ].slice(0, MAX_ALERTS));
        });

        // --- 🆕 3D Collision Monitoring ---
        socket.on('collision_warning_3d', (data) => {
            triggerWarning(data.droneA);
            triggerWarning(data.droneB);
            setAlerts(prev => [
                { 
                  type: 'collision_warning', 
                  severity: data.severity,
                  droneId: data.droneA, // Primary drone
                  droneB: data.droneB,
                  proximityAlerts: [{ otherDroneId: data.droneB, distance: data.distanceTotal }],
                  action: data.resolution?.action || 'Automatic Avoidance',
                  timestamp: data.timestamp || new Date().toISOString() 
                },
                ...prev
            ].slice(0, MAX_ALERTS));
        });

        // --- 🆕 NFZ Violation Monitoring ---
        socket.on('nfz_violation', (data) => {
            triggerWarning(data.droneId);
            setAlerts(prev => [
                { 
                  type: 'nfz_violation', 
                  nfzViolation: true,
                  droneId: data.droneId,
                  message: `Unauthorized entry: ${data.nfzName}`,
                  action: 'Emergency Hover Initiated',
                  timestamp: data.timestamp || new Date().toISOString() 
                },
                ...prev
            ].slice(0, MAX_ALERTS));
        });

        // --- Event: event_log ---
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
            socket.off('collision_warning_3d');
            socket.off('nfz_violation');
            socket.off('event_log');
            socket.disconnect();
        };
    }, []);

    return { drones, alerts, eventLog, gridData, warningDrones, connected };
}
