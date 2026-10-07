import { describe, expect, it } from 'vitest';
import { buildAccess, resolveRole } from '@/lib/roles';

describe('resolveRole', () => {
  it('owner sin vínculo es admin', () => {
    expect(resolveRole({ id: 'a', role: 'admin', ownerId: null })).toEqual({
      role: 'admin',
      ownerId: null,
    });
  });

  it('cuenta vinculada siempre es staff aunque diga admin', () => {
    expect(resolveRole({ id: 'b', role: 'admin', ownerId: 'owner-1' })).toEqual({
      role: 'staff',
      ownerId: 'owner-1',
    });
  });

  it('cuenta vinculada con rol kitchen es cocinera', () => {
    expect(resolveRole({ id: 'k', role: 'kitchen', ownerId: 'owner-1' })).toEqual({
      role: 'kitchen',
      ownerId: 'owner-1',
    });
  });

  it('rol kitchen sin vínculo no otorga cocina (cae a admin)', () => {
    expect(resolveRole({ id: 'x', role: 'kitchen', ownerId: null }).role).toBe('admin');
  });

  it('rol legacy/null cae a admin del propio restaurante', () => {
    expect(resolveRole({ id: 'c' }).role).toBe('admin');
    expect(resolveRole(null).role).toBe('admin');
  });
});

describe('buildAccess', () => {
  it('null sin usuario válido', () => {
    expect(buildAccess(null)).toBeNull();
    expect(buildAccess({})).toBeNull();
    expect(buildAccess({ id: '' })).toBeNull();
  });

  it('staff opera sobre el restaurante del dueño', () => {
    const ctx = buildAccess({ id: 'staff-1', role: 'staff', ownerId: 'owner-9', name: 'María' });
    expect(ctx).toMatchObject({
      userId: 'staff-1',
      restaurantId: 'owner-9',
      role: 'staff',
      isAdmin: false,
      name: 'María',
    });
  });

  it('admin opera sobre su propio restaurante', () => {
    const ctx = buildAccess({ id: 'owner-9', role: 'admin', ownerId: null });
    expect(ctx).toMatchObject({ userId: 'owner-9', restaurantId: 'owner-9', isAdmin: true });
  });

  it('cocinero opera sobre el restaurante del dueño sin ser admin', () => {
    const ctx = buildAccess({ id: 'cook-1', role: 'kitchen', ownerId: 'owner-9', name: 'Pepe' });
    expect(ctx).toMatchObject({
      userId: 'cook-1',
      restaurantId: 'owner-9',
      role: 'kitchen',
      isAdmin: false,
      name: 'Pepe',
    });
  });
});
