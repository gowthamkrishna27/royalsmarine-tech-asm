export const gpsService = {
  getCurrentCoordinates: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: new Date(pos.timestamp).toISOString(),
          });
        },
        (err) => {
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  },

  reverseGeocode: async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
      if (!res.ok) throw new Error('Geocoding service unavailable');
      const data = await res.json();
      return data.display_name || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    } catch {
      return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    }
  },
};

export default gpsService;
