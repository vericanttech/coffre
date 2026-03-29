# Coffre — Web

Document vault for Senegalese families (French, Senegal-focused). Built with React, Firebase, and short modular files.

## Setup

1. **Firebase**  
   Create a project at [Firebase Console](https://console.firebase.google.com/), enable Auth (Google + Apple), Firestore, Storage, and Analytics. Use the same Firestore DB id `coffre-ios` if you share data with the iOS app.

2. **Env**  
   Create a `.env` file with your Firebase config (`VITE_FIREBASE_*` vars).

3. **Install and run**
   ```bash
   npm install
   npm run dev
   ```

4. **PWA icons** (optional)  
   Add `public/icon-192.png` and `public/icon-512.png` for “Add to Home Screen”. The app works without them.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview production build

## Structure (short files)

- `src/config/` — Firebase
- `src/theme/` — colors, category labels
- `src/types/` — VaultDocument
- `src/services/` — Firestore stream, upload, storage paths
- `src/hooks/` — useAuth, useDocuments, useScreenAnalytics
- `src/context/` — Offline
- `src/components/` — AuthGate, OfflineBanner, cards, pills
- `src/screens/` — SignIn, Home, Search, Alertes, Profile, UploadModal
- `src/layout/` — MainScaffold, BottomNav
- `src/lib/` — analytics helpers

## Service worker (PWA / offline)

The app uses **vite-plugin-pwa** with the **injectManifest** strategy so the service worker is built from a custom script instead of being fully generated. That avoids the build failure that occurs with the default **generateSW** strategy (Workbox’s internal build sometimes hangs during the Rollup/Terser step).

- **Module:** `vite-plugin-pwa` + `workbox-precaching` / `workbox-routing`
- **Config:** `vite.config.ts` — `VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts' })`
- **Source:** `src/sw.ts` — precaches the app shell and serves `index.html` for navigation so the app works offline.
- **Registration:** In production the app registers `/sw.js` in `main.tsx` after load.

After `npm run build`, the plugin compiles `src/sw.ts` and injects the precache manifest into `dist/sw.js`. Deploy `dist/` and open the app over HTTPS; the service worker will cache assets and allow offline use.

## Backend (Cloud Functions)

The **processVaultDocument** callable runs the pipeline: **OCR** (Vision API) → **redaction** → **Gemini** → **Firestore** update. The web app calls it after each upload so documents move from `processing` to `ready` (or `ocr_failed` / `extraction_failed`).

- **Setup:** `cd functions && npm install`
- **Config:** Set a Gemini API key: `firebase functions:config:set gemini.api_key="YOUR_KEY"` or env `GEMINI_API_KEY`. Enable [Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com) for the project.
- **Deploy:** From repo root: `firebase deploy --only functions`
- **Details:** See `functions/README.md`
