/**
 * zone.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for dynamic airspace zones.
 *
 * Responsibilities:
 *   1. Load all zones from MongoDB into an in-memory Map on startup.
 *   2. Provide fast synchronous accessors used by safety.service + navigation.service.
 *   3. Broadcast zone_created / zone_updated / zone_deleted to all Socket.io clients.
 *   4. Expose full CRUD (create, read, update, delete, toggleVisibility).
 *
 * Geometry format stored in DB (GeoJSON-compatible):
 *   Polygon/Rectangle → coordinates: [ [ [lng,lat], ... ] ]
 *   Circle            → coordinates: [ [lng,lat] ], radius: Number
 *
 * Safety service consumes positions as [{lat,lng}] arrays — conversion done here.
 */

import { v4 as uuidv4 } from "uuid";
import Zone from "../models/Zone.model.js";
import logger from "../utils/logger.js";

class ZoneService {
  constructor() {
    /** @type {Map<string, Object>} id → zone plain object */
    this._cache = new Map();
    /** @type {import('socket.io').Server|null} */
    this._io = null;
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  /**
   * Call once after DB connects.
   * @param {import('socket.io').Server} io
   */
  async init(io) {
    this._io = io;
    await this._hydrateCache();
    logger.info(`[ZoneService] Initialised — ${this._cache.size} zones loaded.`);
  }

  async _hydrateCache() {
    const zones = await Zone.find({}).lean();
    this._cache.clear();
    zones.forEach((z) => this._cache.set(z.id, z));
  }

  // ── Accessors (synchronous — used by routing engine) ─────────────────────

  /** All zones as array */
  getZones() {
    return Array.from(this._cache.values());
  }

  /**
   * Returns only NO_FLY zones that are currently active (within time window)
   * and visible. Returns positions as [{lat,lng}] arrays for the safety service.
   */
  getActiveNoFlyZones() {
    return this._getActiveByType("NO_FLY");
  }

  /**
   * Returns only RESTRICTED zones that are currently active and visible.
   */
  getActiveRestrictedZones() {
    return this._getActiveByType("RESTRICTED");
  }



  _getActiveByType(type) {
    const now = Date.now();
    return Array.from(this._cache.values())
      .filter((z) => {
        if (z.type !== type) return false;
        if (!z.visible) return false;
        if (z.start_time && new Date(z.start_time).getTime() > now) return false;
        if (z.end_time && new Date(z.end_time).getTime() < now) return false;
        return true;
      })
      .map((z) => ({
        ...z,
        // Convert GeoJSON [lng,lat] back to [{lat,lng}] for ray-casting
        positions: this._toLatLngArray(z.geometry),
      }));
  }

  /**
   * Convert geometry to [{lat,lng}] polygon points.
   * For circles: approximate 16-point polygon around the centre.
   */
  _toLatLngArray(geometry) {
    if (!geometry) return [];

    if (geometry.type === "Circle") {
      const [lng, lat] = geometry.coordinates[0];
      const r = geometry.radius || 100; // metres
      const pts = 16;
      const latDeg = r / 111320;
      const lngDeg = r / (111320 * Math.cos((lat * Math.PI) / 180));
      return Array.from({ length: pts }, (_, i) => {
        const angle = (2 * Math.PI * i) / pts;
        return {
          lat: lat + latDeg * Math.sin(angle),
          lng: lng + lngDeg * Math.cos(angle),
        };
      });
    }

    // Polygon / Rectangle — coordinates[0] is the outer ring [[lng,lat],...]
    const ring = geometry.coordinates[0] || [];
    return ring.map(([lng, lat]) => ({ lat, lng }));
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async createZone(payload) {
    const id = uuidv4();
    const zone = await Zone.create({ ...payload, id });
    const plain = zone.toObject();
    this._cache.set(id, plain);
    this._broadcast("zone_created", plain);
    logger.info(`[ZoneService] Created zone ${id} (${plain.type})`);
    return plain;
  }

  async updateZone(id, updates) {
    const zone = await Zone.findOneAndUpdate({ id }, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!zone) throw new Error(`Zone ${id} not found`);
    this._cache.set(id, zone);
    this._broadcast("zone_updated", zone);
    logger.info(`[ZoneService] Updated zone ${id}`);
    return zone;
  }

  async deleteZone(id) {
    const zone = await Zone.findOneAndDelete({ id }).lean();
    if (!zone) throw new Error(`Zone ${id} not found`);
    this._cache.delete(id);
    this._broadcast("zone_deleted", { id });
    logger.info(`[ZoneService] Deleted zone ${id}`);
    return zone;
  }

  async toggleVisibility(id) {
    const existing = this._cache.get(id);
    if (!existing) throw new Error(`Zone ${id} not found`);
    return this.updateZone(id, { visible: !existing.visible });
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  _broadcast(event, data) {
    if (this._io) {
      this._io.emit(event, data);
    }
  }
}

export default new ZoneService();
