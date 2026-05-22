import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../../shared/services/api.js';
import './LoginPage.css';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (nuevaPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (nuevaPassword !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    if (!token) { setError('Token inválido. Solicita un nuevo enlace de recuperación.'); return; }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, nuevaPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">S</div>
          <span className="login-logo-text">SIGOT</span>
        </div>
        <h2 className="login-title">Nueva contraseña</h2>
        <p className="login-subtitle">Ingresa y confirma tu nueva contraseña.</p>

        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ color: '#b5f23d', fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
            <p style={{ color: '#b5f23d', fontWeight: 600 }}>Contraseña actualizada correctamente.</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Redirigiendo al inicio de sesión...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="login-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Nueva contraseña</label>
              <input
                type="password"
                className="form-control"
                value={nuevaPassword}
                onChange={e => setNuevaPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar contraseña</label>
              <input
                type="password"
                className="form-control"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repite la contraseña"
                required
              />
            </div>
            <button type="submit" className="btn btn--primary login-btn" disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
