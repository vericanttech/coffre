import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import ar from '@/locales/ar.json';
import fr from '@/locales/fr.json';

const STORAGE_KEY = 'app-locale';

function getStoredOrDetected(): string {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === 'en' || stored === 'ar' || stored === 'fr') return stored;
  const browser = typeof navigator !== 'undefined' ? navigator.language : '';
  if (browser.startsWith('ar')) return 'ar';
  if (browser.startsWith('fr')) return 'fr';
  return 'en';
}

function applyDocumentDirection(lng: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (lng === 'ar') {
    root.dir = 'rtl';
    root.lang = 'ar';
  } else {
    root.dir = 'ltr';
    root.lang = lng;
  }
}

const initialLng = getStoredOrDetected();
applyDocumentDirection(initialLng);

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar }, fr: { translation: fr } },
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  applyDocumentDirection(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore
  }
});

export default i18n;
