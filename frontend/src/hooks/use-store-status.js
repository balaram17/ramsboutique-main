import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

export const useStoreStatus = (pollMs = 60000) => {
  const [status, setStatus] = useState({ open: true, message: '', hours: null });
  const [loaded, setLoaded] = useState(false);

  const fetch = useCallback(() => {
    api.get('/store-status')
      .then((r) => setStatus(r.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, pollMs);
    return () => clearInterval(id);
  }, [fetch, pollMs]);

  return { ...status, loaded, refresh: fetch };
};
