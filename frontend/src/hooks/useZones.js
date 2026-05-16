/**
 * useZones.js — Custom hook for airspace zone CRUD + real-time sync.
 *
 * - Fetches all zones from REST API on mount.
 * - Listens for zone_created / zone_updated / zone_deleted via Socket.io.
 * - Exposes create / update / delete / toggleVisibility that call the REST API.
 *   The backend then broadcasts the event to all connected clients, so the
 *   socket listener keeps every tab in sync (including the one that made the call).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { SOCKET_URL, API_URL } from '../config/mapConfig';

export function useZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await axios.get(`${API_URL}/zones`);
        if (res.data?.data) setZones(res.data.data);
      } catch (err) {
        setError('Failed to load zones.');
        console.error('[useZones] fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchZones();
  }, []);

  // ── Socket.io real-time sync ──────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('zone_created', (zone) => {
      setZones((prev) => {
        if (prev.find((z) => z.id === zone.id)) return prev;
        return [...prev, zone];
      });
    });

    socket.on('zone_updated', (zone) => {
      setZones((prev) => prev.map((z) => (z.id === zone.id ? zone : z)));
    });

    socket.on('zone_deleted', ({ id }) => {
      setZones((prev) => prev.filter((z) => z.id !== id));
    });

    return () => {
      socket.off('zone_created');
      socket.off('zone_updated');
      socket.off('zone_deleted');
      socket.disconnect();
    };
  }, []);

  // ── REST mutations ────────────────────────────────────────────────────────

  const createZone = useCallback(async (payload) => {
    const res = await axios.post(`${API_URL}/zones`, payload);
    return res.data.data;
  }, []);

  const updateZone = useCallback(async (id, updates) => {
    const res = await axios.put(`${API_URL}/zones/${id}`, updates);
    return res.data.data;
  }, []);

  const deleteZone = useCallback(async (id) => {
    await axios.delete(`${API_URL}/zones/${id}`);
  }, []);

  const toggleVisibility = useCallback(async (id) => {
    const res = await axios.patch(`${API_URL}/zones/${id}/toggle`);
    return res.data.data;
  }, []);

  return { zones, loading, error, createZone, updateZone, deleteZone, toggleVisibility };
}
