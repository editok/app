import { ReactNode, useState, useMemo, Fragment, useCallback } from 'react';
import type { ReactElement } from 'react';
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import Badge from './Badge';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  actions?: (row: T) => ReactNode;
  expandedRow?: (row: T) => ReactNode;
  emptyMessage?: string;
  toolbar?: ReactNode;
}

export default function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Search...',
  pageSize = 8,
  actions,
  expandedRow,
  emptyMessage = 'No data found',
  toolbar,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let r = data ?? [];
    if (search && searchable) {
      const q = search.toLowerCase();
      r = r.filter((row) =>
        columns.some((col) => {
          const val = (row as Record<string, unknown>)[col.key as string];
          return val != null && String(val).toLowerCase().includes(q);
        })
      );
    }
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey];
        const bv = (b as Record<string, unknown>)[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return r;
  }, [data, search, sortKey, sortDir, columns, searchable]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const current = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
  const visibleColumns = useMemo(() => columns.filter((c) => !c.hideOnMobile), [columns]);

  const toggleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  return (
    <div>
      {(searchable || toolbar) && (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          {searchable && (
            <div className="relative flex-1 max-w-xs min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={searchPlaceholder}
                className="w-full min-h-11 pl-9 pr-3 py-2 text-sm border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 transition-all"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {/* Desktop: traditional table */}
      <div className="hidden md:block overflow-x-auto -mx-1">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-ink-100 dark:border-ink-800">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`text-left text-xs 2xl:text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider py-3 px-3 2xl:py-4 2xl:px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                  style={{ width: col.width }}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(String(col.key))}
                      className="inline-flex items-center gap-1 hover:text-ink-800 dark:hover:text-ink-200 transition-colors"
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  ) : col.label}
                </th>
              ))}
              {actions && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {current.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-12 text-ink-400 dark:text-ink-500 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              current.map((row, i) => (
                <Fragment key={row.id ?? i}>
                <tr
                  className="border-b border-ink-50 dark:border-ink-800/50 hover:bg-primary-50/30 dark:hover:bg-primary-500/5 transition-colors"
                  style={{ animation: `staggerIn 0.3s ease ${i * 40}ms both` }}
                >
                  {columns.map((col) => {
                    const val = (row as Record<string, unknown>)[col.key as string];
                    return (
                      <td
                        key={String(col.key)}
                        className={`py-3.5 px-3 2xl:py-4 2xl:px-4 text-sm 2xl:text-base text-ink-700 dark:text-ink-200 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                      >
                        {col.render ? col.render(row) : col.key === 'status' ? <Badge status={String(val)} /> : String(val ?? '')}
                      </td>
                    );
                  })}
                  {actions && <td className="py-3.5 px-3 text-right whitespace-nowrap">{actions(row)}</td>}
                </tr>
                {expandedRow && expandedRow(row) && (
                  <tr>
                    <td colSpan={columns.length + (actions ? 1 : 0)} className="p-0">{expandedRow(row)}</td>
                  </tr>
                )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {current.length === 0 ? (
          <div className="text-center py-12 text-ink-400 dark:text-ink-500 text-sm">{emptyMessage}</div>
        ) : (
          current.map((row, i) => {
            const primaryCol = visibleColumns[0];
            const primaryVal = primaryCol ? (row as Record<string, unknown>)[primaryCol.key as string] : '';
            return (
              <div
                key={row.id ?? i}
                className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-4 shadow-card animate-stagger-in"
                style={{ animation: `staggerIn 0.3s ease ${i * 40}ms both` }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    {primaryCol?.render ? primaryCol.render(row) : (
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                        {String(primaryVal ?? '')}
                      </p>
                    )}
                  </div>
                </div>
                {actions && <div className="flex items-center gap-1.5 flex-wrap mb-3">{actions(row)}</div>}
                {expandedRow && expandedRow(row)}
                <div className="space-y-1.5">
                  {visibleColumns.slice(1).map((col) => {
                    const val = (row as Record<string, unknown>)[col.key as string];
                    return (
                      <div key={String(col.key)} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-ink-400 dark:text-ink-500 font-medium shrink-0">{col.label}</span>
                        <span className="text-ink-700 dark:text-ink-200 text-right min-w-0 truncate">
                          {col.render ? col.render(row) : col.key === 'status' ? <Badge status={String(val)} /> : String(val ?? '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-50 dark:border-ink-800/50">
          <p className="text-xs text-ink-400 dark:text-ink-500 hidden sm:block">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </p>
          <p className="text-xs text-ink-400 dark:text-ink-500 sm:hidden">
            {page} / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="min-h-11 px-3 py-2 text-xs font-medium border border-ink-200 dark:border-ink-700 dark:text-ink-300 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              Previous
            </button>
            {(() => {
              const maxButtons = 5;
              let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
              if (startPage + maxButtons - 1 > totalPages) startPage = totalPages - maxButtons + 1;
              startPage = Math.max(1, startPage);
              const endPage = Math.min(totalPages, startPage + maxButtons - 1);
              const buttons: ReactNode[] = [];
              if (startPage > 1) {
                buttons.push(
                  <button key="first" onClick={() => setPage(1)} className="w-11 h-11 text-xs font-medium rounded-lg border border-ink-200 dark:border-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 transition-all hover:scale-110 active:scale-95">
                    1
                  </button>
                );
                if (startPage > 2) buttons.push(<span key="ellipsis" className="px-1 text-ink-400 text-xs">…</span>);
              }
              for (let p = startPage; p <= endPage; p++) {
                buttons.push(
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-11 h-11 text-xs font-medium rounded-lg transition-all hover:scale-110 active:scale-95 ${
                      page === p ? 'bg-primary-600 text-white shadow-glow' : 'border border-ink-200 dark:border-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
                    }`}
                  >
                    {p}
                  </button>
                );
              }
              if (endPage < totalPages) {
                if (endPage < totalPages - 1) buttons.push(<span key="ellipsis2" className="px-1 text-ink-400 text-xs">…</span>);
                buttons.push(
                  <button key="last" onClick={() => setPage(totalPages)} className="w-11 h-11 text-xs font-medium rounded-lg border border-ink-200 dark:border-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 transition-all hover:scale-110 active:scale-95">
                    {totalPages}
                  </button>
                );
              }
              return buttons;
            })()}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="min-h-11 px-3 py-2 text-xs font-medium border border-ink-200 dark:border-ink-700 dark:text-ink-300 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
