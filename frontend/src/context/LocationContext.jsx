import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

const LocationContext = createContext(null);
const LOC_KEY = 'rb_loc';

const readLoc = () => {
  try { return JSON.parse(localStorage.getItem(LOC_KEY) || 'null'); } catch (_) { return null; }
};

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(readLoc);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    try {
      if (location) localStorage.setItem(LOC_KEY, JSON.stringify(location));
    } catch (_) { /* storage disabled */ }
  }, [location]);

  const detect = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      setChecking(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude: lat, longitude: lng } = pos.coords;
            const { data } = await api.post('/location/check', { lat, lng });
            const loc = { lat, lng, ...data };
            setLocation(loc);
            resolve(loc);
          } catch (e) { reject(e); }
          finally { setChecking(false); }
        },
        (err) => { setChecking(false); reject(err); },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }, []);

  const setManual = useCallback(async (lat, lng) => {
    setChecking(true);
    try {
      const { data } = await api.post('/location/check', { lat, lng });
      const loc = { lat, lng, ...data };
      setLocation(loc);
      return loc;
    } finally { setChecking(false); }
  }, []);

  const clearLoc = useCallback(() => {
    setLocation(null);
    try { localStorage.removeItem(LOC_KEY); } catch (_) { /* storage disabled */ }
  }, []);

  const value = useMemo(
    () => ({ location, checking, detect, setManual, clearLoc }),
    [location, checking, detect, setManual, clearLoc],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useLocationCtx = () => useContext(LocationContext);
