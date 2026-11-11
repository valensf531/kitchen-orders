'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { normalizeMenuStyle, type MenuStyle } from '@/lib/menu-style';

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
type PublicZone = { slug: string; name: string };

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
  rank,
  qty,
  currencySymbol,
  onOpen,
  onAdd,
  onInc,
  onDec,
}: {
  item: Item;
  currencySymbol: string;
  badgeIcon: React.ReactNode;
  badgeLabel: string;
  note?: string;
  rank?: number;
  qty?: number;
  onOpen: () => void;
  onAdd: () => void;
  onInc?: () => void;
  onDec?: () => void;
}) {
  return (
    <article className="relative bg-white rounded-2xl border border-slate-200/80 flex w-60 shrink-0 snap-start flex-col overflow-hidden transition-shadow hover:shadow-lg sm:w-68">
      {typeof rank === 'number' && (
        <span aria-hidden="true" className="pointer-events-none absolute -top-1 right-2 z-10 text-5xl font-black text-slate-900/10 select-none">
          {rank}
        </span>
      )}
      <button onClick={onOpen} className="relative block h-36 w-full bg-gradient-to-br from-amber-50 to-slate-100" aria-label={`Ver detalle de ${item.name}`}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api) servida por separado; next/image no optimiza ni abarata aquí.
          <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
          </span>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-950/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md backdrop-blur">
          {badgeIcon}
          {badgeLabel}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="break-words line-clamp-2 font-bold leading-snug text-slate-800" title={item.name}>{item.name}</span>
          <span className="whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 font-bold text-teal-700">{currencySymbol}{item.price.toFixed(2)}</span>
        </div>
        {note && <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500"><Flame className="h-3 w-3" aria-hidden="true" />{note}</p>}
        {(qty ?? 0) > 0 ? (
          <div className="mt-auto flex items-center justify-between rounded-xl bg-slate-950 px-2 py-1.5">
            <button
              onClick={onDec}
              aria-label={`Quitar una unidad de ${item.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="font-bold text-white" aria-live="polite">{qty}</span>
            <button
              onClick={onInc ?? onAdd}
              aria-label={`Agregar una unidad de ${item.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white transition-colors hover:bg-teal-400"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar
          </button>
        )}
      </div>
    </article>
  );
}

function TextShowcaseCard({
  item,
  qty = 0,
  customTags,
  currencySymbol,
  onOpen,
  onAdd,
  onInc,
  onDec,
}: {
  item: Item;
  qty?: number;
  customTags: CustomTag[];
  currencySymbol: string;
  onOpen: () => void;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <article className="flex w-60 shrink-0 snap-start flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
          <Star className="h-3 w-3" aria-hidden="true" />
          Recomendado
        </span>
        <span className="whitespace-nowrap font-black text-teal-700">{currencySymbol}{item.price.toFixed(2)}</span>
      </div>
      <button
        onClick={onOpen}
        className="mt-2 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        aria-label={`Ver detalle de ${item.name}`}
      >
        <h3 className="line-clamp-2 font-bold leading-snug text-slate-900">{item.name}</h3>
      </button>
      {item.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.description}</p>
      )}
      <div className="mt-2">
        <TagList tags={item.tags} limit={2} customTags={customTags} />
      </div>
      <div className="mt-auto pt-3">
        {qty > 0 ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-950 px-2 py-1.5">
            <button
              onClick={onDec}
              aria-label={`Quitar una unidad de ${item.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="font-bold text-white" aria-live="polite">{qty}</span>
            <button
              onClick={onInc}
              aria-label={`Agregar una unidad de ${item.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white transition-colors hover:bg-teal-400"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar
          </button>
        )}
      </div>
    </article>
  );
}

function MenuListRow({
  item,
  qty,
  customTags,
  currencySymbol,
  onOpen,
  onAdd,
  onInc,
  onDec,
}: {
  item: Item;
  qty: number;
  customTags: CustomTag[];
  currencySymbol: string;
  onOpen: () => void;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <article className="flex items-start gap-3 p-4">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        aria-label={`Ver detalle de ${item.name}`}
      >
        <div className="flex items-start gap-1.5">
          <h3 className="break-words font-bold leading-snug text-slate-900">{item.name}</h3>
          {item.featured && (
            <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Recomendado" />
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
            {item.description}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-1.5">
            <TagList tags={item.tags} limit={2} customTags={customTags} />
          </div>
        )}
      </button>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="whitespace-nowrap font-black text-teal-700">{currencySymbol}{item.price.toFixed(2)}</span>
        {qty > 0 ? (
          <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1">
            <button
              onClick={onDec}
              aria-label={`Quitar una unidad de ${item.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="w-5 text-center text-xs font-bold text-white" aria-live="polite">{qty}</span>
            <button
              onClick={onInc}
              aria-label={`Agregar una unidad de ${item.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-500 text-white transition-colors hover:bg-teal-400"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            aria-label={`Agregar ${item.name} al pedido`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white transition-all duration-150 hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 active:scale-95"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

function SectionTitle({ id, eyebrow, title, count, countLabel }: { id?: string; eyebrow: string; title: string; count?: number; countLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">{eyebrow}</p>
        <h2 id={id} className="mt-0.5 text-xl font-black tracking-tight text-slate-900">{title}</h2>
      </div>
      {typeof count === 'number' && (
        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
          {count} {countLabel ?? (count === 1 ? 'plato' : 'platos')}
        </span>
      )}
    </div>
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
  const [menuStyle, setMenuStyle] = useState<MenuStyle>('photos');
  const [branding, setBranding] = useState<{ name: string; logoUrl: string | null }>({ name: '', logoUrl: null });
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [availableTables, setAvailableTables] = useState<PublicTable[]>([]);
  const [publicZones, setPublicZones] = useState<PublicZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState('');
  const [pickedTableId, setPickedTableId] = useState('');
  const [publicToken, setPublicToken] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reopenRequested, setReopenRequested] = useState(false);
  const [tableLocked, setTableLocked] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState('');

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const initialTable = search.get('table') ?? '';
    setRestaurantFromUrl(search.get('restaurant') ?? '');
    setTable(initialTable);
    setPublicToken(search.get('token') ?? '');
    setTableLocked(Boolean(initialTable));
    setParamsReady(true);
  }, []);

  useEffect(() => {
    /* Esperar a leer la URL: así se hace una sola carga, ya con el
       restaurante correcto (si no, una respuesta vieja puede pisar la
       lista de mesas y el menú vuelve a pedir la mesa). */
    if (!paramsReady) return;
    let active = true;
    const query = restaurantFromUrl ? `?restaurant=${encodeURIComponent(restaurantFromUrl)}` : '';
    fetch(`/api/public/menu${query}`)
      .then((res) => {
        if (!res.ok) throw new Error('menu');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setRestaurant(data.restaurantId ?? '');
        setMenuStyle(normalizeMenuStyle(data.menuStyle));
        setBranding({
          name: typeof data.branding?.name === 'string' ? data.branding.name : '',
          logoUrl: typeof data.branding?.logoUrl === 'string' ? data.branding.logoUrl : null,
        });
        setCurrencySymbol(
          typeof data.currencySymbol === 'string' && data.currencySymbol.trim()
            ? data.currencySymbol.trim()
            : '$',
        );
        setAvailableTables(data.tables ?? []);
        setPublicZones(Array.isArray(data.zones) ? data.zones : []);
        setCategories(data.categories ?? []);
        setCustomTags(Array.isArray(data.tags) ? data.tags : []);
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
  }, [paramsReady, restaurantFromUrl]);

  const tableMatches = useMemo(
    () => availableTables.filter((t) => t.number === Number(table)),
    [availableTables, table],
  );
  const resolvedTable =
    tableMatches.length === 1 ? tableMatches[0] : tableMatches.find((t) => t.id === pickedTableId);
  const tableId = resolvedTable?.id ?? '';
  const zone = resolvedTable?.zone ?? '';
  /* Si la mesa ya está resuelta (número + id) no se vuelve a pedir: el
     modal solo aparece si falta la mesa, si la del QR no existe (o se
     borró) o si el usuario pidió cambiarla. El link general (sin token)
     también lo muestra para elegir la mesa. */
  const tableModalOpen = !loading && (reopenRequested || !table || !tableId);
  const zoneNameOf = (slug: string) =>
    publicZones.find((z) => z.slug === slug)?.name ?? slug.replace(/_/g, ' ');
  const tableTyped = table.trim().length > 0;
  const menuWidth = menuStyle === 'list' ? 'max-w-3xl' : 'max-w-5xl';

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
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of visibleItems) {
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [visibleItems]);

  const sections = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          sectionItems: itemsByCategory.get(category.id) ?? [],
        }))
        .filter((section) => section.sectionItems.length > 0),
    [categories, itemsByCategory],
  );

  const featuredItems = useMemo(() => items.filter((item) => item.featured), [items]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartQtyById = useMemo(
    () => new Map(cart.map((item) => [item.id, item.quantity])),
    [cart],
  );
  const cartQty = (id: string) => cartQtyById.get(id) ?? 0;
  const money = (value: number) => `${currencySymbol}${(Number(value) || 0).toFixed(2)}`;

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
    if (!publicToken) {
      setError('Este menú no tiene un QR válido. Escaneá el QR de tu mesa para pedir.');
      return;
    }
    if (cart.length === 0) {
      setError('Agregá al menos un producto');
      return;
    }
    setSubmitting(true);
    setError('');
    const idempotencyKey =
      idempotencyKeyRef.current ??
      (idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `key-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try {
      const response = await fetch('/api/public/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant,
          tableId,
          tableNumber: table,
          zone,
          tableToken: publicToken,
          idempotencyKey,
          notes,
          total,
          items: cart,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'No se pudo enviar el pedido');
        return;
      }
      idempotencyKeyRef.current = null;
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
    <main className="min-h-dvh overflow-x-hidden bg-canvas text-slate-800 pb-72 sm:pb-32">
      {/* Encabezado con marca + mesa */}
      <header className="bg-white border-b border-slate-200">
        <div className={`mx-auto ${menuWidth} px-4 py-4 sm:px-5`}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-3 min-w-0">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo del restaurante (data URL); next/image no aplica.
                <img
                  src={branding.logoUrl}
                  alt={branding.name || 'Logo del restaurante'}
                  className="h-12 w-12 rounded-xl object-contain bg-white border border-slate-200"
                />
              ) : (
              <Image
                src="/logo.png"
                alt="Lumen Logo"
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl border border-slate-200"
                priority
              />
              )}
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{branding.name || 'Lumen'}</h1>
                <p className="text-xs text-slate-500">
                  Menú digital{!loading && items.length > 0 && ` · ${items.length} ${items.length === 1 ? 'plato' : 'platos'}`}
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-end gap-2">
              <div>
                <label htmlFor="table" className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Mesa
                </label>
                <input
                  id="table"
                  disabled={tableLocked}
                  value={table}
                  onChange={(e) => setTable(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="N°"
                  className={`w-20 px-3 py-2 border rounded-lg text-slate-900 placeholder:text-slate-400 font-bold text-center ${
                    tableLocked
                      ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed'
                      : 'border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900'
                  }`}
                />
              </div>
              {tableLocked && !publicToken && (
                <button
                  onClick={() => setReopenRequested(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Cambiar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className={`mx-auto ${menuWidth} px-4 pt-4 sm:px-5 sm:pt-5`}>
        {error && (
          <div role="alert" className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Buscador + mesa + categorías (fijo al scrollear) */}
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className={`mx-auto ${menuWidth} space-y-3`}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                aria-label="Buscar en el menú"
                placeholder="Buscar platos, bebidas…"
                className="w-full pl-11 pr-10 py-3 border border-slate-200 rounded-full bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:bg-white"
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
            {tableLocked && tableId && !publicToken && (
              <button
                type="button"
                onClick={() => setReopenRequested(true)}
                title="Cambiar de mesa"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white border border-slate-300 px-3.5 py-3 text-xs font-bold text-slate-800 shadow-sm transition-transform active:scale-95"
              >
                Mesa {table}
              </button>
            )}
          </div>

          <nav className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" aria-label="Categorías del menú">
            {sections.map(({ category }) => (
              <a
                key={category.id}
                href={`#categoria-${category.id}`}
                className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-150 bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                {category.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className={`mx-auto ${menuWidth} px-4 pt-6 sm:px-5 sm:pt-8`}>
        {/* Recomendados del chef */}
        {!loading && !searching && featuredItems.length > 0 && (
          <section aria-labelledby="featured-title" className="mb-10">
            <SectionTitle id="featured-title" eyebrow="Selección de la casa" title="Recomendados del chef" />
            <div className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
              {featuredItems.map((item) =>
                menuStyle === 'photos' ? (
                  <ShowcaseCard
                    key={item.id}
                    item={item}
                    badgeIcon={<Star className="h-3 w-3" aria-hidden="true" />}
                    badgeLabel="Recomendado"
                    qty={cartQty(item.id)}
                    currencySymbol={currencySymbol}
                    onOpen={() => openDetail(item)}
                    onAdd={() => addToCart(item)}
                    onInc={() => change(item.id, 1)}
                    onDec={() => change(item.id, -1)}
                  />
                ) : (
                  <TextShowcaseCard
                    key={item.id}
                    item={item}
                    qty={cartQty(item.id)}
                    customTags={customTags}
                    currencySymbol={currencySymbol}
                    onOpen={() => openDetail(item)}
                    onAdd={() => addToCart(item)}
                    onInc={() => change(item.id, 1)}
                    onDec={() => change(item.id, -1)}
                  />
                ),
              )}
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
                className={`${menuStyle === 'list' ? 'mb-8' : 'mb-10'} scroll-mt-40`}
              >
                <SectionTitle
                  id={`categoria-title-${category.id}`}
                  eyebrow="Categoría"
                  title={category.name}
                  count={sectionItems.length}
                  countLabel={sectionItems.length === 1 ? 'producto' : 'productos'}
                />
                <div
                  className={
                    menuStyle === 'photos'
                      ? 'grid grid-cols-1 gap-4 sm:gap-4 lg:grid-cols-3'
                      : 'overflow-hidden rounded-2xl border border-slate-200/80 bg-white divide-y divide-slate-100'
                  }
                >
                  {sectionItems.map((item) => {
                    const qty = cartQty(item.id);
                    if (menuStyle === 'list') {
                      return (
                        <MenuListRow
                          key={item.id}
                          item={item}
                          qty={qty}
                          customTags={customTags}
                          currencySymbol={currencySymbol}
                          onOpen={() => openDetail(item)}
                          onAdd={() => addToCart(item)}
                          onInc={() => change(item.id, 1)}
                          onDec={() => change(item.id, -1)}
                        />
                      );
                    }
                    return (
              <article key={item.id} className="bg-white rounded-2xl border border-slate-200/80 flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
                <button
                  onClick={() => openDetail(item)}
                  className="relative block h-44 w-full bg-gradient-to-br from-amber-50 to-slate-100 sm:h-44"
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
                  <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1 font-bold text-slate-900 shadow-md backdrop-blur">
                    {money(item.price)}
                  </span>
                </button>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="break-words line-clamp-2 font-bold leading-snug text-slate-800" title={item.name}>{item.name}</h3>
                  {item.description && (
                    <p className="line-clamp-2 text-xs text-slate-500">{item.description}</p>
                  )}
                  <TagList tags={item.tags} limit={3} customTags={customTags} />
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <button
                      onClick={() => openDetail(item)}
                      className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      Detalle
                    </button>
                    {qty > 0 ? (
                      <div className="ml-auto flex items-center gap-1 rounded-xl bg-slate-950 p-1">
                        <button
                          onClick={() => change(item.id, -1)}
                          aria-label={`Quitar una unidad de ${item.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="w-7 text-center font-bold text-white" aria-live="polite">{qty}</span>
                        <button
                          onClick={() => change(item.id, 1)}
                          aria-label={`Agregar una unidad de ${item.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white transition-colors hover:bg-teal-400"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        aria-label={`Agregar ${item.name} al pedido`}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 active:scale-95"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              </article>
                    );
                  })}
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
        <section className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-5 sm:pb-5">
          <div className={`mx-auto ${menuWidth} max-h-[85dvh] overflow-y-auto rounded-2xl bg-slate-950 p-4 text-white shadow-2xl sm:p-5`}>
            <div className="flex flex-col gap-3">
              <div className="min-w-0" aria-live="polite">
                <p className="flex items-center gap-2 font-bold">
                  Tu pedido
                  <span className="inline-flex items-center rounded-full bg-teal-500 px-2 py-0.5 text-xs font-bold text-white">
                    {cartCount} {cartCount === 1 ? 'item' : 'items'}
                  </span>
                  <span className="ml-auto text-xl font-black">{money(total)}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cart.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex max-w-full items-center gap-2 bg-white/10 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm"
                    >
                      <button
                        onClick={() => change(item.id, -1)}
                        aria-label={`Quitar una unidad de ${item.name}`}
                        className="w-6 h-6 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded transition-colors text-white"
                      >
                        <Minus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="truncate font-medium text-white">
                        {item.quantity}× {item.name}
                      </span>
                      {item.notes && (
                        <span title={item.notes} className="text-white/50">
                          <StickyNote className="h-3 w-3" aria-label={`Notas: ${item.notes}`} />
                        </span>
                      )}
                      <button
                        onClick={() => change(item.id, 1)}
                        aria-label={`Agregar una unidad de ${item.name}`}
                        className="w-6 h-6 flex items-center justify-center bg-teal-500 hover:bg-teal-400 rounded transition-colors text-white"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Eliminar ${item.name} del pedido`}
                        className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-rose-500/40 rounded transition-colors text-white/70 hover:text-white"
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
                  className="flex-1 px-3 py-2.5 border border-white/15 rounded-xl text-sm bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                />
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="sm:w-auto px-6 py-3 bg-teal-500 hover:bg-teal-400 disabled:bg-white/15 disabled:text-white/50 text-white rounded-xl font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Enviar pedido · {money(total)}
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
            {menuStyle === 'photos' && (
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
            )}

            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 id="detail-title" className="text-xl font-bold leading-snug text-slate-800">
                  {detailItem.name}
                </h2>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="whitespace-nowrap text-lg font-bold text-indigo-600">
                    {money(detailItem.price)}
                  </span>
                  {menuStyle === 'list' && (
                    <button
                      onClick={closeDetail}
                      aria-label="Cerrar detalle"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
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
                Agregar {detailQty} · {money(detailQty * detailItem.price)}
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
              {publicToken
                ? 'Necesitamos este dato para enviar tu pedido al salón correcto.'
                : 'Este link es solo para ver el menú. Para enviar un pedido, escaneá el QR impreso en tu mesa.'}
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

            {loading && tableTyped && (
              <p className="text-sm text-slate-400 mt-2">Buscando tu mesa…</p>
            )}
            {!loading && tableTyped && tableMatches.length === 0 && (
              <p role="alert" className="text-sm text-rose-600 font-medium mt-2">
                La mesa {table} no existe. Revisá el número.
              </p>
            )}

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
                      {zoneNameOf(t.zone)}
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
