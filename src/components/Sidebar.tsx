'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from '@/lib/auth-client';
import { useAccess } from '@/hooks/use-access';
import { Zone } from '@/types/table';
import { 
  ChefHat, 
  UtensilsCrossed, 
  LogOut, 
  User, 
  ChevronDown, 
  ChevronRight,
  MapPin,
  Flame,
  CheckCircle,
  XCircle,
  Menu,
  X,
  Settings, Banknote,
  BarChart3,
  Loader2
} from 'lucide-react';
import Image from 'next/image';

export type SidebarSection = 'kitchen' | 'dining' | 'cashier' | 'stats' | 'settings';
export type KitchenTab = 'active' | 'received' | 'processing' | 'finished' | 'canceled';
export type DiningTab = string;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
  activeKitchenTab: KitchenTab;
  onKitchenTabChange: (tab: KitchenTab) => void;
  activeDiningTab: DiningTab;
  onDiningTabChange: (tab: DiningTab) => void;
  activeOrdersCount: number;
  receivedCount: number;
  processingCount: number;
  finishedCount: number;
  canceledCount: number;
}

const kitchenTabs = [
  { id: 'active' as KitchenTab, label: 'Activos', icon: Flame },
  { id: 'received' as KitchenTab, label: 'Recibidos', icon: Flame },
  { id: 'processing' as KitchenTab, label: 'En Progreso', icon: Flame },
  { id: 'finished' as KitchenTab, label: 'Finalizados', icon: CheckCircle },
  { id: 'canceled' as KitchenTab, label: 'Cancelados', icon: XCircle },
];

interface SidebarContentProps {
  session: { user?: { name?: string | null; email?: string | null } } | null;
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
  activeKitchenTab: KitchenTab;
  onKitchenTabChange: (tab: KitchenTab) => void;
  activeDiningTab: DiningTab;
  onDiningTabChange: (tab: DiningTab) => void;
  activeOrdersCount: number;
  receivedCount: number;
  processingCount: number;
  finishedCount: number;
  canceledCount: number;
  kitchenExpanded: boolean;
  setKitchenExpanded: (v: boolean) => void;
  diningExpanded: boolean;
  setDiningExpanded: (v: boolean) => void;
  onSignOut: () => void;
  zones: Zone[];
  loadingZones: boolean;
  showStats: boolean;
  showSettings: boolean;
  /* Cocinero: solo ve Cocina (ni Salón ni Caja). */
  kitchenOnly: boolean;
  roleLabel: string;
}

function SidebarContent({
  session,
  activeSection,
  onSectionChange,
  activeKitchenTab,
  onKitchenTabChange,
  activeDiningTab,
  onDiningTabChange,
  activeOrdersCount,
  receivedCount,
  processingCount,
  finishedCount,
  canceledCount,
  kitchenExpanded,
  setKitchenExpanded,
  diningExpanded,
  setDiningExpanded,
  onSignOut,
  zones,
  loadingZones,
  showStats,
  showSettings,
  kitchenOnly,
  roleLabel,
}: SidebarContentProps) {
  const counts = { active: activeOrdersCount, received: receivedCount, processing: processingCount, finished: finishedCount, canceled: canceledCount };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Image 
            src="/logo.png" 
            alt="Lumen Logo" 
            width={44}
            height={44}
            className="w-11 h-11 rounded-xl"
          />
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Lumen</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Restaurant</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        <button
          onClick={() => {
            onSectionChange('kitchen');
            setKitchenExpanded(true);
          }}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-150 ${
            activeSection === 'kitchen' 
              ? 'bg-indigo-50 text-indigo-700' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <ChefHat className="w-5 h-5" />
            <span className="font-medium">Cocina</span>
          </div>
          <div className="flex items-center gap-2">
            {activeOrdersCount > 0 && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
                {activeOrdersCount}
              </span>
            )}
            {kitchenExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>
        
        {kitchenExpanded && (
          <div className="ml-3 pl-3 border-l border-slate-200 space-y-0.5">
            {kitchenTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === 'kitchen' && activeKitchenTab === tab.id;
              const count = counts[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    onSectionChange('kitchen');
                    onKitchenTabChange(tab.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                    isActive 
                      ? 'bg-slate-100 text-slate-800 font-medium' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!kitchenOnly && (
        <>
        <button
          onClick={() => {
            onSectionChange('dining');
            setDiningExpanded(true);
          }}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-150 ${
            activeSection === 'dining' 
              ? 'bg-teal-50 text-teal-700' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="w-5 h-5" />
            <span className="font-medium">Salón</span>
          </div>
          {diningExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        
        {diningExpanded && (
          <div className="ml-3 pl-3 border-l border-slate-200 space-y-0.5">
            <button
              onClick={() => {
                onSectionChange('dining');
                onDiningTabChange('orders');
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                activeSection === 'dining' && activeDiningTab === 'orders'
                  ? 'bg-slate-100 text-slate-800 font-medium' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Nuevo Pedido</span>
            </button>
            
            {loadingZones ? (
              <div className="flex items-center gap-2 px-3 py-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Cargando...</span>
              </div>
            ) : zones.length === 0 ? (
              <div className="px-3 py-2 text-slate-400 text-sm">
                Sin zonas
              </div>
            ) : (
              zones.map((zone) => {
                const isActive = activeSection === 'dining' && activeDiningTab === zone.slug;
                return (
                  <button
                    key={zone.id}
                    onClick={() => {
                      onSectionChange('dining');
                      onDiningTabChange(zone.slug);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                      isActive 
                        ? 'bg-slate-100 text-slate-800 font-medium' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{zone.name}</span>
                  </button>
                );
              })
            )}
          </div>
        )}

        <button onClick={() => onSectionChange('cashier')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${activeSection === 'cashier' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Banknote className="w-5 h-5" /><span className="font-medium">Caja y mesas</span>
        </button>
        </>
        )}

        {showStats && (
          <button onClick={() => onSectionChange('stats')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${activeSection === 'stats' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-100'}`}>
            <BarChart3 className="w-5 h-5" /><span className="font-medium">Estadísticas</span>
          </button>
        )}

        {showSettings && (
        <button
          onClick={() => onSectionChange('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
            activeSection === 'settings' 
              ? 'bg-slate-100 text-slate-800' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Configuración</span>
        </button>
        )}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{session?.user?.name || 'Usuario'}</p>
              <p className="text-[10px] text-slate-400 truncate">{session?.user?.email}</p>
              <span className={`mt-1 inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${roleLabel === 'Administrador' ? 'bg-indigo-100 text-indigo-700' : roleLabel === 'Cocinero' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                {roleLabel}
              </span>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  activeSection,
  onSectionChange,
  activeKitchenTab,
  onKitchenTabChange,
  activeDiningTab,
  onDiningTabChange,
  activeOrdersCount,
  receivedCount,
  processingCount,
  finishedCount,
  canceledCount,
}: SidebarProps) {
  const { data: session } = useSession();
  const { isAdmin, isKitchen, role } = useAccess();
  const [kitchenExpanded, setKitchenExpanded] = useState(true);
  const [diningExpanded, setDiningExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchZones = async () => {
      try {
        const res = await fetch('/api/zones');
        if (!active || !res.ok) return;
        const data = await res.json();
        const next = data.zones || [];
        /* Evita re-renderizar el sidebar en cada polling si no cambió nada. */
        setZones(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      } catch (error) {
        console.error('Failed to fetch zones:', error);
      } finally {
        if (active) setLoadingZones(false);
      }
    };
    fetchZones();
    const interval = setInterval(fetchZones, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    window.location.href = '/sign-in';
  };

  const handleSectionChange = (section: SidebarSection) => {
    onSectionChange(section);
  };

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2.5 bg-white text-slate-700 rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-200
        lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent
          session={session}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          activeKitchenTab={activeKitchenTab}
          onKitchenTabChange={onKitchenTabChange}
          activeDiningTab={activeDiningTab}
          onDiningTabChange={onDiningTabChange}
          activeOrdersCount={activeOrdersCount}
          receivedCount={receivedCount}
          processingCount={processingCount}
          finishedCount={finishedCount}
          canceledCount={canceledCount}
          kitchenExpanded={kitchenExpanded}
          setKitchenExpanded={setKitchenExpanded}
          diningExpanded={diningExpanded}
          setDiningExpanded={setDiningExpanded}
          onSignOut={handleSignOut}
          zones={zones}
          loadingZones={loadingZones}
          showStats={isAdmin}
          showSettings={isAdmin}
          kitchenOnly={isKitchen}
          roleLabel={isAdmin ? 'Administrador' : role === 'kitchen' ? 'Cocinero' : 'Vendedor'}
        />
      </aside>
    </>
  );
}
