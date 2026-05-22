import React, { useRef } from 'react';
import { MdCameraAlt } from 'react-icons/md';
import './ImageUploader.css';

export default function ImageUploader({ preview, onChange, size = 80, disabled, initials }) {
  const ref = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no puede superar 2 MB.');
      e.target.value = '';
      return;
    }
    onChange(file);
  };

  return (
    <div
      className="img-uploader"
      style={{ width: size, height: size, minWidth: size }}
      onClick={() => !disabled && ref.current?.click()}
      title={disabled ? '' : 'Cambiar foto'}
    >
      {preview ? (
        <img src={preview} alt="avatar" className="img-uploader__img" />
      ) : (
        <div className="img-uploader__placeholder">
          {initials
            ? <span className="img-uploader__initials">{initials}</span>
            : <MdCameraAlt size={Math.round(size * 0.35)} />
          }
        </div>
      )}
      {!disabled && (
        <div className="img-uploader__overlay">
          <MdCameraAlt size={16} />
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}
