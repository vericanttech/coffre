import { useState, useEffect } from 'react';
import { streamDocuments } from '@/services/vaultStorage';
import * as offlineVaultDb from '@/services/offlineVaultDb';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { VaultDocument } from '@/types/vault';

/**
 * Returns the current user's document list. When online: live from Firestore and mirrored to IndexedDB.
 * When offline: read from IndexedDB so list, search, and metadata still work.
 */
export function useDocuments(userId: string | null): VaultDocument[] {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const online = useOnlineStatus();

  useEffect(() => {
    if (!userId) {
      setDocs([]);
      return;
    }

    if (online) {
      const unsub = streamDocuments(userId, (firestoreDocs) => {
        setDocs(firestoreDocs);
        offlineVaultDb.putDocuments(userId, firestoreDocs).catch(() => {});
      });
      return () => unsub();
    }

    const uid = userId;
    function loadFromMirror() {
      offlineVaultDb.getDocuments(uid).then(setDocs).catch(() => setDocs([]));
    }
    loadFromMirror();

    const onMirrorUpdated = () => loadFromMirror();
    window.addEventListener('trouvedoc-mirror-updated', onMirrorUpdated);
    return () => window.removeEventListener('trouvedoc-mirror-updated', onMirrorUpdated);
  }, [userId, online]);

  return docs;
}
