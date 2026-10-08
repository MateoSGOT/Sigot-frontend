import React, { useEffect, useState } from 'react';
import { MdCheckCircle, MdError, MdInfo, MdWarning, MdClose } from 'react-icons/md';
import './Toast.css';

const ICONS = {
  success: MdCheckCircle,
  error: MdError,
  warning: MdWarning,
  info: MdInfo,
};

export default function Toast({ type = 'info', message, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const Icon = ICONS[type] || MdInfo;

  return (
    <div className={`toast toast--${type} ${visible ? 'toast--visible' : ''}`}>
      <div className="toast__icon">
        <Icon size={20} />
      </div>
      <span className="toast__message">{message}</span>
      <button className="toast__close max-lg:min-h-[44px] max-lg:min-w-[44px]" onClick={handleClose}>
        <MdClose size={16} />
      </button>
    </div>
  );
}
