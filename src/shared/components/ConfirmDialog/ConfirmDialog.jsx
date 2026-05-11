import React from 'react';
import { MdWarning } from 'react-icons/md';
import Modal from '../Modal/Modal.jsx';
import './ConfirmDialog.css';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', danger = false, loading = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="confirm-dialog">
        <div className={`confirm-dialog__icon ${danger ? 'confirm-dialog__icon--danger' : 'confirm-dialog__icon--warning'}`}>
          <MdWarning size={32} />
        </div>
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button className="btn btn--outline" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm} disabled={loading}>
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
