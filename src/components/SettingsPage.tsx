'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Settings, MapPin, Plus, Edit3, Trash2, X, Loader2, Check, DollarSign, Sparkles, Star, ImagePlus, Users, KeyRound, QrCode, UtensilsCrossed, Tags, Printer, Download } from 'lucide-react';
import { Zone } from '@/types/table';
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

type ConfigTab = 'zones' | 'menu' | 'tags' | 'qrs' | 'staff';

const CONFIG_TABS: { id: ConfigTab; label: string; icon: typeof MapPin; hint: string }[] = [
  { id: 'zones', label: 'Local', icon: MapPin, hint: 'Zonas del salón' },
  { id: 'menu', label: 'Menú', icon: UtensilsCrossed, hint: 'Categorías y platos' },
  { id: 'tags', label: 'Etiquetas', icon: Tags, hint: 'Sellos de los platos' },
  { id: 'qrs', label: 'QRs', icon: QrCode, hint: 'Para mesas y redes' },
  { id: 'staff', label: 'Personal', icon: Users, hint: 'Vendedores y cocineros' },
];

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
  const [submittingZone, setSubmittingZone] = useState(false);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [submittingTag, setSubmittingTag] = useState(false);
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

  /* Acceso efectivo (restaurante + rol) y personal vinculado. */
  const [restaurantId, setRestaurantId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffKind, setNewStaffKind] = useState<'staff' | 'kitchen'>('staff');
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffNotice, setStaffNotice] = useState('');

  /* Marca del restaurante (nombre + logo para tarjetas y menú público). */
  const [brandingName, setBrandingName] = useState('');
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingError, setBrandingError] = useState('');
  const [brandingNotice, setBrandingNotice] = useState('');
  const [logoError, setLogoError] = useState('');

  /* Mesas + tarjeta seleccionada para previsualizar/descargar. */
  const [tables, setTables] = useState<{ id: string; number: number; zone: string }[]>([]);
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
      setBrandingName(data.branding?.name ?? '');
      setBrandingLogo(data.branding?.logoUrl ?? null);
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
        body: JSON.stringify({ name: brandingName, logoUrl: brandingLogo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBrandingError(data?.error ?? 'No se pudo guardar la marca');
        return;
      }
      setBrandingName(data.branding?.name ?? '');
      setBrandingLogo(data.branding?.logoUrl ?? null);
      setBrandingNotice('Marca guardada. Se usa en las tarjetas y en el menú público.');
    } catch {
      setBrandingError('Error de red. Intentá de nuevo.');
    } finally {
      setSavingBranding(false);
    }
  };

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

  const [newZoneName, setNewZoneName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(0);
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
    setGeneratingCard(true);
    setCardError('');
    QRCode.toDataURL(buildTableMenuUrl(window.location.origin, restaurantId, table.number), {
      width: 520,
      margin: 1,
    })
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
  }, [restaurantId, cardTableId, tables]);

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
        const qr = await QRCode.toDataURL(buildTableMenuUrl(window.location.origin, restaurantId, table.number), {
          width: 520,
          margin: 1,
        });
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
    try {
      const res = await fetch('/api/zones');
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
      }
    } catch (error) {
      console.error('Failed to load zones:', error);
    } finally {
      setLoadingZones(false);
    }
  };

  const loadMenuData = async () => {
    setLoading(true);
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
      }
    } catch (error) {
      console.error('Failed to load menu data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZone = async () => {
    if (!newZoneName.trim() || submittingZone) return;
    setSubmittingZone(true);

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
        }
      }
    } catch (error) {
      console.error('Failed to save zone:', error);
    } finally {
      setSubmittingZone(false);
    }

    setShowZoneModal(false);
    setEditingZone(null);
    setNewZoneName('');
  };

  const handleDeleteZone = async (id: string) => {
    const zone = zones.find((z) => z.id === id);
    const mesaCount = zone ? tables.filter((t) => t.zone === zone.slug).length : 0;
    const warning =
      mesaCount > 0
        ? `¿Eliminar la zona "${zone?.name}"? También se eliminarán sus ${mesaCount} mesa(s).`
        : `¿Estás seguro de eliminar esta zona?`;
    if (confirm(warning)) {
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
        }
      } catch (error) {
        console.error('Failed to delete zone:', error);
      }
    }
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim() || submittingCategory) return;
    setSubmittingCategory(true);

    try {
      if (editingCategory) {
        const res = await fetch(`/api/menu/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCategoryName }),
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(prev => prev.map(c => c.id === editingCategory.id ? data.category : c));
        }
      } else {
        const res = await fetch('/api/menu/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCategoryName }),
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(prev => [...prev, data.category]);
          if (categories.length === 0) {
            setNewItemCategory(data.category.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setSubmittingCategory(false);
    }

    setShowCategoryModal(false);
    setEditingCategory(null);
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta categoría? Se eliminarán todos los items asociados.')) {
      try {
        const res = await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setCategories(prev => prev.filter(c => c.id !== id));
          setMenuItems(prev => prev.filter(i => i.categoryId !== id));
        }
      } catch (error) {
        console.error('Failed to delete category:', error);
      }
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
    if (!newItemName.trim() || newItemPrice <= 0 || !newItemCategory || submittingItem) return;
    setSubmittingItem(true);

    const payload = {
      name: newItemName,
      price: newItemPrice,
      categoryId: newItemCategory,
      imageUrl: newItemImageUrl || undefined,
      description: newItemDescription.trim() || undefined,
      ingredients: newItemIngredients.trim() || undefined,
      tags: newItemTags,
      featured: newItemFeatured,
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
        }
      }
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setSubmittingItem(false);
    }

    setShowItemModal(false);
    setEditingItem(null);
    setNewItemName('');
    setNewItemPrice(0);
    setNewItemCategory(categories[0]?.id || '');
    setNewItemImageUrl('');
    setNewItemDescription('');
    setNewItemIngredients('');
    setNewItemTags([]);
    setNewItemFeatured(false);
    setImageError('');
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este item?')) {
      try {
        const res = await fetch(`/api/menu/items/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setMenuItems(prev => prev.filter(i => i.id !== id));
        }
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
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
    try {
      const res = await fetch(`/api/menu/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !available }),
      });
      if (res.ok) {
        setMenuItems(prev => prev.map(i => i.id === id ? { ...i, available: !available } : i));
      }
    } catch (error) {
      console.error('Failed to toggle item availability:', error);
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
    if (confirm('¿Estás seguro de eliminar esta etiqueta? Se quitará de todos los platos que la usan.')) {
      try {
        const res = await fetch(`/api/menu/tags/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setCustomTags(prev => prev.filter(t => t.id !== id));
          setMenuItems(prev => prev.map(i => ({ ...i, tags: i.tags.filter(tag => tag !== id) })));
        }
      } catch (error) {
        console.error('Failed to delete tag:', error);
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
    ? `${window.location.origin}/menu?restaurant=${encodeURIComponent(restaurantId)}`
    : '';
  /* Vitrina de solo lectura para Instagram/WhatsApp (sin pedido). */
  const cartaUrl = typeof window !== 'undefined' && restaurantId
    ? `${window.location.origin}/carta?restaurant=${encodeURIComponent(restaurantId)}`
    : '';

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
                onClick={() => setActiveTab(tab.id)}
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
            {activeTab === 'tags' && ' · Se usan para destacar platos en el menú.'}
          </p>
        )}

        {activeTab === 'zones' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <SectionHeader
              title={`Zonas del salón${zones.length > 0 ? ` (${zones.length})` : ''}`}
              hint="Ej. Terraza, Adentro, Barra. Cada zona agrupa sus mesas."
              action={
              <button
                onClick={() => { setEditingZone(null); setNewZoneName(''); setShowZoneModal(true); }}
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
                      <button onClick={() => { setEditingZone(zone); setNewZoneName(zone.name); setShowZoneModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
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
                hint="Crealas una vez y reutilizalas en varios platos."
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
                              {menuItems.filter(i => i.tags.includes(tag.id)).length} platos la usan
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
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${member.role === 'kitchen' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                          {member.role === 'kitchen' ? 'Cocina' : 'Vendedor'}
                        </span>
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
                  <input
                    type="password"
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    placeholder="Solo para cuentas nuevas"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
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

        {activeTab === 'menu' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title={`Categorías${categories.length > 0 ? ` (${categories.length})` : ''}`}
                hint="Agrupan los platos en el QR. Podés generar un ejemplo para empezar."
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
                    onClick={() => { setEditingCategory(null); setNewCategoryName(''); setShowCategoryModal(true); }}
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
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">{category.name}</span>
                        <button onClick={() => { setEditingCategory(category); setNewCategoryName(category.name); setShowCategoryModal(true); }} className="p-1 text-slate-400 hover:text-indigo-600">
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteCategory(category.id)} className="p-1 text-slate-400 hover:text-rose-600">
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
                title={`Platos${menuItems.length > 0 ? ` (${menuItems.length})` : ''}`}
                hint="Tocá el tilde para pausar un plato sin borrarlo."
                action={
                <button
                  onClick={() => {
                    if (categories.length === 0) { alert('Primero debes crear al menos una categoría'); return; }
                     setEditingItem(null); setNewItemName(''); setNewItemPrice(0); setNewItemCategory(categories[0].id); setNewItemImageUrl(''); setNewItemDescription(''); setNewItemIngredients(''); setNewItemTags([]); setNewItemFeatured(false); setImageError(''); setShowItemModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all duration-150"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo plato
                </button>
                }
              />

              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
                ) : menuItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">No hay items en el menú</div>
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
                                <p className="text-sm font-semibold text-indigo-600">${item.price.toFixed(2)}</p>
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
                               <button onClick={() => { setEditingItem(item); setNewItemName(item.name); setNewItemPrice(item.price); setNewItemCategory(item.categoryId); setNewItemImageUrl(item.imageUrl ?? ''); setNewItemDescription(item.description ?? ''); setNewItemIngredients(item.ingredients ?? ''); setNewItemTags(item.tags); setNewItemFeatured(item.featured); setImageError(''); setShowItemModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
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
                    {typeof window !== 'undefined' && restaurantId
                      ? buildTableMenuUrl(window.location.origin, restaurantId, selectedCardTable.number)
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
            <div className="p-4">
              <label className="block text-sm font-medium text-slate-600 mb-2">Nombre de la Categoría</label>
              <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ej: Pizzas, Bebidas" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg" autoFocus />
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
              <h3 className="text-base font-bold text-slate-800">{editingItem ? 'Editar Item' : 'Nuevo Item'}</h3>
              <button onClick={() => setShowItemModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Nombre del Item</label>
                <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Ej: Pizza Muzzarella" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Precio</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" value={newItemPrice} onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg" />
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
                <p className="text-xs text-slate-400 mt-1">Se muestra en el detalle del plato para clientes con alergias o restricciones.</p>
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
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Foto del plato</label>
                {newItemImageUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (object URL/data URL); next/image no aplica. */}
                    <img src={newItemImageUrl} alt="Vista previa de la foto del plato" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
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
                {imageError && <p className="text-sm text-rose-600 mt-2">{imageError}</p>}
              </div>
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
    </div>
  );
}
