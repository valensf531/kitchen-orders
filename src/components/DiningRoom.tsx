'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Order, OrderItem } from '@/types/order';
import { Zone, ZoneType } from '@/types/table';
import { Plus, Minus, Trash2, Send, User, Hash, UtensilsCrossed, MessageSquare, MapPin, AlertCircle, Loader2, EyeOff, Eye } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  available: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  order: number;
}

interface CartItem extends OrderItem {
  price: number;
}

interface TableInfo {
  id: string;
  number: number;
  status: string;
}

export function DiningRoom({ orders = [] }: { orders?: Order[] }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [selectedZone, setSelectedZone] = useState<ZoneType>('');
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState<number | undefined>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [stockToggling, setStockToggling] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const initialized = useRef(false);
  const money = (value: number) => `${currencySymbol}${(Number(value) || 0).toFixed(2)}`;

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await fetch('/api/zones');
        if (res.ok) {
          const data = await res.json();
          const loadedZones = data.zones || [];
          setZones(loadedZones);
          if (loadedZones.length > 0 && !initialized.current) {
            initialized.current = true;
            setSelectedZone(loadedZones[0].slug);
          }
        }
      } catch (error) {
        console.error('Failed to fetch zones:', error);
      } finally {
        setLoadingZones(false);
      }
    };
    fetchZones();
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const symbol = data?.branding?.currencySymbol;
        if (typeof symbol === 'string' && symbol.trim()) setCurrencySymbol(symbol.trim());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch('/api/menu');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
          setMenuItems(data.items || []);
          if (data.categories?.length > 0) {
            setSelectedCategory(data.categories[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch menu:', error);
      } finally {
        setLoadingMenu(false);
      }
    };
    fetchMenu();
  }, []);

  useEffect(() => {
    if (!selectedZone) return;
    const fetchTables = async () => {
      setLoadingTables(true);
      try {
        const res = await fetch(`/api/tables?zone=${selectedZone}`);
        if (res.ok) {
          const data = await res.json();
          setTables(data.tables || []);
        }
      } catch (error) {
        console.error('Failed to fetch tables:', error);
      } finally {
        setLoadingTables(false);
      }
    };
    fetchTables();
  }, [selectedZone]);

  const availableTableNumbers = useMemo(
    () => tables.map((table) => table.number).sort((a, b) => a - b),
    [tables],
  );

  /* Cuenta abierta de la mesa elegida: el mozo ve qué hay antes de sumar. */
  const tableAccount = useMemo(() => {
    if (!tableNumber) return null;
    const currentTable = tables.find((table) => table.number === tableNumber);
    const matches = orders.filter((order) => {
      if (order.status === 'canceled' || order.paidAt) return false;
      if (currentTable && order.tableId === currentTable.id) return true;
      return order.tableNumber === tableNumber && (order.zone ?? '') === selectedZone;
    });
    if (matches.length === 0) return null;
    const items = new Map<string, { name: string; quantity: number; total: number }>();
    for (const order of matches) {
      for (const item of order.items) {
        const key = item.name;
        const entry = items.get(key) ?? { name: item.name, quantity: 0, total: 0 };
        entry.quantity += item.quantity;
        entry.total += (Number(item.price) || 0) * item.quantity;
        items.set(key, entry);
      }
    }
    return {
      orders: matches.length,
      items: Array.from(items.values()),
      total: matches.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    };
  }, [orders, tableNumber, tables, selectedZone]);

  const availableCategories = useMemo(() => {
    const categoriesWithStock = new Set(
      menuItems.filter((item) => item.available).map((item) => item.categoryId),
    );
    return categories.filter((category) => categoriesWithStock.has(category.id));
  }, [categories, menuItems]);

  const availableItems = useMemo(
    () =>
      menuItems.filter(
        (item) => item.available && item.categoryId === selectedCategory,
      ),
    [menuItems, selectedCategory],
  );

  const soldOutItems = useMemo(
    () =>
      menuItems.filter(
        (item) => !item.available && item.categoryId === selectedCategory,
      ),
    [menuItems, selectedCategory],
  );

  /* Marcar agotado / reponer directo desde la toma de pedidos. */
  const toggleStock = async (item: MenuItem, available: boolean) => {
    setStockToggling(item.id);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/menu/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available }),
      });
      if (res.ok) {
        setMenuItems(prev => prev.map(entry => entry.id === item.id ? { ...entry, available } : entry));
        if (!available) {
          /* Si estaba en el carrito, sale: ya no se puede pedir. */
          setCart(prev => prev.filter(entry => entry.menuItemId !== item.id));
        }
      } else {
        setErrorMessage('No se pudo cambiar el stock. Intentá de nuevo.');
      }
    } catch {
      setErrorMessage('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setStockToggling(null);
    }
  };

  const addToCart = (name: string, price: number, menuItemId?: string) => {
    setCart(prev => {
      const cartKey = (item: CartItem) => item.menuItemId ?? item.name;
      const entryKey = menuItemId ?? name;
      const existing = prev.find(item => cartKey(item) === entryKey);
      if (existing) {
        return prev.map(item =>
          cartKey(item) === entryKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { name, quantity: 1, price, menuItemId }];
    });
  };

  const removeFromCart = (name: string) => {
    setCart(prev => prev.filter(item => item.name !== name));
  };

  const updateQuantity = (name: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.name === name) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    if (cart.length === 0 || !tableNumber) return;

    if (!availableTableNumbers.includes(tableNumber)) {
      const zoneName = zones.find(z => z.slug === selectedZone)?.name || selectedZone;
      setErrorMessage(`La mesa ${tableNumber} no existe en ${zoneName}`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || undefined,
          tableNumber,
          items: cart.map(({ name, quantity, notes, menuItemId }) => ({ name, quantity, notes, id: menuItemId })),
          source: 'dining-room',
          notes: notes || undefined,
          zone: selectedZone,
        }),
      });

      if (res.ok) {
        setSuccessMessage('Pedido enviado a cocina exitosamente!');
        setCustomerName('');
        setTableNumber(undefined);
        setCart([]);
        setNotes('');
        setTimeout(() => setSuccessMessage(''), 3000);
        /* Refresca mesas para que el salón refleje el estado actual. */
        const tablesRes = await fetch(`/api/tables?zone=${selectedZone}`);
        if (tablesRes.ok) {
          const data = await tablesRes.json();
          setTables(data.tables || []);
        }
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Error al enviar el pedido');
      }
    } catch (error) {
      console.error('Failed to submit order:', error);
      setErrorMessage('Error al enviar el pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {successMessage && (
        <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-xl text-teal-700 font-semibold text-center">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Información del Cliente</h2>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Zona <span className="text-rose-500">*</span>
              </label>
              {loadingZones ? (
                <div className="py-3 px-4 bg-slate-100 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              ) : zones.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  No hay zonas configuradas. Ve a Configuración para crear zonas.
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {zones.map(zone => (
                    <button
                      key={zone.id}
                      onClick={() => {
                        setSelectedZone(zone.slug);
                        setTableNumber(undefined);
                      }}
                      className={`py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-150 flex items-center gap-2 ${
                        selectedZone === zone.slug
                          ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      {zone.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tableNumber" className="block text-sm font-semibold text-slate-600 mb-2">
                  Mesa # <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  {loadingTables ? (
                    <div className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <select
                      id="tableNumber"
                      value={tableNumber ?? ''}
                      onChange={(e) => setTableNumber(e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                    >
                      <option value="">Seleccionar mesa...</option>
                      {availableTableNumbers.map(num => (
                        <option key={num} value={num}>Mesa {num}</option>
                      ))}
                    </select>
                  )}
                </div>
                {availableTableNumbers.length === 0 && !loadingTables && (
                  <p className="text-xs text-amber-600 mt-2">
                    No hay mesas en {zones.find(z => z.slug === selectedZone)?.name || 'esta zona'}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="customerName" className="block text-sm font-semibold text-slate-600 mb-2">
                  Nombre del Cliente <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej: Juan García"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Menú</h2>
            </div>
            
            {loadingMenu ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                <p className="text-slate-500 mt-2">Cargando menú...</p>
              </div>
            ) : availableCategories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No hay items en el menú.</p>
                <p className="text-sm text-slate-400 mt-1">Ve a Configuración para agregar productos.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                  {availableCategories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                        selectedCategory === category.id
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {availableItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1 p-3 pr-2 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-all duration-150 border border-transparent hover:border-indigo-200"
                    >
                      <button
                        onClick={() => addToCart(item.name, item.price, item.id)}
                        className="flex-1 flex justify-between items-center text-left min-w-0"
                      >
                        <span className="text-sm text-slate-700 truncate">{item.name}</span>
                        <span className="text-sm font-semibold text-indigo-600 ml-2">{money(item.price)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStock(item, false)}
                        disabled={stockToggling === item.id}
                        title="Marcar como agotado"
                        className="shrink-0 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {soldOutItems.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      Sin stock ({soldOutItems.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {soldOutItems.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleStock(item, true)}
                          disabled={stockToggling === item.id}
                          title="Volver a poner en stock"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-100 disabled:opacity-40"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 h-fit lg:sticky lg:top-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center">
              <Send className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Pedido Actual</h2>
          </div>

          {tableAccount && tableNumber && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                Cuenta abierta · Mesa {tableNumber}
                {tableAccount.orders > 1 ? ` · ${tableAccount.orders} pedidos` : ''}
              </p>
              <div className="mt-2 space-y-1">
                {tableAccount.items.map((item) => (
                  <div key={item.name} className="flex justify-between gap-2 text-xs text-amber-900">
                    <span className="truncate">{item.quantity}× {item.name}</span>
                    <span className="shrink-0 font-semibold">{money(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between border-t border-amber-200 pt-2 text-sm font-bold text-amber-900">
                <span>Total actual</span>
                <span>{money(tableAccount.total)}</span>
              </div>
            </div>
          )}

          {cart.length === 0 ? (
            <p className="text-slate-400 text-center py-8 text-sm">
              Agrega items del menú
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {cart.map(item => (
                <div key={item.name} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{money(item.price)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.name, -1)}
                      className="w-7 h-7 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded transition-colors"
                    >
                      <Minus className="w-3 h-3 text-slate-600" />
                    </button>
                    <span className="w-7 text-center font-bold text-sm text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.name, 1)}
                      className="w-7 h-7 flex items-center justify-center bg-teal-600 text-white rounded transition-colors hover:bg-teal-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.name)}
                      className="w-7 h-7 flex items-center justify-center bg-rose-100 hover:bg-rose-200 rounded transition-colors ml-1"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <>
              <div className="border-t border-slate-200 pt-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <label htmlFor="notes" className="text-sm font-semibold text-slate-600">Notas especiales</label>
                </div>
                <textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, término medio"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center mb-4">
                <span className="font-semibold text-slate-600">Total</span>
                <span className="text-xl font-bold text-indigo-600">{money(getTotal())}</span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !tableNumber}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Enviando...' : 'Enviar a Cocina'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}