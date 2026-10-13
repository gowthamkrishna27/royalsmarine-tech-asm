import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { gpsService } from '../services/gpsService';

export function useGps() {
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);

  const captureLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const position = await gpsService.getCurrentCoordinates();
      setCoords(position);

      const resolvedAddress = await gpsService.reverseGeocode(position.lat, position.lng);
      setAddress(resolvedAddress);
      toast.success('Location captured successfully');
      return { coords: position, address: resolvedAddress };
    } catch (err) {
      const errMsg = err.message || 'Could not capture location';
      setError(errMsg);
      toast.error('Location capture failed. Please provide a reason.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { captureLocation, loading, coords, address, error };
}

export default useGps;
