/**
 * ═══════════════════════════════════════════════════════════════
 * GEOCODING UTILITY
 * ═══════════════════════════════════════════════════════════════
 * Converts city names to latitude/longitude coordinates
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */

const https = require('https');

/**
 * Convert city name to coordinates (latitude, longitude)
 * @param {string} city - City name to geocode
 * @param {string} country - Optional country name or code (default: Algeria)
 * @returns {Promise<Object>} - { latitude, longitude, city, formattedAddress }
 * @throws {Error} if geocoding fails or city not found
 */
const cityToCoordinates = async (city, country = 'Algeria') => {
  return new Promise((resolve, reject) => {
    if (!city || typeof city !== 'string' || city.trim() === '') {
      return reject(new Error('City name is required and must be a non-empty string.'));
    }

    const trimmedCity = city.trim();
    const query = `${trimmedCity}, ${country}`;
    
    // OpenStreetMap Nominatim API (requires user-agent header)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

    const options = {
      headers: {
        'User-Agent': 'Tutoring-Platform/1.0',
        'Accept': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const results = JSON.parse(data);

          if (!results || results.length === 0) {
            return reject(new Error(`City "${trimmedCity}" not found in ${country}`));
          }

          const location = results[0];
          const latitude = parseFloat(location.lat);
          const longitude = parseFloat(location.lon);
          const displayName = location.display_name || `${trimmedCity}, ${country}`;

          resolve({
            latitude,
            longitude,
            city: trimmedCity,
            country,
            formattedAddress: displayName,
            source: 'nominatim'
          });
        } catch (err) {
          reject(new Error(`Failed to parse geocoding response: ${err.message}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Geocoding API request failed: ${err.message}`));
    });
  });
};

/**
 * Validate coordinates (latitude, longitude)
 * @param {number} latitude - Latitude value
 * @param {number} longitude - Longitude value
 * @returns {boolean} - true if valid coordinates
 */
const validateCoordinates = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;

  return true;
};

module.exports = {
  cityToCoordinates,
  validateCoordinates
};
