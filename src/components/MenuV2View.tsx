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
import { resolveTagMeta, type CustomTag, type TagMeta } from '@/lib/menu-tags';

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
  fontFamily: 'var(--font-editorial), Georgia, serif',
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
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      {shown.map((meta: TagMeta) => (
        <span
          key={meta.key}
          className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#7a6a58]"
        >
          <span aria-hidden="true">{meta.icon}</span>
          {meta.label}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#a08e79]">
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
  onAdd,
  onInc,
  onDec,
}: {
  name: string;
  qty: number;
  compact?: boolean;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  if (qty > 0) {
    return (
      <div className="inline-flex items-center border border-[#201b16] bg-[#201b16] text-[#f6f1e7]">
        <button
          type="button"
          onClick={onDec}
          aria-label={`Quitar una unidad de ${name}`}
          className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-[#3a2f26]"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="w-6 text-center text-xs font-bold" aria-live="polite">
          {qty}
        </span>
        <button
          type="button"
          onClick={onInc}
          aria-label={`Agregar una unidad de ${name}`}
          className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-[#3a2f26]"
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
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#201b16] transition-colors hover:bg-[#201b16] hover:text-[#f6f1e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b45309]"
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
      className="inline-flex h-9 items-center gap-1.5 border border-[#201b16] px-3 text-[9px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-[#201b16] hover:text-[#f6f1e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b45309]"
    >
      Agregar
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

function FeaturedCard({
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
    <article className="group flex w-[86vw] max-w-xl shrink-0 snap-start flex-col border border-[#d8cbb9] bg-[#fbf7ef] sm:w-auto sm:max-w-none">
      <div className="grid flex-1 sm:grid-cols-[1.05fr_1fr]">
        <button
          type="button"
          onClick={onOpen}
          className="relative block aspect-[4/3] w-full overflow-hidden bg-[#e7ddcd] text-left sm:aspect-auto sm:min-h-[280px]"
          aria-label={`Ver detalle de ${item.name}`}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida aparte.
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center text-7xl text-[#b45309]/40"
              style={displayFont}
            >
              {initial}
            </span>
          )}
          <span className="absolute left-3 top-3 bg-[#f6f1e7]/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#b45309]">
            Selección de la casa
          </span>
        </button>

        <div className="flex flex-col gap-4 p-5">
          <button type="button" onClick={onOpen} className="text-left">
            <h3 className="text-3xl leading-none tracking-tight" style={displayFont}>
              {item.name}
            </h3>
            {item.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#6f6254]">
                {item.description}
              </p>
            )}
          </button>

          <MenuTagLine tags={item.tags} customTags={customTags} limit={3} />

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#e4dacb] pt-4">
            <span className="text-2xl" style={displayFont}>
              {money(item.price)}
            </span>
            <QuantityControl
              name={item.name}
              qty={qty}
              onAdd={onAdd}
              onInc={onInc}
              onDec={onDec}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function MenuRow({
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
    <article className="group flex items-start gap-3 border-b border-[#e4dacb] py-4 last:border-0 sm:gap-4">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 text-left sm:gap-4"
        aria-label={`Ver detalle de ${item.name}`}
      >
        <span className="relative h-16 w-16 shrink-0 overflow-hidden bg-[#e7ddcd] sm:h-20 sm:w-20">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida aparte.
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center text-3xl text-[#b45309]/40"
              style={displayFont}
            >
              {initial}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            <span className="text-lg font-semibold leading-snug text-[#201b16]">
              {item.name}
            </span>
            {item.featured && (
              <Star
                className="mt-1 h-3.5 w-3.5 shrink-0 fill-[#b45309] text-[#b45309]"
                aria-label="Recomendado"
              />
            )}
          </span>
          {item.description && (
            <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-[#6f6254]">
              {item.description}
            </span>
          )}
          <MenuTagLine tags={item.tags} customTags={customTags} limit={2} />
        </span>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
        <span className="text-sm font-semibold text-[#201b16]">{money(item.price)}</span>
        <QuantityControl
          name={item.name}
          qty={qty}
          compact
          onAdd={onAdd}
          onInc={onInc}
          onDec={onDec}
        />
      </div>
    </article>
  );
}

function SectionHeading({
  index,
  name,
  count,
}: {
  index: number;
  name: string;
  count: number;
}) {
  return (
    <div className="mb-2 flex items-end gap-3 border-b border-[#d8cbb9] pb-3">
      <span
        aria-hidden="true"
        className="text-4xl leading-none text-[#b45309]/45"
        style={displayFont}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <h2 className="text-3xl leading-none tracking-tight text-[#201b16]" style={displayFont}>
        {name}
      </h2>
      <span className="ml-auto pb-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#877663]">
        {count} {count === 1 ? 'producto' : 'productos'}
      </span>
    </div>
  );
}

export function MenuV2View() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [branding, setBranding] = useState<{ name: string; logoUrl: string | null }>({
    name: '',
    logoUrl: null,
  });
  const [currencySymbol, setCurrencySymbol] = useState('$');
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
    const restaurant = new URLSearchParams(window.location.search).get('restaurant');
    const query = restaurant ? `?restaurant=${encodeURIComponent(restaurant)}` : '';

    fetch(`/api/public/menu${query}`)
      .then((res) => {
        if (!res.ok) throw new Error('menu');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
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
      .catch(() => active && setError('No se pudo cargar la carta. Recargá la página.'))
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
    () => items.filter((item) => item.featured).slice(0, 4),
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

  const initial = (branding.name || 'Lumen').trim().charAt(0).toUpperCase();

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#f4efe5] text-[#201b16]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #d8cbb9 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      <header className="relative overflow-hidden bg-[#201b16] text-[#f6f1e7]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-20 select-none text-[17rem] leading-none text-[#f6f1e7]/[0.04]"
          style={displayFont}
        >
          {initial}
        </span>

        <div className="relative mx-auto max-w-4xl px-5 pb-12 pt-6 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo del restaurante (data URL).
                <img
                  src={branding.logoUrl}
                  alt={branding.name || 'Logo del restaurante'}
                  className="h-10 w-10 shrink-0 border border-[#5b4a3a] bg-[#f6f1e7] object-contain"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#5b4a3a] text-lg text-[#d6b98c]"
                  style={displayFont}
                >
                  {initial}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{branding.name || 'Lumen'}</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#d6b98c]">
                  Vista previa de diseño
                </p>
              </div>
            </div>

            <span className="shrink-0 border border-[#5b4a3a] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#d6b98c]">
              Modo demo
            </span>
          </div>

          <div className="mt-12 max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d6b98c]">
              Cocina de autor · Menú digital
            </p>
            <h1 className="mt-3 text-5xl leading-[0.95] tracking-tight sm:text-7xl" style={displayFont}>
              La carta<span className="text-[#d97706]">.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#c9bba7]">
              Una selección de platos y bebidas para pedir desde la mesa. Elegí, sumá al pedido y
              confirmá.
            </p>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-[#d8cbb9] bg-[#f4efe5]/95 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-5 pb-3 pt-3 sm:px-6">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#877663]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              aria-label="Buscar en la carta"
              placeholder="Buscar en la carta…"
              className="w-full border-b border-[#c9bba7] bg-transparent py-2 pl-7 pr-8 text-sm text-[#201b16] placeholder:text-[#9c8c79] focus:border-[#201b16] focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-[#877663] transition-colors hover:text-[#201b16]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <nav className="scrollbar-hide -mx-1 mt-3 flex gap-5 overflow-x-auto px-1">
            {sections.map(({ category }, index) => (
              <a
                key={category.id}
                href={`#cat-${category.id}`}
                className="shrink-0 whitespace-nowrap border-b border-transparent pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f6254] transition-colors hover:border-[#b45309] hover:text-[#201b16]"
              >
                <span className="mr-1.5 text-[#b45309]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {category.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="relative mx-auto max-w-4xl px-5 pb-44 pt-10 sm:px-6 sm:pb-32">
        {error && (
          <div
            role="alert"
            className="mb-8 flex items-center gap-3 border border-[#d8b4a0] bg-[#f8e8df] px-4 py-3 text-sm text-[#8a3f22]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[9px] font-bold uppercase tracking-[0.16em] underline underline-offset-4"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-8" aria-label="Cargando la carta">
            <div className="h-56 bg-[#e7ddcd]" />
            <div className="space-y-3">
              <div className="h-7 w-48 bg-[#e7ddcd]" />
              <div className="h-24 bg-[#e7ddcd]" />
              <div className="h-24 bg-[#e7ddcd]" />
            </div>
          </div>
        ) : (
          <>
            {!searching && featuredItems.length > 0 && (
              <section className="mb-14" aria-labelledby="featured-v2-title">
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#b45309]">
                      Selección de la casa
                    </p>
                    <h2
                      id="featured-v2-title"
                      className="mt-1 text-3xl leading-none tracking-tight"
                      style={displayFont}
                    >
                      Recomendados
                    </h2>
                  </div>
                  <span className="hidden pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#a08e79] sm:block">
                    Deslizá para ver más
                  </span>
                </div>

                <div className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
                  {featuredItems.map((item) => (
                    <FeaturedCard
                      key={item.id}
                      item={item}
                      qty={cartQty(item.id)}
                      customTags={customTags}
                      onOpen={() => openDetail(item)}
                      onAdd={() => addToCart(item)}
                      onInc={() => change(item.id, 1)}
                      onDec={() => change(item.id, -1)}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-x-12 gap-y-12 lg:grid-cols-2">
              {sections.map(({ category, sectionItems }, index) => (
                <section
                  key={category.id}
                  id={`cat-${category.id}`}
                  aria-labelledby={`cat-title-${category.id}`}
                  className="scroll-mt-36"
                >
                  <div id={`cat-title-${category.id}`}>
                    <SectionHeading index={index} name={category.name} count={sectionItems.length} />
                  </div>
                  <div>
                    {sectionItems.map((item) => (
                      <MenuRow
                        key={item.id}
                        item={item}
                        qty={cartQty(item.id)}
                        customTags={customTags}
                        onOpen={() => openDetail(item)}
                        onAdd={() => addToCart(item)}
                        onInc={() => change(item.id, 1)}
                        onDec={() => change(item.id, -1)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {!loading && !error && sections.length === 0 && (
              <p className="py-16 text-center text-sm text-[#877663]">
                {searching
                  ? 'No encontramos productos que coincidan con tu búsqueda.'
                  : 'Todavía no hay productos publicados en la carta.'}
              </p>
            )}
          </>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3">
          <button
            type="button"
            onClick={openCart}
            className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 bg-[#201b16] px-4 py-3 text-[#f6f1e7] shadow-[0_20px_50px_-20px_rgba(32,27,22,0.75)] transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em]">
              <ShoppingBag className="h-4 w-4 text-[#d6b98c]" aria-hidden="true" />
              {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
            </span>
            <span className="flex items-center gap-4">
              <span className="text-xl" style={displayFont}>
                {formatMoney(total)}
              </span>
              <span className="border border-[#f6f1e7]/30 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em]">
                Ver pedido
              </span>
            </span>
          </button>
        </div>
      )}

      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#201b16]/60 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={closeDetail}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-v2-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto bg-[#fbf7ef] shadow-2xl sm:border sm:border-[#d8cbb9]"
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
                  className="flex aspect-[4/3] w-full items-center justify-center bg-[#201b16] text-8xl text-[#d6b98c]/35"
                  style={displayFont}
                >
                  {detailItem.name.trim().charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Cerrar detalle"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#f6f1e7]/90 text-[#201b16] shadow transition-colors hover:bg-[#f6f1e7]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <h2
                  id="detail-v2-title"
                  className="text-3xl leading-none tracking-tight"
                  style={displayFont}
                >
                  {detailItem.name}
                </h2>
                <span className="shrink-0 text-xl" style={displayFont}>
                  {formatMoney(detailItem.price)}
                </span>
              </div>

              <MenuTagLine tags={detailItem.tags} customTags={customTags} limit={8} />

              {detailItem.description && (
                <p className="text-sm leading-relaxed text-[#6f6254]">{detailItem.description}</p>
              )}

              {detailItem.ingredients && (
                <div className="border-l-2 border-[#b45309] bg-[#f4efe5] px-4 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#b45309]">
                    Contiene
                  </p>
                  <p className="mt-1 text-sm text-[#201b16]">{detailItem.ingredients}</p>
                </div>
              )}

              <div className="flex items-center justify-between border-y border-[#e4dacb] py-3">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6f6254]">
                  Cantidad
                </span>
                <div className="flex items-center border border-[#201b16] bg-[#201b16] text-[#f6f1e7]">
                  <button
                    type="button"
                    onClick={() => setDetailQty((value) => Math.max(1, value - 1))}
                    aria-label="Quitar una unidad"
                    className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-[#3a2f26]"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold" aria-live="polite">
                    {detailQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetailQty((value) => Math.min(20, value + 1))}
                    aria-label="Agregar una unidad"
                    className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-[#3a2f26]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="detail-v2-notes"
                  className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#6f6254]"
                >
                  Notas para la cocina <span className="font-normal normal-case tracking-normal">(opcional)</span>
                </label>
                <input
                  id="detail-v2-notes"
                  value={detailNotes}
                  onChange={(event) => setDetailNotes(event.target.value)}
                  placeholder="Ej. sin cebolla, punto de cocción…"
                  className="mt-2 w-full border-b border-[#c9bba7] bg-transparent py-2 text-sm placeholder:text-[#9c8c79] focus:border-[#201b16] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={addFromDetail}
                className="flex w-full items-center justify-between bg-[#201b16] px-4 py-3.5 text-[#f6f1e7] transition-colors hover:bg-[#3a2f26]"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                  Agregar al pedido
                </span>
                <span className="text-lg" style={displayFont}>
                  {formatMoney(detailQty * detailItem.price)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#201b16]/60 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={closeCart}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-v2-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto bg-[#fbf7ef] shadow-2xl sm:border sm:border-[#d8cbb9]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e4dacb] p-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#b45309]">
                  Vista previa de diseño
                </p>
                <h2
                  id="cart-v2-title"
                  className="mt-1 text-3xl leading-none tracking-tight"
                  style={displayFont}
                >
                  Tu pedido
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Cerrar pedido"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8cbb9] text-[#6f6254] transition-colors hover:bg-[#f4efe5]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {previewSent ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-[#b45309]" aria-hidden="true" />
                <h3 className="mt-4 text-3xl" style={displayFont}>
                  Pedido de prueba listo
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#6f6254]">
                  Esta es una vista previa de diseño. No se envió nada a cocina ni se abrió una
                  cuenta en la mesa.
                </p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-8 w-full bg-[#201b16] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f6f1e7] transition-colors hover:bg-[#3a2f26]"
                >
                  Volver a la carta
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-[#6f6254]">Tu pedido está vacío.</p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-6 w-full border border-[#201b16] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors hover:bg-[#201b16] hover:text-[#f6f1e7]"
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
                      className="flex items-start gap-3 border-b border-[#e4dacb] py-4 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#201b16]">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-[#877663]">
                          {formatMoney(item.price)} c/u
                        </p>
                        {item.notes && (
                          <p className="mt-1 inline-flex items-start gap-1 text-[11px] italic text-[#7a6a58]">
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                            {item.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-sm font-semibold">{formatMoney(item.price * item.quantity)}</span>
                        <div className="flex items-center gap-1">
                          <div className="inline-flex items-center border border-[#201b16] bg-[#201b16] text-[#f6f1e7]">
                            <button
                              type="button"
                              onClick={() => change(item.id, -1)}
                              aria-label={`Quitar una unidad de ${item.name}`}
                              className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-[#3a2f26]"
                            >
                              <Minus className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold" aria-live="polite">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => change(item.id, 1)}
                              aria-label={`Agregar una unidad de ${item.name}`}
                              className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-[#3a2f26]"
                            >
                              <Plus className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            aria-label={`Eliminar ${item.name} del pedido`}
                            className="flex h-8 w-8 items-center justify-center text-[#877663] transition-colors hover:bg-[#f4efe5] hover:text-[#8a3f22]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#e4dacb] p-5">
                  <div className="flex items-end justify-between gap-4">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#877663]">
                      Total
                    </span>
                    <span className="text-3xl leading-none" style={displayFont}>
                      {formatMoney(total)}
                    </span>
                  </div>

                  <p className="mt-4 border border-dashed border-[#d8cbb9] bg-[#f4efe5] px-3 py-2 text-[11px] leading-relaxed text-[#877663]">
                    Vista previa de diseño: este pedido no se envía a cocina.
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={closeCart}
                      className="flex-1 border border-[#201b16] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors hover:bg-[#f4efe5]"
                    >
                      Seguir viendo
                    </button>
                    <button
                      type="button"
                      onClick={confirmPreview}
                      className="flex-1 bg-[#201b16] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f6f1e7] transition-colors hover:bg-[#3a2f26]"
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
