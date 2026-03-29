import { useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import * as offlineVaultDb from '@/services/offlineVaultDb';
import { updateDocument, updateDocumentExtractedFields, updateDocumentKeywords } from '@/services/vaultStorage';
import type { VaultExtractedFields } from '@/types/vault';

/** Flushes pending metadata writes to Firestore when the app is online. Call with current userId. */
export function useOfflineSync(userId: string | null): void {
  const online = useOnlineStatus();

  useEffect(() => {
    if (!userId || !online) return;

    const uid = userId;
    let cancelled = false;

    async function flush() {
      const pending = await offlineVaultDb.getPendingWrites(uid);
      for (const write of pending) {
        if (cancelled) return;
        try {
          if (write.type === 'document') {
            await updateDocument(write.docId, write.payload as Parameters<typeof updateDocument>[1]);
          } else if (write.type === 'extractedFields') {
            await updateDocumentExtractedFields(write.docId, write.payload as VaultExtractedFields);
          } else if (write.type === 'keywords') {
            await updateDocumentKeywords(write.docId, (write.payload as { keywords: string[] }).keywords);
          }
          await offlineVaultDb.removePendingWrite(write.id);
        } catch {
          // Leave in queue; will retry on next online or next load
        }
      }
    }

    flush();

    return () => {
      cancelled = true;
    };
  }, [userId, online]);
}
