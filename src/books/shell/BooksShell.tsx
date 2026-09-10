import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BOOKS_TREE, branchByPath, moduleByPath } from '../catalog/modules';
import { useBooks } from '../context/BooksProvider';
import { BooksPageMode, FeatureIcon } from '../ui';
import CommandPalette from '../ui/CommandPalette';

export default function BooksShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { tenant } = useBooks();
  const module = moduleByPath(location.pathname);
  const current = branchByPath(location.pathname);
  const siblings = (BOOKS_TREE.find((branch) => branch.id === current.id)?.items || []).filter((item) => item.href !== module.href);

  return (
    <div className="books-root h-full min-h-0 flex flex-col overflow-hidden text-[#0B1F3A] bg-[#F5F7FA]">
      <header className="shrink-0 z-30 border-b border-[#E5E7EB] bg-white px-4 min-h-14 py-2 flex items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-[#0B1F3A] text-white flex items-center justify-center shadow-[0_8px_16px_-10px_rgba(11,31,58,0.7)] shrink-0">
            <FeatureIcon href={module.href} className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[16px] font-semibold tracking-tight truncate">{module.name}</h1>
            <p className="text-[11px] text-slate-500 truncate">{tenant?.name || 'Books'} · {current.name}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 overflow-x-auto py-0.5">
          {siblings.slice(0, 6).map((rel) => (
            <Link
              key={rel.href}
              to={rel.href}
              title={rel.name}
              className="group inline-flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-[#0B1F3A] shrink-0"
            >
              <span className="w-6 h-6 rounded-md bg-[#F4F7FB] text-[#0B1F3A] border border-slate-200/80 flex items-center justify-center group-hover:bg-white">
                <FeatureIcon href={rel.href} className="w-3.5 h-3.5" />
              </span>
              <span className="hidden lg:inline text-[12px] font-semibold max-w-[9rem] truncate">{rel.name}</span>
            </Link>
          ))}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">
        <BooksPageMode embedded>{children}</BooksPageMode>
      </div>
      <CommandPalette />
    </div>
  );
}
