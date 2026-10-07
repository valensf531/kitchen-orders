'use client';

import { useState, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { Table, ZoneType, TableStatus, STATUS_CONFIG, SHAPE_CONFIG } from '@/types/table';
import { useAccess } from '@/hooks/use-access';
import { TableCardPreview } from './TableCardPreview';
import { buildTableMenuUrl, buildTableCardPNG, downloadDataUrl, tableCardsPrintSheetHtml, openPrintWindow } from '@/lib/table-card';
import { Plus, X, Hash, MapPin, Loader2, AlertCircle, Users, Circle, Square, RectangleHorizontal, Trash2, Edit3, CheckCircle, CreditCard, Banknote, QrCode, ExternalLink, Printer, Download, Minus } from 'lucide-react';

type TableShape = 'circle' | 'square' | 'rectangle';

const SHAPES: TableShape[] = ['circle', 'square', 'rectangle'];

function ShapeIcon({ shape, className }: { shape: TableShape; className: string }) {
  if (shape === 'circle') return <Circle className={className} />;
  if (shape === 'square') return <Square className={className} />;
  return <RectangleHorizontal className={className} />;
}

interface TableFormModalProps {
  title: string;
  submitLabel: string;
  submitting: boolean;
  numberValue: string;
  onNumberChange: (v: string) => void;
  shape: TableShape;
  onShapeChange: (s: TableShape) => void;
  seats: number;
  onSeatsChange: (n: number) => void;
  zoneLabel: string;
  /* Números ya ocupados en la zona (en edición excluye la mesa actual). */
  existingNumbers: number[];
  serverError: string | null;
  suggestedNumber: number | null;
  onSubmit: () => void;
  onClose: () => void;
}

/* Modal compartido para crear y editar mesas: validación en línea
   (número inválido o duplicado), siguiente número sugerido, stepper de
   capacidad y vista previa en vivo. Se envía con Enter. */
function TableFormModal({
  title,
  submitLabel,
  submitting,
  numberValue,
  onNumberChange,
  shape,
  onShapeChange,
  seats,
  onSeatsChange,
  zoneLabel,
  existingNumbers,
  serverError,
  suggestedNumber,
  onSubmit,
  onClose,
}: TableFormModalProps) {
  const parsed = parseInt(numberValue, 10);
  const invalid = !parsed || parsed <= 0;
  const duplicate = !invalid && existingNumbers.includes(parsed);
  const canSubmit = !invalid && !duplicate && !submitting;
  const showSuggestion =
    suggestedNumber !== null && !existingNumbers.includes(suggestedNumber) && (numberValue.trim() === '' || duplicate);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
        >
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="table-number" className="block text-sm font-medium text-slate-600 mb-2">Número de Mesa</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="table-number"
                  type="number"
                  min={1}
                  value={numberValue}
                  onChange={(e) => onNumberChange(e.target.value)}
                  placeholder="Ej: 1, 2, 3..."
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                    duplicate
                      ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-400'
                      : 'border-slate-200 focus:ring-teal-600/20 focus:border-teal-600'
                  }`}
                  autoFocus
                />
              </div>
              {duplicate ? (
                <p className="text-sm text-rose-600 mt-1.5">Ya existe la mesa {parsed} en esta zona.</p>
              ) : showSuggestion ? (
                <button
                  type="button"
                  onClick={() => onNumberChange(String(suggestedNumber))}
                  className="text-sm text-teal-700 font-medium mt-1.5 hover:underline"
                >
                  Usar siguiente disponible: {suggestedNumber}
                </button>
              ) : null}
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-600 mb-2">Forma</span>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de la mesa">
                {SHAPES.map((option) => {
                  const shapeConfig = SHAPE_CONFIG[option];
                  const selected = shape === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onShapeChange(option)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all duration-150 ${
                        selected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <ShapeIcon shape={option} className="w-6 h-6 text-slate-600" />
                      <span className="text-xs font-medium text-slate-600">{shapeConfig.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="table-seats" className="block text-sm font-medium text-slate-600 mb-2">Capacidad (lugares)</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSeatsChange(Math.max(2, seats - 1))}
                  disabled={seats <= 2}
                  aria-label="Quitar un lugar"
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  id="table-seats"
                  type="range"
                  min={2}
                  max={12}
                  value={seats}
                  onChange={(e) => onSeatsChange(parseInt(e.target.value, 10))}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => onSeatsChange(Math.min(12, seats + 1))}
                  disabled={seats >= 12}
                  aria-label="Agregar un lugar"
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-bold text-slate-700">{seats}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div
                aria-hidden="true"
                className={`flex items-center justify-center bg-teal-500 text-white font-bold shrink-0 ${
                  shape === 'circle' ? 'w-12 h-12 rounded-full text-base' : shape === 'square' ? 'w-12 h-12 rounded-lg text-base' : 'w-16 h-12 rounded-lg text-base'
                }`}
              >
                {invalid ? '–' : parsed}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {invalid ? 'Mesa sin número' : `Mesa ${parsed}`} · {SHAPE_CONFIG[shape].label}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {zoneLabel} · {seats} lugares
                </p>
              </div>
            </div>

            {serverError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{serverError}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 p-4 bg-slate-50">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100">Cancelar</button>
            <button type="submit" disabled={!canSubmit} className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50">
              {submitting ? 'Guardando...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FloorPlanProps {
  zone: ZoneType;
  zoneName?: string;
}

export function FloorPlan({ zone, zoneName }: FloorPlanProps) {
  const displayName = zoneName || zone;
  const { isAdmin } = useAccess();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableShape, setNewTableShape] = useState<'circle' | 'square' | 'rectangle'>('circle');
  const [newTableSeats, setNewTableSeats] = useState(4);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [brandingName, setBrandingName] = useState('');
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setRestaurantId(data.restaurantId ?? '');
        setBrandingName(data.branding?.name ?? '');
        setBrandingLogo(data.branding?.logoUrl ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const tableMenuUrl = (tableNumber: number) =>
    restaurantId
      ? buildTableMenuUrl(window.location.origin, restaurantId, tableNumber)
      : `${window.location.origin}/menu?table=${tableNumber}`;

  /* QR del menú de la mesa: se imprime y se pega en la mesa. */
  const openQrModal = async (table: Table) => {
    setQrTable(table);
    setQrDataUrl('');
    try {
      const dataUrl = await QRCode.toDataURL(tableMenuUrl(table.number), {
        width: 260,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate QR:', err);
    }
  };

  const printQr = () => {
    if (!qrTable || !qrDataUrl) return;
    openPrintWindow(
      tableCardsPrintSheetHtml(
        [{ qrDataUrl, zoneName: displayName, tableNumber: qrTable.number }],
        { restaurantName: brandingName, logoUrl: brandingLogo },
      ),
    );
  };

  const downloadQrCard = async () => {
    if (!qrTable || !qrDataUrl) return;
    try {
      const png = await buildTableCardPNG(
        { qrDataUrl, zoneName: displayName, tableNumber: qrTable.number },
        { restaurantName: brandingName, logoUrl: brandingLogo },
      );
      downloadDataUrl(png, `mesa-${qrTable.number}.png`);
    } catch (err) {
      console.error('Failed to generate card:', err);
    }
  };

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables?zone=${zone}`);
      if (!res.ok) throw new Error('Error al cargar mesas');
      const data = await res.json();
      const next = data.tables || [];
      /* Evita re-renderizar el plan si no cambió nada. */
      setTables(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
      setError('Error al cargar las mesas');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [zone]);

  useEffect(() => {
    setLoading(true);
    fetchTables();
    const interval = setInterval(fetchTables, 15000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  const handleCreateTable = async () => {
    const number = parseInt(newTableNumber, 10);
    if (!number || number <= 0) {
      setFormError('Ingresá un número de mesa válido');
      return;
    }
    if (tables.some((t) => t.number === number)) {
      setFormError(`Ya existe la mesa ${number} en esta zona`);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, zone, shape: newTableShape, seats: newTableSeats, position: { x: 100, y: 100 } }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear mesa');
      }

      await fetchTables();
      setShowCreateModal(false);
      setNewTableNumber('');
      setNewTableShape('circle');
      setNewTableSeats(4);
      setFormError(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear mesa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTable = async () => {
    if (!editingTable) return;

    const number = parseInt(newTableNumber, 10);
    if (!number || number <= 0) {
      setFormError('Ingresá un número de mesa válido');
      return;
    }
    if (tables.some((t) => t.id !== editingTable.id && t.number === number)) {
      setFormError(`Ya existe la mesa ${number} en esta zona`);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/tables/${editingTable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, shape: newTableShape, seats: newTableSeats }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar mesa');
      }

      await fetchTables();
      setShowEditModal(false);
      setEditingTable(null);
      setNewTableNumber('');
      setFormError(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al actualizar mesa');
    } finally {
      setSubmitting(false);
    }
  };

  const [statusError, setStatusError] = useState<Record<string, string>>({});

  const handleStatusChange = async (id: string, status: TableStatus) => {
    setStatusError((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/tables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error al actualizar estado');
      }
      await fetchTables();
    } catch (err) {
      console.error('Failed to update status:', err);
      setStatusError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Error al actualizar estado',
      }));
    }
  };

  /* Liberar solo tiene sentido sin cuenta abierta: el backend lo bloquea
     (422) si hay pedidos por cobrar, y acá se muestra el motivo. */
  const handleFreeTable = (table: Table) => {
    if (!confirm(`¿Liberar la mesa ${table.number}? Quedará disponible.`)) return;
    void handleStatusChange(table.id, 'available');
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta mesa?')) return;
    try {
      const res = await fetch(`/api/tables/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar mesa');
      await fetchTables();
    } catch (err) {
      console.error('Failed to delete table:', err);
    }
  };

  const openCreateModal = () => {
    const next = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) + 1 : 1;
    setNewTableNumber(String(next));
    setNewTableShape('circle');
    setNewTableSeats(4);
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (table: Table) => {
    setEditingTable(table);
    setNewTableNumber(table.number.toString());
    setNewTableShape(table.shape);
    setNewTableSeats(table.seats);
    setFormError(null);
    setShowEditModal(true);
  };

  const closeTableModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingTable(null);
    setFormError(null);
  };

  /* Escape cierra el modal de mesa. */
  useEffect(() => {
    if (!showCreateModal && !showEditModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setShowEditModal(false);
        setEditingTable(null);
        setFormError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreateModal, showEditModal]);

  /* Números ocupados y siguiente sugerido (solo para crear). */
  const createExistingNumbers = tables.map((t) => t.number);
  const suggestedNumber = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) + 1 : 1;
  const editExistingNumbers = editingTable ? tables.filter((t) => t.id !== editingTable.id).map((t) => t.number) : [];

  const statusCounts = {
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    pending_payment: tables.filter(t => t.status === 'pending_payment').length,
    paid: tables.filter(t => t.status === 'paid').length,
  };

  const statusIcons = { available: CheckCircle, occupied: Users, pending_payment: CreditCard, paid: Banknote };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600" />
              {displayName}
            </h2>
            <div className="flex items-center gap-2">
              {(Object.keys(STATUS_CONFIG) as TableStatus[]).map((status) => {
                const config = STATUS_CONFIG[status];
                const count = statusCounts[status];
                const StatusIcon = statusIcons[status];
                return (
                  <div key={status} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${config.bgLight} ${config.color}`} title={config.label}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {isAdmin && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-all duration-150 shadow-lg shadow-teal-600/20"
          >
            <Plus className="w-4 h-4" />
            Nueva Mesa
          </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex-1 p-4 overflow-auto">
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-600">No hay mesas</p>
            <p className="text-sm text-slate-400 mt-1">Añade mesas para comenzar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((table) => {
              const config = STATUS_CONFIG[table.status];
              const shapeConfig = SHAPE_CONFIG[table.shape];
              return (
                <div key={table.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
                  <div className={`${config.bgColor} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-lg bg-white/20 flex items-center justify-center ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}>
                          <span className="text-lg font-bold text-white">{table.number}</span>
                        </div>
                        <div>
                          <p className="text-white font-bold">Mesa {table.number}</p>
                          <p className="text-white/80 text-sm">{shapeConfig.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openQrModal(table)} title="Ver QR de la mesa" className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg">
                          <QrCode className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                        <>
                        <button onClick={() => openEditModal(table)} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteTable(table.id)} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center gap-4 mb-3 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{table.seats} lugares</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {table.shape === 'circle' && <Circle className="w-4 h-4" />}
                        {table.shape === 'square' && <Square className="w-4 h-4" />}
                        {table.shape === 'rectangle' && <RectangleHorizontal className="w-4 h-4" />}
                        <span>{shapeConfig.label}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${config.bgLight} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>

                    {table.status === 'available' || table.status === 'paid' ? (
                      <button
                        onClick={() => handleStatusChange(table.id, 'occupied')}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-all duration-150"
                      >
                        Marcar ocupada
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFreeTable(table)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all duration-150"
                      >
                        Liberar mesa
                      </button>
                    )}
                    {statusError[table.id] && (
                      <p className="text-xs text-rose-600 mt-2">{statusError[table.id]}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-2">La cuenta se cobra en Caja.</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <TableFormModal
          title={`Nueva Mesa · ${displayName}`}
          submitLabel="Crear Mesa"
          submitting={submitting}
          numberValue={newTableNumber}
          onNumberChange={setNewTableNumber}
          shape={newTableShape}
          onShapeChange={setNewTableShape}
          seats={newTableSeats}
          onSeatsChange={setNewTableSeats}
          zoneLabel={displayName}
          existingNumbers={createExistingNumbers}
          serverError={formError}
          suggestedNumber={suggestedNumber}
          onSubmit={handleCreateTable}
          onClose={closeTableModal}
        />
      )}

      {showEditModal && editingTable && (
        <TableFormModal
          title={`Editar Mesa ${editingTable.number}`}
          submitLabel="Guardar"
          submitting={submitting}
          numberValue={newTableNumber}
          onNumberChange={setNewTableNumber}
          shape={newTableShape}
          onShapeChange={setNewTableShape}
          seats={newTableSeats}
          onSeatsChange={setNewTableSeats}
          zoneLabel={displayName}
          existingNumbers={editExistingNumbers}
          serverError={formError}
          suggestedNumber={null}
          onSubmit={handleUpdateTable}
          onClose={closeTableModal}
        />
      )}

      {qrTable && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <p className="font-bold text-slate-800">{displayName} · Mesa {qrTable.number}</p>
                <p className="text-xs text-slate-500">Tarjeta lista para plastificar</p>
              </div>
              <button onClick={() => setQrTable(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center gap-3">
              {qrDataUrl ? (
                <TableCardPreview
                  restaurantName={brandingName}
                  logoUrl={brandingLogo}
                  qrDataUrl={qrDataUrl}
                  zoneName={displayName}
                  tableNumber={qrTable.number}
                />
              ) : (
                <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
              )}
              <p className="text-xs text-slate-400 text-center break-all">{tableMenuUrl(qrTable.number)}</p>
              <div className="flex gap-2 w-full mt-1">
                <button
                  type="button"
                  onClick={() => window.open(tableMenuUrl(qrTable.number), '_blank')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={downloadQrCard}
                  disabled={!qrDataUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  PNG
                </button>
                <button
                  type="button"
                  onClick={printQr}
                  disabled={!qrDataUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}