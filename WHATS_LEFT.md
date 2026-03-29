# Coffre Web — What’s Done vs Left (vs WEB_SPEC copy.md)

This doc is aligned with **WEB_SPEC copy.md**: same sections and the §14 checklist.

---

## 1. Project overview (§1)

| Spec requirement | Status |
|------------------|--------|
| Responsive design (mobile + desktop) | **Done** — breakpoints, sidebar at 1024px+, bottom nav on small screens (§11.0). |

### 1.1 PWA and offline (§1.1) — **Partial**

| Requirement | Status |
|-------------|--------|
| PWA: installable, manifest, HTTPS, standalone | **Done** |
| Service worker: cache static assets (app shell) | **Done** |
| Offline **document list** (browse, search, metadata) | **Done** — see below. |
| Offline **thumbnails/originals** (previously viewed) | **Done** — SW runtime cache for Firebase Storage. |
| Queue writes when offline, sync when back online | **Missing** |
| Offline indicator (banner/icon) | **Done** |

**Offline approach (implemented)** — See **docs/OFFLINE_LOCAL_DB_APPROACH.md** for the full design.

- **Local DB (IndexedDB):** Mirror of the user’s document list + metadata in `trouvedoc-vault` (store `documents`). When **online**, the Firestore stream updates the UI and writes each snapshot to IndexedDB. When **offline**, the app reads the list from IndexedDB so the user can still browse, search (in-memory on that list), and open document detail to see all metadata. Search runs in memory on the loaded list (fast, one IndexedDB read when going offline).
- **Data layer:** `useOnlineStatus()` (navigator.onLine + events) and `useDocuments(userId)`: online → `streamDocuments` + `putDocuments`; offline → `getDocuments(userId)`.
- **Logout:** `clearUser(userId)` is called before sign-out so the next user on the same device doesn’t see cached docs.
- **Service worker:** Besides precache and navigation fallback, a **runtime cache** (CacheFirst) for `firebasestorage.googleapis.com` so thumbnails and originals that were already loaded are served from cache when offline. Images for docs never opened remain unavailable offline (placeholder + metadata only).

### 1.2 Firebase Analytics (§1.2) — **Done**

| Requirement | Status |
|-------------|--------|
| Analytics integrated, screen views, key actions, funnel/errors | **Done** (screen views, sign-in/out, search, upload events). |

---

## 2. Authentication (§2) — **Done**

- AuthGate, SignInScreen, MainScaffold.
- Web: Google and Apple only (no email/password).
- Sign out from Profile → Déconnexion.

---

## 3. Main app shell (§3) — **Done**

- 4 tabs: Home, Search, Alertes, Profile; center FAB opens Upload modal.
- Home search bar → Search tab; category pill → Search with initial filter.

---

## 4. Data structures (§4) — **Done**

- Firestore database **`coffre-ios`**, collection `vault_documents`.
- Document shape: userId, originalRef, thumbRef, fileType, category, customCategory, title, ocrSummary, keywords, extractedFields, status, extractionProvider, pageCount, createdAt, updatedAt.
- Storage paths: `vault/{userId}/{docId}/thumb.jpg`, `original.jpg`|`original.pdf`, `page_*.jpg`.
- `originalRefs` for multi-page: supported in spec; client/backend may not yet create multi-page docs with `originalRefs` (see §5.11).

---

## 5. Upload pipeline (§5) — **Mostly done**

| Spec | Status |
|------|--------|
| §5.1 Upload modal: options → review → processing → error | **Done** |
| §5.2 Single image: docId, upload thumb + original, call CF for OCR→redact→Gemini | **Done** |
| §5.3 PDF: first-page extraction, thumb, original PDF as-is | **Done** (CF uses pdf-parse for first-page text; client uploads PDF + first-page thumb). |
| §5.4 Multi-page (2–6 images, “together”, originalRefs) | **Not implemented** — web flow is Images | PDFs only; no “mark 2+ together” or page_0/page_1 upload. |
| §5.5 Processing state UI, success/error messages | **Done** |
| §5.5.1 Unreadable image: save with fallback, status ocr_failed, “Document enregistré. Vous pouvez le renommer.” | **Done** |
| §5.6 OCR | **Done** in CF (Vision for images, pdf-parse for PDF). |
| §5.7 Redaction before Gemini | **Done** in CF (same patterns as spec). |
| §5.8 Gemini extraction (gemini-2.5-flash-lite) | **Done** in CF (Vertex AI). |
| §5.9 Thumb + storage upload | **Done** (client optimizes and uploads; CF writes Firestore). |
| §5.10 Web Cloud Function pipeline | **Done** (download → OCR → redact → Gemini → Firestore merge). |
| §5.10.1 PDF in CF (first page → OCR → redact → Gemini) | **Done** (pdf-parse first page). |
| §5.11 Web upload: **two buttons only** — Images \| PDFs | **Done** |
| §5.11.1 **Per-image cropping** (optional rect/quad before upload) | **Skipped** — spec says “optional” but checklist mentions it; current review has add/delete only, no crop. |
| §5.11.1 **Together** (2+ images → one doc, originalRefs) | **Not implemented** — each image → one doc; no “lier en un seul document”. |
| §5.11.2 PDFs: one doc per PDF | **Done** |
| **Document detail + rename** (§5.5.1, §14) | **Missing** — “Vous pouvez le renommer” has no UI; card tap does nothing; `updateDocument` exists but no screen. |

---

## 6. Home screen (§6) — **Done**

- Greeting, avatar, summary card (total, by category, Expirent, **À classifier** count).
- Search bar → Search tab.
- Category pills: Tous + distinct **fixed** categories + **all distinct custom categories** (e.g. “À classifier”, “Erreur de compilation iOS”) + “À classifier” pill when user has unclassified docs. Tapping pill → Search with that filter.

---

## 7. Search screen (§7) — **Done**

- Header, search field, initial filter from Home pill.
- Filter by query (title, category label, ocrSummary, keywords) and by category/customCategory.
- Result count, VaultDocumentCard list, suggestion chips, “Recherche intelligente” info.
- **Document detail:** tapping card does nothing (see §5 / §14).

---

## 8. Document card and thumbnails (§8) — **Partial**

| Spec | Status |
|------|--------|
| VaultDocumentCard: thumb, title, meta, category accent, badge (Prêt / Expire bientôt), chevron | **Done** |
| **CachedThumb:** resolve from cache, else fetch and cache | **Missing** — no VaultCacheService; thumbs likely fetched from Storage without persistent cache. |
| Category → label/color/icon | **Done** (getCategoryLabel, getCategoryColor). |

---

## 9. Alertes (§9) — **Partial**

| Spec | Status |
|------|--------|
| Expiry list (extractedFields.expiryDate, within 60 days) | **Done** |
| Red dot on bell when there are alerts | **Missing** |
| Insights (optional): dismissable cards, contextual messages | **Missing** — only expiring-docs list. |

---

## 10. Profile (§10) — **Done**

- Avatar, display name, email, Paramètres → Déconnexion.

---

## 11. Design system (§11) — **Done**

- Responsive (§11.0), colors, typography, dark theme, category pills/summary card/document card, icons.

---

## 12. Services (§12) — **Partial**

| Service | Status |
|---------|--------|
| Auth | **Done** |
| VaultStorageService (Firestore coffre-ios, Storage) | **Done** |
| Offline vault DB (IndexedDB mirror for doc list + metadata, clear on logout) | **Done** — `src/services/offlineVaultDb.ts`; used by `useDocuments` when offline. |
| VaultCacheService (thumb cache, getCacheSize, clearCache) | **Missing** — thumb/original caching is done via SW runtime cache for Storage URLs instead. |
| OCR / Redaction / Extraction | **Done** in Cloud Function (no client-side OCR). |
| VaultThumbnailService (thumb gen, compress, PDF first page) | **Done** (client). |

---

## 14. Spec checklist (§14) — Summary

| Checklist item | Status |
|----------------|--------|
| Auth: Google & Apple only, AuthGate, sign out | **Done** |
| Firestore: coffre-ios, vault_documents, same shape | **Done** |
| Storage: same paths (thumb, original, page_*) | **Done** |
| Home: greeting, summary, search bar, category pills | **Done** (+ all custom category pills). |
| Search: stream, filter (query + category), cards, suggestions | **Done** |
| Upload: modal, single image + PDF; OCR/redact/Gemini (CF); unreadable → fallback + “Vous pouvez le renommer.” | **Done** |
| Web upload §5.11: Images \| PDFs; **per-image crop**; **together** (2+ → one doc) | **Crop skipped**; **together not implemented**. |
| Alertes: expiry list; optional red dot + insights | **Expiry done**; red dot + insights **missing**. |
| Profile: avatar, name, email, Déconnexion | **Done** |
| Design + responsive (§11.0) | **Done** |
| PWA: manifest, installable | **Done** |
| **Service worker & offline (required):** cache static + **doc list + thumbs**; **queue writes + sync**; offline indicator | **Partial:** static + indicator **done**; doc list + metadata via IndexedDB and thumbs/originals via SW runtime cache **done**; **queue writes + sync when back online** still **missing**. |
| Firebase Analytics | **Done** |
| **Document detail + rename (recommended)** | **Missing** |
| **“À classifier” chip on Home (recommended)** | **Done** (+ all custom categories). |
| (Optional) Thumb cache + getCacheSize/clear in settings | **Missing** |

---

## What’s left (concise)

**Required by spec but incomplete**

1. **§1.1 Full offline (remaining):** **Queue writes when offline and sync when back online** is still missing. Document list + metadata (IndexedDB mirror) and thumbnails/originals (SW runtime cache for Firebase Storage) are implemented — see §1.1 “Offline approach (implemented)” and **docs/OFFLINE_LOCAL_DB_APPROACH.md**.
2. **§5.11.1 Per-image cropping (optional in spec, in checklist):** Optional crop (rect or quad) before upload — currently **skipped**.
3. **§5.11 / §5.4 “Together” (multi-page):** Mark 2+ images as one document (originalRefs, page_0, page_1…) — **not implemented**; each image is one doc.

**Recommended / optional**

4. **Document detail + rename (§5.5.1, §14):** Screen to view doc and **edit title** (and optionally category) so “Vous pouvez le renommer” is actionable. `updateDocument` exists; no UI.
5. **Alertes red dot:** Show red dot on bell when there are expiry alerts.
6. **Thumb cache + settings (§12, §14):** CachedThumb, getCacheSize, clear cache in settings.
7. **Insights (Alertes):** Optional insight cards, dismissable, contextual.

**Backend**

- Cloud Function is in repo (`functions/`). Deploy: `firebase deploy --only functions`. Enable **Vertex AI API** for the project. See **COST_ESTIMATE.md** for power-user cost estimates.
