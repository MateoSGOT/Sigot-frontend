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
    // Solo forzamos la redirección dura a /login cuando HABÍA sesión (token
    // presente) y el servidor la rechaza → expiración real de sesión.
    // Si ya no hay token (estamos cerrando sesión a propósito, o cualquier
    // 401 posterior al logout), NO redirigimos: dejamos que React Router lleve
    // a la landing. Antes, cualquier 401 durante el logout pisaba navigate('/')
    // con window.location y terminaba en el login.
    const hadToken = !!localStorage.getItem(TOKEN_KEY);
    if (error.response?.status === 401 && hadToken) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export { TOKEN_KEY };
