export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';
export const DEFAULT_CURRENCY_CODE = 'ARS';
export const DEFAULT_CURRENCY_SYMBOL = '$';

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeCurrencySymbol(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const symbol = value.trim();
  if (symbol.length < 1 || symbol.length > 5) return null;
  return symbol;
}

export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export function formatMoney(value: number, symbol = DEFAULT_CURRENCY_SYMBOL): string {
  return `${symbol}${(Number(value) || 0).toFixed(2)}`;
}
