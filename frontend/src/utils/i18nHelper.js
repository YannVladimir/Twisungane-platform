/**
 * Formats a number as FRW (Rwandan Franc) with locale-aware thousand separators.
 * @param {number|string} val - The numeric value to format.
 * @param {string} lang - The current language locale ('en', 'fr', 'ky').
 * @returns {string} - Formatted currency string.
 */
export const frw = (val, lang) => {
  const amount = Number(val) || 0;
  const locale = lang === 'fr' ? 'fr-FR' : (lang === 'ky' ? 'rw-RW' : 'en-GB');
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    maximumFractionDigits: 0
  }).format(amount) + ' FRW';
};

/**
 * Returns the locale string for date formatting based on the application language.
 * @param {string} lang - The current language locale.
 * @returns {string}
 */
export const getLocale = (lang) => {
  return lang === 'fr' ? 'fr-FR' : (lang === 'ky' ? 'rw-RW' : 'en-GB');
};
