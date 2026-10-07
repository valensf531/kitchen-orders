export type TagTone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'stone';

export interface TagMeta {
  key: string;
  label: string;
  icon: string;
  tone: TagTone;
}

export interface CustomTag {
  id: string;
  label: string;
  icon?: string;
  tone?: string;
}

/* Etiquetas predefinidas: disponibles siempre, sin depender de la base de datos. */
export const PREDEFINED_TAGS: TagMeta[] = [
  { key: 'vegano', label: 'Vegano', icon: '🌱', tone: 'green' },
  { key: 'vegetariano', label: 'Vegetariano', icon: '🥗', tone: 'green' },
  { key: 'sin_tacc', label: 'Sin TACC', icon: '🌾', tone: 'amber' },
  { key: 'sin_lactosa', label: 'Sin lactosa', icon: '🥛', tone: 'blue' },
  { key: 'picante', label: 'Picante', icon: '🌶️', tone: 'red' },
  { key: 'popular', label: 'Popular', icon: '⭐', tone: 'amber' },
  { key: 'nuevo', label: 'Nuevo', icon: '✨', tone: 'violet' },
  { key: 'sin_azucar', label: 'Sin azúcar', icon: '🍃', tone: 'green' },
];

export const TAG_TONES: { value: TagTone; label: string }[] = [
  { value: 'green', label: 'Verde' },
  { value: 'amber', label: 'Ámbar' },
  { value: 'red', label: 'Rojo' },
  { value: 'blue', label: 'Azul' },
  { value: 'violet', label: 'Violeta' },
  { value: 'stone', label: 'Neutro' },
];

export const TAG_TONE_BADGE_CLASSES: Record<TagTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  stone: 'bg-stone-100 text-stone-700 border-stone-200',
};

export const TAG_TONE_SOLID_CLASSES: Record<TagTone, string> = {
  green: 'bg-emerald-500 text-white',
  amber: 'bg-amber-500 text-stone-900',
  red: 'bg-rose-500 text-white',
  blue: 'bg-sky-500 text-white',
  violet: 'bg-violet-500 text-white',
  stone: 'bg-stone-400 text-white',
};

export function normalizeTone(tone?: string | null): TagTone {
  return TAG_TONE_BADGE_CLASSES[tone as TagTone] ? (tone as TagTone) : 'stone';
}

/* Resuelve una etiqueta de un plato: predefinida por key o personalizada por id. */
export function resolveTagMeta(key: string, customTags: CustomTag[] = []): TagMeta {
  const predefined = PREDEFINED_TAGS.find((tag) => tag.key === key);
  if (predefined) return predefined;
  const custom = customTags.find((tag) => tag.id === key);
  return {
    key,
    label: custom?.label ?? key,
    icon: custom?.icon ?? '🏷️',
    tone: normalizeTone(custom?.tone),
  };
}

/* Validación compartida por las rutas de etiquetas personalizadas. */
export function validateTagBody(body: { label?: unknown; icon?: unknown; tone?: unknown }): string[] {
  const errors: string[] = [];
  if (typeof body.label !== 'string' || !body.label.trim() || body.label.trim().length > 50) {
    errors.push('label es obligatorio (máx. 50 caracteres)');
  }
  if (body.icon !== undefined && typeof body.icon !== 'string') {
    errors.push('icon debe ser un texto');
  }
  if (body.tone !== undefined && (typeof body.tone !== 'string' || !TAG_TONE_BADGE_CLASSES[body.tone as TagTone])) {
    errors.push('tone inválido');
  }
  return errors;
}
