# Offline write queue + sync — how it would work

The app already supports **offline read**: document list and metadata come from IndexedDB when offline; thumbnails/originals come from the service worker cache when they were previously viewed. What’s missing is **offline writes**: when the user adds or edits something while offline, we need to **queue** those operations and **run them when back online**. Yes — **files are uploaded only when the device is back online**.

---

## 0. Browser storage is limited — what we can rely on

**Browser storage (IndexedDB, Cache API) is not a reliable place for arbitrary file blobs:**

- **Quota** is typically a few hundred MB to a few GB per origin, shared with the rest of the app (doc list, SW cache). It varies by browser and device; the user or OS can clear it.
- **Mobile devices** often have tight storage; the browser may evict data under pressure. Private/incognito can have stricter limits.
- **Storing many or large files** for “upload when online” is therefore **fragile**: we can’t guarantee the data will still be there when the user comes back online.

**Recommendation:**

| Offline write type | Reliable? | Recommendation |
|-------------------|-----------|-----------------|
| **Metadata only** (rename, category, extracted fields) | **Yes** | Queue these. Payload is tiny (a few KB per update). Safe and predictable. |
| **New uploads** (store file blobs, upload when online) | **No** | Do **not** rely on storing files offline. Either **require online for uploads** (simplest), or at most support a **best-effort** “queue 1–2 small files” with clear UX: “Enregistré localement — synchronisation à la reconnexion (espace limité).” |

**Practical approach:** Implement **offline queue + sync for metadata edits only**. For new documents, keep **“Add document” available only when online** (or show a message: “Reconnectez-vous pour ajouter un document”). That avoids depending on browser storage for files while still improving offline UX for renames and category changes.

---

## 1. Two kinds of “writes”


| Kind                                                    | Offline                                                                                                                        | When back online                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Metadata edits** (rename, category, extracted fields) | User edits in document detail; we **queue** “update doc X with { title, category, … }”.                                        | Call `updateDocument(docId, payload)` (and optionally `updateDocumentExtractedFields`) for each queued update. No files.                                |
| **New uploads** (image/PDF)                             | User picks file(s); we **store the file blobs locally** (IndexedDB or a blob store) and **queue** “create doc with this blob”. | For each queued create: upload blob to Storage, create/init Firestore doc, call `processVaultDocument` (OCR → redact → Gemini), then remove from queue. |


So: **files are not uploaded while offline**. We only store them locally and record “create this doc with this file”; the actual upload and processing happen in a **sync step** when the app is online again.

---

## 2. High-level flow

### 2.1 Offline metadata edit (e.g. rename)

1. User is offline, opens a document, changes the title and saves.
2. App **updates the local IndexedDB mirror** so the list/detail show the new title (optimistic UI).
3. App **appends to a “pending writes” queue** in IndexedDB:
  `{ type: 'update', docId: 'abc', payload: { title: 'Nouveau titre' }, timestamp }`.
4. When the app later detects **online**:
  - Process queue: for each `update`, call `updateDocument(docId, payload)`.
  - On success, remove that entry from the queue. Firestore stream will then update the mirror anyway; optionally trim duplicate updates.
5. No file upload involved.

### 2.2 Offline new upload (not recommended — see §0)

If you still want to support “add document while offline” despite storage limits:

1. User is offline, opens “Ajouter un document”, selects one or more images (or a PDF).
2. App **stores each file blob** in IndexedDB (e.g. a second store `pending_blobs` keyed by a temporary id). **Risk:** quota can be exceeded or evicted; not reliable.
3. App **appends to the pending-writes queue**:
  `{ type: 'create', tempId: 'local-uuid', blobKeys: ['key1','key2'], title?, category?, fileType: 'image'|'pdf', timestamp }`.
4. App **adds a “pending” document** to the in-memory list so the user sees “En attente de synchronisation”.
5. When **back online**: load blobs, upload to Storage, create Firestore doc, call CF; on success remove from queue. **If the blob was evicted**, the sync fails and the user loses that “pending” doc — hence not recommended to rely on.

**Preferred:** Require online for new uploads; only queue **metadata** edits offline.

---

## 3. Where to store the queue (metadata-only recommended)

- **Pending writes queue:** A separate IndexedDB store (e.g. `pending_writes`) in the same DB as the document mirror. Each row: `{ id, userId, type: 'update', docId, payload: { title?, category?, customCategory?, extractedFields? }, timestamp }`. Key by `id`; index by `userId` so you only process the current user’s queue and clear on logout. No blob storage.
- **Pending file blobs** (if you still implement offline uploads despite §0): A store like `pending_blobs` — but remember quota is limited and evictable; use at your own risk.

---

## 4. When to run the sync

- **On “online”:** Listen to `navigator.onLine` and the `online` event; when the app goes from offline to online, run the flush.
- **On load:** If the app loads while already online, check the queue and flush (so we don’t leave pending items from a previous session).
- **After login:** When the user signs in, you can run a flush for that `userId` (queue is keyed by user).

---

## 5. UX

- **Offline banner** already says: “Les modifications seront synchronisées à la reconnexion.” So the expectation is set.
- **Pending docs:** Show them in the list with a clear “En attente” / “Synchronisation à la reconnexion” state and optionally disable share/download until synced.
- **Errors on flush:** If an upload or update fails (e.g. network), keep the item in the queue and show a small “Échec de la synchronisation — réessai automatique” or “Réessayer” button.

---

## 6. Summary

- **Metadata-only queue is reliable:** Queue renames, category, extracted fields when offline; flush with `updateDocument` when online. No file storage; tiny payload.
- **Storing files offline for later upload is not reliable:** Browser storage is limited and evictable. Prefer **requiring online for new uploads** and only implement **metadata** offline sync.
- **Implementation (recommended scope):** Add a `pending_writes` queue (type `update` only, no blobs). When offline, push updates there and apply to the local mirror; when online, flush to Firestore and clear the queue.

