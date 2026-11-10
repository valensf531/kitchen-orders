import { beforeAll, describe, expect, it } from 'vitest';
import { signTableToken, verifyTableToken } from '@/lib/table-token';

const table = {
  restaurantId: 'rest-1',
  tableId: 'TBL-1',
  tableNumber: 4,
  zone: 'salon',
};

describe('table-token', () => {
  beforeAll(() => {
    process.env.PUBLIC_ORDER_SECRET = 'test-secret-for-table-tokens';
  });

  it('firma y verifica el token de la mesa correcta', () => {
    const token = signTableToken(table);
    expect(verifyTableToken(token, table)).toBe(true);
  });

  it('rechaza un token de otra mesa', () => {
    const token = signTableToken(table);
    expect(verifyTableToken(token, { ...table, tableNumber: 5 })).toBe(false);
    expect(verifyTableToken(token, { ...table, tableId: 'TBL-2' })).toBe(false);
    expect(verifyTableToken(token, { ...table, restaurantId: 'rest-2' })).toBe(false);
  });

  it('rechaza un token manipulado o ausente', () => {
    const token = signTableToken(table);
    expect(verifyTableToken(`${token}x`, table)).toBe(false);
    expect(verifyTableToken(undefined, table)).toBe(false);
    expect(verifyTableToken('', table)).toBe(false);
  });
});
