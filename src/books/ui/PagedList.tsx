import React, { useEffect, useMemo, useState } from 'react';
import { getRuntimePrefs } from '../../lib/app-prefs';

const btnGhost = 'byjan-btn-ghost disabled:opacity-50';
const PAGE_SIZES = [10, 25, 50, 100];

function Card({ children }: { children: React.ReactNode }) {
  return <div className="byjan-card">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-14 text-center text-sm text-slate-500">{text}</div>;
}

function defaultSearchText(row: unknown) {
  if (row == null) return '';
  if (typeof row !== 'object') return String(row);
  try {
    return Object.values(row as Record<string, unknown>)
      .filter((value) => value == null || ['string', 'number', 'boolean'].includes(typeof value))
      .join(' ');
  } catch {
    return '';
  }
}

export function usePaging<T>(rows: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, pages);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const slice = useMemo(() => rows.slice((safe - 1) * pageSize, safe * pageSize), [rows, safe, pageSize]);
  return { page: safe, pages, slice, setPage, total: rows.length, pageSize, setPageSize };
}

export function Pager({
  page,
  pages,
  total,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (n: number) => void;
  onPageSize?: (n: number) => void;
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-[#E5E7EB] text-sm text-[#6B7280]">
      <p>{start}–{end} of {total}</p>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <label className="flex items-center gap-1.5 text-xs">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="border border-slate-200 rounded-md px-1.5 py-1 bg-white text-xs"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className={btnGhost} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

type PagedTableProps<T> = {
  rows: T[];
  empty: string;
  pageSize?: number;
  minWidth?: string;
  searchPlaceholder?: string;
  searchText?: (row: T) => string;
  children: (slice: T[]) => React.ReactNode;
};

export function PagedTable<T>(props: PagedTableProps<T>) {
  const { rows, empty, minWidth = 'min-w-[720px]', children } = props;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const getter = props.searchText || defaultSearchText;
    return rows.filter((row) => getter(row).toLowerCase().includes(q));
  }, [rows, query, props.searchText]);
  const paging = usePaging(filtered, props.pageSize ?? getRuntimePrefs().listPageSize);
  return (
    <Card>
      <div className="p-3 border-b border-[#E5E7EB]">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            paging.setPage(1);
          }}
          placeholder={props.searchPlaceholder || 'Search this list'}
          className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {filtered.length === 0 ? <Empty text={query.trim() ? 'No rows match this search.' : empty} /> : (
        <>
          <div className="overflow-x-auto">
            <div className={minWidth}>{children(paging.slice)}</div>
          </div>
          <Pager
            page={paging.page}
            pages={paging.pages}
            total={paging.total}
            pageSize={paging.pageSize}
            onPage={paging.setPage}
            onPageSize={paging.setPageSize}
          />
        </>
      )}
    </Card>
  );
}
