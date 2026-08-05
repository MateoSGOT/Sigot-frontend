import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'sigot_token';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    // El POST de /logout responde 401 (ya no hay token): es esperado y NO debe
    // forzar una redirección dura a /login — si no, pisa el navigate('/') del
    // cierre de sesión y termina en el login en vez de la landing.
    const isLogout = url.includes('/api/auth/logout');
    if (error.response?.status === 401 && !isLogout) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export { TOKEN_KEY };
