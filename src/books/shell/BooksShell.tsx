import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BOOKS_TREE, branchByPath, moduleByPath } from '../catalog/modules';
import { useBooks } from '../context/BooksProvider';
import { BooksPageMode, FeatureIcon } from '../ui';

export default function BooksShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { tenant } = useBooks();
  const module = moduleByPath(location.pathname);
  const current = branchByPath(location.pathname);
  const siblings = (BOOKS_TREE.find((branch) => branch.id === current.id)?.items || []).filter((item) => item.href !== module.href);

  return (
    <div className="books-root h-full min-h-0 flex flex-col text-[#0B1F3A] bg-[#F5F7FA]">
      <header className="shrink-0 z-20 border-b border-[#E5E7EB] bg-white px-4 h-11 flex items-center gap-3">
        <FeatureIcon href={module.href} className="w-5 h-5 shrink-0" />
        <h1 className="font-display text-[15px] font-semibold tracking-tight truncate">{module.name}</h1>
        <span className="hidden sm:inline text-[11px] text-slate-400 truncate">{tenant?.name}</span>
        <div className="ml-auto flex items-center gap-1 overflow-x-auto">
          {siblings.slice(0, 6).map((rel) => (
            <Link key={rel.href} to={rel.href} title={rel.name} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0B1F3A]">
              <FeatureIcon href={rel.href} className="w-4.5 h-4.5 w-5 h-5" />
            </Link>
          ))}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-3">
        <BooksPageMode embedded>{children}</BooksPageMode>
      </div>
    </div>
  );
}
