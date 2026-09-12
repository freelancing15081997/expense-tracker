import React, { useState } from 'react';
import { FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { BooksFile } from '../core/types';
import { booksFileUrl } from '../storage/adapter';
import { ReceiptModal, attachmentKind } from '../../components/ReceiptModal';

export default function AttachmentList({ files, empty = 'No supporting files yet.' }: { files: BooksFile[]; empty?: string }) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string; kind: 'image' | 'pdf' | 'file'; fileName: string } | null>(null);

  if (files.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }

  const openFile = async (file: BooksFile) => {
    if (openingId) return;
    setOpeningId(file.id);
    setPreview({ url: '', title: file.name, kind: attachmentKind(file.name, file.contentType), fileName: file.name });
    try {
      const url = await booksFileUrl(file.path || file.url || '');
      setPreview({ url, title: file.name, kind: attachmentKind(file.name, file.contentType), fileName: file.name });
    } catch {
      setPreview(null);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <>
      <ul className="space-y-2">
        {files.map((file) => {
          const isImage = (file.contentType || '').startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
          const busy = openingId === file.id;
          return (
            <li key={file.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
              <span className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                {busy ? <Loader2 className="w-4 h-4 text-slate-500 animate-spin" /> : isImage ? <ImageIcon className="w-4 h-4 text-slate-500" /> : <FileText className="w-4 h-4 text-slate-500" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#0B1F3A] truncate">{file.name}</p>
                <p className="text-[11px] text-slate-500">{file.ext.toUpperCase()} · {Math.max(1, Math.round(file.size / 1024))} KB</p>
              </div>
              <button type="button" className="byjan-btn-ghost h-8 px-3 text-xs" disabled={Boolean(openingId)} onClick={() => void openFile(file)}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {busy ? 'Opening' : 'Open'}
              </button>
            </li>
          );
        })}
      </ul>
      {preview && (
        <ReceiptModal
          imageUrl={preview.url || null}
          expenseTitle={preview.title}
          kind={preview.kind}
          fileName={preview.fileName}
          loading={!preview.url && Boolean(openingId)}
          verified={false}
          onClose={() => {
            setPreview(null);
            setOpeningId(null);
          }}
        />
      )}
    </>
  );
}
