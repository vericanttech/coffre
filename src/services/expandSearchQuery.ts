import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

export interface ExpandSearchQueryParams {
  query: string;
  vaultContext: {
    categories: string[];
    sampleTitles: string[];
  };
}

export interface ExpandSearchQueryResult {
  keywords: string[];
}

/**
 * Callable: expand user search query into ~10 related keywords using vault context (AI-Boosted search).
 */
export async function expandSearchQuery(params: ExpandSearchQueryParams): Promise<ExpandSearchQueryResult> {
  const callable = httpsCallable<ExpandSearchQueryParams, ExpandSearchQueryResult>(
    functions,
    'expandSearchQuery'
  );
  const res = await callable(params);
  return res.data;
}
