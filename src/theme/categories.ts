import i18n from '@/i18n';

/** Stored value for unclassified documents (translated in UI via getCategoryLabel) */
export const UNCLASSIFIED_CATEGORY_KEY = 'aClassifier';

/** Category display labels and accent colors (§8) */
export const CATEGORY_COLORS: Record<string, string> = {
  famille: '#52B788',
  identite: '#C8A45A',
  sante: '#5B9FE8',
  ecole: '#B07FD4',
  business: '#C8A45A',
  maison: '#52B788',
  vehicule: '#5B9FE8',
};

export function getCategoryLabel(cat: string, customLabel?: string | null): string {
  if (cat === 'custom' && customLabel) {
    if (customLabel === UNCLASSIFIED_CATEGORY_KEY) {
      return i18n.t('categories.aClassifier');
    }
    return customLabel;
  }
  const key = `categories.${cat}`;
  const out = i18n.t(key);
  return typeof out === 'string' ? out : 'Document';
}

export function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? '#525778';
}
