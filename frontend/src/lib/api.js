import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://ramsboutique-api-prod-endcc7bmbegsanca.southindia-01.azurewebsites.net';
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ 
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  }
 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
