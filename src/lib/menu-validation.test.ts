import { describe, expect, it } from 'vitest';
import { validateItemFields } from '@/lib/menu-validation';

describe('validateItemFields', () => {
  it('acepta cuerpos válidos', () => {
    expect(validateItemFields({})).toBeNull();
    expect(
      validateItemFields({
        description: 'Salsa de tomate y albahaca',
        ingredients: 'Tomate, albahaca. Contiene gluten.',
        tags: ['vegano'],
        featured: true,
      }),
    ).toBeNull();
  });

  it('rechaza description no string', () => {
    expect(validateItemFields({ description: 123 })).toBe('Invalid description');
  });

  it('rechaza ingredients no string', () => {
    expect(validateItemFields({ ingredients: ['tomate'] })).toBe('Invalid ingredients');
  });

  it('rechaza tags que no son array de strings', () => {
    expect(validateItemFields({ tags: 'vegano' })).toBe('Invalid tags');
    expect(validateItemFields({ tags: ['vegano', 1] })).toBe('Invalid tags');
  });

  it('rechaza featured no boolean', () => {
    expect(validateItemFields({ featured: 'si' })).toBe('Invalid featured');
  });
});
