import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Interceptor para enviar JWT token y credenciales de catálogo locales si existen
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Claves guardadas localmente por el usuario (BYOK)
  const rawgKey = localStorage.getItem('gametracker_rawg_key');
  if (rawgKey) {
    config.headers['x-rawg-key'] = rawgKey.trim();
  }

  const igdbClientId = localStorage.getItem('gametracker_igdb_client_id');
  const igdbClientSecret = localStorage.getItem('gametracker_igdb_client_secret');
  if (igdbClientId && igdbClientSecret) {
    config.headers['x-igdb-client-id'] = igdbClientId.trim();
    config.headers['x-igdb-client-secret'] = igdbClientSecret.trim();
  }

  return config;
});

export default API;