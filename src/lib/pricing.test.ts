import { describe, expect, it } from 'vitest';
import { resolveOrderItems } from '@/lib/pricing';
import type { PricedMenuItem } from '@/lib/pricing';

const menu: PricedMenuItem[] = [
  { id: 'item-1', name: 'Pizza Margherita', price: 12, available: true },
  { id: 'item-2', name: 'Pizza Pepperoni', price: 13.5, available: false },
  { id: 'item-3', name: 'Coca-Cola', price: 3.5, available: true },
];

describe('resolveOrderItems', () => {
  it('usa el precio de la base e ignora el del cliente', () => {
    const result = resolveOrderItems(
      menu,
      [
        { id: 'item-1', quantity: 2, price: 0 },
        { name: 'coca-cola', quantity: 1, price: 999 },
      ],
      { strict: true },
    );
    expect(result).toEqual({
      ok: true,
      items: [
        { name: 'Pizza Margherita', quantity: 2, price: 12, menuItemId: 'item-1' },
        { name: 'Coca-Cola', quantity: 1, price: 3.5, menuItemId: 'item-3' },
      ],
      total: 27.5,
    });
  });

  it('rechaza items que no están en el menú (modo estricto)', () => {
    const result = resolveOrderItems(menu, [{ id: 'no-existe', quantity: 1 }], { strict: true });
    expect(result.ok).toBe(false);
  });

  it('rechaza items no disponibles', () => {
    const result = resolveOrderItems(menu, [{ id: 'item-2', quantity: 1 }], { strict: true });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('no está disponible');
  });

  it('normaliza cantidades fuera de rango', () => {
    const result = resolveOrderItems(
      menu,
      [
        { id: 'item-1', quantity: 0 },
        { id: 'item-3', quantity: 500 },
      ],
      { strict: true },
    );
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.items[0].quantity).toBe(1);
    expect(result.ok === true && result.items[1].quantity).toBe(99);
  });

  it('recorta y trimea las notas', () => {
    const result = resolveOrderItems(
      menu,
      [{ id: 'item-1', quantity: 1, notes: '   sin sal   ' }],
      { strict: true },
    );
    expect(result.ok === true && result.items[0].notes).toBe('sin sal');
  });

  it('rechaza pedidos vacíos o demasiado grandes', () => {
    expect(resolveOrderItems(menu, [], { strict: true }).ok).toBe(false);
    expect(resolveOrderItems(menu, 'no-array', { strict: true }).ok).toBe(false);
    const big = Array.from({ length: 51 }, () => ({ id: 'item-1', quantity: 1 }));
    expect(resolveOrderItems(menu, big, { strict: true }).ok).toBe(false);
  });

  it('redondea el total a centavos', () => {
    const result = resolveOrderItems(
      [{ id: 'x', name: 'X', price: 10.1, available: true }],
      [{ id: 'x', quantity: 3 }],
      { strict: true },
    );
    expect(result.ok === true && result.total).toBe(30.3);
  });

  it('modo staff: permite items libres con precio válido', () => {
    const result = resolveOrderItems(
      menu,
      [{ name: 'Cubiertos', quantity: 2, price: 1.25 }],
      { strict: false },
    );
    expect(result).toEqual({
      ok: true,
      items: [{ name: 'Cubiertos', quantity: 2, price: 1.25 }],
      total: 2.5,
    });
  });

  it('modo staff: rechaza items libres sin precio válido', () => {
    expect(resolveOrderItems(menu, [{ name: 'Cubiertos', quantity: 1 }], { strict: false }).ok).toBe(false);
    expect(resolveOrderItems(menu, [{ name: 'Cubiertos', quantity: 1, price: -5 }], { strict: false }).ok).toBe(false);
    expect(resolveOrderItems(menu, [{ name: '', quantity: 1, price: 1 }], { strict: false }).ok).toBe(false);
  });
});
