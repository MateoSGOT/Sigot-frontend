import React, { useState, useEffect } from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import EmptyState from '../EmptyState/EmptyState.jsx';
import { TableSkeleton } from '../Skeleton/Skeleton.jsx';
import './Table.css';

const DEFAULT_PAGE_SIZE = 10;

export default function Table({
  columns,
  data,
  loading,
  emptyMessage = 'No hay registros',
  emptyState,        // { title, description, actionLabel, onAction, icon } — override opcional
  searchTerm,        // si hay búsqueda activa y no hay datos → variante "sin resultados"
  onClearSearch,     // acción "Limpiar búsqueda" para la variante no-results
  pageSize: externalPageSize,
}) {
  const [page, setPage] = useState(1);
  const [internalPageSize] = useState(DEFAULT_PAGE_SIZE);

  const effectivePageSize = externalPageSize ?? internalPageSize;
  const showAll = effectivePageSize === 'all';

  useEffect(() => { setPage(1); }, [data.length, effectivePageSize]);

  const totalItems = data.length;
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const start = showAll ? 0 : (safePage - 1) * effectivePageSize;
  const pageData = showAll ? data : data.slice(start, start + effectivePageSize);

  const goTo = (p) => setPage(Math.max(1, Math.min(p, totalPages)));

  const skeletonRows = typeof effectivePageSize === 'number' ? Math.min(effectivePageSize, 8) : 6;

  // Estado vacío: distingue "sin resultados de búsqueda" de "aún no hay datos".
  const renderEmpty = () => {
    if (emptyState) {
      return <EmptyState variant={searchTerm ? 'no-results' : 'empty'} {...emptyState} />;
    }
    if (searchTerm) {
      return (
        <EmptyState
          variant="no-results"
          title="Sin coincidencias"
          description={`Ningún registro coincide con “${searchTerm}”.`}
          actionLabel={onClearSearch ? 'Limpiar búsqueda' : undefined}
          onAction={onClearSearch}
        />
      );
    }
    return <EmptyState variant="empty" title={emptyMessage} />;
  };

  return (
    <div>
      <div className="table-wrapper">
        <table className="table">
          <thead className="table__head">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`table__th ${col.numeric ? 'table__th--num' : ''}`} style={col.width ? { width: col.width } : {}}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={columns.length} rows={skeletonRows} />
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table__empty-cell">
                  {renderEmpty()}
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
                      <td key={col.key} className={`table__td ${col.numeric ? 'table__td--num' : ''}`}>
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

      {!loading && totalPages > 1 && (
        <div className="table-pagination">
          <button className="table-pagination__btn" onClick={() => goTo(safePage - 1)} disabled={safePage === 1} aria-label="Página anterior">
            <MdChevronLeft size={16} />
          </button>
          <span className="table-pagination__current">{safePage}</span>
          <span className="table-pagination__sep">de</span>
          <span className="table-pagination__total">{totalPages}</span>
          <button className="table-pagination__btn" onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages} aria-label="Página siguiente">
            <MdChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
