import React, { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import type { BooksFile } from '../core/types';
import { booksFileUrl } from '../storage/adapter';

const ghost = 'byjan-btn-ghost disabled:opacity-50';

export default function AttachmentList({ files, empty = 'No supporting files yet.' }: { files: BooksFile[]; empty?: string }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const next: Record<string, string> = {};
    Promise.all(files.map(async (file) => {
      try {
        next[file.id] = await booksFileUrl(file.path || file.url || '');
      } catch {
        next[file.id] = '';
      }
    })).then(() => {
      if (!cancelled) setUrls({ ...next });
    });
    return () => {
      cancelled = true;
      Object.values(next).forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, [files.map((f) => f.id).join('|')]);

  if (files.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {files.map((file) => {
        const preview = urls[file.id];
        const isImage = (file.contentType || '').startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
        return (
          <li key={file.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-2">
            <span className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {isImage && preview ? (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : isImage ? (
                <ImageIcon className="w-5 h-5 text-slate-500" />
              ) : (
                <FileText className="w-5 h-5 text-slate-500" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0B1F3A] truncate">{file.name}</p>
              <p className="text-[11px] text-slate-500">{file.ext.toUpperCase()} · {Math.max(1, Math.round(file.size / 1024))} KB</p>
            </div>
            {preview && (
              <button type="button" className={ghost} onClick={() => window.open(preview, '_blank', 'noopener')}>
                Open
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
