import { describe, expect, it } from 'vitest';
import {
  buildTableMenuUrl,
  formatZoneName,
  tableCardPrintHtml,
  tableCardsPrintSheetHtml,
} from '@/lib/table-card';
import { validateBranding } from '@/lib/branding-store';

describe('buildTableMenuUrl', () => {
  it('incluye restaurante y mesa', () => {
    expect(buildTableMenuUrl('https://demo.com', 'rest-1', 4)).toBe(
      'https://demo.com/menu?restaurant=rest-1&table=4',
    );
  });

  it('tolera origin con barra final y restaurante con espacios', () => {
    expect(buildTableMenuUrl('https://demo.com/', 'mi resto', 12)).toBe(
      'https://demo.com/menu?restaurant=mi%20resto&table=12',
    );
  });
});

describe('validateBranding', () => {
  it('acepta nombre vacío (fallback) y sin logo', () => {
    expect(validateBranding({ name: '', logoUrl: null })).toBeNull();
  });

  it('rechaza nombre muy largo y logo no-imagen o gigante', () => {
    expect(validateBranding({ name: 'x'.repeat(81) })).not.toBeNull();
    expect(validateBranding({ name: 'Bar', logoUrl: 'https://x.com/a.png' })).not.toBeNull();
    expect(validateBranding({ name: 'Bar', logoUrl: `data:image/png;base64,${'a'.repeat(800_000)}` })).not.toBeNull();
  });
});

describe('formatZoneName', () => {
  it('muestra slugs huérfanos con espacios', () => {
    expect(formatZoneName('salon_interno')).toBe('salon interno');
    expect(formatZoneName('Terraza VIP')).toBe('Terraza VIP');
  });
});

describe('table card print html', () => {
  const card = { qrDataUrl: 'data:image/png;base64,qr', zoneName: 'Terraza', tableNumber: 5 };
  const branding = { restaurantName: 'La Esquina', logoUrl: null };

  it('incluye nombre, mesa y QR, escapando HTML', () => {
    const html = tableCardPrintHtml(card, { restaurantName: '<img onerror=x>Bar', logoUrl: null });
    expect(html).toContain('&lt;img onerror=x&gt;Bar');
    expect(html).not.toContain('<img onerror=x>');
    expect(html).toContain('Terraza · Mesa 5');
    expect(html).toContain('Hecho con Lumen');
  });

  it('la hoja incluye una tarjeta por mesa', () => {
    const sheet = tableCardsPrintSheetHtml(
      [card, { ...card, tableNumber: 6 }],
      branding,
    );
    expect(sheet).toContain('Mesa 5');
    expect(sheet).toContain('Mesa 6');
    expect(sheet).toContain('La Esquina');
  });
});
