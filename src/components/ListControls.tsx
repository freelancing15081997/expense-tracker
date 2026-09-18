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

export function ListSearch(props: {
  query: string;
  onQuery: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="byjan-search w-full">
      <Search className="w-4 h-4 text-slate-400 shrink-0" />
      <input
        type="search"
        value={props.query}
        onChange={(e) => props.onQuery(e.target.value)}
        placeholder={props.placeholder || 'Search'}
      />
    </label>
  );
}

export function ListPager(props: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  pageSize: number;
  onPageSize: (size: number) => void;
  total: number;
}) {
  const start = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const end = Math.min(props.page * props.pageSize, props.total);
  return (
    <nav className="list-pager" aria-label="List pages">
      <div className="list-pager-meta">
        <span className="list-pager-kicker">Pages</span>
        <strong>{start}–{end}</strong>
        <span>of {props.total}</span>
      </div>
      <div className="list-pager-actions">
        <label className="list-pager-size">
          <span>Rows</span>
          <select
            value={props.pageSize}
            onChange={(e) => props.onPageSize(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)} aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="list-pager-now">{props.page}/{props.totalPages}</span>
        <button type="button" disabled={props.page >= props.totalPages} onClick={() => props.onPage(props.page + 1)} aria-label="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
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
  return (
    <div className="space-y-2">
      <ListSearch query={props.query} onQuery={props.onQuery} placeholder={props.placeholder} />
    </div>
  );
}
