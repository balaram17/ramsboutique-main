import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'rb_token';

const storeToken = (t) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch (_) { /* storage disabled */ }
};
const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch (_) { /* storage disabled */ }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; } })();
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then((r) => { if (!cancelled) setUser(r.data); })
      .catch(() => { clearToken(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    storeToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const adminLogin = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/admin-login', { email, password });
    storeToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (payload) => {
    const { data } = await api.post('/auth/signup', payload);
    storeToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

const verifyOtp = useCallback(async (phone, otp) => {
  // Directly fires values to your self-managed FastAPI routes
  const { data } = await api.post('/auth/verify-otp', { 
    phone: phone, 
    otp: otp 
  });
  storeToken(data.token);
  setUser(data.user);
  return data.user;
}, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const { data } = await api.patch('/auth/me', payload);
    setUser(data);
    return data;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, adminLogin, signup, verifyOtp, updateProfile, logout }),
    [user, loading, login, adminLogin, signup, verifyOtp, updateProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
