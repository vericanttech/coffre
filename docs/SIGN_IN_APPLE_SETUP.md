# Sign in with Apple — configuration

The app **already uses** Sign in with Apple in code (`OAuthProvider('apple.com')` + `signInWithPopup`). For it to work, you must configure **Firebase** and **Apple Developer**.

---

## Reusing your mobile setup

If you already have Sign in with Apple for the **mobile** (iOS) app, you can reuse:

| Item | Reuse? |
|------|--------|
| **Apple Developer account / Team ID** | Yes — same account. |
| **App ID (Bundle ID)** | Yes — use it as **Primary App ID** when creating the Services ID (§2.1) and when configuring the key (§2.2). |
| **Sign in with Apple key** (.p8) | Yes — the same key can be used for both native and web. Use that Key ID and private key in Firebase; no need to create a second key. |
| **Services ID** | No — the **web** flow requires a Services ID; mobile only uses an App ID, so there is none to reuse. Create one for web (e.g. `com.yourapp.coffre.web`) and, when configuring it, use **the same domain** where your app is served (Domains, Subdomains, and Return URLs as in §2.1). |

Summary: same account, same App ID, same key, same domain. Create one new **Services ID** for the web flow and register your domain + Firebase Return URL in it.

**If Apple is already configured in Firebase from mobile:** you only need to (1) create the Services ID (§2.1, above) and (2) in Firebase → Authentication → Sign-in method → Apple, set the **Services ID** to that new value (e.g. `com.yourapp.coffre.web`) and save. Team ID, Key ID, and private key are already there — no need to re-enter them. §2.2 and the full §3 apply only when setting up from scratch.

---

## 1. Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Sign-in method**.
2. Click **Apple** → **Enable**.
3. You will need to paste values from Apple Developer (see below). Leave the tab open.

---

## 2. Apple Developer (developer.apple.com)

You must be in the [Apple Developer Program](https://developer.apple.com/programs/) (paid).

### 2.1 Create a Services ID (for web)

1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources) → **Identifiers**.
2. Click **+** → choose **Services IDs** → Continue.
3. **Description:** e.g. `Coffre Web`. **Identifier:** e.g. `com.yourapp.coffre.web` (must be unique).
4. Enable **Sign In with Apple** and click **Configure**:
   - **Primary App ID:** select your app (or create an App ID first).
   - **Domains and Subdomains:** your web domain, e.g. `coffre-147aa.web.app` (and your custom domain if any).
   - **Return URLs:** add exactly:
     ```text
     https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler
     ```
     Replace `YOUR_PROJECT_ID` with your Firebase project ID (e.g. `coffre-147aa`).
5. Save. The **Services ID** (e.g. `com.yourapp.coffre.web`) is what you will use as “Service ID” in Firebase.

### 2.2 Create a Sign in with Apple key

1. In Apple Developer → **Keys** → **+**.
2. **Key name:** e.g. `Coffre Sign in with Apple`.
3. Enable **Sign In with Apple** → **Configure** → select your **Primary App ID**.
4. Continue → Register. **Download the `.p8` file once** (you cannot download it again). Note the **Key ID**.
5. You also need your **Team ID** and **Bundle ID** (or the App ID identifier) from the Apple Developer account overview / App ID.

### 2.3 Optional: private email relay

If you use user email and want to receive Apple’s private relay emails, register the relay domain in Apple (e.g. `noreply@YOUR_PROJECT_ID.firebaseapp.com`). This is optional for basic sign-in.

---

## 3. Paste into Firebase

Back in Firebase → Authentication → Sign-in method → Apple.  
*(If you already enabled Apple for mobile, only add or update the **Services ID**; leave the other fields as they are.)*

| Field | Where it comes from |
|-------|----------------------|
| **Services ID** | The Services ID you created (e.g. `com.yourapp.coffre.web`). |
| **Apple Team ID** | Apple Developer → Membership / Account → Team ID. |
| **Key ID** | The Key ID of the key you created for Sign in with Apple. |
| **Private key** | Contents of the `.p8` file you downloaded (full text, including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`). |

Save. After that, the “Continuer avec Apple” button in the app should work (on supported browsers).

---

## 4. Quick checklist

- [ ] Apple Developer Program membership.
- [ ] Services ID created with Return URL `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`.
- [ ] Sign in with Apple key created; `.p8` downloaded; Key ID noted.
- [ ] Apple provider enabled in Firebase with Services ID, Team ID, Key ID, and private key.
- [ ] App served over HTTPS (Firebase Hosting or your domain).

---

## 5. References

- [Firebase: Authenticate with Apple (web)](https://firebase.google.com/docs/auth/web/apple)
- [Apple: Sign in with Apple for the web](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js)
