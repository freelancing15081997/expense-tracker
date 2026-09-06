import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BOOKS_TREE, branchByPath, moduleByPath } from '../catalog/modules';
import { useBooks } from '../context/BooksProvider';
import { BooksPageMode } from '../ui';

export default function BooksShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { tenant, role } = useBooks();
  const module = moduleByPath(location.pathname);
  const current = branchByPath(location.pathname);
  const siblings = (BOOKS_TREE.find((branch) => branch.id === current.id)?.items || []).filter((item) => item.href !== module.href);

  return (
    <div className="books-root h-full min-h-0 flex flex-col text-[#0B1F3A] bg-[#F8FAFC]">
      <header className="shrink-0 z-20 border-b border-[#E5E7EB] bg-white px-4 md:px-7 py-3 md:py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#12B8A8] font-semibold truncate">
          {current.name} · {tenant?.name || 'Byjan Books'} · {role || 'workspace'}
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mt-1">
          <div className="min-w-0">
            <h1 className="font-display text-xl md:text-2xl font-semibold tracking-tight truncate">{module.name}</h1>
            <p className="text-sm text-[#4B5563] mt-1 leading-relaxed hidden sm:block">{module.blurb}</p>
          </div>
          {siblings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {siblings.slice(0, 5).map((rel) => (
                <Link key={rel.href} to={rel.href} className="px-3 py-1.5 rounded-full border border-[#E5E7EB] text-xs font-medium text-[#0B1F3A] hover:bg-[#F3F4F6]">
                  {rel.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-7 py-5">
        <BooksPageMode embedded>{children}</BooksPageMode>
      </div>
    </div>
  );
}
