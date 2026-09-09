import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { doc, getDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { storage, db } from '../../lib/firebase';

const MAX_BYTES = 8 * 1024 * 1024;
const FIRESTORE_MAX_BYTES = 750 * 1024; // 750KB limit for Firestore fallback
const ALLOWED = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'csv', 'txt', 'xlsx']);

const EXT_MIME: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  csv: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  txt: ['text/plain'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export function inspectFile(file: File) {
  const name = file.name.replace(/[/\\]/g, '').trim();
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED.has(ext)) throw new Error(`File type .${ext || 'unknown'} is not allowed`);
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error('File must be between 1 byte and 8 MB');
  const declared = (file.type || '').toLowerCase();
  if (declared && !EXT_MIME[ext].includes(declared)) {
    throw new Error('File extension does not match its type');
  }
  return { name, ext, size: file.size, contentType: declared || EXT_MIME[ext][0] };
}

async function compressFile(file: File): Promise<{ base64: string; contentType: string; ext: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const originalExt = file.name.split('.').pop()?.toLowerCase() || '';
      const originalContentType = file.type || 'application/octet-stream';
      
      if (!file.type.startsWith('image/')) {
        return resolve({ base64: dataUrl, contentType: originalContentType, ext: originalExt });
      }
      
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 1200; // Aggressively scale down images for database storage
        
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round(height * (MAX_DIM / width));
            width = MAX_DIM;
          } else {
            width = Math.round(width * (MAX_DIM / height));
            height = MAX_DIM;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ base64: dataUrl, contentType: originalContentType, ext: originalExt });
        
        // Fill white background in case of transparent PNG -> JPEG conversion
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Force JPEG and 60% quality to ensure very small payload
        const compressed = canvas.toDataURL('image/jpeg', 0.6);
        
        if (compressed.length < dataUrl.length) {
          resolve({ base64: compressed, contentType: 'image/jpeg', ext: 'jpg' });
        } else {
          resolve({ base64: dataUrl, contentType: originalContentType, ext: originalExt });
        }
      };
      img.onerror = () => resolve({ base64: dataUrl, contentType: originalContentType, ext: originalExt });
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function storeBooksFile(tenantId: string, fileId: string, file: File) {
  const meta = inspectFile(file);
  const path = `erp_workspaces/${tenantId}/files/${fileId}.${meta.ext}`;
  
  try {
    // Try Firebase Storage first
    await uploadBytes(ref(storage, path), file, { contentType: meta.contentType });
    return { ...meta, path, isFirestore: false };
  } catch (error: any) {
    // Fallback to Firestore if Storage is unauthorized (common in AI Studio sandbox)
    if (error.code === 'storage/unauthorized' || error.message?.includes('unauthorized')) {
      const compressed = await compressFile(file);
      const base64 = compressed.base64;
      const dbMeta = {
        ...meta,
        ext: compressed.ext,
        contentType: compressed.contentType,
        size: Math.round(base64.length * 0.75) // estimate binary size from base64
      };
      
      // If the file is larger than the single document limit, we chunk it
      if (base64.length > FIRESTORE_MAX_BYTES) {
        const chunks = Math.ceil(base64.length / FIRESTORE_MAX_BYTES);
        
        // Save chunks in small batches to reduce roundtrips without exceeding the 10MiB Firestore request size limit
        const BATCH_SIZE = 4;
        for (let i = 0; i < chunks; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          
          if (i === 0) {
            const docRef = doc(db, 'erp_files', fileId);
            batch.set(docRef, { 
              tenantId, name: dbMeta.name, ext: dbMeta.ext, contentType: dbMeta.contentType, 
              size: dbMeta.size, chunked: true, totalChunks: chunks 
            });
          }
          
          for (let j = 0; j < BATCH_SIZE && (i + j) < chunks; j++) {
            const chunkIndex = i + j;
            const chunkData = base64.slice(chunkIndex * FIRESTORE_MAX_BYTES, (chunkIndex + 1) * FIRESTORE_MAX_BYTES);
            const chunkRef = doc(db, 'erp_files', `${fileId}_chunk_${chunkIndex}`);
            batch.set(chunkRef, { chunkIndex, data: chunkData, fileId });
          }
          
          await batch.commit();
        }
      } else {
        const docRef = doc(db, 'erp_files', fileId);
        await setDoc(docRef, { tenantId, name: dbMeta.name, ext: dbMeta.ext, contentType: dbMeta.contentType, size: dbMeta.size, data: base64, chunked: false });
      }

      return { ...dbMeta, path: `firestore://${fileId}`, isFirestore: true };
    }
    throw error;
  }
}

export async function booksFileUrl(path: string) {
  if (path.startsWith('firestore://')) {
    const fileId = path.replace('firestore://', '');
    const docRef = doc(db, 'erp_files', fileId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.chunked) {
        // Read chunks concurrently to improve download speed
        const promises = [];
        for (let i = 0; i < data.totalChunks; i++) {
          promises.push(getDoc(doc(db, 'erp_files', `${fileId}_chunk_${i}`)));
        }
        const chunkSnaps = await Promise.all(promises);
        
        let fullBase64 = '';
        for (let i = 0; i < data.totalChunks; i++) {
          if (chunkSnaps[i].exists()) {
            fullBase64 += chunkSnaps[i].data().data;
          } else {
            throw new Error(`Missing file chunk ${i}`);
          }
        }
        return fullBase64;
      } else {
        return data.data; // base64 string
      }
    }
    throw new Error('File not found in database');
  }
  return getDownloadURL(ref(storage, path));}

export async function removeBooksBlob(path: string) {
  if (path.startsWith('firestore://')) {
    const fileId = path.replace('firestore://', '');
    const snap = await getDoc(doc(db, 'erp_files', fileId));
    if (snap.exists() && snap.data().chunked) {
      const totalChunks = snap.data().totalChunks;
      
      // Delete chunks in batches
      const BATCH_SIZE = 400; // max batch is 500
      for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (let j = 0; j < BATCH_SIZE && (i + j) < totalChunks; j++) {
          batch.delete(doc(db, 'erp_files', `${fileId}_chunk_${i + j}`));
        }
        await batch.commit();
      }
      return deleteDoc(doc(db, 'erp_files', fileId));
    }
    return deleteDoc(doc(db, 'erp_files', fileId));
  }
  return deleteObject(ref(storage, path));
}
