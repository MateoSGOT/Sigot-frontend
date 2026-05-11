import React, { useState, useEffect } from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import './Table.css';

const DEFAULT_PAGE_SIZE = 10;

export default function Table({ columns, data, loading, emptyMessage = 'No hay registros', pageSize: externalPageSize }) {
  const [page, setPage] = useState(1);
  const [internalPageSize] = useState(DEFAULT_PAGE_SIZE);

  const effectivePageSize = externalPageSize ?? internalPageSize;
  const showAll = effectivePageSize === 'all';

  // Reset to page 1 when data or pageSize changes
  useEffect(() => { setPage(1); }, [data.length, effectivePageSize]);

  if (loading) {
    return (
      <div className="table-loading">
        <div className="table-spinner" />
        <span>Cargando...</span>
      </div>
    );
  }

  const totalItems = data.length;
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const start = showAll ? 0 : (safePage - 1) * effectivePageSize;
  const pageData = showAll ? data : data.slice(start, start + effectivePageSize);

  const goTo = (p) => setPage(Math.max(1, Math.min(p, totalPages)));

  return (
    <div>
      <div className="table-wrapper">
        <table className="table">
          <thead className="table__head">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="table__th" style={col.width ? { width: col.width } : {}}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table__empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((row, rowIndex) => {
                if (row._separator) {
                  return (
                    <tr key={`sep-${rowIndex}`} className="table__row table__row--separator">
                      <td colSpan={columns.length} className="table__td table__td--separator">
                        {row._label}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={row.id || row.Id_Rol || rowIndex}
                    className={`table__row ${row.Estado === 0 ? 'table__row--inactive' : ''}`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="table__td">
                        {col.render ? col.render(row[col.key], row, rowIndex) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Minimalist pagination — only shows if more than 1 page */}
      {totalPages > 1 && (
        <div className="table-pagination">
          <button
            className="table-pagination__btn"
            onClick={() => goTo(safePage - 1)}
            disabled={safePage === 1}
          >
            <MdChevronLeft size={16} />
          </button>
          <span className="table-pagination__current">{safePage}</span>
          <span className="table-pagination__sep">de</span>
          <span className="table-pagination__total">{totalPages}</span>
          <button
            className="table-pagination__btn"
            onClick={() => goTo(safePage + 1)}
            disabled={safePage === totalPages}
          >
            <MdChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
