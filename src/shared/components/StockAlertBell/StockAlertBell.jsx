import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdNotifications, MdWarning } from 'react-icons/md';
import api from '../../services/api.js';
import Skeleton from '../Skeleton/Skeleton.jsx';
import './StockAlertBell.css';

export default function StockAlertBell() {
  const navigate = useNavigate();
  const [items, setItems]       = useState([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const ref = useRef(null);

  const fetchStockBajo = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/repuestos/stock-bajo');
      setItems(r.data?.data || []);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStockBajo(); }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = items.length;

  return (
    <div className="stock-bell" ref={ref}>
      <button
        className={`stock-bell__btn ${count > 0 ? 'stock-bell__btn--alert' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Alertas de stock"
      >
        <MdNotifications size={20} />
        {count > 0 && <span className="stock-bell__badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="stock-bell__dropdown">
          <div className="stock-bell__header">
            <MdWarning size={16} />
            <span>Stock bajo ({count})</span>
          </div>
          {loading && (
            <div className="stock-bell__loading">
              {[0, 1, 2].map(i => (
                <div key={i} className="stock-bell__skeleton-row">
                  <Skeleton width="55%" height={11} />
                  <Skeleton width={64} height={16} radius="var(--radius-full)" />
                </div>
              ))}
            </div>
          )}
          {!loading && count === 0 && <div className="stock-bell__empty">Sin alertas de stock</div>}
          {!loading && items.map(item => (
            <div
              key={item.Id_Repuesto}
              className={`stock-bell__item ${item.criticidad === 'critico' ? 'stock-bell__item--critico' : 'stock-bell__item--bajo'}`}
              onClick={() => { setOpen(false); navigate('/repuestos'); }}
            >
              <span className="stock-bell__item-name">{item.NombreRepuesto}</span>
              <span className="stock-bell__item-stock">
                {item.criticidad === 'critico'
                  ? <span className="stock-bell__chip stock-bell__chip--critico">AGOTADO</span>
                  : <span className="stock-bell__chip stock-bell__chip--bajo">Stock: {item.Stock}/{item.StockMinimo}</span>
                }
              </span>
            </div>
          ))}
          {count > 0 && (
            <button className="stock-bell__ver-todos" onClick={() => { setOpen(false); navigate('/repuestos'); }}>
              Ver todos en Repuestos →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
