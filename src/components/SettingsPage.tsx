'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Settings, MapPin, Plus, Edit3, Trash2, X, Loader2, Check, DollarSign, Sparkles, Star, ImagePlus, ImageIcon, Users, KeyRound, QrCode, UtensilsCrossed, Tags, Printer, Download, Dices, Copy, Eye, EyeOff, AlertCircle, ChevronUp, ChevronDown, Palette, ExternalLink } from 'lucide-react';
import { Zone } from '@/types/table';
import { normalizeMenuStyle, type MenuStyle } from '@/lib/menu-style';
import {
  DEFAULT_CURRENCY_CODE,
  DEFAULT_CURRENCY_SYMBOL,
  DEFAULT_TIMEZONE,
} from '@/lib/locale';
import {
  DEFAULT_MENU_THEME,
  MAX_CUSTOM_THEME_NAME,
  MENU_THEME_PRESETS,
  THEME_KEYS,
  normalizeMenuTheme,
  sameMenuTheme,
  themeStyle,
  type CustomMenuTheme,
  type MenuTheme,
} from '@/lib/menu-theme';
import { TableCardPreview } from './TableCardPreview';
import {
  buildTableMenuUrl,
  buildTableCardPNG,
  downloadDataUrl,
  openPrintWindow,
  tableCardsPrintSheetHtml,
  type TableCardData,
} from '@/lib/table-card';
import {
  PREDEFINED_TAGS,
  TAG_TONES,
  TAG_TONE_BADGE_CLASSES,
  TAG_TONE_SOLID_CLASSES,
  resolveTagMeta,
  type CustomTag,
  type TagMeta,
} from '@/lib/menu-tags';

interface MenuCategory {
  id: string;
  name: string;
  order: number;
  kind: 'food' | 'drink';
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  available: boolean;
  imageUrl?: string;
  description?: string;
  ingredients?: string;
  tags: string[];
  featured: boolean;
}

type ConfigTab = 'zones' | 'menu' | 'appearance' | 'tags' | 'qrs' | 'staff';

const CONFIG_TABS: { id: ConfigTab; label: string; icon: typeof MapPin; hint: string }[] = [
  { id: 'zones', label: 'Local', icon: MapPin, hint: 'Zonas del salón' },
  { id: 'menu', label: 'Menú', icon: UtensilsCrossed, hint: 'Categorías y productos' },
  { id: 'appearance', label: 'Apariencia', icon: Palette, hint: 'Estilo y colores del menú' },
  { id: 'tags', label: 'Etiquetas', icon: Tags, hint: 'Sellos de los productos' },
  { id: 'qrs', label: 'QRs', icon: QrCode, hint: 'Para mesas y redes' },
  { id: 'staff', label: 'Personal', icon: Users, hint: 'Vendedores y cocineros' },
];

const THEME_COLOR_FIELDS: { key: keyof MenuTheme; label: string }[] = [
  { key: 'primary', label: 'Principal' },
  { key: 'accent', label: 'Acento' },
  { key: 'background', label: 'Fondo' },
  { key: 'surface', label: 'Superficie' },
  { key: 'text', label: 'Texto' },
];

function readCustomTheme(value: unknown): CustomMenuTheme | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { name?: unknown; theme?: unknown };
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name) return null;
  return { name, theme: normalizeMenuTheme(record.theme) };
}

function SectionHeader({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
      </div>
      {action}
    </div>
  );
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'kitchen';
  createdAt: string;
}

function TagBadge({ meta }: { meta: TagMeta }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TAG_TONE_BADGE_CLASSES[meta.tone]}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

/* Lee un archivo de imagen, lo reescala a máx. 1024px y lo devuelve como JPEG
   en data URL, para guardarlo directo en la base (sin storage externo). */
function compressImageToDataUrl(file: File, maxSize = 1024, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('image'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('reader'));
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('zones');
  const [zones, setZones] = useState<Zone[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingZones, setLoadingZones] = useState(true);
  const [zonesLoadError, setZonesLoadError] = useState('');
  const [menuLoadError, setMenuLoadError] = useState('');
  const [submittingZone, setSubmittingZone] = useState(false);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [submittingTag, setSubmittingTag] = useState(false);
  const [zoneError, setZoneError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [itemError, setItemError] = useState('');
  /* Aviso visible para acciones fuera de modales (borrados, toggle). */
  const [actionNotice, setActionNotice] = useState('');
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState('');
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [deletingItemBusy, setDeletingItemBusy] = useState(false);
  const [deleteItemError, setDeleteItemError] = useState('');
  const [reorderingCategories, setReorderingCategories] = useState(false);

  /* Acceso efectivo (restaurante + rol) y personal vinculado. */
  const [restaurantId, setRestaurantId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [copiedStaffPassword, setCopiedStaffPassword] = useState(false);
  const [newStaffKind, setNewStaffKind] = useState<'staff' | 'kitchen'>('staff');
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffNotice, setStaffNotice] = useState('');

  /* Marca del restaurante (nombre + logo para tarjetas y menú público). */
  const [brandingName, setBrandingName] = useState('');
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_CURRENCY_CODE);
  const [currencySymbol, setCurrencySymbol] = useState(DEFAULT_CURRENCY_SYMBOL);
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const publicOrigin: string =
    publicBaseUrl ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingError, setBrandingError] = useState('');
  const [brandingNotice, setBrandingNotice] = useState('');
  const [logoError, setLogoError] = useState('');
  const [menuStyle, setMenuStyle] = useState<MenuStyle>('photos');
  const [savingMenuStyle, setSavingMenuStyle] = useState(false);
  const [menuStyleError, setMenuStyleError] = useState('');
  const [menuStyleNotice, setMenuStyleNotice] = useState('');
  const [menuTheme, setMenuTheme] = useState<MenuTheme>(DEFAULT_MENU_THEME);
  const [customTheme, setCustomTheme] = useState<CustomMenuTheme | null>(null);
  const [customThemeName, setCustomThemeName] = useState('');
  const [customThemeDraft, setCustomThemeDraft] = useState<MenuTheme>(DEFAULT_MENU_THEME);
  const [customThemeEditorOpen, setCustomThemeEditorOpen] = useState(false);
  const [savingMenuTheme, setSavingMenuTheme] = useState(false);
  const [menuThemeError, setMenuThemeError] = useState('');
  const [menuThemeNotice, setMenuThemeNotice] = useState('');

  /* Mesas + tarjeta seleccionada para previsualizar/descargar. */
  const [tables, setTables] = useState<{ id: string; number: number; zone: string; publicToken?: string }[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [cardZone, setCardZone] = useState('');
  const [cardTableId, setCardTableId] = useState('');
  const [cardQr, setCardQr] = useState('');
  const [generatingCard, setGeneratingCard] = useState(false);
  const [cardError, setCardError] = useState('');

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.publicBaseUrl === 'string' && data.publicBaseUrl.trim()) {
        setPublicBaseUrl(data.publicBaseUrl.trim().replace(/\/+$/, ''));
      }
      setBrandingName(data.branding?.name ?? '');
      setBrandingLogo(data.branding?.logoUrl ?? null);
      setTimezone(data.branding?.timezone ?? DEFAULT_TIMEZONE);
      setCurrencyCode(data.branding?.currencyCode ?? DEFAULT_CURRENCY_CODE);
      setCurrencySymbol(data.branding?.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL);
      setMenuStyle(normalizeMenuStyle(data.branding?.menuStyle));
      setMenuTheme(normalizeMenuTheme(data.branding?.theme));
      const savedCustom = readCustomTheme(data.branding?.customTheme);
      setCustomTheme(savedCustom);
      setCustomThemeName(savedCustom?.name ?? '');
      setCustomThemeDraft(savedCustom?.theme ?? normalizeMenuTheme(data.branding?.theme));
    } catch {
      /* Sin marca: se usa el fallback. */
    } finally {
      setBrandingLoaded(true);
    }
  };

  const fetchTables = async () => {
    setLoadingTables(true);
    try {
      const res = await fetch('/api/tables');
      if (!res.ok) return;
      const data = await res.json();
      setTables(data.tables ?? []);
    } catch {
      /* Sin mesas: se muestra vacío. */
    } finally {
      setLoadingTables(false);
    }
  };

  const handleLogoChange = async (file: File | undefined) => {
    setLogoError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('El archivo seleccionado no es una imagen');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLogoError('La imagen es demasiado grande (máx. 10 MB)');
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file, 512, 0.85);
      setBrandingLogo(dataUrl);
    } catch {
      setLogoError('No se pudo procesar el logo. Probá con otra imagen.');
    }
  };

  const handleSaveBranding = async () => {
    setBrandingError('');
    setBrandingNotice('');
    setSavingBranding(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: brandingName,
          logoUrl: brandingLogo,
          timezone,
          currencyCode,
          currencySymbol,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBrandingError(data?.error ?? 'No se pudo guardar la marca');
        return;
      }
      setBrandingName(data.branding?.name ?? '');
      setBrandingLogo(data.branding?.logoUrl ?? null);
      setTimezone(data.branding?.timezone ?? DEFAULT_TIMEZONE);
      setCurrencyCode(data.branding?.currencyCode ?? DEFAULT_CURRENCY_CODE);
      setCurrencySymbol(data.branding?.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL);
      setMenuStyle(normalizeMenuStyle(data.branding?.menuStyle));
      setMenuTheme(normalizeMenuTheme(data.branding?.theme));
      const savedCustom = readCustomTheme(data.branding?.customTheme);
      setCustomTheme(savedCustom);
      setCustomThemeName(savedCustom?.name ?? '');
      setCustomThemeDraft(savedCustom?.theme ?? normalizeMenuTheme(data.branding?.theme));
      setBrandingNotice('Marca y configuración regional guardadas.');
    } catch {
      setBrandingError('Error de red. Intentá de nuevo.');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleMenuStyleChange = async (style: MenuStyle) => {
    if (savingMenuStyle || style === menuStyle) return;
    const previous = menuStyle;
    setMenuStyle(style);
    setSavingMenuStyle(true);
    setMenuStyleError('');
    setMenuStyleNotice('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuStyle: style }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMenuStyle(previous);
        setMenuStyleError(data?.error ?? 'No se pudo guardar el estilo del menú.');
        return;
      }
      setMenuStyle(normalizeMenuStyle(data?.branding?.menuStyle));
      setMenuTheme(normalizeMenuTheme(data?.branding?.theme));
      setMenuStyleNotice('Estilo guardado. Ya se aplica en el menú público.');
    } catch {
      setMenuStyle(previous);
      setMenuStyleError('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSavingMenuStyle(false);
    }
  };

  const updateThemeColor = (key: keyof MenuTheme, value: string) => {
    setCustomThemeDraft((current) => ({ ...current, [key]: value }));
    setMenuThemeError('');
    setMenuThemeNotice('');
  };

  const openCustomThemeEditor = () => {
    if (customTheme) {
      setCustomThemeName(customTheme.name);
      setCustomThemeDraft({ ...customTheme.theme });
    } else {
      setCustomThemeName('');
      setCustomThemeDraft({ ...menuTheme });
    }
    setMenuThemeError('');
    setMenuThemeNotice('');
    setCustomThemeEditorOpen(true);
  };

  const closeCustomThemeEditor = () => {
    setCustomThemeEditorOpen(false);
    setMenuThemeError('');
  };

  const handleApplyTheme = async (theme: MenuTheme) => {
    if (savingMenuTheme) return;
    const previous = menuTheme;
    setMenuTheme({ ...theme });
    setCustomThemeEditorOpen(false);
    setSavingMenuTheme(true);
    setMenuThemeError('');
    setMenuThemeNotice('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMenuTheme(previous);
        setMenuThemeError(data?.error ?? 'No se pudo aplicar el tema.');
        return;
      }
      setMenuTheme(normalizeMenuTheme(data?.branding?.theme));
      setCustomTheme(readCustomTheme(data?.branding?.customTheme));
      setMenuThemeNotice('Tema aplicado.');
    } catch {
      setMenuTheme(previous);
      setMenuThemeError('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSavingMenuTheme(false);
    }
  };

  const handleSaveCustomTheme = async () => {
    const name = customThemeName.trim();
    if (!name) {
      setMenuThemeError('Poné un nombre para tu tema personalizado.');
      return;
    }
    if (savingMenuTheme) return;
    const theme = { ...customThemeDraft };
    setSavingMenuTheme(true);
    setMenuThemeError('');
    setMenuThemeNotice('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          customTheme: { name, theme },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMenuThemeError(data?.error ?? 'No se pudo guardar el tema personalizado.');
        return;
      }
      setMenuTheme(normalizeMenuTheme(data?.branding?.theme));
      const savedCustom = readCustomTheme(data?.branding?.customTheme);
      setCustomTheme(savedCustom);
      setCustomThemeName(savedCustom?.name ?? name);
      setCustomThemeDraft(savedCustom?.theme ?? theme);
      setCustomThemeEditorOpen(false);
      setMenuThemeNotice(`Tema "${savedCustom?.name ?? name}" guardado y aplicado.`);
    } catch {
      setMenuThemeError('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSavingMenuTheme(false);
    }
  };

  const activeThemePreset = MENU_THEME_PRESETS.find((preset) =>
    sameMenuTheme(menuTheme, preset.theme),
  )?.id;
  const customThemeActive = customTheme ? sameMenuTheme(menuTheme, customTheme.theme) : false;

  const fetchStaff = async () => {
    setLoadingStaff(true);
    setStaffError('');
    try {
      const res = await fetch('/api/users');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStaffError(data?.error ?? 'No se pudo cargar el personal. Recargá la página.');
        return;
      }
      const data = await res.json();
      setStaff(data.staff ?? []);
    } catch {
      setStaffError('Error de red al cargar el personal. Recargá la página.');
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/access')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setRestaurantId(data.restaurantId ?? '');
        setIsAdmin(Boolean(data.isAdmin));
        if (data.isAdmin) void fetchStaff();
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAccessLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  /* Contraseña aleatoria segura (12 caracteres sin ambiguos) para
     cuentas nuevas: el admin la comparte con el empleado. */
  const generateStaffPassword = () => {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = new Uint32Array(12);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  };

  const handleGenerateStaffPassword = () => {
    setNewStaffPassword(generateStaffPassword());
    setShowStaffPassword(true);
    setCopiedStaffPassword(false);
  };

  const handleCopyStaffPassword = async () => {
    if (!newStaffPassword) return;
    try {
      await navigator.clipboard.writeText(newStaffPassword);
      setCopiedStaffPassword(true);
      setTimeout(() => setCopiedStaffPassword(false), 2000);
    } catch {
      /* Portapapeles no disponible: la contraseña queda visible arriba. */
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');
    setStaffNotice('');
    setSubmittingStaff(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStaffName,
          email: newStaffEmail,
          password: newStaffPassword || undefined,
          kind: newStaffKind,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStaffError(data.error ?? 'No se pudo agregar');
        return;
      }
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setShowStaffPassword(false);
      setCopiedStaffPassword(false);
      const kindLabel = newStaffKind === 'kitchen' ? 'cocinero' : 'vendedor';
      setStaffNotice(data.linked ? `Cuenta vinculada como ${kindLabel}.` : `Cuenta de ${kindLabel} creada.`);
      await fetchStaff();
    } catch {
      setStaffError('Error de red. Intentá de nuevo.');
    } finally {
      setSubmittingStaff(false);
    }
  };

  /* Cambio de contraseña propio (better-auth verifica la actual). */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordNotice('');
    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setSubmittingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPasswordError(
          res.status === 401 || res.status === 400
            ? 'La contraseña actual no es correcta.'
            : (data?.message ?? 'No se pudo cambiar la contraseña.'),
        );
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setPasswordNotice('Contraseña actualizada. Se cerraron tus otras sesiones.');
    } catch {
      setPasswordError('Error de red. Intentá de nuevo.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`¿Quitar el acceso a ${name}? Ya no podrá entrar al restaurante.`)) return;
    setStaffError('');
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setStaffError('No se pudo quitar el acceso.');
        return;
      }
      await fetchStaff();
    } catch {
      setStaffError('Error de red. Intentá de nuevo.');
    }
  };

  const handleChangeStaffRole = async (id: string, role: 'staff' | 'kitchen') => {
    setStaffError('');
    setStaffNotice('');
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        setStaffError('No se pudo cambiar el rol.');
        return;
      }
      setStaff(prev => prev.map(member => member.id === id ? { ...member, role } : member));
      setStaffNotice(role === 'kitchen' ? 'Rol cambiado a cocina.' : 'Rol cambiado a vendedor.');
    } catch {
      setStaffError('Error de red. Intentá de nuevo.');
    }
  };

  const handleResetStaffPassword = async (member: StaffMember) => {
    const password = generateStaffPassword();
    if (
      !window.confirm(
        `¿Resetear la contraseña de ${member.name}? Se cerrarán sus sesiones abiertas.`,
      )
    ) {
      return;
    }
    setStaffError('');
    setStaffNotice('');
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setStaffError('No se pudo resetear la contraseña.');
        return;
      }
      setStaffNotice(`Contraseña nueva de ${member.name}: ${password} (copiala ahora).`);
    } catch {
      setStaffError('Error de red. Intentá de nuevo.');
    }
  };

  const [newZoneName, setNewZoneName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKind, setNewCategoryKind] = useState<'food' | 'drink'>('food');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemIngredients, setNewItemIngredients] = useState('');
  const [newItemTags, setNewItemTags] = useState<string[]>([]);
  const [newItemFeatured, setNewItemFeatured] = useState(false);
  const [imageError, setImageError] = useState('');

  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagIcon, setNewTagIcon] = useState('');
  const [newTagTone, setNewTagTone] = useState('stone');
  const [tagError, setTagError] = useState('');

  useEffect(() => {
    if (!accessLoaded || !isAdmin) return;
    loadZones();
    loadMenuData();
    void fetchBranding();
    void fetchTables();
  }, [accessLoaded, isAdmin]);

  /* QR de la tarjeta seleccionada (URL con restaurante + mesa). */
  useEffect(() => {
    let active = true;
    if (!restaurantId || !cardTableId) {
      setCardQr('');
      return;
    }
    const table = tables.find((t) => t.id === cardTableId);
    if (!table) {
      setCardQr('');
      return;
    }
    if (!table.publicToken) {
      setCardError('No se pudo firmar el QR. Recargá la página e intentá de nuevo.');
      setGeneratingCard(false);
      return;
    }
    setGeneratingCard(true);
    setCardError('');
    QRCode.toDataURL(
      buildTableMenuUrl(publicOrigin, restaurantId, table.number, table.publicToken),
      {
        width: 520,
        margin: 1,
      },
    )
      .then((url) => {
        if (active) setCardQr(url);
      })
      .catch(() => {
        if (active) setCardError('No se pudo generar el QR.');
      })
      .finally(() => {
        if (active) setGeneratingCard(false);
      });
    return () => {
      active = false;
    };
  }, [restaurantId, cardTableId, tables, publicOrigin]);

  const selectedCardTable = tables.find((t) => t.id === cardTableId) ?? null;
  const selectedZoneName =
    zones.find((z) => z.slug === selectedCardTable?.zone)?.name ?? selectedCardTable?.zone ?? cardZone;

  const handleDownloadCard = async () => {
    if (!selectedCardTable || !cardQr) return;
    try {
      const png = await buildTableCardPNG(
        { qrDataUrl: cardQr, zoneName: selectedZoneName, tableNumber: selectedCardTable.number },
        { restaurantName: brandingName, logoUrl: brandingLogo },
      );
      downloadDataUrl(png, `mesa-${selectedCardTable.number}.png`);
    } catch {
      setCardError('No se pudo generar la imagen.');
    }
  };

  const handlePrintCard = () => {
    if (!selectedCardTable || !cardQr) return;
    openPrintWindow(
      tableCardsPrintSheetHtml(
        [{ qrDataUrl: cardQr, zoneName: selectedZoneName, tableNumber: selectedCardTable.number }],
        { restaurantName: brandingName, logoUrl: brandingLogo },
      ),
    );
  };

  const handlePrintAll = async () => {
    if (tables.length === 0) return;
    setGeneratingCard(true);
    try {
      const cards: TableCardData[] = [];
      for (const table of tables) {
        if (!table.publicToken) {
          throw new Error('missing-token');
        }
        const qr = await QRCode.toDataURL(
          buildTableMenuUrl(publicOrigin, restaurantId, table.number, table.publicToken),
          {
            width: 520,
            margin: 1,
          },
        );
        const zoneName = zones.find((z) => z.slug === table.zone)?.name ?? table.zone;
        cards.push({ qrDataUrl: qr, zoneName, tableNumber: table.number });
      }
      openPrintWindow(tableCardsPrintSheetHtml(cards, { restaurantName: brandingName, logoUrl: brandingLogo }));
    } catch {
      setCardError('No se pudieron generar las tarjetas.');
    } finally {
      setGeneratingCard(false);
    }
  };

  const loadZones = async () => {
    setLoadingZones(true);
    setZonesLoadError('');
    try {
      const res = await fetch('/api/zones');
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
      } else {
        setZonesLoadError('No se pudieron cargar las zonas.');
      }
    } catch {
      setZonesLoadError('Error de red al cargar las zonas.');
    } finally {
      setLoadingZones(false);
    }
  };

  const loadMenuData = async () => {
    setLoading(true);
    setMenuLoadError('');
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setMenuItems((data.items || []).map((item: MenuItem) => ({
          ...item,
          tags: Array.isArray(item.tags) ? item.tags : [],
          featured: Boolean(item.featured),
        })));
        setCustomTags(data.tags || []);
        if (data.categories?.length > 0) {
          setNewItemCategory(data.categories[0].id);
        }
      } else {
        setMenuLoadError('No se pudo cargar el menú.');
      }
    } catch {
      setMenuLoadError('Error de red al cargar el menú.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZone = async () => {
    if (!newZoneName.trim() || submittingZone) return;
    setSubmittingZone(true);
    setZoneError('');

    const readError = async (res: Response, fallback: string) => {
      if (res.status === 409) return 'Ya existe una zona con un nombre similar.';
      const data = await res.json().catch(() => null);
      return (data?.error as string | undefined) ?? fallback;
    };

    let saved = false;
    try {
      if (editingZone) {
        const res = await fetch(`/api/zones/${editingZone.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newZoneName }),
        });
        if (res.ok) {
          const data = await res.json();
          setZones(prev => prev.map(z => z.id === editingZone.id ? data.zone : z));
          /* Renombrar puede cambiar el slug: las mesas migran en el
             backend, así que se refrescan para no mostrar datos viejos. */
          void fetchTables();
          saved = true;
        } else {
          setZoneError(await readError(res, 'No se pudo guardar la zona.'));
        }
      } else {
        const res = await fetch('/api/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newZoneName }),
        });
        if (res.ok) {
          const data = await res.json();
          setZones(prev => [...prev, data.zone]);
          saved = true;
        } else {
          setZoneError(await readError(res, 'No se pudo crear la zona.'));
        }
      }
    } catch {
      setZoneError('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSubmittingZone(false);
    }

    if (!saved) return;

    setShowZoneModal(false);
    setEditingZone(null);
    setNewZoneName('');
    setZoneError('');
  };

  const handleDeleteZone = async (id: string) => {
    const zone = zones.find((z) => z.id === id);
    const mesaCount = zone ? tables.filter((t) => t.zone === zone.slug).length : 0;
    const warning =
      mesaCount > 0
        ? `¿Eliminar la zona "${zone?.name}"? También se eliminarán sus ${mesaCount} mesa(s).`
        : `¿Estás seguro de eliminar esta zona?`;
    if (confirm(warning)) {
      setActionNotice('');
      try {
        const res = await fetch(`/api/zones/${id}`, { method: 'DELETE' });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const removedSlugs = zone ? [zone.slug] : [];
          setZones(prev => prev.filter(z => z.id !== id));
          /* Las mesas en cascada ya no existen en el backend. */
          if (removedSlugs.length > 0 || typeof data?.tablesDeleted === 'number') {
            setTables(prev => prev.filter(t => !removedSlugs.includes(t.zone)));
          }
        } else {
          setActionNotice('No se pudo eliminar la zona. Intentá de nuevo.');
        }
      } catch {
        setActionNotice('Error de red. Revisá tu conexión e intentá de nuevo.');
      }
    }
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim() || submittingCategory) return;
    setSubmittingCategory(true);
    setCategoryError('');

    let saved = false;
    try {
      if (editingCategory) {
        const res = await fetch(`/api/menu/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCategoryName, kind: newCategoryKind }),
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(prev => prev.map(c => c.id === editingCategory.id ? data.category : c));
          saved = true;
        } else {
          const data = await res.json().catch(() => null);
          setCategoryError((data?.error as string | undefined) ?? 'No se pudo guardar la categoría.');
        }
      } else {
        const res = await fetch('/api/menu/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCategoryName, kind: newCategoryKind }),
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(prev => [...prev, data.category]);
          if (categories.length === 0) {
            setNewItemCategory(data.category.id);
          }
          saved = true;
        } else {
          const data = await res.json().catch(() => null);
          setCategoryError((data?.error as string | undefined) ?? 'No se pudo crear la categoría.');
        }
      }
    } catch {
      setCategoryError('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSubmittingCategory(false);
    }

    if (!saved) return;

    setShowCategoryModal(false);
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryKind('food');
    setCategoryError('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta categoría? Se eliminarán todos los productos asociados.')) {
      setActionNotice('');
      try {
        const res = await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setCategories(prev => prev.filter(c => c.id !== id));
          setMenuItems(prev => prev.filter(i => i.categoryId !== id));
        } else {
          setActionNotice('No se pudo eliminar la categoría. Intentá de nuevo.');
        }
      } catch {
        setActionNotice('Error de red. Revisá tu conexión e intentá de nuevo.');
      }
    }
  };

  const handleMoveCategory = async (id: string, direction: -1 | 1) => {
    if (reorderingCategories) return;
    const index = categories.findIndex((category) => category.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;

    const previous = categories;
    const next = [...categories];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);

    setCategories(next.map((category, order) => ({ ...category, order })));
    setActionNotice('');
    setReorderingCategories(true);
    try {
      const res = await fetch('/api/menu/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map((category) => category.id) }),
      });
      if (!res.ok) {
        setCategories(previous);
        setActionNotice('No se pudo cambiar el orden. Intentá de nuevo.');
      }
    } catch {
      setCategories(previous);
      setActionNotice('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setReorderingCategories(false);
    }
  };

  const handleImageChange = async (file: File | undefined) => {
    setImageError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('El archivo seleccionado no es una imagen');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError('La imagen es demasiado grande (máx. 10 MB)');
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setNewItemImageUrl(dataUrl);
    } catch {
      setImageError('No se pudo procesar la imagen. Probá con otra foto.');
    }
  };

  const handleSaveItem = async () => {
    if (!newItemName.trim() || !newItemCategory || submittingItem) return;
    const price = Number(newItemPrice.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) {
      setItemError('Ingresá un precio mayor a 0.');
      return;
    }
    setSubmittingItem(true);
    setItemError('');

    const payload = {
      name: newItemName,
      price,
      categoryId: newItemCategory,
      imageUrl: newItemImageUrl || undefined,
      description: newItemDescription.trim() || undefined,
      ingredients: newItemIngredients.trim() || undefined,
      tags: newItemTags,
      featured: newItemFeatured,
    };

    const resetItemForm = () => {
      setShowItemModal(false);
      setEditingItem(null);
      setNewItemName('');
      setNewItemPrice('');
      setNewItemCategory(categories[0]?.id || '');
      setNewItemImageUrl('');
      setNewItemDescription('');
      setNewItemIngredients('');
      setNewItemTags([]);
      setNewItemFeatured(false);
      setImageError('');
      setItemError('');
    };

    try {
      if (editingItem) {
        const res = await fetch(`/api/menu/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setMenuItems(prev => prev.map(i => i.id === editingItem.id ? data.item : i));
          resetItemForm();
        } else {
          const data = await res.json().catch(() => null);
          setItemError((data?.error as string | undefined) ?? 'No se pudo guardar el producto.');
        }
      } else {
        const res = await fetch('/api/menu/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setMenuItems(prev => [...prev, data.item]);
          resetItemForm();
        } else {
          const data = await res.json().catch(() => null);
          setItemError((data?.error as string | undefined) ?? 'No se pudo crear el producto.');
        }
      }
    } catch {
      setItemError('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem || deletingItemBusy) return;
    setDeleteItemError('');
    setDeletingItemBusy(true);
    try {
      const res = await fetch(`/api/menu/items/${deletingItem.id}`, { method: 'DELETE' });
      if (res.ok) {
        setMenuItems(prev => prev.filter(i => i.id !== deletingItem.id));
        setDeletingItem(null);
      } else {
        setDeleteItemError('No se pudo eliminar el producto. Intentá de nuevo.');
      }
    } catch {
      setDeleteItemError('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setDeletingItemBusy(false);
    }
  };

  const handleSeedMenu = async () => {
    setSeeding(true);
    setSeedError('');
    try {
      const res = await fetch('/api/menu/seed', { method: 'POST' });
      if (res.ok) {
        await loadMenuData();
      } else {
        const data = await res.json();
        setSeedError(data.error || 'Error al generar el menú');
      }
    } catch {
      setSeedError('Error al generar el menú');
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleItemAvailability = async (id: string, available: boolean) => {
    setActionNotice('');
    try {
      const res = await fetch(`/api/menu/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !available }),
      });
      if (res.ok) {
        setMenuItems(prev => prev.map(i => i.id === id ? { ...i, available: !available } : i));
      } else {
        setActionNotice('No se pudo cambiar la disponibilidad. Intentá de nuevo.');
      }
    } catch {
      setActionNotice('Error de red. Revisá tu conexión e intentá de nuevo.');
    }
  };

  const handleSaveTag = async () => {
    if (!newTagLabel.trim() || submittingTag) return;
    setSubmittingTag(true);
    setTagError('');

    const payload = {
      label: newTagLabel,
      icon: newTagIcon.trim() || undefined,
      tone: newTagTone,
    };

    let saved = false;
    try {
      if (editingTag) {
        const res = await fetch(`/api/menu/tags/${editingTag.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setCustomTags(prev => prev.map(t => t.id === editingTag.id ? data.tag : t));
          saved = true;
        } else {
          const data = await res.json().catch(() => ({}));
          setTagError(data.error || 'Error al guardar la etiqueta');
        }
      } else {
        const res = await fetch('/api/menu/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setCustomTags(prev => [...prev, data.tag]);
          saved = true;
        } else {
          const data = await res.json().catch(() => ({}));
          setTagError(data.error || 'Error al guardar la etiqueta');
        }
      }
    } catch {
      setTagError('Error al guardar la etiqueta. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSubmittingTag(false);
    }

    if (!saved) return;

    setShowTagModal(false);
    setEditingTag(null);
    setNewTagLabel('');
    setNewTagIcon('');
    setNewTagTone('stone');
  };

  const handleDeleteTag = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta etiqueta? Se quitará de todos los productos que la usan.')) {
      setActionNotice('');
      try {
        const res = await fetch(`/api/menu/tags/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setCustomTags(prev => prev.filter(t => t.id !== id));
          setMenuItems(prev => prev.map(i => ({ ...i, tags: i.tags.filter(tag => tag !== id) })));
        } else {
          setActionNotice('No se pudo eliminar la etiqueta. Intentá de nuevo.');
        }
      } catch {
        setActionNotice('Error de red. Revisá tu conexión e intentá de nuevo.');
      }
    }
  };

  const openEditTag = (tag: CustomTag) => {
    setEditingTag(tag);
    setNewTagLabel(tag.label);
    setNewTagIcon(tag.icon ?? '');
    setNewTagTone(tag.tone ?? 'stone');
    setTagError('');
    setShowTagModal(true);
  };

  const toggleItemTag = (key: string) =>
    setNewItemTags(prev => prev.includes(key) ? prev.filter(tag => tag !== key) : [...prev, key]);

  /* QR del restaurante efectivo (para el personal, el del dueño). */
  const publicMenuUrl = typeof window !== 'undefined' && restaurantId
    ? `${publicOrigin}/menu?restaurant=${encodeURIComponent(restaurantId)}`
    : '';
  /* Vitrina de solo lectura para Instagram/WhatsApp (sin pedido). */
  const cartaUrl = typeof window !== 'undefined' && restaurantId
    ? `${publicOrigin}/carta?restaurant=${encodeURIComponent(restaurantId)}`
    : '';
  const modernMenuUrl = typeof window !== 'undefined' && restaurantId
    ? `${publicOrigin}/menu-cafe?restaurant=${encodeURIComponent(restaurantId)}`
    : '/menu-cafe';

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Configuración</h1>
            <p className="text-xs text-slate-500">Tu cuenta primero, después el restaurante por secciones.</p>
          </div>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-6 mb-2">Tu cuenta</p>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-400" />
              Mi cuenta
            </h2>
            <p className="text-xs text-slate-500 mt-1">Cambiá tu contraseña cuando quieras.</p>
          </div>
          <form onSubmit={handleChangePassword} className="p-4 grid sm:grid-cols-3 gap-3 items-end">
            <label className="block">
              <span className="block text-sm font-medium text-slate-600 mb-1">Contraseña actual</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-600 mb-1">Nueva (mín. 8)</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={submittingPassword}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {submittingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              Cambiar
            </button>
            {passwordError && <p className="text-sm text-rose-600 sm:col-span-3">{passwordError}</p>}
            {passwordNotice && <p className="text-sm text-emerald-600 sm:col-span-3">{passwordNotice}</p>}
          </form>
        </div>

        {!accessLoaded ? (
          <div className="p-6 text-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Cargando permisos…
          </div>
        ) : !isAdmin ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="font-bold text-slate-800">Solo administradores</p>
            <p className="text-sm text-slate-500 mt-1">
              Sos vendedor: podés usar Cocina, Salón y Caja, y cambiar tu contraseña arriba.
              Las zonas, el menú, las etiquetas, los QR y el personal los gestiona un administrador.
            </p>
          </div>
        ) : (
        <>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2 mb-2">Restaurante · solo administradores</p>
        <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex gap-1 mb-6 overflow-x-auto">
          {CONFIG_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count =
              tab.id === 'zones' ? zones.length :
              tab.id === 'menu' ? menuItems.length :
              tab.id === 'tags' ? customTags.length :
              tab.id === 'staff' ? staff.length : null;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setActionNotice(''); }}
                title={tab.hint}
                className={`flex-1 min-w-[104px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
                {typeof count === 'number' && count > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab !== 'qrs' && activeTab !== 'staff' && (
          <p className="text-xs text-slate-400 mb-4">
            {CONFIG_TABS.find((t) => t.id === activeTab)?.hint}
            {activeTab === 'zones' && ' · Las mesas de cada zona se gestionan desde Salón.'}
            {activeTab === 'menu' && ' · Los cambios se reflejan en el QR al instante.'}
            {activeTab === 'appearance' && ' · Los cambios se reflejan en el menú al instante.'}
            {activeTab === 'tags' && ' · Se usan para destacar productos en el menú.'}
          </p>
        )}

        {actionNotice && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="flex-1">{actionNotice}</p>
            <button
              type="button"
              onClick={() => setActionNotice('')}
              aria-label="Cerrar aviso"
              className="p-1 hover:bg-rose-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <SectionHeader
              title={`Zonas del salón${zones.length > 0 ? ` (${zones.length})` : ''}`}
              hint="Ej. Terraza, Adentro, Barra. Cada zona agrupa sus mesas."
              action={
              <button
                onClick={() => { setEditingZone(null); setNewZoneName(''); setZoneError(''); setShowZoneModal(true); }}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all duration-150"
              >
                <Plus className="w-4 h-4" />
                Nueva zona
              </button>
              }
            />

            <div className="divide-y divide-slate-100">
              {loadingZones ? (
                <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
              ) : zonesLoadError ? (
                <div className="p-8 text-center">
                  <p className="font-medium text-slate-700">No se pudieron cargar las zonas</p>
                  <p className="text-sm text-slate-400 mt-1 mb-4">{zonesLoadError} Revisá tu conexión.</p>
                  <button
                    type="button"
                    onClick={() => loadZones()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                  >
                    Reintentar
                  </button>
                </div>
              ) : zones.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-700">Sin zonas todavía</p>
                  <p className="text-sm text-slate-400 mt-1 mb-4">Creá la primera para empezar a cargar mesas.</p>
                </div>
              ) : (
                zones.map((zone) => (
                  <div key={zone.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{zone.name}</p>
                        <p className="text-sm text-slate-400">{zone.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingZone(zone); setNewZoneName(zone.name); setZoneError(''); setShowZoneModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteZone(zone.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'tags' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title={`Tus etiquetas${customTags.length > 0 ? ` (${customTags.length})` : ''}`}
                hint="Crealas una vez y reutilizalas en varios productos."
                action={
                <button
                  onClick={() => { setEditingTag(null); setNewTagLabel(''); setNewTagIcon(''); setNewTagTone('stone'); setTagError(''); setShowTagModal(true); }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all duration-150"
                >
                  <Plus className="w-4 h-4" />
                  Nueva etiqueta
                </button>
                }
              />

              <div className="divide-y divide-slate-100">
                {customTags.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="font-medium text-slate-700">Sin etiquetas propias</p>
                    <p className="text-sm text-slate-400 mt-1">Ej. “De la casa”, “Picante suave”, “Sin gluten”.</p>
                  </div>
                ) : (
                  customTags.map((tag) => {
                    const meta = resolveTagMeta(tag.id, customTags);
                    return (
                      <div key={tag.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${TAG_TONE_SOLID_CLASSES[meta.tone]}`}>
                            {meta.icon}
                          </div>
                          <div>
                            <TagBadge meta={meta} />
                            <p className="text-xs text-slate-400 mt-1">
                              {menuItems.filter(i => i.tags.includes(tag.id)).length} productos la usan
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditTag(tag)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteTag(tag.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader title="Predefinidas" hint="Vienen con el sistema y están siempre disponibles." />
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TAGS.map((tag) => (
                    <TagBadge key={tag.key} meta={tag} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {isAdmin && activeTab === 'staff' && (
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:col-span-3">
              <SectionHeader
                title={`Personal${staff.length > 0 ? ` (${staff.length})` : ''}`}
                hint="Vendedores ven cocina, salón y caja. Cocineros solo cocina."
              />
              <div className="divide-y divide-slate-100">
                {loadingStaff ? (
                  <div className="p-6 flex items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                  </div>
                ) : staff.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-700">Sin personal todavía</p>
                    <p className="text-sm text-slate-400 mt-1">Agregalos con el formulario.</p>
                  </div>
                ) : (
                  staff.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{member.name}</p>
                        <p className="text-xs text-slate-400 truncate">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeStaffRole(member.id, e.target.value as 'staff' | 'kitchen')}
                          aria-label={`Rol de ${member.name}`}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg border uppercase tracking-wide ${
                            member.role === 'kitchen'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-teal-50 text-teal-700 border-teal-200'
                          }`}
                        >
                          <option value="staff">Vendedor</option>
                          <option value="kitchen">Cocina</option>
                        </select>
                        <button
                          onClick={() => handleResetStaffPassword(member)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                          aria-label={`Resetear contraseña de ${member.name}`}
                          title="Resetear contraseña"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(member.id, member.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          aria-label={`Quitar acceso a ${member.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:col-span-2">
              <SectionHeader title="Agregar" hint="Si el email ya existe, se vincula. Si no, se crea." />
              <form onSubmit={handleCreateStaff} className="p-4 space-y-3">
                <div className="grid gap-3">
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-600 mb-1">Nombre</span>
                    <input
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="Ej. María"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-600 mb-1">Email</span>
                    <input
                      type="email"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="maria@ejemplo.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-600 mb-1">Tipo</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewStaffKind('staff')}
                      aria-pressed={newStaffKind === 'staff'}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150 ${
                        newStaffKind === 'staff'
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Vendedor
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewStaffKind('kitchen')}
                      aria-pressed={newStaffKind === 'kitchen'}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150 ${
                        newStaffKind === 'kitchen'
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Cocinero
                    </button>
                  </div>
                  <span className="block text-xs text-slate-400 mt-1">
                    {newStaffKind === 'kitchen' ? 'Solo ve Cocina.' : 'Ve cocina, salón y caja.'}
                  </span>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-600 mb-1">
                    Contraseña <span className="font-normal text-slate-400">(solo si la cuenta no existe · mín. 8)</span>
                  </span>
                  <div className="relative">
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="Solo para cuentas nuevas"
                      autoComplete="new-password"
                      className="w-full pl-3 pr-28 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={handleGenerateStaffPassword}
                        title="Generar contraseña segura"
                        aria-label="Generar contraseña segura"
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        <Dices className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowStaffPassword((v) => !v)}
                        title={showStaffPassword ? 'Ocultar' : 'Mostrar'}
                        aria-label={showStaffPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyStaffPassword}
                        disabled={!newStaffPassword}
                        title="Copiar para compartirla"
                        aria-label="Copiar contraseña"
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {copiedStaffPassword ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <span className="block text-xs text-slate-400 mt-1">
                    {copiedStaffPassword ? '¡Copiada! Compartila con el empleado.' : 'Generala con el dado y compartila con el empleado.'}
                  </span>
                </label>
                {staffError && <p className="text-sm text-rose-600">{staffError}</p>}
                {staffNotice && <p className="text-sm text-emerald-600">{staffNotice}</p>}
                <button
                  type="submit"
                  disabled={submittingStaff}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {submittingStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                  Agregar
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Estilo del menú"
                hint="Elegí cómo se muestran los productos en la carta pública."
                action={
                  savingMenuStyle ? (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Guardando…
                    </span>
                  ) : undefined
                }
              />
              <div className="p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleMenuStyleChange('photos')}
                    disabled={savingMenuStyle}
                    aria-pressed={menuStyle === 'photos'}
                    className={`flex flex-col gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150 disabled:opacity-60 ${
                      menuStyle === 'photos'
                        ? 'border-teal-500 bg-teal-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="mb-2 flex h-14 items-center justify-center rounded-md bg-gradient-to-br from-amber-100 to-slate-200">
                        <ImageIcon className="h-5 w-5 text-slate-400" />
                      </div>
                      <span className="mb-1.5 block h-2 w-20 rounded-full bg-slate-300" />
                      <span className="block h-1.5 w-12 rounded-full bg-slate-200" />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">Con fotos</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Tarjetas grandes con imagen, descripción y precio.
                        </p>
                      </div>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          menuStyle === 'photos'
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMenuStyleChange('list')}
                    disabled={savingMenuStyle}
                    aria-pressed={menuStyle === 'list'}
                    className={`flex flex-col gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150 disabled:opacity-60 ${
                      menuStyle === 'list'
                        ? 'border-teal-500 bg-teal-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      {[0, 1, 2].map((row) => (
                        <div
                          key={row}
                          className="flex items-center gap-2 border-b border-slate-200 py-1.5 last:border-0"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <span className="block h-1.5 w-16 rounded-full bg-slate-300" />
                            <span className="block h-1 w-10 rounded-full bg-slate-200" />
                          </div>
                          <span className="h-1.5 w-5 rounded-full bg-teal-300" />
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-white">
                            <Plus className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">Sin fotos</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Lista compacta: más productos por pantalla y carga más rápida.
                        </p>
                      </div>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          menuStyle === 'list'
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </div>
                  </button>
                </div>
                {menuStyleError && <p className="mt-3 text-sm text-rose-600">{menuStyleError}</p>}
                {menuStyleNotice && <p className="mt-3 text-sm text-emerald-600">{menuStyleNotice}</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Tema de colores"
                hint="Elegí un preset o creá tu propio tema para el menú moderno de cafetería."
                action={
                  savingMenuTheme ? (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Guardando…
                    </span>
                  ) : undefined
                }
              />
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MENU_THEME_PRESETS.map((preset) => {
                    const selected = !customThemeActive && activeThemePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyTheme(preset.theme)}
                        disabled={savingMenuTheme}
                        aria-pressed={selected}
                        className={`rounded-xl border-2 p-2.5 text-left transition-all duration-150 disabled:opacity-60 ${
                          selected
                            ? 'border-teal-500 bg-teal-50/40'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="flex overflow-hidden rounded-md border border-black/5">
                          {THEME_KEYS.map((key) => (
                            <span
                              key={key}
                              className="h-7 flex-1"
                              style={{ backgroundColor: preset.theme[key] }}
                            />
                          ))}
                        </span>
                        <span className="mt-2 flex items-center justify-between gap-2">
                          <span>
                            <span className="block text-sm font-semibold text-slate-800">
                              {preset.name}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {preset.description}
                            </span>
                          </span>
                          {selected && <Check className="h-4 w-4 shrink-0 text-teal-600" />}
                        </span>
                      </button>
                    );
                  })}

                  {customTheme ? (
                    <button
                      type="button"
                      onClick={() => handleApplyTheme(customTheme.theme)}
                      disabled={savingMenuTheme}
                      aria-pressed={customThemeActive}
                      className={`rounded-xl border-2 p-2.5 text-left transition-all duration-150 disabled:opacity-60 ${
                        customThemeActive
                          ? 'border-teal-500 bg-teal-50/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="flex overflow-hidden rounded-md border border-black/5">
                        {THEME_KEYS.map((key) => (
                          <span
                            key={key}
                            className="h-7 flex-1"
                            style={{ backgroundColor: customTheme.theme[key] }}
                          />
                        ))}
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2">
                        <span>
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {customTheme.name}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            Tema personalizado
                          </span>
                        </span>
                        {customThemeActive && (
                          <Check className="h-4 w-4 shrink-0 text-teal-600" />
                        )}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openCustomThemeEditor}
                      className="rounded-xl border-2 border-dashed border-slate-300 p-2.5 text-left transition-colors hover:border-teal-400 hover:bg-teal-50/30"
                    >
                      <span className="flex h-7 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                      <span className="mt-2 block text-sm font-semibold text-slate-700">
                        Crear tema
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Con tus propios colores
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">Los presets se aplican al instante.</p>
                  <button
                    type="button"
                    onClick={openCustomThemeEditor}
                    className="text-sm font-medium text-teal-700 hover:text-teal-800"
                  >
                    {customTheme ? 'Editar tema personalizado' : 'Crear tema personalizado'}
                  </button>
                </div>

                {customThemeEditorOpen && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">
                        {customTheme ? 'Editar tema personalizado' : 'Crear tema personalizado'}
                      </p>
                      <button
                        type="button"
                        onClick={closeCustomThemeEditor}
                        className="text-sm font-medium text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">
                        Nombre del tema personalizado
                      </span>
                      <input
                        id="custom-theme-name"
                        type="text"
                        value={customThemeName}
                        onChange={(event) => {
                          setCustomThemeName(event.target.value);
                          setMenuThemeError('');
                          setMenuThemeNotice('');
                        }}
                        placeholder="Ej. Mi café de barrio"
                        maxLength={MAX_CUSTOM_THEME_NAME}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveCustomTheme}
                      disabled={savingMenuTheme}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                    >
                      {savingMenuTheme ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Palette className="w-4 h-4" />
                      )}
                      Guardar y aplicar
                    </button>
                  </div>

                  {customTheme && (
                    <p className="text-xs text-slate-500">
                      Tema guardado: <span className="font-semibold">{customTheme.name}</span>.
                      Tocá su tarjeta para volver a aplicarlo.
                    </p>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      Colores del tema
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {THEME_COLOR_FIELDS.map((field) => (
                        <label key={field.key} className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-600">
                            {field.label}
                          </span>
                          <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                            <input
                              type="color"
                              value={customThemeDraft[field.key]}
                              onChange={(event) => updateThemeColor(field.key, event.target.value)}
                              aria-label={`Color ${field.label}`}
                              className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                            />
                            <span className="font-mono text-[11px] uppercase text-slate-500">
                              {customThemeDraft[field.key]}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3" style={themeStyle(customThemeDraft)}>
                    <div className="rounded-xl bg-[var(--menu-bg)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--menu-muted)]">
                            Vista previa
                          </p>
                          <p className="text-lg font-black text-[var(--menu-text)]">Flat white</p>
                          <p className="text-xs text-[var(--menu-muted)]">
                            Doble espresso y leche texturizada
                          </p>
                        </div>
                        <span className="rounded-full bg-[var(--menu-accent)] px-2.5 py-1 text-[10px] font-bold text-[var(--menu-on-accent)]">
                          Nuevo
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[var(--menu-surface)] p-3">
                        <div>
                          <p className="text-sm font-bold text-[var(--menu-text)]">Café de la casa</p>
                          <p className="text-xs text-[var(--menu-muted)]">Notas de cacao y avellana</p>
                        </div>
                        <span className="inline-flex items-center gap-2">
                          <span className="text-sm font-black text-[var(--menu-text)]">$ 3.200</span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--menu-primary)] text-[var(--menu-on-primary)]">
                            <Plus className="h-4 w-4" />
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    Los colores se aplican al menú moderno de cafetería.
                  </p>
                  <a
                    href={modernMenuUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800"
                  >
                    Abrir menú moderno
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {menuThemeError && <p className="text-sm text-rose-600">{menuThemeError}</p>}
                {menuThemeNotice && <p className="text-sm text-emerald-600">{menuThemeNotice}</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-4">
            {menuLoadError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-wrap items-center gap-3">
                <p className="flex-1 text-sm text-rose-700 font-medium min-w-[200px]">
                  {menuLoadError} Revisá tu conexión.
                </p>
                <button
                  type="button"
                  onClick={() => loadMenuData()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"
                >
                  Reintentar
                </button>
              </div>
            )}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title={`Categorías${categories.length > 0 ? ` (${categories.length})` : ''}`}
                hint="Agrupan los productos en el QR. Usá las flechas para ordenarlas en el menú."
                action={
                <div className="flex items-center gap-2">
                  {categories.length === 0 && (
                    <button
                      onClick={handleSeedMenu}
                      disabled={seeding}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50"
                    >
                      {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {seeding ? 'Generando…' : 'Ejemplo'}
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingCategory(null); setNewCategoryName(''); setNewCategoryKind('food'); setCategoryError(''); setShowCategoryModal(true); }}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all duration-150"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva
                  </button>
                </div>
                }
              />

              <div className="p-4">
                {loading ? (
                  <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-slate-400 mb-4">No hay categorías</p>
                    <button
                      onClick={handleSeedMenu}
                      disabled={seeding}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50"
                    >
                      {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {seeding ? 'Generando...' : 'Generar Menú Ejemplo'}
                    </button>
                    {seedError && <p className="text-rose-600 text-sm mt-2">{seedError}</p>}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category, index) => (
                      <div key={category.id} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">{category.name}</span>
                        {(category.kind ?? 'food') === 'drink' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">
                            Bebidas
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 ml-1">
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(category.id, -1)}
                            disabled={index === 0 || reorderingCategories}
                            aria-label={`Mover ${category.name} hacia arriba`}
                            title="Mover arriba"
                            className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(category.id, 1)}
                            disabled={index === categories.length - 1 || reorderingCategories}
                            aria-label={`Mover ${category.name} hacia abajo`}
                            title="Mover abajo"
                            className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button onClick={() => { setEditingCategory(category); setNewCategoryName(category.name); setNewCategoryKind(category.kind ?? 'food'); setCategoryError(''); setShowCategoryModal(true); }} className="p-1 text-slate-400 hover:text-indigo-600" aria-label={`Editar ${category.name}`}>
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteCategory(category.id)} className="p-1 text-slate-400 hover:text-rose-600" aria-label={`Eliminar ${category.name}`}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title={`Productos${menuItems.length > 0 ? ` (${menuItems.length})` : ''}`}
                hint="Tocá el tilde para pausar un producto sin borrarlo."
                action={
                <button
                  onClick={() => {
                    if (categories.length === 0) { alert('Primero debes crear al menos una categoría'); return; }
                     setEditingItem(null); setNewItemName(''); setNewItemPrice(''); setNewItemCategory(categories[0].id); setNewItemImageUrl(''); setNewItemDescription(''); setNewItemIngredients(''); setNewItemTags([]); setNewItemFeatured(false); setImageError(''); setItemError(''); setShowItemModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all duration-150"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo producto
                </button>
                }
              />

              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
                ) : menuItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">No hay productos en el menú</div>
                ) : (
                  categories.map((category) => {
                    const categoryItems = menuItems.filter(i => i.categoryId === category.id);
                    if (categoryItems.length === 0) return null;
                    return (
                      <div key={category.id}>
                        <div className="px-4 py-2 bg-slate-50 text-sm font-medium text-slate-500">{category.name}</div>
                        {categoryItems.map((item) => (
                          <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-3 min-w-0">
                              <button onClick={() => handleToggleItemAvailability(item.id, item.available)} className={`w-6 h-6 shrink-0 rounded flex items-center justify-center transition-all duration-150 ${item.available ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {item.featured && <Star className="w-4 h-4 shrink-0 fill-amber-400 text-amber-400" aria-label="Destacado" />}
                                  <p className={`font-medium truncate ${item.available ? 'text-slate-800' : 'text-slate-400'}`}>{item.name}</p>
                                </div>
                                <p className="text-sm font-semibold text-indigo-600">{currencySymbol}{item.price.toFixed(2)}</p>
                                {item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {item.tags.slice(0, 4).map((tag) => (
                                      <TagBadge key={tag} meta={resolveTagMeta(tag, customTags)} />
                                    ))}
                                    {item.tags.length > 4 && (
                                      <span className="text-xs text-slate-400 font-medium">+{item.tags.length - 4}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                               <button onClick={() => { setEditingItem(item); setNewItemName(item.name); setNewItemPrice(String(item.price)); setNewItemCategory(item.categoryId); setNewItemImageUrl(item.imageUrl ?? ''); setNewItemDescription(item.description ?? ''); setNewItemIngredients(item.ingredients ?? ''); setNewItemTags(item.tags); setNewItemFeatured(item.featured); setImageError(''); setItemError(''); setShowItemModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setDeleteItemError(''); setDeletingItem(item); }}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                aria-label={`Eliminar ${item.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'qrs' && (
          <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <SectionHeader
              title="Marca del local"
              hint="Nombre y logo para las tarjetas de mesa y el menú público."
              action={
                <button
                  type="button"
                  onClick={handleSaveBranding}
                  disabled={savingBranding || !brandingLoaded}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {savingBranding && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar marca
                </button>
              }
            />
            <div className="p-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-sm font-medium text-slate-600 mb-1">Nombre del restaurante</span>
                <input
                  value={brandingName}
                  onChange={(e) => setBrandingName(e.target.value)}
                  placeholder="Ej. La Esquina"
                  maxLength={80}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </label>
              <div>
                <span className="block text-sm font-medium text-slate-600 mb-1">Logo</span>
                {brandingLogo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- preview local (data URL); next/image no aplica. */}
                    <img src={brandingLogo} alt="Logo del restaurante" className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-white" />
                    <button
                      type="button"
                      onClick={() => setBrandingLogo(null)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-medium"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-200 rounded-lg py-5 cursor-pointer hover:border-teal-400 hover:bg-teal-50/40 transition-colors">
                    <ImagePlus className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">Subir logo</span>
                    <span className="text-xs text-slate-400">PNG o JPG · se ajusta solo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void handleLogoChange(file);
                      }}
                    />
                  </label>
                )}
                {logoError && <p className="text-sm text-rose-600 mt-2">{logoError}</p>}
              </div>
              <label className="block sm:col-span-2">
                <span className="block text-sm font-medium text-slate-600 mb-1">
                  Zona horaria
                </span>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/Argentina/Buenos_Aires"
                  list="timezone-options"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <datalist id="timezone-options">
                  <option value="America/Argentina/Buenos_Aires" />
                  <option value="America/Sao_Paulo" />
                  <option value="Europe/Madrid" />
                  <option value="UTC" />
                </datalist>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-600 mb-1">
                  Moneda (ISO)
                </span>
                <input
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                  maxLength={3}
                  placeholder="ARS"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm uppercase"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-600 mb-1">
                  Símbolo de moneda
                </span>
                <input
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  maxLength={5}
                  placeholder="$"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </label>
              {brandingError && <p className="text-sm text-rose-600 sm:col-span-2">{brandingError}</p>}
              {brandingNotice && <p className="text-sm text-emerald-600 sm:col-span-2">{brandingNotice}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-slate-950 text-white rounded-xl p-5">
              <p className="text-amber-300 text-[11px] uppercase tracking-widest font-bold">1 · Para pedir en el local</p>
              <h2 className="text-lg font-bold mt-1">QR de las mesas</h2>
              <p className="text-slate-300 text-sm mt-1">Pegalo en cada mesa. El cliente elige su mesa y pide.</p>
              {publicMenuUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR externo de tamaño fijo; no compensa el costo de optimización de next/image. */}
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicMenuUrl)}`} alt="QR del menú digital" className="w-36 h-36 bg-white p-2 rounded-xl mt-4" />
                  <p className="text-slate-400 text-xs mt-3 break-all">{publicMenuUrl}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => window.open(publicMenuUrl, '_blank')}
                      className="flex-1 py-2 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-100"
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard?.writeText(publicMenuUrl); }}
                      className="flex-1 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20"
                    >
                      Copiar link
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 text-sm mt-4">Cargando…</p>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-indigo-500 text-[11px] uppercase tracking-widest font-bold">2 · Para difundir</p>
              <h2 className="text-lg font-bold mt-1 text-slate-800">Carta sin pedido</h2>
              <p className="text-slate-500 text-sm mt-1">Para Instagram, bio o WhatsApp. Solo muestra, no vende.</p>
              {cartaUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR externo de tamaño fijo; no compensa el costo de optimización de next/image. */}
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(cartaUrl)}`} alt="QR de la carta para compartir" className="w-36 h-36 bg-white p-2 rounded-xl border border-slate-200 mt-4" />
                  <p className="text-slate-400 text-xs mt-3 break-all">{cartaUrl}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => window.open(cartaUrl, '_blank')}
                      className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard?.writeText(cartaUrl); }}
                      className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
                    >
                      Copiar link
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 text-sm mt-4">Cargando…</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <SectionHeader
              title="Tarjetas para plastificar"
              hint="Una por mesa: logo, nombre, QR, zona y número. Descargá el PNG o imprimí."
              action={
                <button
                  type="button"
                  onClick={handlePrintAll}
                  disabled={generatingCard || tables.length === 0}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-medium"
                >
                  {generatingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Imprimir todas ({tables.length})
                </button>
              }
            />
            <div className="p-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-600 mb-1">Zona</span>
                    <select
                      value={cardZone}
                      onChange={(e) => {
                        setCardZone(e.target.value);
                        setCardTableId('');
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">Todas</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.slug}>{z.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-600 mb-1">Mesa</span>
                    <select
                      value={cardTableId}
                      onChange={(e) => setCardTableId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">Elegí…</option>
                      {tables
                        .filter((t) => !cardZone || t.zone === cardZone)
                        .map((t) => {
                          const zoneName = zones.find((z) => z.slug === t.zone)?.name ?? t.zone;
                          return (
                            <option key={t.id} value={t.id}>
                              {zoneName} · Mesa {t.number}
                            </option>
                          );
                        })}
                    </select>
                  </label>
                </div>
                {loadingTables ? (
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando mesas…
                  </p>
                ) : tables.length === 0 ? (
                  <p className="text-sm text-slate-400">Todavía no hay mesas. Crealas desde Salón.</p>
                ) : !selectedCardTable ? (
                  <p className="text-sm text-slate-400">Elegí una mesa para ver su tarjeta.</p>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadCard}
                      disabled={!cardQr}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Descargar PNG
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintCard}
                      disabled={!cardQr}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-medium"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir
                    </button>
                  </div>
                )}
                {cardError && <p className="text-sm text-rose-600">{cardError}</p>}
                {selectedCardTable && (
                  <p className="text-xs text-slate-400 break-all">
                    {typeof window !== 'undefined' && restaurantId && selectedCardTable.publicToken
                      ? buildTableMenuUrl(
                          publicOrigin,
                          restaurantId,
                          selectedCardTable.number,
                          selectedCardTable.publicToken,
                        )
                      : ''}
                  </p>
                )}
              </div>
              <div>
                {selectedCardTable ? (
                  <TableCardPreview
                    restaurantName={brandingName}
                    logoUrl={brandingLogo}
                    qrDataUrl={cardQr}
                    zoneName={selectedZoneName}
                    tableNumber={selectedCardTable.number}
                  />
                ) : (
                  <div className="h-full min-h-[280px] rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center p-6 text-center">
                    <p className="text-sm text-slate-400">La vista previa aparece acá.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}
        </>
        )}
      </div>

      {showZoneModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">{editingZone ? 'Editar Zona' : 'Nueva Zona'}</h3>
              <button onClick={() => setShowZoneModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-slate-600 mb-2">Nombre de la Zona</label>
              <input type="text" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} placeholder="Ej: Terraza VIP" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg" autoFocus />
              {zoneError && <p className="text-sm text-rose-600 mt-2">{zoneError}</p>}
            </div>
            <div className="flex gap-3 p-4 bg-slate-50">
              <button onClick={() => setShowZoneModal(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSaveZone} disabled={submittingZone} className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50">{submittingZone ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Nombre de la Categoría</label>
                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ej: Pizzas, Bebidas" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg" autoFocus />
              </div>
              <button
                type="button"
                onClick={() => setNewCategoryKind((k) => (k === 'drink' ? 'food' : 'drink'))}
                aria-pressed={newCategoryKind === 'drink'}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
                  newCategoryKind === 'drink'
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span>Es categoría de bebidas</span>
                <span className={`w-9 h-5 rounded-full relative transition-colors ${newCategoryKind === 'drink' ? 'bg-amber-500' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${newCategoryKind === 'drink' ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
              <p className="text-xs text-slate-400 -mt-2">Las bebidas aparecen con checkbox en Cocina (se entregan primero).</p>
              {categoryError && <p className="text-sm text-rose-600">{categoryError}</p>}
            </div>
            <div className="flex gap-3 p-4 bg-slate-50">
              <button onClick={() => setShowCategoryModal(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSaveCategory} disabled={submittingCategory} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">{submittingCategory ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-base font-bold text-slate-800">{editingItem ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={() => setShowItemModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Nombre del producto</label>
                <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Ej: Pizza Muzzarella" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Precio</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={newItemPrice}
                    onChange={(e) => {
                      setNewItemPrice(e.target.value);
                      if (itemError) setItemError('');
                    }}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Categoría</label>
                <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg">
                  {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Descripción</label>
                <textarea value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} placeholder="Ej: Salsa de tomate, muzzarella y albahaca fresca" rows={3} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Ingredientes</label>
                <textarea value={newItemIngredients} onChange={(e) => setNewItemIngredients(e.target.value)} placeholder="Ej: Tomate, muzzarella, albahaca. Contiene gluten y lactosa." rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg resize-none" />
                <p className="text-xs text-slate-400 mt-1">Se muestra en el detalle del producto para clientes con alergias o restricciones.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Etiquetas</label>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TAGS.map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      onClick={() => toggleItemTag(tag.key)}
                      aria-pressed={newItemTags.includes(tag.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                        newItemTags.includes(tag.key)
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {tag.icon} {tag.label}
                    </button>
                  ))}
                  {customTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleItemTag(tag.id)}
                      aria-pressed={newItemTags.includes(tag.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                        newItemTags.includes(tag.id)
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {tag.icon ?? '🏷️'} {tag.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Podés crear más etiquetas en la pestaña «Etiquetas».</p>
              </div>
              {menuStyle === 'photos' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Foto del producto</label>
                  {newItemImageUrl ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (object URL/data URL); next/image no aplica. */}
                      <img src={newItemImageUrl} alt="Vista previa de la foto del producto" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setNewItemImageUrl('')}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Quitar foto
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-200 rounded-lg py-6 cursor-pointer hover:border-teal-400 hover:bg-teal-50/40 transition-colors">
                      <ImagePlus className="w-6 h-6 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">Subir una imagen</span>
                      <span className="text-xs text-slate-400">JPG o PNG · se optimiza automáticamente</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          handleImageChange(file);
                        }}
                      />
                    </label>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    Para que se vea mejor: foto horizontal de 1200×800 px (3:2) o 1280×720 px (16:9), con el producto centrado. Las fotos verticales o cuadradas se recortan.
                  </p>
                  {imageError && <p className="text-sm text-rose-600 mt-2">{imageError}</p>}
                </div>
              )}
              <button
                type="button"
                onClick={() => setNewItemFeatured(!newItemFeatured)}
                aria-pressed={newItemFeatured}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all duration-150 ${
                  newItemFeatured
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Star className={`w-4 h-4 ${newItemFeatured ? 'fill-amber-400 text-amber-400' : ''}`} />
                {newItemFeatured ? 'Destacado del chef' : 'Marcar como recomendado'}
              </button>
              {itemError && <p className="text-sm text-rose-600">{itemError}</p>}
            </div>
            <div className="flex gap-3 p-4 bg-slate-50 sticky bottom-0">
              <button onClick={() => setShowItemModal(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSaveItem} disabled={submittingItem} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">{submittingItem ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">{editingTag ? 'Editar Etiqueta' : 'Nueva Etiqueta'}</h3>
              <button onClick={() => setShowTagModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Nombre</label>
                <input type="text" value={newTagLabel} onChange={(e) => setNewTagLabel(e.target.value)} placeholder="Ej: Sin gluten certificado" maxLength={50} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Ícono (emoji, opcional)</label>
                <input type="text" value={newTagIcon} onChange={(e) => setNewTagIcon(e.target.value)} placeholder="Ej: 🥜" maxLength={4} className="w-24 px-3 py-2.5 border border-slate-200 rounded-lg text-center text-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Color</label>
                <select value={newTagTone} onChange={(e) => setNewTagTone(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg">
                  {TAG_TONES.map((tone) => (
                    <option key={tone.value} value={tone.value}>{tone.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Vista previa:</span>
                <TagBadge meta={{ key: 'preview', label: newTagLabel.trim() || 'Tu etiqueta', icon: newTagIcon.trim() || '🏷️', tone: TAG_TONES.find(t => t.value === newTagTone)?.value ?? 'stone' }} />
              </div>
              {tagError && <p className="text-sm text-rose-600">{tagError}</p>}
            </div>
            <div className="flex gap-3 p-4 bg-slate-50">
              <button onClick={() => setShowTagModal(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSaveTag} disabled={submittingTag} className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50">{submittingTag ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {deletingItem && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-item-title"
        >
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-start gap-3 p-4">
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 id="delete-item-title" className="text-base font-bold text-slate-800">Eliminar producto</h3>
                <p className="text-sm text-slate-500 mt-1">
                  ¿Eliminar «{deletingItem.name}» del menú? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            {deleteItemError && <p className="px-4 pb-3 text-sm text-rose-600">{deleteItemError}</p>}
            <div className="flex gap-3 p-4 bg-slate-50">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={deletingItemBusy}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-50"
                autoFocus
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={deletingItemBusy}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingItemBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {deletingItemBusy ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
