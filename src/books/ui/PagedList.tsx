import React, { useEffect, useMemo, useState } from 'react';
import { btnGhost, Card, Empty } from './index';

export function usePaging<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, pages);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const slice = useMemo(() => rows.slice((safe - 1) * pageSize, safe * pageSize), [rows, safe, pageSize]);
  return { page: safe, pages, slice, setPage, total: rows.length, pageSize };
}

export function Pager({ page, pages, total, pageSize, onPage }: { page: number; pages: number; total: number; pageSize: number; onPage: (n: number) => void }) {
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-[#E5E7EB] text-sm text-[#6B7280]">
      <p>{start}–{end} of {total}</p>
      <div className="flex gap-2">
        <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className={btnGhost} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function PagedTable<T = any>({
  rows,
  empty,
  pageSize = 10,
  minWidth = 'min-w-[720px]',
  children,
}: {
  rows: T[];
  empty: string;
  pageSize?: number;
  minWidth?: string;
  children: (slice: T[]) => React.ReactNode;
}) {
  const paging = usePaging(rows, pageSize);
  if (rows.length === 0) return <Card><Empty text={empty} /></Card>;
  return (
    <Card>
      <div className="overflow-x-auto">
        <div className={minWidth}>{children(paging.slice)}</div>
      </div>
      <Pager page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPage={paging.setPage} />
    </Card>
  );
}
