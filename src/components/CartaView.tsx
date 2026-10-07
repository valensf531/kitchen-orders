'use client';

/* Vitrina pública de solo lectura (para Instagram/WhatsApp): sin carrito,
   sin mesas y sin POST. Reutiliza el mismo payload que /menu. */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Flame,
  ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  Search,
  Star,
  UtensilsCrossed,
  X,
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

function DishCard({ item, customTags, onOpen }: { item: Item; customTags: CustomTag[]; onOpen: () => void }) {
  return (
    <article className="bg-white rounded-xl border border-slate-200 flex w-56 shrink-0 snap-start flex-col overflow-hidden sm:w-64">
      <button onClick={onOpen} className="relative block h-32 w-full bg-slate-100" aria-label={`Ver ${item.name}`}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api); next/image no optimiza ni abarata aquí.
          <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
          </span>
        )}
        {item.featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
            <Star className="h-3 w-3" aria-hidden="true" />
            Recomendado
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="break-words line-clamp-2 font-semibold leading-snug text-slate-800" title={item.name}>
            {item.name}
          </span>
          <span className="whitespace-nowrap font-semibold text-indigo-600">${item.price.toFixed(2)}</span>
        </div>
        {item.description && <p className="line-clamp-2 text-xs text-slate-500">{item.description}</p>}
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} meta={resolveTagMeta(tag, customTags)} />
          ))}
        </div>
      </div>
    </article>
  );
}

export function CartaView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [branding, setBranding] = useState<{ name: string; logoUrl: string | null }>({ name: '', logoUrl: null });
  const [popular, setPopular] = useState<{ id: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const restaurant = new URLSearchParams(window.location.search).get('restaurant') ?? '';
    const query = restaurant ? `?restaurant=${encodeURIComponent(restaurant)}` : '';
    fetch(`/api/public/menu${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.error) {
          setError(typeof data.error === 'string' ? data.error : 'No se pudo cargar la carta');
          return;
        }
        setCategories(data.categories ?? []);
        setBranding({
          name: typeof data.branding?.name === 'string' ? data.branding.name : '',
          logoUrl: typeof data.branding?.logoUrl === 'string' ? data.branding.logoUrl : null,
        });
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
      .catch(() => active && setError('No se pudo cargar la carta'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const query = search.trim().toLowerCase();
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !query ||
          item.name.toLowerCase().includes(query) ||
          (item.description ?? '').toLowerCase().includes(query),
      ),
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

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = encodeURIComponent('Mirá nuestra carta 🍽️');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Portapapeles no disponible: el link queda visible abajo. */
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300 mx-auto" />
          <p className="text-slate-500 mt-3">Cargando la carta…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">No se pudo cargar la carta</p>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-slate-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo del restaurante (data URL); next/image no aplica.
            <img src={branding.logoUrl} alt={branding.name || 'Logo'} className="w-16 h-16 rounded-xl object-contain bg-white mx-auto" />
          ) : (
          <UtensilsCrossed className="w-8 h-8 mx-auto text-amber-300" aria-hidden="true" />
          )}
          <h1 className="text-2xl sm:text-3xl font-black mt-2">{branding.name || 'Nuestra carta'}</h1>
          <p className="text-slate-300 text-sm mt-1">Platos, precios y fotos · solo para mirar 😋</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <a
              href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? '¡Copiado!' : 'Copiar link'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar platos…"
            aria-label="Buscar platos"
            className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {featuredItems.length > 0 && !query && (
          <section aria-label="Recomendados">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">
              <Star className="w-4 h-4 text-amber-500" /> Recomendados
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
              {featuredItems.map((item) => (
                <DishCard key={item.id} item={item} customTags={customTags} onOpen={() => setDetailItem(item)} />
              ))}
            </div>
          </section>
        )}

        {popularList.length > 0 && !query && (
          <section aria-label="Los más pedidos">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">
              <Flame className="w-4 h-4 text-orange-500" /> Los más pedidos
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
              {popularList.map(({ item }) => (
                <DishCard key={item.id} item={item} customTags={customTags} onOpen={() => setDetailItem(item)} />
              ))}
            </div>
          </section>
        )}

        {sections.length === 0 ? (
          <p className="text-center text-slate-400 py-12">
            {query ? 'Sin resultados para tu búsqueda.' : 'Todavía no hay platos en la carta.'}
          </p>
        ) : (
          sections.map(({ category, sectionItems }) => (
            <section key={category.id} aria-label={category.name}>
              <h2 className="text-lg font-bold text-slate-800 mb-3">
                {category.name}{' '}
                <span className="text-xs font-medium text-slate-400">({sectionItems.length})</span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {sectionItems.map((item) => (
                  <article
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden flex gap-3 p-3"
                  >
                    <button
                      onClick={() => setDetailItem(item)}
                      className="relative block h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-slate-100"
                      aria-label={`Ver ${item.name}`}
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api); next/image no optimiza ni abarata aquí.
                        <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-slate-300" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-800 leading-snug break-words">{item.name}</p>
                        <p className="whitespace-nowrap font-semibold text-indigo-600">${item.price.toFixed(2)}</p>
                      </div>
                      {item.description && (
                        <p className="line-clamp-2 text-xs text-slate-500 mt-0.5">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.tags.slice(0, 3).map((tag) => (
                          <TagBadge key={tag} meta={resolveTagMeta(tag, customTags)} />
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {detailItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDetailItem(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="carta-detail-title"
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-44 w-full bg-slate-100">
              {detailItem.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto de usuario (data:/externa//api); next/image no optimiza ni abarata aquí.
                <img src={detailItem.imageUrl} alt={detailItem.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-slate-300" aria-hidden="true" />
                </span>
              )}
              <button
                onClick={() => setDetailItem(null)}
                aria-label="Cerrar detalle"
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 id="carta-detail-title" className="text-lg font-bold text-slate-800">
                  {detailItem.name}
                </h2>
                <p className="whitespace-nowrap text-lg font-bold text-indigo-600">
                  ${detailItem.price.toFixed(2)}
                </p>
              </div>
              {detailItem.description && (
                <p className="text-sm text-slate-600 mt-2">{detailItem.description}</p>
              )}
              {detailItem.ingredients && (
                <p className="text-xs text-slate-400 mt-2">{detailItem.ingredients}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {detailItem.tags.map((tag) => (
                  <TagBadge key={tag} meta={resolveTagMeta(tag, customTags)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
