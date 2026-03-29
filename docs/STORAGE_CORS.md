# Firebase Storage CORS setup

Download and Share in the app fetch file blobs from Firebase Storage. The browser only allows these requests if the Storage bucket returns CORS headers for your app’s **origin** (e.g. localhost in dev, or your production URL).

## Error you might see

- `Access to fetch at 'https://firebasestorage.googleapis.com/...' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`

## How it works

- **Local:** App runs at `http://localhost:5173` → bucket must allow that origin.
- **Production:** App runs at e.g. `https://coffre-147aa.web.app` → bucket must allow that origin.

`storage.cors.json` in the project root already includes:

- Localhost (dev): `http://localhost:5173`, `http://localhost:3000`, `127.0.0.1`
- Production (Firebase Hosting default): `https://coffre-147aa.web.app`, `https://coffre-147aa.firebaseapp.com`

So once you apply this CORS config **once** to your bucket, both local and production work. If you use a **custom domain** (e.g. `https://trouvedoc.com`), add it to the `"origin"` array in `storage.cors.json` and run `gsutil cors set` again.

## Apply CORS to the bucket (one-time)

1. **Install Google Cloud SDK** (if needed) so you have `gsutil`:  
   https://cloud.google.com/sdk/docs/install

2. **Log in and set project:**
   ```bash
   gcloud auth login
   gcloud config set project coffre-147aa
   ```

3. **Apply the config** (use the bucket from your Firebase config, e.g. `.env` → `VITE_FIREBASE_STORAGE_BUCKET`):
   ```bash
   gsutil cors set storage.cors.json gs://coffre-147aa.firebasestorage.app
   ```
   If your bucket is the default one:
   ```bash
   gsutil cors set storage.cors.json gs://coffre-147aa.appspot.com
   ```

4. **Check (optional):**
   ```bash
   gsutil cors get gs://coffre-147aa.firebasestorage.app
   ```

After this, Download and Share work from **localhost** and from **production** (e.g. `https://coffre-147aa.web.app`). Clear cache or use incognito if you had a CORS error before.
