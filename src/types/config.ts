export interface Zone {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  description?: string;
  ingredients?: string;
  tags: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export const ZONE_ICONS: Record<string, string> = {
  internal_patio: '🏠',
  external_patio: '🌿',
  terrace: '🌅',
  vip: '👑',
  bar: '🍸',
  default: '📍',
};
