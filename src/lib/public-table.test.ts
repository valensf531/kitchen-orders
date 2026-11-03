import { describe, expect, it } from 'vitest';
import { resolvePublicTable, type PublicTableRef } from '@/lib/public-table';

const tables: PublicTableRef[] = [
  { id: 'a1', number: 1, zone: 'salon_interno' },
  { id: 'b1', number: 1, zone: 'terraza' },
  { id: 'a2', number: 2, zone: 'salon_interno' },
];

describe('resolvePublicTable', () => {
  it('rechaza número inexistente (caso mesa 78)', () => {
    const result = resolvePublicTable(tables, { tableNumber: 78 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain('no existe');
    }
  });

  it('resuelve número único sin zona', () => {
    const result = resolvePublicTable(tables, { tableNumber: 2 });
    expect(result).toEqual({ ok: true, table: tables[2] });
  });

  it('pide salón si el número está en varias zonas', () => {
    const result = resolvePublicTable(tables, { tableNumber: 1 });
    expect(result).toEqual({ ok: false, error: 'Seleccioná el salón de la mesa', status: 409 });
  });

  it('resuelve con zona indicada', () => {
    const result = resolvePublicTable(tables, { tableNumber: 1, zone: 'terraza' });
    expect(result).toEqual({ ok: true, table: tables[1] });
  });

  it('rechaza tableId que no coincide con el número (id viejo + otro número)', () => {
    const result = resolvePublicTable(tables, { tableId: 'a1', tableNumber: 78 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('rechaza tableId inexistente o de otra zona', () => {
    expect(resolvePublicTable(tables, { tableId: 'xxx', tableNumber: 1 }).ok).toBe(false);
    expect(
      resolvePublicTable(tables, { tableId: 'a1', tableNumber: 1, zone: 'terraza' }).ok,
    ).toBe(false);
  });

  it('acepta tableId consistente con número y zona', () => {
    expect(
      resolvePublicTable(tables, { tableId: 'b1', tableNumber: 1, zone: 'terraza' }),
    ).toEqual({ ok: true, table: tables[1] });
  });
});
