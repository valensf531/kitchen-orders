'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Minus,
  Plus,
  Send,
  UtensilsCrossed,
  CheckCircle2,
  ImageIcon,
  Loader2,
  AlertCircle,
  Pencil,
  Search,
  X,
  Star,
  Flame,
  Info,
  StickyNote,
  Trash2,
} from 'lucide-react';
import {
  resolveTagMeta,
  TAG_TONE_BADGE_CLASSES,
  type CustomTag,
  type TagMeta,
} from '@/lib/menu-tags';

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
type PublicTable = { id: string; number: number; zone: string };

function TagBadge({ meta }: { meta: TagMeta }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TAG_TONE_BADGE_CLASSES[meta.tone]}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function TagList({ tags, limit = 3, customTags = [] }: { tags: string[]; limit?: number; customTags?: CustomTag[] }) {
  const metas = tags.map((tag) => resolveTagMeta(tag, customTags));
  if (metas.length === 0) return null;
  const shown = metas.slice(0, limit);
  const rest = metas.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1" title={metas.map((meta) => meta.label).join(', ')}>
      {shown.map((meta) => (
        <TagBadge key={meta.key} meta={meta} />
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          +{rest}
        </span>
      )}
    </div>
  );
}

function ShowcaseCard({
  item,
  badgeIcon,
  badgeLabel,
  note,
  onOpen,
  onAdd,
}: {
  item: Item;
  badgeIcon: React.ReactNode;
  badgeLabel: string;
  note?: string;
  onOpen: () => void;
  onAdd: () => void;
}) {
  return (
    <article className="bg-white rounded-xl border border-slate-200 flex w-56 shrink-0 snap-start flex-col overflow-hidden transition-shadow hover:shadow-md sm:w-64">
      <button onClick={onOpen} className="relative block h-32 w-full bg-slate-100" aria-label={`Ver detalle de ${item.name}`}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida por separado; next/image no optimiza ni abarata aquí.
          <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
          </span>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
          {badgeIcon}
          {badgeLabel}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="break-words line-clamp-2 font-semibold leading-snug text-slate-800" title={item.name}>{item.name}</span>
          <span className="whitespace-nowrap font-semibold text-indigo-600">${item.price.toFixed(2)}</span>
        </div>
        {item.description && <p className="line-clamp-2 text-xs text-slate-500">{item.description}</p>}
        {note && <p className="text-[11px] font-medium text-slate-400">{note}</p>}
        <button
          onClick={onAdd}
          className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar
        </button>
      </div>
    </article>
  );
}

function PublicMenu() {
  // The query string is read after mount so server and client render the same
  // shell on the first pass (no hydration mismatch) and the page keeps its SSR.
  const [paramsReady, setParamsReady] = useState(false);
  const [restaurantFromUrl, setRestaurantFromUrl] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [branding, setBranding] = useState<{ name: string; logoUrl: string | null }>({ name: '', logoUrl: null });
  const [popular, setPopular] = useState<{ id: string; count: number }[]>([]);
  const [availableTables, setAvailableTables] = useState<PublicTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState('');
  const [pickedTableId, setPickedTableId] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reopenRequested, setReopenRequested] = useState(false);
  const [tableLocked, setTableLocked] = useState(false);

  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState('');

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const initialTable = search.get('table') ?? '';
    setRestaurantFromUrl(search.get('restaurant') ?? '');
    setTable(initialTable);
    setTableLocked(Boolean(initialTable));
    setParamsReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    const query = restaurantFromUrl ? `?restaurant=${encodeURIComponent(restaurantFromUrl)}` : '';
    fetch(`/api/public/menu${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setRestaurant(data.restaurantId ?? '');
        setBranding({
          name: typeof data.branding?.name === 'string' ? data.branding.name : '',
          logoUrl: typeof data.branding?.logoUrl === 'string' ? data.branding.logoUrl : null,
        });
        setAvailableTables(data.tables ?? []);
        setCategories(data.categories ?? []);
        setCustomTags(Array.isArray(data.tags) ? data.tags : []);
        setPopular(Array.isArray(data.popularItems) ? data.popularItems : []);
        setItems(
          (data.items ?? []).map((item: Item) => ({
            ...item,
            price: Number(item.price) || 0,
            tags: Array.isArray(item.tags) ? item.tags : [],
            featured: Boolean(item.featured),
          })),
        );
      })
      .catch(() => active && setError('No se pudo cargar el menú'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [restaurantFromUrl]);

  const tableMatches = useMemo(
    () => availableTables.filter((t) => t.number === Number(table)),
    [availableTables, table],
  );
  const resolvedTable =
    tableMatches.length === 1 ? tableMatches[0] : tableMatches.find((t) => t.id === pickedTableId);
  const tableId = resolvedTable?.id ?? '';
  const zone = resolvedTable?.zone ?? '';
  const tableModalOpen = !tableLocked && (reopenRequested || !paramsReady || !table);

  const searching = search.trim().length > 0;
  const query = search.trim().toLowerCase();

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesSearch =
          !query ||
          item.name.toLowerCase().includes(query) ||
          (item.description ?? '').toLowerCase().includes(query);
        return matchesSearch;
      }),
    [items, query],
  );

  /* Secciones del menú: una por categoría, con nombre y cantidad de platos. */
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

  const featuredItems = useMemo(() => items.filter((item) => item.featured), [items]);

  const popularList = useMemo(
    () =>
      popular
        .map((entry) => {
          const item = items.find((candidate) => candidate.id === entry.id);
          return item ? { item, count: entry.count } : null;
        })
        .filter((entry): entry is { item: Item; count: number } => entry !== null),
    [popular, items],
  );

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const addToCart = (item: Item, quantity = 1, notes?: string) =>
    setCart((current) => {
      const existing = current.find((x) => x.id === item.id);
      if (!existing) return [...current, { ...item, quantity, notes }];
      return current.map((x) =>
        x.id === item.id ? { ...x, quantity: x.quantity + quantity, notes: notes ?? x.notes } : x,
      );
    });

  const change = (id: string, delta: number) =>
    setCart((current) =>
      current
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );

  const removeFromCart = (id: string) => setCart((current) => current.filter((item) => item.id !== id));

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

  const lockTable = () => {
    if (!table || !tableId) return;
    setTableLocked(true);
    setReopenRequested(false);
    setError('');
  };

  const submit = async () => {
    if (submitting) return;
    if (!tableId) {
      setError('Elegí tu mesa antes de enviar el pedido');
      return;
    }
    if (cart.length === 0) {
      setError('Agregá al menos un producto');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/public/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant,
          tableId,
          tableNumber: table,
          zone,
          notes,
          total,
          items: cart,
        }),
      });
      if (!response.ok) {
        setError((await response.json()).error || 'No se pudo enviar el pedido');
        return;
      }
      setSent(true);
      setCart([]);
      setNotes('');
    } catch {
      setError('No se pudo enviar el pedido. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-xl border border-slate-200 max-w-md p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-500" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-slate-800">¡Pedido enviado!</h1>
          <p className="mt-2 text-slate-500">
            La cocina ya recibió tu pedido. Podés volver a pedir cuando quieras.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-6 w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-sm transition-all duration-150"
          >
            Volver al menú
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-800 pb-72 sm:pb-32">
      {/* Encabezado con marca + mesa */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo del restaurante (data URL); next/image no aplica.
                <img
                  src={branding.logoUrl}
                  alt={branding.name || 'Logo del restaurante'}
                  className="w-11 h-11 rounded-xl object-contain bg-white border border-slate-200"
                />
              ) : (
              <Image
                src="/logo.png"
                alt="Lumen Logo"
                width={44}
                height={44}
                className="w-11 h-11 rounded-xl"
                priority
              />
              )}
              <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">{branding.name || 'Lumen'}</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Menú digital</p>
              </div>
            </div>

            <div className="ml-auto min-w-0">
              <label htmlFor="table" className="block text-sm font-semibold text-slate-600 mb-2">
                Mesa
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="table"
                  disabled={tableLocked}
                  value={table}
                  onChange={(e) => setTable(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="Ej. 4"
                  className={`w-28 px-3 py-2.5 border rounded-lg text-slate-800 placeholder:text-slate-400 font-bold ${
                    tableLocked
                      ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed'
                      : 'border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600'
                  }`}
                />
                {tableLocked && (
                  <button
                    onClick={() => setReopenRequested(true)}
                    className="inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Cambiar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-5 sm:pt-5">
        {error && (
          <div role="alert" className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Búsqueda + filtros + categorías */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
              aria-label="Buscar en el menú"
              placeholder="Buscar platos, bebidas…"
              className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <nav className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1" aria-label="Categorías del menú">
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#categoria-${category.id}`}
                className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                {category.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-5 sm:pt-6">
        {/* Los más pedidos (carrusel principal) */}
        {!loading && !searching && popularList.length > 0 && (
          <section aria-labelledby="popular-title" className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500 flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <h2 id="popular-title" className="text-base font-bold text-slate-800">Los más pedidos</h2>
            </div>
            <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
              {popularList.map(({ item, count }) => (
                <ShowcaseCard
                  key={item.id}
                  item={item}
                  badgeIcon={<Flame className="h-3 w-3" aria-hidden="true" />}
                  badgeLabel="Top pedido"
                  note={`Se pidió ${count} ${count === 1 ? 'vez' : 'veces'}`}
                  onOpen={() => openDetail(item)}
                  onAdd={() => addToCart(item)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recomendados del chef */}
        {!loading && !searching && featuredItems.length > 0 && (
          <section aria-labelledby="featured-title" className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
                <Star className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <h2 id="featured-title" className="text-base font-bold text-slate-800">Recomendados del chef</h2>
            </div>
            <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
              {featuredItems.map((item) => (
                <ShowcaseCard
                  key={item.id}
                  item={item}
                  badgeIcon={<Star className="h-3 w-3" aria-hidden="true" />}
                  badgeLabel="Recomendado"
                  onOpen={() => openDetail(item)}
                  onAdd={() => addToCart(item)}
                />
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" aria-hidden="true" />
            <p className="text-slate-500 mt-2">Cargando menú…</p>
          </div>
        ) : (
          <>
            {sections.map(({ category, sectionItems }) => (
              <section
                key={category.id}
                id={`categoria-${category.id}`}
                aria-labelledby={`categoria-title-${category.id}`}
                className="mb-8 scroll-mt-40"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <h2 id={`categoria-title-${category.id}`} className="text-base font-bold text-slate-800">
                    {category.name}
                  </h2>
                  <span className="text-xs font-semibold text-slate-400">
                    {sectionItems.length} {sectionItems.length === 1 ? 'producto' : 'productos'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
                  {sectionItems.map((item) => (
              <article key={item.id} className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden transition-shadow hover:shadow-md">
                <button
                  onClick={() => openDetail(item)}
                  className="relative block h-36 w-full bg-slate-100 sm:h-40"
                  aria-label={`Ver detalle de ${item.name}`}
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida por separado; next/image no optimiza ni abarata aquí.
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-slate-300" aria-hidden="true" />
                    </span>
                  )}
                  {item.featured && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                      <Star className="h-3 w-3" aria-hidden="true" />
                      Recomendado
                    </span>
                  )}
                </button>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="break-words line-clamp-2 font-semibold leading-snug text-slate-800" title={item.name}>{item.name}</h3>
                    <span className="whitespace-nowrap font-semibold text-indigo-600">${item.price.toFixed(2)}</span>
                  </div>
                  {item.description && (
                    <p className="line-clamp-2 text-xs text-slate-500">{item.description}</p>
                  )}
                  <TagList tags={item.tags} limit={3} customTags={customTags} />
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <button
                      onClick={() => openDetail(item)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      Detalle
                    </button>
                    <button
                      onClick={() => addToCart(item)}
                      aria-label={`Agregar ${item.name} al pedido`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white transition-all duration-150 hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 active:scale-95"
                    >
                      <Plus className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
                ))}
                </div>
              </section>
            ))}
          </>
        )}

        {!loading && !error && visibleItems.length === 0 && (
          <p className="py-12 text-center text-slate-400">
            {searching
              ? 'No encontramos platos que coincidan con tu búsqueda.'
              : 'Todavía no hay platos publicados en el menú.'}
          </p>
        )}
      </div>

      {cart.length > 0 && (
        <section className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 shadow-lg sm:p-4">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col gap-3">
              <div className="min-w-0" aria-live="polite">
                <p className="flex items-center gap-2 font-bold text-slate-800">
                  Tu pedido
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                    {cartCount} {cartCount === 1 ? 'item' : 'items'}
                  </span>
                  <span className="ml-auto text-lg font-bold text-indigo-600">${total.toFixed(2)}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cart.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex max-w-full items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm"
                    >
                      <button
                        onClick={() => change(item.id, -1)}
                        aria-label={`Quitar una unidad de ${item.name}`}
                        className="w-6 h-6 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded transition-colors text-slate-600"
                      >
                        <Minus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="truncate font-medium text-slate-700">
                        {item.quantity}× {item.name}
                      </span>
                      {item.notes && (
                        <span title={item.notes} className="text-slate-400">
                          <StickyNote className="h-3 w-3" aria-label={`Notas: ${item.notes}`} />
                        </span>
                      )}
                      <button
                        onClick={() => change(item.id, 1)}
                        aria-label={`Agregar una unidad de ${item.name}`}
                        className="w-6 h-6 flex items-center justify-center bg-teal-600 hover:bg-teal-700 rounded transition-colors text-white"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Eliminar ${item.name} del pedido`}
                        className="w-6 h-6 flex items-center justify-center bg-rose-100 hover:bg-rose-200 rounded transition-colors text-rose-500"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  aria-label="Notas especiales para la cocina"
                  placeholder="Notas generales (opcional)"
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
                />
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="sm:w-auto px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Enviar pedido
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Modal de detalle del plato */}
      {detailItem && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={closeDetail}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-44 w-full bg-slate-100">
              {detailItem.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida por separado; next/image no optimiza ni abarata aquí.
                <img src={detailItem.imageUrl} alt={detailItem.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-slate-300" aria-hidden="true" />
                </span>
              )}
              {detailItem.featured && (
                <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                  <Star className="h-3 w-3" aria-hidden="true" />
                  Recomendado
                </span>
              )}
              <button
                onClick={closeDetail}
                aria-label="Cerrar detalle"
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 id="detail-title" className="text-xl font-bold leading-snug text-slate-800">
                  {detailItem.name}
                </h2>
                <span className="whitespace-nowrap text-lg font-bold text-indigo-600">
                  ${detailItem.price.toFixed(2)}
                </span>
              </div>

              <TagList tags={detailItem.tags} limit={8} customTags={customTags} />

              {detailItem.description && (
                <p className="text-sm leading-relaxed text-slate-500">{detailItem.description}</p>
              )}

              {detailItem.ingredients && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Contiene</p>
                  <p className="text-sm text-slate-700">{detailItem.ingredients}</p>
                </div>
              )}

              <div className="mt-1 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-600">Cantidad</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                    aria-label="Quitar una unidad"
                    className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded transition-colors text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="w-7 text-center font-bold text-slate-800" aria-live="polite">{detailQty}</span>
                  <button
                    onClick={() => setDetailQty((q) => Math.min(20, q + 1))}
                    aria-label="Agregar una unidad"
                    className="w-8 h-8 flex items-center justify-center bg-teal-600 hover:bg-teal-700 rounded transition-colors text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="detail-notes" className="block text-sm font-semibold text-slate-600 mb-2">
                  Notas para la cocina <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="detail-notes"
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  placeholder="Ej. sin cebolla, punto de cocción…"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
                />
              </div>

              <button
                onClick={addFromDetail}
                className="mt-1 w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Agregar {detailQty} · ${(detailQty * detailItem.price).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`fixed inset-0 z-30 flex items-center justify-center p-4 transition-opacity ${
          tableModalOpen ? 'bg-black/40 backdrop-blur-sm' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!tableModalOpen}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-modal-title"
          className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl"
        >
          <div className="p-6 flex flex-col items-center text-center">
            <div className="mb-4 w-14 h-14 rounded-xl bg-teal-600 flex items-center justify-center">
              <UtensilsCrossed className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <h2 id="table-modal-title" className="text-xl font-bold text-slate-800">
              ¿En qué mesa estás?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Necesitamos este dato para enviar tu pedido al salón correcto.
            </p>

            <label htmlFor="table-modal-input" className="sr-only">
              Número de mesa
            </label>
            <input
              id="table-modal-input"
              autoFocus
              value={table}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setTable(value);
                setPickedTableId('');
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') lockTable();
              }}
              inputMode="numeric"
              placeholder="Número de mesa"
              className="mt-6 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-center text-lg font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
            />

            {tableMatches.length > 1 && (
              <>
                <label htmlFor="zone-select" className="sr-only">
                  Seleccioná el salón
                </label>
                <select
                  id="zone-select"
                  value={tableId}
                  onChange={(e) => setPickedTableId(e.target.value)}
                  className="mt-3 w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                >
                  <option value="">Seleccioná el salón</option>
                  {tableMatches.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.zone}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="flex gap-3 p-4 bg-slate-50">
            {reopenRequested && (
              <button onClick={() => setReopenRequested(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100">
                Cancelar
              </button>
            )}
            <button
              onClick={lockTable}
              disabled={!table || !tableId}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-all duration-150"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default PublicMenu;
