'use client';

import { formatZoneName } from '@/lib/table-card';

/* Vista previa fiel de la tarjeta plastificable: mismo contenido que el
   PNG generado en canvas (logo, nombre, QR, zona·mesa, sello Lumen). */

interface TableCardPreviewProps {
  restaurantName: string;
  logoUrl: string | null;
  qrDataUrl: string;
  zoneName: string;
  tableNumber: number;
  compact?: boolean;
}

export function TableCardPreview({
  restaurantName,
  logoUrl,
  qrDataUrl,
  zoneName,
  tableNumber,
}: TableCardPreviewProps) {
  const name = restaurantName.trim() || 'Nuestro restaurante';
  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 w-full max-w-[300px] mx-auto p-6 text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- preview local (data URL); next/image no aplica.
        <img src={logoUrl} alt={`Logo de ${name}`} className="max-w-[180px] max-h-[110px] object-contain mx-auto" />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto">
          <span className="text-2xl font-black text-slate-300">{name.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <h3 className="text-xl font-extrabold text-slate-900 mt-3 leading-tight break-words">{name}</h3>
      <p className="text-xs text-slate-500 mt-1">Escaneá para pedir</p>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- QR generado como data URL; next/image no lo optimiza.
        <img src={qrDataUrl} alt={`QR ${zoneName} mesa ${tableNumber}`} className="w-52 h-52 mx-auto mt-4 bg-white" />
      ) : (
        <div className="w-52 h-52 mx-auto mt-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex items-center justify-center">
          <span className="text-xs text-slate-400">Generando QR…</span>
        </div>
      )}
      <p className="text-lg font-extrabold text-slate-900 mt-4">
        {formatZoneName(zoneName)} · Mesa {tableNumber}
      </p>
      <p className="text-[11px] text-slate-400 mt-1">Hecho con Lumen</p>
    </div>
  );
}
