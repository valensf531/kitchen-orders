import { describe, expect, it } from 'vitest';
import { canCreateOrders, canOperateTables } from '@/lib/permissions';

describe('permisos de cocina', () => {
  it('cocinero no crea pedidos ni opera mesas', () => {
    expect(canCreateOrders('kitchen')).toBe(false);
    expect(canOperateTables('kitchen')).toBe(false);
  });

  it('admin y vendedor sí', () => {
    expect(canCreateOrders('admin')).toBe(true);
    expect(canCreateOrders('staff')).toBe(true);
    expect(canOperateTables('admin')).toBe(true);
    expect(canOperateTables('staff')).toBe(true);
  });
});
