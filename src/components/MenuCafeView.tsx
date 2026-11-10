'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { resolveTagMeta, type CustomTag } from '@/lib/menu-tags';
import {
  DEFAULT_MENU_THEME,
  normalizeMenuTheme,
  themeStyle,
  type MenuTheme,
} from '@/lib/menu-theme';

type Item = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  imageUrl?: string;
  description?: string;
  ingredients?: string;
  tags: string[];
  featured: boolean;
};

type Category = { id: string; name: string; order: number };
type CartItem = Item & { quantity: number; notes?: string };

const displayFont = {
  fontFamily: 'var(--font-cafe), var(--font-geist), ui-sans-serif, sans-serif',
} as const;

const priceFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const baseMoney = (value: number, symbol = '$') => `${symbol} ${priceFormatter.format(value)}`;
const money = (value: number) => baseMoney(value);

function MenuTagLine({
  tags,
  customTags = [],
  limit = 3,
}: {
  tags: string[];
  customTags?: CustomTag[];
  limit?: number;
}) {
  const metas = tags.map((tag) => resolveTagMeta(tag, customTags));
  if (metas.length === 0) return null;
  const shown = metas.slice(0, limit);
  const rest = metas.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {shown.map((meta) => (
        <span
          key={meta.key}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--menu-primary-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--menu-primary)]"
        >
          <span aria-hidden="true">{meta.icon}</span>
          {meta.label}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--menu-muted)]">
          +{rest}
        </span>
      )}
    </div>
  );
}

function QuantityControl({
  name,
  qty,
  compact = false,
  tone = 'primary',
  onAdd,
  onInc,
  onDec,
}: {
  name: string;
  qty: number;
  compact?: boolean;
  tone?: 'primary' | 'accent';
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const toneClass =
    tone === 'accent'
      ? 'bg-[var(--menu-accent)] text-[var(--menu-on-accent)]'
      : 'bg-[var(--menu-primary)] text-[var(--menu-on-primary)]';

  if (qty > 0) {
    return (
      <div className={`inline-flex items-center rounded-full ${toneClass}`}>
        <button
          type="button"
          onClick={onDec}
          aria-label={`Quitar una unidad de ${name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-80"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="w-5 text-center text-xs font-black" aria-live="polite">
          {qty}
        </span>
        <button
          type="button"
          onClick={onInc}
          aria-label={`Agregar una unidad de ${name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Agregar ${name} al pedido`}
        className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-105 active:scale-95 ${toneClass}`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Agregar ${name} al pedido`}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[10px] font-black uppercase tracking-wide shadow-sm transition-transform hover:scale-[1.02] active:scale-95 ${toneClass}`}
    >
      Agregar
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

function ProductCard({
  item,
  qty,
  onOpen,
  onAdd,
  onInc,
  onDec,
}: {
  item: Item;
  qty: number;
  onOpen: () => void;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const initial = item.name.trim().charAt(0).toUpperCase();

  return (
    <article className="group flex flex-col overflow-hidden rounded-[1.6rem] border border-[var(--menu-line)] bg-[var(--menu-surface)] shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-30px_rgba(0,0,0,0.5)]">
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-[var(--menu-primary-soft)]"
        aria-label={`Ver detalle de ${item.name}`}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida aparte.
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-5xl font-black text-[var(--menu-primary)]"
            style={displayFont}
          >
            {initial}
          </span>
        )}

        {item.featured && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--menu-accent)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--menu-on-accent)] shadow-sm">
            <Star className="h-2.5 w-2.5" aria-hidden="true" />
            Top
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-3">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug" style={displayFont}>
            {item.name}
          </h3>
        </button>

        {item.description && (
          <p className="mt-1 hidden line-clamp-2 text-[11px] leading-relaxed text-[var(--menu-muted)] sm:block">
            {item.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-sm font-black">{money(item.price)}</span>
          <QuantityControl
            name={item.name}
            qty={qty}
            compact
            onAdd={onAdd}
            onInc={onInc}
            onDec={onDec}
          />
        </div>
      </div>
    </article>
  );
}

function ProductWideCard({
  item,
  qty,
  customTags,
  onOpen,
  onAdd,
  onInc,
  onDec,
}: {
  item: Item;
  qty: number;
  customTags: CustomTag[];
  onOpen: () => void;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const initial = item.name.trim().charAt(0).toUpperCase();

  return (
    <article className="group flex flex-col overflow-hidden rounded-[1.8rem] border border-[var(--menu-line)] bg-[var(--menu-surface)] shadow-[0_20px_45px_-32px_rgba(0,0,0,0.5)] sm:flex-row">
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--menu-primary-soft)] sm:aspect-auto sm:h-64 sm:w-2/5"
        aria-label={`Ver detalle de ${item.name}`}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida aparte.
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-6xl font-black text-[var(--menu-primary)]"
            style={displayFont}
          >
            {initial}
          </span>
        )}
        {item.featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--menu-accent)] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[var(--menu-on-accent)] shadow-sm">
            <Star className="h-2.5 w-2.5" aria-hidden="true" />
            Top
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="text-2xl font-black leading-tight" style={displayFont}>
            {item.name}
          </h3>
        </button>
        {item.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--menu-muted)]">
            {item.description}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-3">
            <MenuTagLine tags={item.tags} customTags={customTags} limit={3} />
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <span className="text-2xl font-black">{money(item.price)}</span>
          <QuantityControl
            name={item.name}
            qty={qty}
            onAdd={onAdd}
            onInc={onInc}
            onDec={onDec}
          />
        </div>
      </div>
    </article>
  );
}

function FeaturedCard({
  item,
  qty,
  onOpen,
  onAdd,
  onInc,
  onDec,
}: {
  item: Item;
  qty: number;
  onOpen: () => void;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const initial = item.name.trim().charAt(0).toUpperCase();

  return (
    <article className="w-[280px] shrink-0 snap-start overflow-hidden rounded-[1.8rem] bg-[var(--menu-primary)] text-[var(--menu-on-primary)] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.55)]">
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[5/3] w-full overflow-hidden"
        aria-label={`Ver detalle de ${item.name}`}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida aparte.
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-[var(--menu-primary-soft)] text-6xl font-black text-[var(--menu-primary)]"
            style={displayFont}
          >
            {initial}
          </span>
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-[var(--menu-accent)] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[var(--menu-on-accent)]">
          Recomendado
        </span>
      </button>

      <div className="p-4">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="text-xl font-black leading-tight" style={displayFont}>
            {item.name}
          </h3>
        </button>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-75">
            {item.description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-lg font-black">{money(item.price)}</span>
          <QuantityControl
            name={item.name}
            qty={qty}
            tone="accent"
            onAdd={onAdd}
            onInc={onInc}
            onDec={onDec}
          />
        </div>
      </div>
    </article>
  );
}

export function MenuCafeView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [branding, setBranding] = useState<{ name: string; logoUrl: string | null }>({
    name: '',
    logoUrl: null,
  });
  const [theme, setTheme] = useState<MenuTheme>(DEFAULT_MENU_THEME);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [table, setTable] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const formatMoney = (value: number) => baseMoney(value, currencySymbol);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [previewSent, setPreviewSent] = useState(false);

  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const restaurant = params.get('restaurant');
    const tableNumber = params.get('table') ?? '';
    const query = restaurant ? `?restaurant=${encodeURIComponent(restaurant)}` : '';

    fetch(`/api/public/menu${query}`)
      .then((res) => {
        if (!res.ok) throw new Error('menu');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setTable(tableNumber);
        setTheme(normalizeMenuTheme(data.theme));
        setBranding({
          name: typeof data.branding?.name === 'string' ? data.branding.name : '',
          logoUrl: typeof data.branding?.logoUrl === 'string' ? data.branding.logoUrl : null,
        });
        setCurrencySymbol(
          typeof data.currencySymbol === 'string' && data.currencySymbol.trim()
            ? data.currencySymbol.trim()
            : '$',
        );
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setCustomTags(Array.isArray(data.tags) ? data.tags : []);
        setItems(
          (Array.isArray(data.items) ? data.items : []).map((item: Item) => ({
            ...item,
            price: Number(item.price) || 0,
            tags: Array.isArray(item.tags) ? item.tags : [],
            featured: Boolean(item.featured),
          })),
        );
      })
      .catch(() => active && setError('No se pudo cargar el menú. Recargá la página.'))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const searching = search.trim().length > 0;
  const query = search.trim().toLowerCase();

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (!query) return true;
        return (
          item.name.toLowerCase().includes(query) ||
          (item.description ?? '').toLowerCase().includes(query)
        );
      }),
    [items, query],
  );

  const sections = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          sectionItems: visibleItems.filter((item) => item.categoryId === category.id),
        }))
        .filter((section) => section.sectionItems.length > 0),
    [categories, visibleItems],
  );

  const featuredItems = useMemo(
    () => items.filter((item) => item.featured).slice(0, 6),
    [items],
  );

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );
  const cartQty = (id: string) => cart.find((item) => item.id === id)?.quantity ?? 0;

  const addToCart = (item: Item, quantity = 1, notes?: string) =>
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (!existing) return [...current, { ...item, quantity, notes }];
      return current.map((entry) =>
        entry.id === item.id
          ? { ...entry, quantity: entry.quantity + quantity, notes: notes ?? entry.notes }
          : entry,
      );
    });

  const change = (id: string, delta: number) =>
    setCart((current) =>
      current
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    );

  const removeFromCart = (id: string) =>
    setCart((current) => current.filter((item) => item.id !== id));

  const openDetail = (item: Item) => {
    setDetailItem(item);
    setDetailQty(1);
    setDetailNotes('');
  };

  const closeDetail = () => setDetailItem(null);

  const addFromDetail = () => {
    if (!detailItem) return;
    addToCart(detailItem, detailQty, detailNotes.trim() || undefined);
    closeDetail();
  };

  const openCart = () => {
    setPreviewSent(false);
    setCartOpen(true);
  };

  const closeCart = () => {
    setCartOpen(false);
    setPreviewSent(false);
  };

  const confirmPreview = () => {
    setPreviewSent(true);
    setCart([]);
  };

  const initial = (branding.name || 'Café').trim().charAt(0).toUpperCase();

  return (
    <main
      style={themeStyle(theme)}
      className="min-h-dvh overflow-x-hidden bg-[var(--menu-bg)] text-[var(--menu-text)]"
    >
      <header className="sticky top-0 z-30 border-b border-[var(--menu-line)] bg-[var(--menu-bg)] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo del restaurante (data URL).
              <img
                src={branding.logoUrl}
                alt={branding.name || 'Logo del restaurante'}
                className="h-11 w-11 shrink-0 rounded-2xl border border-[var(--menu-line)] bg-[var(--menu-surface)] object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--menu-primary)] text-lg font-black text-[var(--menu-on-primary)]"
                style={displayFont}
              >
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-black" style={displayFont}>
                {branding.name || 'Café'}
              </p>
              <p className="text-[10px] font-semibold text-[var(--menu-muted)]">
                Menú digital · Vista previa
              </p>
            </div>

            <button
              type="button"
              onClick={openCart}
              aria-label={`Ver pedido${cartCount > 0 ? ` (${cartCount})` : ''}`}
              className="relative ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--menu-primary)] text-[var(--menu-on-primary)] shadow-sm transition-transform hover:scale-105 active:scale-95"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--menu-accent)] px-1 text-[10px] font-black text-[var(--menu-on-accent)]">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--menu-muted)]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              aria-label="Buscar en el menú"
              placeholder="Buscar en el menú…"
              className="w-full rounded-full border border-[var(--menu-line)] bg-[var(--menu-surface)] py-2.5 pl-10 pr-10 text-sm text-[var(--menu-text)] placeholder:text-[var(--menu-muted)] focus:border-[var(--menu-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--menu-primary-soft)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--menu-muted)] transition-colors hover:bg-[var(--menu-primary-soft)] hover:text-[var(--menu-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <nav className="scrollbar-hide -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {sections.map(({ category }) => (
              <a
                key={category.id}
                href={`#cafe-${category.id}`}
                className="shrink-0 whitespace-nowrap rounded-full border border-[var(--menu-line)] bg-[var(--menu-surface)] px-3.5 py-1.5 text-[11px] font-bold text-[var(--menu-text)] transition-colors hover:bg-[var(--menu-primary-soft)]"
              >
                {category.name}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-[var(--menu-primary)] p-6 text-[var(--menu-on-primary)] sm:p-10">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[var(--menu-accent)] opacity-25 blur-2xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 right-12 h-56 w-56 rounded-full border-[26px] border-[var(--menu-on-primary)] opacity-10"
          />
          <div className="relative">
            <span className="inline-flex rounded-full bg-[var(--menu-accent)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--menu-on-accent)]">
              Menú digital
            </span>
            <h1
              className="mt-4 max-w-xl text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl"
              style={displayFont}
            >
              {branding.name || 'Café'}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed opacity-80">
              Elegí tus favoritos, sumalos al pedido y disfrutá desde tu mesa.
            </p>
            {table && (
              <span className="mt-5 inline-flex rounded-full bg-[var(--menu-on-primary)] px-3 py-1.5 text-xs font-bold text-[var(--menu-primary)]">
                Mesa {table}
              </span>
            )}
          </div>
        </section>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-40 pt-6 sm:px-6 sm:pb-32">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 rounded-2xl border border-[var(--menu-line)] bg-[var(--menu-surface)] px-4 py-3 text-sm"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-[var(--menu-accent)]" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[10px] font-black uppercase tracking-wide underline underline-offset-4"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="animate-pulse" aria-label="Cargando el menú">
            <div className="h-[220px] rounded-[2rem] bg-[var(--menu-primary-soft)]" />
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-64 rounded-[1.6rem] bg-[var(--menu-surface)]"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {!searching && featuredItems.length > 0 && (
              <section className="mb-9" aria-labelledby="featured-cafe-title">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <h2
                    id="featured-cafe-title"
                    className="text-2xl font-black tracking-tight"
                    style={displayFont}
                  >
                    Para empezar
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--menu-muted)]">
                    Deslizá
                  </span>
                </div>
                <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
                  {featuredItems.map((item) => (
                    <FeaturedCard
                      key={item.id}
                      item={item}
                      qty={cartQty(item.id)}
                      onOpen={() => openDetail(item)}
                      onAdd={() => addToCart(item)}
                      onInc={() => change(item.id, 1)}
                      onDec={() => change(item.id, -1)}
                    />
                  ))}
                </div>
              </section>
            )}

            {sections.map(({ category, sectionItems }) => (
              <section
                key={category.id}
                id={`cafe-${category.id}`}
                aria-labelledby={`cafe-title-${category.id}`}
                className="mt-9 scroll-mt-44"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2
                    id={`cafe-title-${category.id}`}
                    className="text-2xl font-black tracking-tight"
                    style={displayFont}
                  >
                    {category.name}
                  </h2>
                  <span className="rounded-full bg-[var(--menu-primary-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--menu-primary)]">
                    {sectionItems.length} {sectionItems.length === 1 ? 'opción' : 'opciones'}
                  </span>
                </div>

                {sectionItems.length === 1 ? (
                  <ProductWideCard
                    item={sectionItems[0]}
                    qty={cartQty(sectionItems[0].id)}
                    customTags={customTags}
                    onOpen={() => openDetail(sectionItems[0])}
                    onAdd={() => addToCart(sectionItems[0])}
                    onInc={() => change(sectionItems[0].id, 1)}
                    onDec={() => change(sectionItems[0].id, -1)}
                  />
                ) : (
                  <div
                    className={
                      sectionItems.length === 2
                        ? 'grid max-w-3xl grid-cols-2 gap-3'
                        : sectionItems.length === 3
                          ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
                          : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
                    }
                  >
                    {sectionItems.map((item) => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        qty={cartQty(item.id)}
                        onOpen={() => openDetail(item)}
                        onAdd={() => addToCart(item)}
                        onInc={() => change(item.id, 1)}
                        onDec={() => change(item.id, -1)}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}

            {sections.length === 0 && (
              <p className="py-16 text-center text-sm text-[var(--menu-muted)]">
                {searching
                  ? 'No encontramos productos que coincidan con tu búsqueda.'
                  : 'Todavía no hay productos publicados en el menú.'}
              </p>
            )}
          </>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4">
          <button
            type="button"
            onClick={openCart}
            className="mx-auto flex w-full max-w-md items-center justify-between gap-4 rounded-full bg-[var(--menu-primary)] px-5 py-3 text-[var(--menu-on-primary)] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-lg font-black">{formatMoney(total)}</span>
              <span className="rounded-full bg-[var(--menu-accent)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[var(--menu-on-accent)]">
                Ver pedido
              </span>
            </span>
          </button>
        </div>
      )}

      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={closeDetail}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-cafe-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[var(--menu-surface)] text-[var(--menu-text)] shadow-2xl sm:rounded-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative">
              {detailItem.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida aparte.
                <img
                  src={detailItem.imageUrl}
                  alt={detailItem.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex aspect-[4/3] w-full items-center justify-center bg-[var(--menu-primary-soft)] text-7xl font-black text-[var(--menu-primary)]"
                  style={displayFont}
                >
                  {detailItem.name.trim().charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Cerrar detalle"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--menu-bg)] text-[var(--menu-text)] shadow transition-transform hover:scale-105"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <h2
                  id="detail-cafe-title"
                  className="text-3xl font-black leading-none tracking-tight"
                  style={displayFont}
                >
                  {detailItem.name}
                </h2>
                <span className="shrink-0 text-xl font-black">{formatMoney(detailItem.price)}</span>
              </div>

              <MenuTagLine tags={detailItem.tags} customTags={customTags} limit={8} />

              {detailItem.description && (
                <p className="text-sm leading-relaxed text-[var(--menu-muted)]">
                  {detailItem.description}
                </p>
              )}

              {detailItem.ingredients && (
                <div className="rounded-2xl bg-[var(--menu-primary-soft)] px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--menu-primary)]">
                    Contiene
                  </p>
                  <p className="mt-1 text-sm">{detailItem.ingredients}</p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-full border border-[var(--menu-line)] px-4 py-2.5">
                <span className="text-[10px] font-black uppercase tracking-wide text-[var(--menu-muted)]">
                  Cantidad
                </span>
                <QuantityControl
                  name={detailItem.name}
                  qty={detailQty}
                  onAdd={() => setDetailQty(1)}
                  onInc={() => setDetailQty((value) => Math.min(20, value + 1))}
                  onDec={() => setDetailQty((value) => Math.max(1, value - 1))}
                />
              </div>

              <div>
                <label
                  htmlFor="detail-cafe-notes"
                  className="block text-[10px] font-black uppercase tracking-wide text-[var(--menu-muted)]"
                >
                  Notas para la cocina{' '}
                  <span className="font-normal normal-case tracking-normal">(opcional)</span>
                </label>
                <input
                  id="detail-cafe-notes"
                  value={detailNotes}
                  onChange={(event) => setDetailNotes(event.target.value)}
                  placeholder="Ej. sin azúcar, leche deslactosada…"
                  className="mt-2 w-full rounded-full border border-[var(--menu-line)] bg-[var(--menu-bg)] px-4 py-2.5 text-sm text-[var(--menu-text)] placeholder:text-[var(--menu-muted)] focus:border-[var(--menu-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--menu-primary-soft)]"
                />
              </div>

              <button
                type="button"
                onClick={addFromDetail}
                className="flex w-full items-center justify-between rounded-full bg-[var(--menu-primary)] px-5 py-3.5 text-[var(--menu-on-primary)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                  Agregar al pedido
                </span>
                <span className="text-lg font-black">{formatMoney(detailQty * detailItem.price)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={closeCart}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-cafe-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[var(--menu-surface)] text-[var(--menu-text)] shadow-2xl sm:rounded-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--menu-accent)]">
                  Vista previa
                </p>
                <h2
                  id="cart-cafe-title"
                  className="mt-1 text-3xl font-black leading-none tracking-tight"
                  style={displayFont}
                >
                  Tu pedido
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Cerrar pedido"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--menu-bg)] text-[var(--menu-text)] transition-transform hover:scale-105"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {previewSent ? (
              <div className="flex flex-col items-center px-6 pb-12 pt-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-[var(--menu-primary)]" aria-hidden="true" />
                <h3 className="mt-4 text-3xl font-black" style={displayFont}>
                  Pedido de prueba listo
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--menu-muted)]">
                  Esta es una vista previa de diseño. No se envió nada a cocina ni se abrió una
                  cuenta en la mesa.
                </p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-8 w-full rounded-full bg-[var(--menu-primary)] px-4 py-3 text-[10px] font-black uppercase tracking-wide text-[var(--menu-on-primary)]"
                >
                  Volver al menú
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="px-6 pb-12 pt-4 text-center">
                <p className="text-sm text-[var(--menu-muted)]">Tu pedido está vacío.</p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-6 w-full rounded-full border border-[var(--menu-line)] px-4 py-3 text-[10px] font-black uppercase tracking-wide transition-colors hover:bg-[var(--menu-primary-soft)]"
                >
                  Seguir viendo
                </button>
              </div>
            ) : (
              <>
                <div className="px-5">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 border-t border-[var(--menu-line)] py-4 first:border-t-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--menu-muted)]">
                          {formatMoney(item.price)} c/u
                        </p>
                        {item.notes && (
                          <p className="mt-1 inline-flex items-start gap-1 text-[11px] italic text-[var(--menu-muted)]">
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                            {item.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-sm font-black">
                          {formatMoney(item.price * item.quantity)}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="inline-flex items-center rounded-full bg-[var(--menu-primary)] text-[var(--menu-on-primary)]">
                            <button
                              type="button"
                              onClick={() => change(item.id, -1)}
                              aria-label={`Quitar una unidad de ${item.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-full transition-opacity hover:opacity-80"
                            >
                              <Minus className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <span className="w-5 text-center text-xs font-black" aria-live="polite">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => change(item.id, 1)}
                              aria-label={`Agregar una unidad de ${item.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-full transition-opacity hover:opacity-80"
                            >
                              <Plus className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            aria-label={`Eliminar ${item.name} del pedido`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--menu-muted)] transition-colors hover:bg-[var(--menu-primary-soft)] hover:text-[var(--menu-primary)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[var(--menu-line)] p-5">
                  <div className="flex items-end justify-between gap-4">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[var(--menu-muted)]">
                      Total
                    </span>
                    <span className="text-3xl font-black leading-none">{formatMoney(total)}</span>
                  </div>

                  <p className="mt-4 rounded-2xl bg-[var(--menu-primary-soft)] px-4 py-3 text-[11px] leading-relaxed text-[var(--menu-primary)]">
                    Vista previa de diseño: este pedido no se envía a cocina.
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={closeCart}
                      className="flex-1 rounded-full border border-[var(--menu-line)] px-4 py-3 text-[10px] font-black uppercase tracking-wide transition-colors hover:bg-[var(--menu-primary-soft)]"
                    >
                      Seguir viendo
                    </button>
                    <button
                      type="button"
                      onClick={confirmPreview}
                      className="flex-1 rounded-full bg-[var(--menu-primary)] px-4 py-3 text-[10px] font-black uppercase tracking-wide text-[var(--menu-on-primary)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      Confirmar pedido
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
