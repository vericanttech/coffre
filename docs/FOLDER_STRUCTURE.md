# TrouveDoc / Coffre Web — Folder structure and file roles

Short overview of the project layout and what each file does.

---

## Root

| File | Role |
|------|------|
| `package.json` | App dependencies and scripts (`dev`, `build`, `preview`). |
| `tsconfig.json` | TypeScript config for the web app. |
| `vite.config.ts` | Vite build config, PWA plugin, path alias `@/` → `src/`. |
| `index.html` | Single HTML entry; root div for React. |
| `firebase.json` | Firebase project config (hosting, functions). |
| `storage.cors.json` | CORS rules for Cloud Storage (used when deploying). |
| `README.md` | Setup, scripts, structure, PWA and backend notes. |
| `WHATS_LEFT.md` | Done vs remaining features vs spec. |
| `COST_ESTIMATE.md` | Rough cost estimates (Firebase + Vertex AI). |
| `WEB_SPEC copy.md` | Product/spec reference. |

---

## `docs/`

| File | Role |
|------|------|
| `OFFLINE_LOCAL_DB_APPROACH.md` | Design: IndexedDB mirror for offline list/search. |
| `OFFLINE_QUEUE_SYNC.md` | Design: metadata-only offline queue and sync when online. |
| `STORAGE_CORS.md` | How to set Storage CORS for download/share. |
| `GEMINI_AND_REDACTION.md` | Backend: Gemini extraction and redaction. |
| `FOLDER_STRUCTURE.md` | This file. |

---

## `src/` (web app)

### `src/` (root)

| File | Role |
|------|------|
| `main.tsx` | React mount, BrowserRouter, service worker registration in prod. |
| `App.tsx` | Root UI: ThemeProvider → OfflineProvider → OfflineBanner + AuthGate. |
| `sw.ts` | Service worker: precache app shell, navigation fallback, runtime cache for Storage. |
| `vite-env.d.ts` | Vite env types (e.g. `import.meta.env`). |

### `src/config/`

| File | Role |
|------|------|
| `firebase.ts` | Firebase init (Auth, Firestore `coffre-ios`, Storage, Functions, Analytics); optional emulators. |

### `src/context/`

| File | Role |
|------|------|
| `ThemeContext.tsx` | Light/dark theme state and `useTheme()` (colors). |
| `OfflineContext.tsx` | Offline state for the banner; wraps app. |

### `src/hooks/`

| File | Role |
|------|------|
| `useAuth.ts` | Current Firebase user (or null); used for gating and `userId`. |
| `useDocuments.ts` | Document list: online = Firestore stream + mirror to IndexedDB; offline = read from IndexedDB; listens for mirror-updated. |
| `useOnlineStatus.ts` | `navigator.onLine` plus `online` / `offline` events. |
| `useOfflineSync.ts` | When online, flushes pending metadata writes (queue) to Firestore. |
| `useBreakpoint.ts` | `useIsDesktop()` (e.g. 1024px) for layout. |
| `useDebouncedValue.ts` | Debounced value for search input. |
| `useScreenAnalytics.ts` | Logs screen view to Firebase Analytics. |

### `src/components/`

| File | Role |
|------|------|
| `AuthGate.tsx` | If not signed in → SignInScreen; else → MainScaffold (tabs + upload + detail). |
| `OfflineBanner.tsx` | Banner when offline (“Vous êtes hors ligne…”). |
| `CategoryPills.tsx` | Category filter pills (Tous + fixed + custom); used on Home and Search. |
| `VaultSummaryCard.tsx` | Home summary: total docs, by category, expiring, “À classifier”. |
| `VaultDocumentCard.tsx` | Document row/tile: thumb, title, meta, category accent, status; `variant`: list | gallery. |

### `src/layout/`

| File | Role |
|------|------|
| `MainScaffold.tsx` | Main shell: sidebar (desktop), tabs (Home, Search, Alertes, Profile), FAB, upload modal, document detail; runs `useOfflineSync`. |
| `Sidebar.tsx` | Desktop nav (tabs + Add). |
| `BottomNav.tsx` | Mobile bottom nav + FAB. |

### `src/screens/`

| File | Role |
|------|------|
| `SignInScreen.tsx` | Sign in with Google or Apple. |
| `HomeScreen.tsx` | Greeting, summary card, search bar (→ Search tab), category pills (→ Search with filter). |
| `SearchScreen.tsx` | Search input, category filter, result count, gallery of `VaultDocumentCard`, recent searches. |
| `AlertesScreen.tsx` | List of documents expiring in the next 60 days (from `extractedFields.expiryDate`). |
| `ProfileScreen.tsx` | Avatar, name, email, Paramètres → Déconnexion (clears offline data + sign out). |
| `UploadModal.tsx` | Add flow: Images | PDFs, review, processing; uploads + calls Cloud Function for OCR/redact/Gemini. |
| `DocumentDetailScreen.tsx` | View doc (thumb/original), edit title/category/metadata, download, share; offline saves go to mirror + queue. |

### `src/services/`

| File | Role |
|------|------|
| `vaultStorage.ts` | Firestore (stream, create, update, updateDocumentExtractedFields), Storage (upload, getDownloadUrl, getFileBlob), category helpers. |
| `offlineVaultDb.ts` | IndexedDB: document mirror (putDocuments, getDocuments, updateDocumentInMirror), pending-writes queue (add, get, remove), clearUser. |
| `processVaultDocument.ts` | Client: calls the Cloud Function `processVaultDocument` after upload. |

### `src/lib/`

| File | Role |
|------|------|
| `analytics.ts` | Helpers for Firebase Analytics (screen, search, upload). |
| `recentSearches.ts` | Recent search strings in localStorage (per user). |
| `searchUtils.ts` | `fuzzyIncludes` and search helpers. |

### `src/theme/`

| File | Role |
|------|------|
| `colors.ts` | Dark/light palette; `useTheme()` provides `colors`. |
| `categories.ts` | Category keys, labels, colors (getCategoryLabel, getCategoryColor). |

### `src/types/`

| File | Role |
|------|------|
| `vault.ts` | `VaultDocument`, `VaultExtractedFields`, category type. |
| `pdfjs-worker.d.ts` | Type declaration for PDF.js worker. |

### `src/utils/`

| File | Role |
|------|------|
| `pdfThumb.ts` | Renders first page of a PDF as an image blob for thumbnails. |

### `src/styles/`

| File | Role |
|------|------|
| `global.css` | Global styles (reset, body, app container). |

---

## `functions/` (Firebase Cloud Functions)

Backend for document processing (OCR → redaction → Gemini → Firestore).

| File | Role |
|------|------|
| `package.json` | Functions dependencies (Firebase Admin, Vision, Gemini, pdf-parse, etc.). |
| `tsconfig.json` | TypeScript config for functions. |
| `src/index.ts` | Exposes callable `processVaultDocument` (auth, validate input, run pipeline). |
| `src/pipeline.ts` | Pipeline: download file, OCR (Vision or pdf-parse), redact, Gemini extraction, merge to Firestore. |
| `src/redact.ts` | Redaction logic before sending text to Gemini. |
| `src/pdf-parse.d.ts` | Types for pdf-parse. |
| `README.md` | How to configure and deploy functions. |

---

## Build output

| Path | Role |
|------|------|
| `dist/` | Production build (Vite): `index.html`, JS/CSS assets, `sw.js`, `manifest.webmanifest`. |

---

## Quick map

- **Entry:** `index.html` → `main.tsx` → `App.tsx` → `AuthGate` → sign-in or `MainScaffold`.
- **Data:** Online: Firestore stream + Storage; offline: IndexedDB mirror + pending-writes queue; sync in `useOfflineSync`.
- **UI:** Tabs (Home, Search, Alertes, Profile), FAB for upload, document detail as overlay.
- **Backend:** `functions/` — one callable that runs the full document pipeline.
