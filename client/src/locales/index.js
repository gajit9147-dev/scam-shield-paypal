import { en } from './en.js';
import { hi } from './hi.js';
import { hinglish } from './hinglish.js';

export const locales = { en, hi, hinglish };

export function getDictionary(lang = 'en') {
  return locales[lang] || locales.en;
}

export function translateCategory(categoryKey, lang = 'en', defaultLabel = '') {
  const dict = getDictionary(lang);
  if (!categoryKey) return defaultLabel || '';
  if (dict.categories && dict.categories[categoryKey]) {
    return dict.categories[categoryKey];
  }
  // Try matching directly against English label
  const enCategories = locales.en.categories;
  for (const [key, label] of Object.entries(enCategories)) {
    if (label.toLowerCase() === (defaultLabel || categoryKey).toLowerCase()) {
      return dict.categories?.[key] || defaultLabel || categoryKey;
    }
  }
  return defaultLabel || categoryKey;
}

export function translateEvidence(evidenceText, lang = 'en') {
  if (!evidenceText) return '';
  const dict = getDictionary(lang);
  if (dict.evidence && dict.evidence[evidenceText]) {
    return dict.evidence[evidenceText];
  }
  // Partial substring matching for dynamic signals
  for (const [key, translation] of Object.entries(dict.evidence || {})) {
    if (evidenceText.toLowerCase().includes(key.toLowerCase())) {
      return translation;
    }
  }
  return evidenceText;
}

export function translateRecommendation(recText, categoryKey, lang = 'en') {
  const dict = getDictionary(lang);
  if (categoryKey && dict.recommendations && dict.recommendations[categoryKey]) {
    return dict.recommendations[categoryKey];
  }
  return dict.recommendations?.general_scam || [recText];
}
