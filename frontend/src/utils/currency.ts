export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR'];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$',
  JPY: '¥', CHF: 'CHF ', CNY: '¥', INR: '₹',
};

export function symbolOf(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency + ' ';
}

/** Convert amount from one currency to another using USD-base rates. */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to) return amount;
  const rateFrom = rates[from] ?? 1;
  const rateTo = rates[to] ?? 1;
  return amount * (rateTo / rateFrom);
}

/** Format a number with its currency symbol. */
export function fmt(amount: number, currency: string): string {
  const sym = symbolOf(currency);
  // JPY and CNY have no decimal places by convention
  const decimals = ['JPY', 'CNY'].includes(currency) ? 0 : 2;
  return `${sym}${amount.toFixed(decimals)}`;
}

/** Returns a secondary "≈ X" string when currencies differ, or empty string. */
export function fmtConverted(
  amount: number,
  originalCurrency: string,
  preferredCurrency: string,
  rates: Record<string, number>,
): string {
  if (originalCurrency === preferredCurrency || Object.keys(rates).length === 0) return '';
  const converted = convert(amount, originalCurrency, preferredCurrency, rates);
  return `≈ ${fmt(converted, preferredCurrency)}`;
}
