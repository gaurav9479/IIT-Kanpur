/**
 * trajectoryMath.js
 * Utility functions for geographic calculations and trajectory extrapolation.
 * 
 * WHY INVERSE HAVERSINE?
 * Euclidean approximations (like lat += speed * dx) fail over long distances and
 * near the poles because degrees of longitude shrink. Inverse Haversine strictly 
 * adheres to the Earth's curvature, ensuring millimeter-precise collision 
 * boundaries even in cross-campus flights.
 */

const EARTH_RADIUS_M = 6_371_000;

/**
 * Calculates the exact future latitude and longitude of a point after travelling
 * a specific distance in a specific heading direction.
 * 
 * @param {number} lat - Current latitude (degrees)
 * @param {number} lng - Current longitude (degrees)
 * @param {number} distanceM - Distance to travel (meters)
 * @param {number} headingDeg - True bearing/heading (degrees from North)
 * @returns {{lat: number, lng: number}} The extrapolated future coordinate
 */
export function inverseHaversine(lat, lng, distanceM, headingDeg) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const latRad = toRad(lat);
  const lngRad = toRad(lng);
  const headingRad = toRad(headingDeg);
  const angularDist = distanceM / EARTH_RADIUS_M;

  const futureLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDist) +
    Math.cos(latRad) * Math.sin(angularDist) * Math.cos(headingRad)
  );

  let futureLngRad = lngRad + Math.atan2(
    Math.sin(headingRad) * Math.sin(angularDist) * Math.cos(latRad),
    Math.cos(angularDist) - Math.sin(latRad) * Math.sin(futureLatRad)
  );

  // Normalize longitude to -180 to 180
  futureLngRad = ((futureLngRad + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

  return {
    lat: toDeg(futureLatRad),
    lng: toDeg(futureLngRad)
  };
}

/**
 * Standard Haversine distance between two points.
 * 
 * @param {{lat: number, lng: number}} p1 
 * @param {{lat: number, lng: number}} p2 
 * @returns {number} Distance in meters
 */
export function haversineDistance(p1, p2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Calculates the initial bearing/heading from point 1 to point 2.
 * 
 * @param {{lat: number, lng: number}} p1 
 * @param {{lat: number, lng: number}} p2 
 * @returns {number} Heading in degrees (0 to 360)
 */
export function headingBetweenPoints(p1, p2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const dLng = toRad(p2.lng - p1.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let bearing = Math.atan2(y, x);
  bearing = toDeg(bearing);
  return (bearing + 360) % 360;
}
