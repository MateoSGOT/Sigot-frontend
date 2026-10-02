import api from '../../../shared/services/api.js';

// Autoregistro de clientes (self-service, 3 pasos). Reemplaza el modelo anterior, donde
// todas las cuentas de cliente las creaba el taller a mano desde ClientesPage.
//
// Los 3 pasos son endpoints separados a propósito: la cuenta no existe en la BD hasta el
// paso 3 (Cliente.Documento/Id_TipoDoc son NOT NULL), así que mientras tanto vive en la
// tabla RegistroPendiente del backend identificada por el correo. Por eso TODOS los pasos
// reenvían el Correo: es la llave del registro en curso, no hay sesión todavía.
export const registroService = {
  // Paso 1 — correo + contraseña. Dispara el código de verificación por correo (Resend).
  async registrar(Correo, Password, ConfirmarPassword) {
    const r = await api.post('/api/auth/registro', { Correo, Password, ConfirmarPassword });
    return r.data;
  },

  // Paso 2 — valida el código de 6 dígitos.
  async verificarCodigo(Correo, Codigo) {
    const r = await api.post('/api/auth/verificar-codigo', { Correo, Codigo });
    return r.data;
  },

  async reenviarCodigo(Correo) {
    const r = await api.post('/api/auth/reenviar-codigo', { Correo });
    return r.data;
  },

  // Paso 3 — datos legales. Devuelve el token para entrar directo al portal.
  async completarRegistro(datos) {
    const r = await api.post('/api/auth/completar-registro', datos);
    return r.data;
  },

  // Catálogo público (no requiere sesión, que es justo lo que hace falta acá: en el paso 3
  // el usuario todavía no tiene cuenta). Ver catalogo.routes.js::/tipos-documento.
  // OJO con el prefijo: el mount en app.js es '/api/catalogos' en PLURAL, aunque el
  // archivo de rutas se llame catalogo.routes.js en singular.
  async getTiposDocumento() {
    const r = await api.get('/api/catalogos/tipos-documento');
    return Array.isArray(r.data?.data) ? r.data.data : [];
  },
};
