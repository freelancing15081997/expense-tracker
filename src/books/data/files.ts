import { doc, getDocs, setDoc, updateDoc, type Firestore, type QuerySnapshot } from 'firebase/firestore';
import { clean } from '../core/clean';
import { assertCan } from '../core/permissions';
import type { BooksFile, BooksTemplate } from '../core/types';
import { removeBooksBlob, storeBooksFile } from '../storage/adapter';
import { col, type TxCtx } from './repo';

function nowISO() {
  return new Date().toISOString();
}

function mapDocs<T>(snap: QuerySnapshot): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as T));
}

export async function loadFilesAndTemplates(db: Firestore, tenantId: string) {
  const [files, templates] = await Promise.all([
    getDocs(col(db, tenantId, 'files')),
    getDocs(col(db, tenantId, 'templates')),
  ]);
  return {
    files: mapDocs<BooksFile>(files).filter((f) => f.status !== 'archived').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    templates: mapDocs<BooksTemplate>(templates).filter((t) => t.status !== 'archived').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export async function uploadWorkspaceFile(ctx: TxCtx, input: { domain: string; resourceId?: string | null; file: File }) {
  assertCan(ctx.role, 'create');
  const fileRef = doc(col(ctx.db, ctx.tenantId, 'files'));
  const stored = await storeBooksFile(ctx.tenantId, fileRef.id, input.file);
  await setDoc(fileRef, clean({
    domain: input.domain,
    resourceId: input.resourceId || null,
    name: stored.name,
    ext: stored.ext,
    size: stored.size,
    contentType: stored.contentType,
    path: stored.path,
    status: 'active',
    createdAt: nowISO(),
    createdBy: ctx.uid,
  }));
  return { id: fileRef.id, path: stored.path };
}

export async function archiveWorkspaceFile(ctx: TxCtx, file: BooksFile) {
  assertCan(ctx.role, 'edit');
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'files'), file.id), { status: 'archived' });
  try {
    await removeBooksBlob(file.path);
  } catch {
    // Blob may already be gone; metadata stays archived.
  }
}

export async function saveTemplate(ctx: TxCtx, input: Omit<BooksTemplate, 'id' | 'createdAt' | 'status'>) {
  assertCan(ctx.role, 'create');
  const ref = doc(col(ctx.db, ctx.tenantId, 'templates'));
  await setDoc(ref, clean({
    domain: input.domain,
    name: input.name.trim(),
    kind: input.kind,
    payload: input.payload,
    status: 'active',
    createdAt: nowISO(),
  }));
  return ref.id;
}

export async function archiveTemplate(ctx: TxCtx, id: string) {
  assertCan(ctx.role, 'edit');
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'templates'), id), { status: 'archived' });
}
