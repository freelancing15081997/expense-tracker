import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export function usePagedList<T>(rows: T[], filter: (row: T, query: string) => boolean, initialSize = 10) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => filter(row, q));
  }, [rows, query, filter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return {
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setPage(1);
    },
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (value: number) => {
      setPageSize(value);
      setPage(1);
    },
    filtered,
    pageRows,
    totalPages,
  };
}

export function ListControls(props: {
  query: string;
  onQuery: (value: string) => void;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  pageSize: number;
  onPageSize: (size: number) => void;
  total: number;
  placeholder?: string;
}) {
  const start = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const end = Math.min(props.page * props.pageSize, props.total);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
          placeholder={props.placeholder || 'Search'}
          className="byjan-input pl-9"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Rows</span>
        <select
          value={props.pageSize}
          onChange={(e) => props.onPageSize(Number(e.target.value))}
          className="byjan-input !w-auto !py-1.5 !h-auto text-xs"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="whitespace-nowrap">
          <span className="text-slate-900 font-medium">{start}-{end}</span> of {props.total}
        </span>
        <button type="button" className="p-1 rounded border border-slate-200 disabled:opacity-40" disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" className="p-1 rounded border border-slate-200 disabled:opacity-40" disabled={props.page >= props.totalPages} onClick={() => props.onPage(props.page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
