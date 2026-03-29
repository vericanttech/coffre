/**
 * IndexedDB mirror of vault documents for offline list, search, and metadata.
 * Written when Firestore stream delivers data; read when the app is offline.
 * Also holds a pending-writes queue for metadata edits (sync when back online).
 */
import type { VaultDocument, VaultExtractedFields } from '@/types/vault';

const DB_NAME = 'trouvedoc-vault';
const DB_VERSION = 2;
const STORE = 'documents';
const PENDING_STORE = 'pending_writes';

export interface PendingWrite {
  id: string;
  userId: string;
  type: 'document' | 'extractedFields' | 'keywords';
  docId: string;
  payload:
    | Partial<Pick<VaultDocument, 'title' | 'category' | 'customCategory'>>
    | VaultExtractedFields
    | { keywords: string[] };
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const pending = db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
        pending.createIndex('userId', 'userId', { unique: false });
      }
    };
  });
}

/** Write the full document list for a user. Replaces previous mirror for this user. */
export async function putDocuments(userId: string, docs: VaultDocument[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const index = store.index('userId');

    const clearReq = index.openCursor(IDBKeyRange.only(userId));
    clearReq.onsuccess = () => {
      const cursor = clearReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        docs.forEach((doc) => store.put(doc));
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Read all documents for a user from the local mirror. */
export async function getDocuments(userId: string): Promise<VaultDocument[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.index('userId').getAll(IDBKeyRange.only(userId));
    req.onsuccess = () => {
      db.close();
      const raw = (req.result ?? []) as VaultDocument[];
      // Ensure dates are Date instances (IndexedDB may restore as plain objects)
      const docs = raw.map((d) => ({
        ...d,
        createdAt: normalizeDate(d.createdAt),
        updatedAt: normalizeDate(d.updatedAt),
      }));
      resolve(docs);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

function normalizeDate(
  v: { seconds: number; nanoseconds?: number } | Date | undefined
): Date | { seconds: number; nanoseconds?: number } {
  if (v instanceof Date) return v;
  if (v && typeof (v as { seconds?: number }).seconds === 'number') {
    const t = v as { seconds: number; nanoseconds?: number };
    return new Date(t.seconds * 1000 + ((t.nanoseconds ?? 0) % 1e6) / 1e6);
  }
  return v ?? new Date(0);
}

/** Update one document in the local mirror (for offline metadata edits). Merges partial into the doc. */
export async function updateDocumentInMirror(
  userId: string,
  docId: string,
  partial:
    | Partial<Pick<VaultDocument, 'title' | 'category' | 'customCategory'>>
    | { extractedFields: VaultExtractedFields }
    | { keywords: string[] }
): Promise<void> {
  const docs = await getDocuments(userId);
  const index = docs.findIndex((d) => d.id === docId);
  if (index === -1) return;
  const doc = docs[index];
  if ('extractedFields' in partial) {
    docs[index] = { ...doc, extractedFields: partial.extractedFields };
  } else if ('keywords' in partial) {
    docs[index] = { ...doc, keywords: partial.keywords };
  } else {
    docs[index] = { ...doc, ...partial };
  }
  await putDocuments(userId, docs);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('trouvedoc-mirror-updated'));
  }
}

/** Add a pending write (metadata only). Flushed when back online. */
export async function addPendingWrite(
  userId: string,
  type: PendingWrite['type'],
  docId: string,
  payload: PendingWrite['payload']
): Promise<void> {
  const db = await openDb();
  const write: PendingWrite = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    type,
    docId,
    payload,
    timestamp: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    tx.objectStore(PENDING_STORE).put(write);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Get all pending writes for a user (oldest first). */
export async function getPendingWrites(userId: string): Promise<PendingWrite[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readonly');
    const req = tx.objectStore(PENDING_STORE).index('userId').getAll(IDBKeyRange.only(userId));
    req.onsuccess = () => {
      db.close();
      const list = (req.result ?? []) as PendingWrite[];
      list.sort((a, b) => a.timestamp - b.timestamp);
      resolve(list);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** Remove one pending write after successful sync. */
export async function removePendingWrite(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    tx.objectStore(PENDING_STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Remove all mirrored documents and pending writes for a user (e.g. on logout). */
export async function clearUser(userId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, PENDING_STORE], 'readwrite');
    const docStore = tx.objectStore(STORE);
    const pendingStore = tx.objectStore(PENDING_STORE);
    const docIndex = docStore.index('userId');
    const pendingIndex = pendingStore.index('userId');

    let docCursor: IDBRequest<IDBCursorWithValue | null> | null = docIndex.openCursor(IDBKeyRange.only(userId));
    docCursor.onsuccess = () => {
      const cursor = docCursor!.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    pendingIndex.openCursor(IDBKeyRange.only(userId)).onsuccess = function (this: IDBRequest<IDBCursorWithValue | null>) {
      const cursor = this.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
