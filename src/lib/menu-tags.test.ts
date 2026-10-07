import { describe, expect, it } from 'vitest';
import {
  normalizeTone,
  resolveTagMeta,
  validateTagBody,
  PREDEFINED_TAGS,
  TAG_TONE_BADGE_CLASSES,
} from '@/lib/menu-tags';

describe('normalizeTone', () => {
  it('devuelve tonos válidos tal cual', () => {
    expect(normalizeTone('green')).toBe('green');
    expect(normalizeTone('amber')).toBe('amber');
  });

  it('cae a stone con tonos inválidos', () => {
    expect(normalizeTone('neon')).toBe('stone');
    expect(normalizeTone(undefined)).toBe('stone');
    expect(normalizeTone(null)).toBe('stone');
  });
});

describe('resolveTagMeta', () => {
  it('resuelve etiquetas predefinidas por key', () => {
    const meta = resolveTagMeta('vegano');
    expect(meta.label).toBe('Vegano');
    expect(meta.icon).toBe('🌱');
    expect(meta.tone).toBe('green');
  });

  it('resuelve etiquetas personalizadas por id', () => {
    const meta = resolveTagMeta('custom-1', [
      { id: 'custom-1', label: 'Sin cebolla', icon: '🧅', tone: 'red' },
    ]);
    expect(meta.label).toBe('Sin cebolla');
    expect(meta.icon).toBe('🧅');
    expect(meta.tone).toBe('red');
  });

  it('degrada con etiquetas desconocidas', () => {
    const meta = resolveTagMeta('desconocida');
    expect(meta.label).toBe('desconocida');
    expect(meta.icon).toBe('🏷️');
    expect(meta.tone).toBe('stone');
  });

  it('cada tono predefinido tiene clases de badge', () => {
    for (const tag of PREDEFINED_TAGS) {
      expect(TAG_TONE_BADGE_CLASSES[tag.tone]).toBeTruthy();
    }
  });
});

describe('validateTagBody', () => {
  it('acepta un cuerpo válido', () => {
    expect(validateTagBody({ label: 'Sin cebolla', icon: '🧅', tone: 'red' })).toEqual([]);
  });

  it('rechaza label vacío o faltante', () => {
    expect(validateTagBody({})).toContain('label es obligatorio (máx. 50 caracteres)');
    expect(validateTagBody({ label: '   ' })).toContain('label es obligatorio (máx. 50 caracteres)');
  });

  it('rechaza label demasiado largo', () => {
    expect(validateTagBody({ label: 'a'.repeat(51) })).toContain('label es obligatorio (máx. 50 caracteres)');
  });

  it('rechaza icon no string', () => {
    expect(validateTagBody({ label: 'X', icon: 123 })).toContain('icon debe ser un texto');
  });

  it('rechaza tone inválido', () => {
    expect(validateTagBody({ label: 'X', tone: 'neon' })).toContain('tone inválido');
  });
});
