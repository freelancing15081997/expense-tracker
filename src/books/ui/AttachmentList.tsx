import React, { useState } from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import type { BooksFile } from '../core/types';
import { booksFileUrl } from '../storage/adapter';

export default function AttachmentList({ files, empty = 'No supporting files yet.' }: { files: BooksFile[]; empty?: string }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  if (files.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }

  const openFile = async (file: BooksFile) => {
    if (urls[file.id]) {
      window.open(urls[file.id], '_blank', 'noopener');
      return;
    }
    try {
      const url = await booksFileUrl(file.path || file.url || '');
      setUrls((prev) => ({ ...prev, [file.id]: url }));
      window.open(url, '_blank', 'noopener');
    } catch {
      // Keep the list responsive if a file URL is slow.
    }
  };

  return (
    <ul className="space-y-2">
      {files.map((file) => {
        const isImage = (file.contentType || '').startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
        return (
          <li key={file.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
            <span className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {isImage ? <ImageIcon className="w-4 h-4 text-slate-500" /> : <FileText className="w-4 h-4 text-slate-500" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0B1F3A] truncate">{file.name}</p>
              <p className="text-[11px] text-slate-500">{file.ext.toUpperCase()} · {Math.max(1, Math.round(file.size / 1024))} KB</p>
            </div>
            <button type="button" className="byjan-btn-ghost h-8 px-3 text-xs" onClick={() => void openFile(file)}>
              Open
            </button>
          </li>
        );
      })}
    </ul>
  );
}
