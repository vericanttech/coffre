import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { analytics, auth } from '@/config/firebase';

/** Current user UID for event params. All analytics logic stays here; UI only calls functions from this file. */
function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function withUid<T extends Record<string, unknown>>(params: T): T & { uid?: string } {
  const uid = getCurrentUid();
  return uid ? { ...params, uid } : params;
}

export function logScreenView(screenName: string) {
  if (analytics) {
    logEvent(analytics, 'screen_view', withUid({ firebase_screen: screenName, firebase_screen_class: screenName }));
  }
}

export function logSignIn(method: string) {
  if (analytics) logEvent(analytics, 'login', withUid({ method }));
}

export function logSignOut() {
  if (analytics) logEvent(analytics, 'sign_out', withUid({}));
}

export function logSearch(query: string, resultCount: number) {
  if (analytics) logEvent(analytics, 'search', withUid({ search_term: query, result_count: resultCount }));
}

export function logUploadStart(source: 'images' | 'pdf') {
  if (analytics) logEvent(analytics, 'upload_start', withUid({ source }));
}

export function logUploadSuccess(source: string) {
  if (analytics) logEvent(analytics, 'upload_success', withUid({ source }));
}

export function logUploadFailure(reason: string) {
  if (analytics) logEvent(analytics, 'upload_failure', withUid({ reason }));
}

export function setAnalyticsUserId(uid: string | null) {
  if (analytics && uid) setUserId(analytics, uid);
}

export function setAnalyticsDocCount(count: number) {
  if (analytics) setUserProperties(analytics, { document_count_bucket: String(Math.min(90, Math.floor(count / 10) * 10)) });
}
