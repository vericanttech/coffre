import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBlob, listAll, deleteObject } from 'firebase/storage';
import { db, storage, VAULT_COLLECTION, STORAGE_VAULT_PREFIX } from '@/config/firebase';
import type { VaultDocument, VaultExtractedFields } from '@/types/vault';

const coll = () => collection(db, VAULT_COLLECTION);

export function streamDocuments(
  userId: string,
  onDocs: (docs: VaultDocument[]) => void
): Unsubscribe {
  const q = query(
    coll(),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
      } as VaultDocument;
    });
    onDocs(docs);
  });
}

export function getDocRef(docId: string) {
  return doc(db, VAULT_COLLECTION, docId);
}

/** Generate a new Firestore document ID for the vault. */
export function newDocId(): string {
  return doc(coll()).id;
}

export async function createDocument(
  userId: string,
  docId: string,
  payload: Omit<VaultDocument, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
) {
  const docRef = getDocRef(docId);
  console.log('[vaultStorage.createDocument] start', {
    userId,
    docId,
    payloadSummary: {
      fileType: payload.fileType,
      category: payload.category,
      customCategory: payload.customCategory,
      status: payload.status,
    },
  });
  try {
    await setDoc(docRef, {
      ...payload,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('[vaultStorage.createDocument] done', { docId });
  } catch (e) {
    console.error('[vaultStorage.createDocument] ERROR', e);
    throw e;
  }
}

export async function initDocument(
  userId: string,
  docId: string,
  initial: Partial<VaultDocument>
) {
  const docRef = getDocRef(docId);
  await setDoc(docRef, { ...initial, userId, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateDocument(
  docId: string,
  updates: Partial<Pick<VaultDocument, 'title' | 'category' | 'customCategory'>>
) {
  await updateDoc(getDocRef(docId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/** Update document keywords (e.g. after user adds search tags). Replaces the full keywords array. */
export async function updateDocumentKeywords(docId: string, keywords: string[]) {
  await updateDoc(getDocRef(docId), {
    keywords,
    updatedAt: serverTimestamp(),
  });
}

/** Update only extracted metadata (date, parties, amounts, referenceNumber, expiryDate). Caller must pass full merged object. */
export async function updateDocumentExtractedFields(
  docId: string,
  extractedFields: VaultExtractedFields
) {
  await updateDoc(getDocRef(docId), {
    extractedFields,
    updatedAt: serverTimestamp(),
  });
}

export async function getExistingCategories(userId: string): Promise<string[]> {
  const q = query(coll(), where('userId', '==', userId));
  const snap = await getDocs(q);
  const set = new Set<string>();
  snap.docs.forEach((d) => {
    const c = d.get('category');
    if (c) set.add(c);
  });
  return Array.from(set);
}

export function storagePath(userId: string, docId: string, file: string) {
  return `${STORAGE_VAULT_PREFIX}/${userId}/${docId}/${file}`;
}

export async function uploadFile(
  userId: string,
  docId: string,
  fileName: string,
  blob: Blob
): Promise<string> {
  const path = storagePath(userId, docId, fileName);
  const storageRef = ref(storage, path);
  console.log('[vaultStorage.uploadFile] start', {
    userId,
    docId,
    fileName,
    path,
    size: blob.size,
    type: (blob as any).type,
  });
  await uploadBytes(storageRef, blob);
  console.log('[vaultStorage.uploadFile] done', { path });
  return path;
}

export async function getDownloadUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}

/** Download file as Blob via the Storage SDK (avoids CORS when bucket has correct CORS config). */
export async function getFileBlob(path: string): Promise<Blob> {
  const blob = await getBlob(ref(storage, path));
  return blob;
}

/**
 * Delete a vault document: remove all files under vault/{userId}/{docId}/ from Storage,
 * then delete the Firestore document. UI updates via the existing Firestore stream.
 */
export async function deleteDocument(userId: string, docId: string): Promise<void> {
  const folderPath = `${STORAGE_VAULT_PREFIX}/${userId}/${docId}`;
  const folderRef = ref(storage, folderPath);
  try {
    const listResult = await listAll(folderRef);
    await Promise.all(listResult.items.map((itemRef) => deleteObject(itemRef)));
  } catch (e) {
    console.warn('[vaultStorage.deleteDocument] Storage delete failed (folder may be empty or missing)', e);
  }
  await deleteDoc(getDocRef(docId));
}
