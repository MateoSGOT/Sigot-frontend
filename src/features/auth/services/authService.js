import api from '../../../shared/services/api.js';
import { TOKEN_KEY } from '../../../shared/services/api.js';

export const authService = {
  async login(Correo, Password) {
    const response = await api.post('/api/auth/login', { Correo, Password });
    return response.data;
  },
  async logout() {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    localStorage.removeItem(TOKEN_KEY);
  },
  async solicitarRecuperacion(Correo) {
    const response = await api.post('/api/auth/recuperar-password', { Correo });
    return response.data;
  },
};
