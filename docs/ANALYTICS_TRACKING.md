# Google Analytics (Firebase) — What We Track

The app uses **Firebase Analytics** (Google Analytics for Firebase). Analytics is initialized in [src/config/firebase.ts](src/config/firebase.ts) and only in production; events are sent only when the Firebase app is configured and analytics is available.

---

## Events


| Event name         | When it fires                       | Parameters                                               | Where it's called                                                                            |
| ------------------ | ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **screen_view**    | User opens a main screen/tab        | `firebase_screen`, `firebase_screen_class`, `uid`        | [useScreenAnalytics](src/hooks/useScreenAnalytics.ts) used by Home, Search, Alertes, Profile |
| **login**          | User signs in successfully          | `method`, `uid`                                          | [SignInScreen](src/screens/SignInScreen.tsx) after Google/Apple sign-in                      |
| **sign_out**       | User signs out                      | `uid`                                                    | [ProfileScreen](src/screens/ProfileScreen.tsx) on Déconnexion                                |
| **search**         | User runs a search (after debounce) | `search_term`, `result_count`, `uid`                     | [SearchScreen](src/screens/SearchScreen.tsx) when there is a non-empty query                 |
| **upload_start**   | User starts an upload flow          | `source`, `uid`                                          | [UploadModal](src/screens/UploadModal.tsx) when choosing Images or PDFs                      |
| **upload_success** | Upload flow completes (images only) | `source`, `uid`                                          | [UploadModal](src/screens/UploadModal.tsx) after images are sent                             |
| **upload_failure** | Upload fails (e.g. error thrown)    | `reason`, `uid`                                          | [UploadModal](src/screens/UploadModal.tsx) in the catch block                                |

Every event above includes **`uid`** (current user’s Firebase UID) when the user is signed in. All tracking is implemented in [src/lib/analytics.ts](src/lib/analytics.ts); the UI only calls functions from that module (no direct `firebase/analytics` usage in screens or hooks).


---

## Screens that log screen_view

- **Home** — [HomeScreen](src/screens/HomeScreen.tsx)
- **Search** — [SearchScreen](src/screens/SearchScreen.tsx)
- **Alertes** — [AlertesScreen](src/screens/AlertesScreen.tsx)
- **Profile** — [ProfileScreen](src/screens/ProfileScreen.tsx)

Sign-in and upload/modals do not log their own `screen_view`; the active main screen is the one that was last logged.

---

## User identification and properties

- **User ID**: When the user is signed in, the Firebase UID is set as the analytics user ID via `setUserId`. Called from [useAuth](src/hooks/useAuth.ts) when the auth state changes.
- **User property**  
  - `document_count_bucket`: Function `setAnalyticsDocCount(count)` in [src/lib/analytics.ts](src/lib/analytics.ts) sets a bucket (e.g. `"0"`, `"10"`, `"20"`, … up to `"90"`) based on document count. **This is not currently called anywhere** in the app; it is available if you want to segment users by doc count.

---

## What you can learn (answers from the current setup)

With the events and user ID above, in Firebase Analytics (or GA4 if linked) you can get:

### Engagement and usage

- **Which screens are used most** — Count of `screen_view` by `firebase_screen` (Home, Search, Alertes, Profile). Lets you see where time is spent and which tabs are ignored.
- **How many users are active** — Unique users over day/week/month (all events are tied to the same app).
- **Session length and depth** — Standard session metrics (session duration, events per session) from the same events.

### Acquisition and retention

- **Sign-ins by method** — Count of `login` events by `method` (`google` vs `apple`) to see which provider dominates.
- **How often users sign out** — Count of `sign_out`; together with `login`, you can infer re-engagement.

### Search

- **How much people search** — Count of `search` events and unique users who triggered them.
- **Popular search terms** — Distribution of `search_term` (and which terms return few/many results via `result_count`) to spot missing content or UX issues.
- **Search effectiveness** — E.g. ratio of searches with `result_count === 0` vs `result_count > 0` to see “no results” rate.

### Uploads

- **Upload intent** — Count of `upload_start` by `source` (`images` vs `pdf`) to see what type of uploads people attempt.
- **Upload success rate** — Compare `upload_success` vs `upload_failure` (and count of `upload_failure` by `reason`) to spot errors and drop-off.
- **Funnel** — `upload_start` → `upload_success` or `upload_failure` per user/session to see where the flow breaks (note: PDFs don’t send `upload_success` today, so the funnel is complete only for images).

### User-level (because we set User ID)

- **Per-user behavior** — Same metrics above broken down by user (e.g. “users who signed in with Apple” or “users who searched at least once”).
- **Cross-session behavior** — Recurring users vs one-time; login/sign_out patterns over time.

### What you cannot get (with current setup)

- **Document count per user** — `setAnalyticsDocCount` exists but is never called; no segment like “users with 10+ documents” yet.
- **PDF upload success** — Only image uploads send `upload_success`; PDF completion is not logged.
- **Which document was opened** — No event when a user opens a document detail; only screen views for the four main tabs.
- **Language/locale** — No analytics event or user property for app language (en/fr/ar).

---

## Implementation details

- **Module**: [src/lib/analytics.ts](src/lib/analytics.ts) — all event and user/property calls go through this file; no screen or hook imports from `firebase/analytics` directly.
- **UID on events**: Each event is sent with an `uid` parameter (current Firebase Auth UID) when the user is signed in, via a shared `withUid()` helper so behavior is consistent and auditable.
- **Guard**: Every call checks `if (analytics)` so nothing is sent when analytics is not initialized (e.g. disabled or missing config).

