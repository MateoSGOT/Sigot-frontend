import React from 'react';
import { MdSearch, MdFilterList } from 'react-icons/md';
import './SearchBar.css';

export default function SearchBar({ value, onChange, placeholder = 'Buscar...', filterSlot, rightSlot }) {
  return (
    <div className="searchbar">
      <div className="searchbar__input-wrapper">
        <MdSearch className="searchbar__icon" size={20} />
        <input
          type="text"
          className="searchbar__input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {filterSlot && <div className="searchbar__filters">{filterSlot}</div>}
      {rightSlot && <div className="searchbar__right">{rightSlot}</div>}
    </div>
  );
}
