# Coffre Cloud Functions

Pipeline: **OCR** (Vision API) → **redaction** (§5.7) → **Gemini** → **Firestore** update.

## Setup

1. **Firebase CLI**  
   `npm install -g firebase-tools` and `firebase login`.

2. **Dependencies**  
   From project root:  
   `cd functions && npm install`

3. **Gemini API key**  
   Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey), then either:

   - **Env (recommended for local):**  
     `export GEMINI_API_KEY=your_key` before running the emulator.
   - **Firebase config:**  
     `firebase functions:config:set gemini.api_key="your_key"`  
     (used in production if `GEMINI_API_KEY` is not set.)

4. **Google Cloud Vision**  
   Enable the [Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com) for your Firebase project (same GCP project). The default service account used by Cloud Functions will have access.

## Build & run

- **Build:** `npm run build`
- **Local emulator:** From repo root: `firebase emulators:start --only functions`  
  (Client can point to `http://127.0.0.1:5001/PROJECT_ID/us-central1` when using the emulator.)
- **Deploy:** From repo root: `firebase deploy --only functions`

## Callable: `processVaultDocument`

The web app calls this after uploading the original file and creating the Firestore doc with `status: 'processing'`.

**Body:** `{ docId, originalPath, fileType?: 'image'|'pdf', thumbRef?, pageCount? }`

The function downloads the file from Storage, runs OCR (Vision for images, pdf-parse for PDF text), redacts PII, calls Gemini for extraction, then updates the document (category, title, keywords, etc.) and sets `status` to `ready` or `ocr_failed` / `extraction_failed`.

## PDFs

PDFs use `pdf-parse` to extract text from the first page (no image rendering). For scanned PDFs you’d need a PDF-to-image step and Vision OCR; the current code is suited to digital PDFs.
