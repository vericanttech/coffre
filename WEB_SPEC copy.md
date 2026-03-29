# Coffre — Web Version Specification

This document describes the **data structures**, **process pipelines**, **features**, and **design choices** of the Coffre iOS app so you can build a faithful web version. It follows the user flow from **logging in** through **home**, **search**, **upload**, **alerts**, and **profile**.

---

## 1. Project overview

**Coffre** is a document vault for Senegalese families. Users store identity papers, health records, school docs, business papers, etc. Documents are captured (camera/gallery/file), processed with OCR and AI extraction, then stored in Firebase. The app is **French-language** and **Senegal-focused** (NINEA, CNI, local phone formats, contextual insights).

**Tech stack (iOS):** Flutter, Firebase (Auth, Firestore, Storage), Firebase AI (Gemini), ML Kit OCR, Provider for state.

**For web you will need:** Equivalent auth (Firebase Auth works on web), same Firestore/Storage, and either:
- A **backend or Cloud Function** for OCR + redaction + Gemini (ML Kit is mobile-only), or
- Client-side OCR (e.g. Tesseract.js) + redaction logic + Gemini from web.

**Responsive design (required):** The web app must be **responsive for both mobile and desktop** viewports, not just mobile. Layout, navigation, and touch/click targets should adapt so the app is usable and readable on small screens (phones), tablets, and desktop (e.g. side-by-side content, max-width containers, optional sidebar nav on large screens). Test across breakpoints (e.g. 320px–768px mobile, 768px–1024px tablet, 1024px+ desktop).

### 1.1 PWA and offline mode (required)

The web version **must** be a **Progressive Web App (PWA)** and **must** use **service workers** to provide **full offline mode**. None of this is optional.

- **PWA (required):** The app must be installable (“Add to Home Screen”), run in a standalone window, and meet PWA criteria (HTTPS, manifest, service worker). This is required for the “vault always at hand” use case.
- **Service worker (required):** A registered service worker **must**:
  - **Cache static assets** (HTML, CSS, JS, fonts, icons) so the app shell loads offline.
  - **Cache document list and thumbnails** for already-visited data so Home and Search remain fully usable without network.
  - **Queue writes** when offline (new uploads, Firestore writes) and **sync when back online**; show a clear “offline” state and retry/sync once connectivity returns.
- **Offline behavior (required):** When the user is offline, the app must show previously loaded documents and allow browsing/searching cached data. Uploads and writes must be deferred and synced when back online. An **offline indicator** (banner or icon) is required so the user always knows connectivity status.

### 1.2 Firebase Analytics (required)

The web app **must** use **Firebase Analytics** to collect metrics that support a **comprehensive view of user behavior**. All product and UX decisions should be informed by this data.

- **Integration:** Initialize Firebase Analytics (e.g. `getAnalytics()` with the Firebase app) and ensure it is active on every page/screen. Respect user consent and privacy (e.g. only enable after consent if required in your jurisdiction).
- **What to track:** Instrument the app so Analytics receives:
  - **Screen / page views:** Sign-in, Home, Search, Alertes, Profile, Upload (options, capture, review, processing), Document detail (if built). Use consistent `screen_view` event names or equivalent.
  - **Key actions:** Sign-in method (web: Google, Apple), sign-out; open search, run search query, tap category pill, tap document card; open upload, choose source (camera, gallery, file, multi-page), start upload, upload success/failure (and reason: OCR fail, Gemini fail, storage fail); tap alert/insight, dismiss insight; clear cache.
  - **Funnel and flow:** Upload funnel (options → capture/review → processing → success/error); time or steps from “open upload” to “upload success”; search usage (queries, result count, zero results).
  - **Errors and fallbacks:** OCR failure, Gemini fallback, storage retry, offline queue sync failure, so you can measure reliability and fix pain points.
- **User properties (optional but recommended):** e.g. first_open date, document_count bucket, last_active, to support segmentation and retention analysis.
- **Goal:** The combination of events and properties should be sufficient to analyze acquisition, engagement, feature adoption, upload success rate, search effectiveness, and drop-off points—i.e. comprehensive user behavior for the product.

---

## 2. Authentication flow

### 2.1 Entry point

- **App root:** Single `MaterialApp` with `home: AuthGate`.
- **AuthGate:** Watches `FirebaseAuth.instance.authStateChanges()` (or equivalent).  
  - **Not signed in** → `SignInScreen`.  
  - **Signed in** → `MainScaffold` (main app with bottom nav).

### 2.2 Sign-in screen

**Purpose:** Log the user in. No sign-up UI in the app (accounts created via Firebase Console for tests, or via Google/Apple on first use).

**Layout:**
- Dark background (`VaultColors.bg`).
- Centered branding: title **"Coffre"** (gold), subtitle **"Vos documents en sécurité"**.
- **Web (simplified):** No email or password. **Two buttons only:** **Continuer avec Apple** and **Continuer avec Google**. No text fields, no "Ou" divider beyond what you need between the two buttons. Error message area and loading spinner as below. Footer: *"En vous connectant, vous acceptez que vos documents soient stockés de manière sécurisée."*
- **iOS / full flow (optional):** Email and Mot de passe fields, hint *"Pour les tests — créez le compte dans la console Firebase."*, then three actions: **Se connecter (email)** — `signInWithEmailAndPassword`; **Ou**; **Continuer avec Apple**; **Continuer avec Google**.
- **Primary actions (web):**
  1. **Continuer avec Apple** — Sign in with Apple → Firebase OAuth credential; optionally update display name from Apple name.
  2. **Continuer avec Google** — Google Sign-In → Firebase credential.
- **Error:** Red-bordered message area above buttons; message from `FirebaseAuthException` or generic.
- **Loading:** Spinner when any auth is in progress.
- **Footer:** *"En vous connectant, vous acceptez que vos documents soient stockés de manière sécurisée."*

**Design:** Buttons are card-style (surface bg, gold border), icon + label. Disabled state: muted surface and border.

### 2.3 After login

- Auth state stream updates → `AuthGate` switches to `MainScaffold`.
- **Sign out:** Only from Profile screen → "Déconnexion" → `FirebaseAuth.instance.signOut()`.

---

## 3. Main app shell (after login)

### 3.1 Layout

- **Scaffold:** Dark background, no app bar.
- **Body:** `IndexedStack` of 4 screens (only the active index is built/visible in practice):
  - Index **0:** Home.
  - Index **1:** Search.
  - Index **2:** Alertes (placeholder in iOS).
  - Index **3:** Profile.
- **Bottom navigation bar:** 4 items + center FAB.
  - Accueil (home icon) | Chercher (search) | [FAB] | Alertes (bell, optional red dot) | Profil (person).
- **FAB:** Centered, docked; gold gradient; "+" icon. **Action:** Open **Upload** as a **modal bottom sheet** (not a tab). On web this could be a modal/dialog or a dedicated route.

### 3.2 Navigation behavior

- **Home → Search:** Tapping the search bar on Home switches tab to Search (and can pre-fill a category filter).
- **Home → category pill:** Tapping a category pill (e.g. "Famille") switches to Search tab and sets **initial filter** to that category’s label (e.g. "Famille"); Search applies it and then clears the initial filter so it isn’t re-applied.
- **Alertes:** Tab shows placeholder; intent is expiry/insights (see Section 9).
- **Profile:** User info + Paramètres (e.g. Déconnexion).

---

## 4. Data structures

### 4.1 Firebase / Firestore

- **Database ID:** `coffre-ios` (use same for web to share data).
- **Collection:** `vault_documents`.
- **Document ID:** Auto-generated (e.g. `Firestore.collection('vault_documents').doc().id`) at start of upload; never changed on retry.

### 4.2 VaultDocument (Firestore + in-memory)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID (Firestore doc id). |
| `userId` | string | Firebase Auth UID. |
| `originalRef` | string | Firebase Storage path of original file (single-page or primary). |
| `thumbRef` | string | Storage path of thumbnail image. |
| `originalRefs` | string[]? | Multi-page: ordered list of storage paths (page_0, page_1, …). Null or length ≤ 1 → treat as single. |
| `fileType` | string | `'image'` or `'pdf'`. |
| `category` | string | One of: `famille`, `identite`, `sante`, `ecole`, `business`, `maison`, `vehicule`, `custom`. |
| `customCategory` | string? | Label when category is `custom` (e.g. "À classifier"). |
| `title` | string | Short title (e.g. from Gemini, max ~6 words). |
| `ocrSummary` | string | One descriptive sentence. |
| `keywords` | string[] | For search: Gemini keywords + redacted originals (e.g. CNI, NINEA, names); redaction map itself is **never** persisted. |
| `extractedFields` | map | See below. |
| `status` | string | `processing` \| `ready` \| `ocr_failed` \| `extraction_failed`. |
| `extractionProvider` | string? | `gemini` \| `fallback`. |
| `pageCount` | int | 1 for single; N for multi-page. |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Resolving “all page refs” for viewing:**  
If `originalRefs != null && length > 1` → use `originalRefs`; else use `[originalRef]`.

### 4.3 VaultExtractedFields (nested in document)

| Field | Type | Description |
|-------|------|-------------|
| `date` | string? | Document date (e.g. ISO or display format). |
| `parties` | string[] | People/entities (may contain placeholders like `[NOM]` if redacted). |
| `amounts` | string[] | Amounts (e.g. FCFA). |
| `referenceNumber` | string? | NINEA, doc number, etc. |
| `expiryDate` | string? | **ISO date (YYYY-MM-DD)**; drives expiry alerts and “Expirent” stat. |

### 4.4 Firebase Storage paths

- **Base:** `vault/{userId}/{docId}/`
- **Files:**
  - Thumb: `thumb.jpg`
  - Single original: `original.jpg` or `original.pdf`
  - Multi-page: `page_0.jpg`, `page_1.jpg`, …

So:
- Thumb path: `vault/{userId}/{docId}/thumb.jpg`
- Original (single): `vault/{userId}/{docId}/original.{jpg|pdf}`
- Page i: `vault/{userId}/{docId}/page_{i}.jpg`

### 4.5 ExtractionResult (upload pipeline only, not stored as-is)

Used during upload; fields are then written to `VaultDocument` and `VaultExtractedFields`.

- `category`, `customCategory`, `title`, `ocrSummary`, `keywords`
- `extractedFields` (same shape as above)
- `provider`: `'gemini'` or `'fallback'`

### 4.6 RedactionResult (in-memory only)

- `redactedText`: OCR text with sensitive parts replaced by placeholders.
- `redactionMap`: placeholder → original value (e.g. `[NUM_ID]` → CNI number).  
**Never stored.** Only used to send safe text to Gemini and to merge placeholder keys (or original values, per product) into `keywords` for search.

---

## 5. Upload process pipeline

Upload is the most complex flow. High-level: **pick file(s)** → **OCR** → **redact** → **Gemini extraction** (if needed) → **thumbnail** + **compress/original** → **Storage** → **Firestore** + **local thumb cache**.

### 5.1 Upload entry (modal)

**States:** `options` | `capture` | `review` | `processing` | `error`.

**Options screen (iOS / full flow):**
- Title: "Ajouter un document"
- Four options (card style, icon + label):
  1. **Prendre une photo** — camera (web: not used; see §5.11).
  2. **Choisir depuis la galerie** — gallery picker (web: not used; see §5.11).
  3. **Sélectionner un fichier** — images + PDF (e.g. jpg, jpeg, png, gif, heic, webp, pdf). If PDF → PDF pipeline; else image pipeline.
  4. **Document multi-pages** — goes to **capture** state (2–6 pages), then **review**, then one multi-page upload.

**Web (simplified):** On web, upload uses only **two buttons** (Images | PDFs), no camera or gallery. See **§5.11 Web upload UX (simplified)**.

### 5.2 Single image pipeline

1. **DocId:** Generate once (Firestore doc id).
2. **Existing categories:** Fetch user’s existing category values (for Gemini prompt).
3. **Processing state:** Show one message at a time (see BranchStatus below).
4. **Parallel branches:**
   - **Extraction branch:**  
     OCR (on image) → raw text → **redact** → if redacted text non-empty → **Gemini** with extraction prompt; else fallback.  
     Result: `ExtractionResult` (or fallback).
   - **Uploads branch:**  
     Generate **thumbnail** from image → upload thumb to Storage → get `thumbRef`.  
     Compress image for upload → upload as `original.jpg` → get `originalRef`.
5. **After both:** Build `VaultDocument` (status = `ready` or `ocr_failed` / `extraction_failed`), **createDocument** in Firestore, save thumb to local cache. Close modal and show success snackbar.

**Retries:** Storage upload retried up to 3 times with delays (e.g. 1s, 2s, 4s). UI shows “Enregistrement… (nouvelle tentative)” when retrying.

### 5.3 PDF pipeline

PDFs use **first page only** for OCR and extraction; the full PDF is stored as the original file.

- **First page only for OCR and Gemini:** Render the first page of the PDF to an image (e.g. ~1200px long edge for processing). Run the same pipeline on that image: OCR → **redact** (§5.7) → Gemini. Do not send raw OCR to Gemini.
- **Thumbnail:** Generate from the first page (compressed, e.g. max 800px), upload as `thumb.jpg`.
- **Storage:** Upload the **original PDF as-is** to `original.pdf` (do not recompress or convert the PDF). Upload thumb as `thumb.jpg`.
- **Firestore:** One document: `fileType: 'pdf'`, `originalRef` = path to `original.pdf`, `thumbRef` = path to `thumb.jpg`, `pageCount` = number of pages in the PDF. Status and keywords from redaction + Gemini, same as single image.
- **Web / Cloud Function:** On web, the client uploads the PDF and first-page thumb; the Cloud Function is responsible for rendering the PDF’s first page and running OCR → redaction → Gemini. See §5.10 and **§5.10.1 PDF handling (web)**.

### 5.4 Multi-page pipeline (2–6 images)

- **Capture:** User adds pages via camera or gallery; each page can go through **quad crop** (optional on web: 4-corner crop). Min 2, max 6 pages.
- **Review:** Horizontal list of page thumbnails; user can remove a page (if count &gt; 2); "Ajouter une page" or "Enregistrer".
- **Upload:**  
  - Upload each page as `page_0.jpg`, `page_1.jpg`, … (with retries).  
  - Thumb = first page image (compressed).  
  - OCR + redaction + Gemini on **first page only**.  
  - Firestore: `originalRef` = first page path; `originalRefs` = list of all page paths; `pageCount` = length of `originalRefs`.

### 5.5 Processing state (UI)

**BranchStatus:** `idle` | `running` | `done` | `failed` | `skipped` | `retrying`.

**User-facing message (priority order):**
- Assembly (multi-page) → "Assemblage des pages…"
- OCR → "Lecture du document…"
- Gemini → "Analyse par intelligence artificielle…"
- Storage retry → "Enregistrement… (nouvelle tentative)"
- Storage → "Enregistrement dans le coffre…"
- Firestore → "Finalisation…" then "Document enregistré ✓"
- Error message if set, else "Préparation…"

**Success snackbar:**  
- If any branch failed (OCR or Gemini) but doc saved: *"Document enregistré. Vous pouvez le renommer."*  
- Else: *"Document enregistré dans le coffre"* (green snackbar).

**Error state:**  
- Show "Erreur" + message; buttons: "Fermer" and "Réessayer" (for multi-page, Réessayer re-runs same session; for single/PDF, Réessayer goes back to options).

### 5.5.1 Edge case: unreadable or low-quality image

When the user uploads an image that is **not readable** (blank, blurry, too dark, wrong orientation, or no text detected), the pipeline must **not** fail the upload. The document is still stored; only extraction is degraded.

**Current behavior (and required for web / Cloud Function):**

1. **OCR returns empty or throws:** If OCR returns no text (empty string) or throws an error (e.g. decode failure), do **not** abort. Use **fallback** extraction: `category: 'custom'`, `customCategory: 'À classifier'`, `title: 'Document'`, `ocrSummary: ''`, empty keywords and extractedFields, `extractionProvider: 'fallback'`. Set document **status** to `'ocr_failed'`. Still upload the original and thumb to Storage, and **create the document in Firestore** with this fallback metadata.
2. **Success message:** When OCR or Gemini failed but the doc was saved, show: *"Document enregistré. Vous pouvez le renommer."* so the user knows the file is in the vault and they can rename or correct it later (e.g. from a document detail screen).
3. **Cloud Function:** Same rule: if OCR returns empty or throws, do not return an error to the client. Still write the `VaultDocument` with fallback metadata and `status: 'ocr_failed'`. The client should treat this as success (document saved) with a hint that extraction was partial.
4. **UI (optional):** In the document list, docs with `status: 'ocr_failed'` or `customCategory: 'À classifier'` can show a badge or label (e.g. "À classifier") so the user sees that the document was stored but not fully read. They can later open it, rename it, or re-upload a clearer image.

**Summary:** Unreadable image → save document anyway with fallback metadata and status `ocr_failed`; show "Document enregistré. Vous pouvez le renommer."; do not block or fail the upload.

**Rename feature (not yet implemented):** The message "Vous pouvez le renommer" implies the user can rename the document later. In the **current iOS app**, **renaming is not implemented** — there is no document detail or edit screen, and nothing in the UI calls `updateDocument`. For the **web version**, implement a **document detail screen** where the user can view the document and **edit the title** (and optionally category). That way failed-OCR docs (and any doc) can be renamed as promised.

**Chip / category for failed OCR on Home (recommended):** On the **current** Home screen, category pills are built from distinct document categories **excluding `custom`**. So docs with `category: 'custom'` (including fallback "À classifier" / failed OCR) **do not get a dedicated chip** — they are only visible under "Tous". For the **web version** (and optionally iOS), **add a chip for "À classifier"** (or "À renommer" / "Non lus"): show this pill when the user has at least one document with `status === 'ocr_failed'` or `category === 'custom'` (and optionally `customCategory === 'À classifier'`). Tapping it opens Search with a filter that shows only those docs, so the user can quickly find and rename them. Optionally show the count of such docs in the summary card (e.g. "À classifier: 3") so it’s visible at a glance.

### 5.6 OCR (iOS: ML Kit)

- Input: single image file.
- Output: raw text (trimmed, normalized line breaks).
- On web: replace with Tesseract.js or a backend OCR that returns plain text.

### 5.7 Redaction (required safety before Gemini)

**Safety (required):** Raw OCR text must **never** be sent to Gemini. A **redaction** step is mandatory: run on the raw OCR output and send only the redacted text to the model. This protects PII (IDs, phones, names, addresses, full birth dates) from leaving the pipeline. Both the iOS client and the web Cloud Function must implement the same redaction logic.

- **Input:** Raw OCR text.
- **Output:** `RedactionResult`: `redactedText` (safe to send to Gemini) and `redactionMap` (placeholder → original; in-memory only, never stored).
- **Redaction patterns (must be applied before any call to Gemini):**
  - **NINEA:** 7 digits + letter + digit (e.g. `1234567A9`) → placeholder.
  - **CNI:** Exactly 13 digits → placeholder (e.g. `[NUM_ID]`).
  - **Senegalese phone:** +221…, 221…, 7x/3x + 8 digits (with or without spaces) → placeholder (e.g. `[TELEPHONE]`).
  - **Full birth date:** dd/mm/yyyy or d/m/yyyy → placeholder keeping only year (e.g. `[DATE_XX/XX/2020]`).
  - **Street-style address:** Lines starting with rue, avenue, av., villa, cité, lot + rest of line → placeholder (e.g. `[ADRESSE]`).
  - **Person names:** Text after "Nom :", "Prénom :", "Nom de naissance :", or after "M.", "Mme", "Monsieur", "Madame" → placeholder (e.g. `[NOM]`).
- Only **redactedText** is sent to Gemini. The map is used only to add searchable terms (e.g. original values) into `keywords` for search; the map is never persisted.

### 5.8 Gemini extraction

- **Model:** e.g. `gemini-2.5-flash-lite` (Firebase AI / Vertex).
- **Input:** Redacted OCR text + list of existing categories.
- **Prompt (French):** Assistant for Senegalese administrative documents; ask for **single JSON** with:
  - `category` (enum: famille|identite|sante|ecole|business|maison|vehicule|custom)
  - `customCategory` (if custom)
  - `title` (short, max ~6 words)
  - `ocrSummary` (one sentence)
  - `keywords` (5–8 French keywords)
  - `extractedFields`: `date`, `parties`, `amounts`, `referenceNumber`, `expiryDate` (ISO)
- **Output:** Parse first `{ ... }` in response; map to `ExtractionResult`. On empty or parse error → fallback (category `custom`, title "Document", etc.).

### 5.9 Thumbnail and storage

- **Thumb:** Max long edge 800px, quality ~78, JPEG. Cached locally after upload.
- **Original image:** Compressed for upload (e.g. max 1920px, quality 85) then uploaded.
- **PDF:** Original file uploaded as-is; thumb = first page rendered then compressed.

### 5.10 Web version: Cloud Functions pipeline and client-side optimization

On the **web**, the image processing pipeline runs in **Firebase Cloud Functions** (not in the browser). The client only prepares and uploads files; the function performs OCR, redaction, and Gemini extraction. This keeps the web app light, consistent with the mobile pipeline, and ensures redaction runs in a controlled environment.

**Client (browser) — required:**
1. **Thumbnail creation (local):** Generate thumbnail from the image (max long edge 800px, quality ~78, JPEG) for preview and for uploading as `thumb.jpg`. No OCR or Gemini on the client.
2. **Optimize original before upload:** Before sending the file to Storage, optimize it for speed and size while keeping quality sufficient for OCR and Gemini:
   - **Resize:** Cap the longest edge (e.g. **1920px or 2400px**). Documents remain readable at this resolution; larger sizes slow uploads without clear benefit.
   - **Recompress:** JPEG quality **82–88** (or WebP if the Cloud Function can decode it). Avoid overly low quality (e.g. &lt; 75) so OCR and extraction stay reliable.
   - **Strip metadata:** Remove EXIF (orientation, GPS, etc.) to reduce size and avoid server-side quirks.
   - **Format:** Prefer JPEG for photos/scans. Do not send raw or unnecessarily large originals.
3. **Upload:** Upload the **optimized original** to Storage (`vault/{userId}/{docId}/original.jpg` or `.pdf`). Upload the **thumbnail** in parallel or immediately after. Both uploads can run in parallel with the Cloud Function call.
4. **Invoke pipeline:** Call a Cloud Function with `userId`, `docId`, and the Storage path of the **original** (the function must use the original file for OCR, not the thumbnail). Alternatively, trigger the function when the original is uploaded (e.g. Storage trigger). The client then shows "Processing…" and subscribes to Firestore for the new document (or polls) until the function writes the doc.

**Cloud Function — required:**
1. **Input:** Receives (or derives from a Storage trigger) the path to the **original** file in Storage. Optionally receives `userId`, `docId`, and existing categories.
2. **Download:** Fetch the original file from Storage (do not use the thumbnail for OCR; quality would be too low).
3. **OCR:** Run OCR on the original image (e.g. Tesseract in Node, or Cloud Vision API). Output: raw text.
4. **Redaction (mandatory safety):** Run the **same redaction logic as in §5.7** on the raw OCR text. Replace NINEA, CNI, phones, full birth dates, addresses, and person names with placeholders. **Never send raw OCR text to Gemini.** Only the redacted text may be passed to the next step.
5. **Gemini:** Call Gemini with the redacted text and existing categories; parse JSON into `ExtractionResult`.
6. **Firestore:** Write the `VaultDocument` (including thumbRef/originalRef from client uploads or from function-uploaded thumb). Optionally the function can upload a server-generated thumb; if the client already uploaded the thumb, use that ref.

**Parallelism:** The client can upload the original and the thumbnail while the Cloud Function runs. The function runs OCR → redaction → Gemini → Firestore. No raw OCR or unredacted PII must ever be sent to Gemini or logged.

#### 5.10.1 PDF handling (web and Cloud Function)

PDFs are handled differently from images: the **original file is never resized or recompressed**; only the **first page** is used for OCR and for the thumbnail.

**Client (browser) — PDF:**
1. **Thumbnail (local):** Render the **first page** of the PDF to an image (e.g. using a PDF library or canvas), then compress it to thumbnail size (max long edge 800px, quality ~78, JPEG). Upload as `thumb.jpg`. No OCR or Gemini on the client.
2. **Original PDF:** Upload the **PDF file as-is** to Storage as `vault/{userId}/{docId}/original.pdf`. Do not apply image-style optimization (resize/recompress) to the PDF; keep the original bytes so the user’s document is preserved.
3. **Invoke pipeline:** Call the Cloud Function with `userId`, `docId`, the Storage path to **original.pdf**, and `fileType: 'pdf'` (or let the function infer from the path). The function will use the PDF to extract text from the first page and run redaction → Gemini.

**Cloud Function — when original is a PDF:**
1. **Download:** Fetch `original.pdf` from Storage.
2. **Render first page:** Use a Node-capable PDF library (e.g. pdf2pic, pdfjs-dist, or pdf-image) to render the **first page** of the PDF to an image (e.g. ~1200px long edge for good OCR). If the PDF has no pages, treat as failure.
3. **OCR:** Run OCR on this **first-page image** (same as for a single image). Output: raw text.
4. **Redaction:** Apply §5.7 redaction to the raw OCR text. **Never send raw OCR to Gemini.** Only redacted text.
5. **Gemini:** Call Gemini with redacted text and existing categories; parse `ExtractionResult`.
6. **Firestore:** Write `VaultDocument` with `fileType: 'pdf'`, `originalRef` = path to `original.pdf`, `thumbRef` = path to client-uploaded `thumb.jpg`, `pageCount` = number of pages in the PDF (from PDF metadata). Status and keywords as for images.

**Summary:** For PDFs, the client uploads the unchanged PDF and a first-page thumbnail; the Cloud Function renders the first page, runs OCR on that image, then redaction → Gemini, and writes the doc. The stored “original” is always the PDF file.

---

### 5.11 Web upload UX (simplified): upload only, no camera

The **web version** uses a simplified upload flow: **no photo taking**, only **file upload**. Two main actions: **Images** and **PDFs**.

**Upload entry (modal or page):**
- **Two buttons only:**
  1. **Images** — open file picker for images (e.g. jpg, jpeg, png, gif, webp). User can select **up to 10 images** at once.
  2. **PDFs** — open file picker for PDF(s). Each PDF is one document (or support multiple PDFs per pick; each → one doc).

No "Prendre une photo", no "Galerie", no "Document multi-pages" capture flow on web.

#### 5.11.1 Images: up to 10, optional crop, optional "together" (concatenate)

- **Selection:** User selects up to **10 image files** in one go.
- **Cropping (required feature):** Each image must have an **optional cropping step** before upload. After selection (or in a review step), the user can crop each image (e.g. rectangular crop or 4-corner quad crop like the iOS QuadCropScreen) to frame the document. If the user skips crop, the full image is used. Cropping applies to the image that will be uploaded and processed; implement with canvas or a cropper library.
- **Together / concatenate:** User can **mark two or more images as belonging to one document** (e.g. passport spread, recto–verso, or multi-page document).  
  - **If marked as "together":** Those images form **one** Firestore document. Only the **first image** of the group is used for processing (OCR → redaction → Gemini in the Cloud Function). All images in the group are uploaded to Storage as `page_0.jpg`, `page_1.jpg`, … and stored in one `VaultDocument` with `originalRefs`, `pageCount` = number of images, `thumbRef` = first page thumb. One doc in Firestore.  
  - **If not marked as together:** Each image is **processed and saved separately**. Each gets its own OCR/extraction and its own Firestore document (up to 10 documents from one batch).
- **UI:** After selecting 1–10 images, show a review step: thumbnails in order, optional crop per image, and a way to **group** images (e.g. "Lier ces images en un seul document" / "Together" checkbox or drag to group). Then "Upload" or "Enregistrer". Process accordingly (one doc per group or one per image).

#### 5.11.2 PDFs

- One button: **PDFs**. User picks one or more PDF files. Each PDF is uploaded as `original.pdf`, thumbnail from first page; Cloud Function runs PDF pipeline (§5.10.1). One Firestore document per PDF.

#### 5.11.3 Summary

| Action        | Selection        | Crop        | Together / group      | Result                                                                 |
|---------------|------------------|------------|------------------------|------------------------------------------------------------------------|
| Images        | 1–10 images      | Optional   | No                     | 1–10 separate documents (each image → one doc)                        |
| Images        | 2+ images        | Optional   | Yes (marked together)  | 1 document; first image processed; all stored as pages (originalRefs)  |
| PDFs          | 1+ PDFs          | N/A        | N/A                    | 1 document per PDF                                                    |

**Cropping** is part of the web image flow (per-image crop before upload). No camera; upload only.

---

## 6. Home screen

- **Top bar:**  
  - Left: "Bonjour," + user display name (or email prefix or "Utilisateur").  
  - Right: Avatar circle with **initial** (gold gradient bg).
- **Summary card (VaultSummaryCard):**
  - Lock icon + total **document count** + "documents" + sync icon.
  - Row of stat chips: **Famille** (count where category = famille), **Business** (business), **Expirent** (count where `extractedFields.expiryDate` is future and ≤ 60 days). "Expirent" chip uses red accent if count &gt; 0.  
  - **Web (recommended):** Optionally add a chip **"À classifier"** (or "À renommer") with count of docs where `status === 'ocr_failed'` or `category === 'custom'` (failed OCR / unreadable), so the user sees at a glance how many docs need renaming.
- **Search bar:** Placeholder "Chercher un document…". Tap → switch to Search tab (or navigate to search page on web).
- **Category pills:** Horizontal scroll; height ~84px.  
  - First pill: **"Tous"** (value null), active by default.  
  - Then one pill per **distinct category** in user’s documents (iOS currently **excludes** `custom`, so "À classifier" docs have no dedicated pill).  
  - **Web (recommended):** Include a pill **"À classifier"** when the user has docs with `status === 'ocr_failed'` or `category === 'custom'` (and optionally `customCategory === 'À classifier'`). Tapping it opens Search filtered to those docs so the user can find and rename them.  
  - Other labels: Famille, Identité, Santé, École, Business, Maison, Véhicule, Autre (for custom when shown).  
  - Tapping a pill switches to Search and passes that **label** (or filter) as initial filter (e.g. "Famille" or "À classifier").

**Data:** `VaultStorageService.streamDocuments(userId)` → list ordered by `updatedAt` desc. Summary counts and category set are derived from this list.

---

## 7. Search screen

- **Header:** "Rechercher" + search field (gold-accent container, search icon, placeholder "Nom, date, numéro…", clear button).
- **Initial filter:** If opened with a category label (e.g. from Home pill), pre-fill search field and run filter once; then clear initial filter so parent doesn’t re-apply.
- **Filtering:** Client-side on streamed documents. Match query (trimmed, lowercased) against: `title`, `category`, `ocrSummary`, each `keywords` entry. Empty query → show all.
- **Results:** Count line: "X document(s)" or "X résultat(s) trouvé(s)" (gold, small caps style). List of **VaultDocumentCard** (see below). Tapping a card currently does nothing (document detail not implemented).
- **Below list:** Section "Recherches récentes" with suggestion chips (e.g. "NINEA", "permis conduire", "bail maison", "passeport"); tap fills search. Then info card: "Recherche intelligente" + short explanation.

---

## 8. Document card and thumbnails

**VaultDocumentCard:**
- Left: **Thumbnail** 42×48 (or category-colored placeholder with category icon if thumb missing). Thumb loaded from cache or fetched from Storage and cached.
- Center: **Title** (doc title), **meta line:** category label + optional relative time or extracted date + optional **badge** ("✓ Prêt" or "Expire bientôt" if expiry within 60 days).
- Right: Chevron.
- **Accent:** Left border color by category (see Category colors below). Badge: green for "Prêt", red for "Expire bientôt".

**CachedThumb behavior:** Resolve thumb from local cache by `docId`; if missing, download from `thumbRef`, save to cache, then show. Placeholder: category icon on colored bg.

**Category → label (display):**  
famille→Famille, identite→Identité, sante→Santé, ecole→École, business→Business, maison→Maison, vehicule→Véhicule, custom→Document/Autre.

**Category → color (accent):**  
famille→green, identite→gold, sante→blue, ecole→purple, business→gold, maison→green, vehicule→blue, default→text3.

**Category → icon:**  
famille→syringe, identite→idCard, sante→ecg, ecole→document; rest→document.

---

## 9. Alertes tab (and future Insights)

**Current (iOS):** Placeholder screen with label "Alertes". Red dot on bell is hardcoded (`_hasAlerts = true`).

**Intended (data already supports it):**  
- **Expiry alerts:** From `VaultDocument.extractedFields.expiryDate` (ISO). Filter: date in future and within e.g. 30 or 60 days. Show count on bell; Alertes screen = list of those documents (same card as Search).
- **Optional — Insights surface (see docs/insights.md):**  
  - **Document-level:** e.g. "Votre permis expire dans 67 jours", "Contrat de bail — révision en janvier 2026".  
  - **Cross-document:** e.g. "3 documents expirent dans les 90 prochains jours".  
  - **Contextual/seasonal:** Rentrée scolaire, déclaration fiscale, Ramadan, etc.  
  - **Data model (future):** e.g. `VaultInsight`: id, userId, message, type (expiry|missing|contextual|renewal), relatedDocId, relatedMemberId, dismissed, createdAt. Dismissed = soft-delete.  
  - **UX:** Card stack; orange for expiry/urgent, gold/neutral for info; dismissable. Copy must be **specific and actionable** (French).

---

## 10. Profile screen

- **Hero:** Large avatar circle (initial, gold gradient), display name, email (small, muted).
- **Section "Paramètres":** List of tiles.  
  - **Déconnexion** (logout icon) → tap calls `FirebaseAuth.instance.signOut()`.

Style: tiles = surface bg, rounded corners, border, icon + label + chevron.

---

## 11. Design system (for web)

### 11.0 Responsive layout (required)

The app must work well on **desktop as well as mobile**. Do not target mobile-only layouts.

- **Viewports:** Support small (phone), medium (tablet), and large (desktop) breakpoints. Use responsive breakpoints (e.g. 640px, 768px, 1024px) to adapt layout, font sizes, and spacing.
- **Desktop:** On large screens, use max-width containers, multi-column grids where appropriate (e.g. document list in a grid or wider list), and consider a sidebar or top nav instead of a bottom nav if it fits the layout. Buttons and interactive areas must remain easily clickable (min touch/click target ~44px).
- **Mobile:** Preserve the existing mobile-first behavior (bottom nav, single column, etc.) on small screens.
- **Testing:** Verify layouts at multiple widths (e.g. 320px, 768px, 1280px) so the app is usable on phones, tablets, and desktops.

### 11.1 Colors (VaultColors)

- **Background:** `#0D0F18` (bg).
- **Surfaces:** `#141720` (surface), `#1A1E2C` (surface2), `#202535` (surface3).
- **Gold:** `#C8A45A` (primary), light `#E6C97E`, dim (13%) for selected states, glow (22%) for FAB.
- **Text:** `#EDE8E0` (text1), `#9A9DB8` (text2), `#525778` (text3).
- **Semantic:** green `#52B788`, red `#E05C5C`, blue `#5B9FE8`, purple `#B07FD4`.
- **Borders:** 7% white, 4% white (border2).

### 11.2 Typography

- **Headings:** Playfair Display (display large 34, medium 22, small 20; weights 600–700).
- **Body / UI:** DM Sans (11–14px, weights 400–700). Caption, overline, section title, doc title, doc meta, badge, results count as in vault_text_styles.

### 11.3 Theme

- Dark theme; status bar dark; nav bar `#0D0F18`; gold primary; surface and error colors as above.

### 11.4 Components (conceptual)

- **Category pill:** Icon circle + label; active = gold dim bg + gold border; inactive = surface + border.
- **Summary card:** Gradient (dark blue tones), gold border, lock icon, big number + "documents", stat chips (Famille, Business, Expirent).
- **Document card:** Left border accent by category, thumb or placeholder, title, meta line, optional badge, chevron.
- **Option cards (upload):** Icon in tinted circle, label, chevron; tap target.
- **Buttons:** Filled gold for primary; text/secondary for cancel.
- **Inputs:** Filled surface, 14px radius, gold focus border.

### 11.5 Icons

- Line-style SVG icons (stroke ~1.6–1.8, round caps). Used: lock, search, home, bell, person, chevronRight, plus, sync, idCard, syringe, document, ecg, camera, image, file, pages, logout, clear, warningTriangle, personAdd. Rendered with currentColor (or gold/text).

---

## 12. Services summary (for web parity)

| Service | Role |
|--------|------|
| **Auth** | Firebase Auth (web: Google and Apple only; no email). Auth state stream drives AuthGate. |
| **VaultStorageService** | Firestore `vault_documents` (create, update, stream by userId, getExistingCategories); Storage uploads (thumb, original, page_i). Uses DB id `coffre-ios`. |
| **VaultCacheService** | Thumb cache (get, save, fetchAndCacheThumb, getCacheSize, clearCache). LRU eviction at 200MB. |
| **VaultOcrService** | Extract text from one image (on-device ML Kit on iOS; web: Tesseract or backend). |
| **VaultRedactionService** | Redact raw text → RedactionResult; never persist map. |
| **VaultExtractionService** | Call Gemini with redacted text + existing categories → ExtractionResult. |
| **VaultThumbnailService** | Generate thumb (max 800px, quality 78); compress for upload; PDF first-page render. |

---

## 13. Flow summary (order of screens)

1. **Launch** → AuthGate checks auth state.
2. **Not logged in** → Sign-in screen (web: Google and Apple only; no email).
3. **Logged in** → Main scaffold: Home (default tab).
4. **Home:** Summary, search bar, category pills. Tap search → Search tab. Tap pill → Search with initial filter.
5. **Search:** Query/filter documents; show cards (document detail not implemented).
6. **Upload:** FAB → modal with options → camera/gallery/file or multi-page → processing → Firestore + Storage + cache → success/error.
7. **Alertes:** Tab; placeholder (or expiry list + optional insights).
8. **Profile:** User info, Déconnexion → sign out → AuthGate shows Sign-in.

---

## 14. What to build for web (checklist)

- [ ] Auth: Sign-in **web:** Google and Apple only (no email/password). AuthGate, sign out.
- [ ] Firestore: same `coffre-ios` DB, `vault_documents` collection; same document shape.
- [ ] Storage: same paths `vault/{userId}/{docId}/thumb.jpg`, `original.*`, `page_*.jpg`.
- [ ] Home: greeting, summary card (counts from stream), search bar → search, category pills → search with filter.
- [ ] Search: stream documents, filter by query (title, category, ocrSummary, keywords), VaultDocumentCard list, suggestion chips.
- [ ] Upload: modal/route with options; single image + PDF + multi-page pipelines; OCR (or backend) + redaction + Gemini; thumbnail + Storage + Firestore; processing state and error/retry. **Unreadable image (§5.5.1):** on OCR empty/failure, still save doc with fallback metadata and `status: ocr_failed`; show "Document enregistré. Vous pouvez le renommer."
- [ ] **Web upload (simplified §5.11):** Two buttons only — Images | PDFs. Images: up to 10 at once; optional **per-image cropping** (rectangular or quad); option to mark 2+ images as "together" (one doc, first image processed, all stored as pages); otherwise each image → separate doc. PDFs: one doc per PDF. No camera on web.
- [ ] Alertes: at least expiry list (from expiryDate ≤ 60 days); optionally insights model and UI.
- [ ] Profile: avatar, name, email, Déconnexion.
- [ ] Design: dark theme, gold/surface/typography as above; category colors and labels consistent. **Responsive:** Layout and navigation must work on desktop as well as mobile (§11.0); test multiple viewport widths.
- [ ] **PWA (required):** Web app manifest (name, short_name, icons, start_url, display standalone), HTTPS, installable “Add to Home Screen”.
- [ ] **Service worker & offline (required):** Register a service worker that caches static assets for offline load; caches document list and thumbnails for offline Home/Search; queues writes when offline and syncs when back online; shows a required offline indicator.
- [ ] **Firebase Analytics (required):** Integrate Firebase Analytics; log screen views, key actions (sign-in method, search, category tap, upload source, upload success/failure, errors), upload funnel, and optional user properties so metrics support comprehensive user behavior analysis.
- [ ] **Document detail + rename (recommended):** View original/PDF, metadata, extracted fields; **edit title** (rename) so users can act on "Vous pouvez le renommer" for failed-OCR docs. Not implemented on iOS yet; web should implement it.
- [ ] **"À classifier" chip on Home (recommended):** Show category pill and optionally summary chip for docs with `ocr_failed` / `custom` so users can filter to docs that need renaming.
- [ ] (Optional) Cache: thumb cache + getCacheSize/clear in settings.

Use this spec as the single source of truth for data, pipelines, and UX when building the web version.
