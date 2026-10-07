/* Tarjetas QR plastificables por mesa: URL por mesa, PNG en canvas y
   HTML de impresión. Las funciones puras son node-safe (testeadas);
   las que tocan canvas/document solo corren en el cliente. */

export const TABLE_CARD_W = 600;
export const TABLE_CARD_H = 850;

/* URL del menú para una mesa: incluye restaurante + mesa para que el
   pedido caiga en el restaurante correcto (cuentas de personal). */
export function buildTableMenuUrl(origin: string, restaurantId: string, tableNumber: number): string {
  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  return `${base}/menu?restaurant=${encodeURIComponent(restaurantId)}&table=${encodeURIComponent(String(tableNumber))}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface TableCardData {
  qrDataUrl: string;
  zoneName: string;
  tableNumber: number;
}

export interface TableCardBranding {
  restaurantName: string;
  logoUrl: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

function fitContain(srcW: number, srcH: number, maxW: number, maxH: number): { w: number; h: number } {
  const scale = Math.min(maxW / srcW, maxH / srcH, 1);
  return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) };
}

/* Muestra el nombre de zona lindo: si llega un slug huérfano
   ("salon_interno"), al menos se lee con espacios. */
export function formatZoneName(zoneName: string): string {
  return zoneName.replace(/_/g, ' ');
}

/* Achica la letra hasta que el texto entra (sin aplastarlo como hace
   fillText con maxWidth). Devuelve el tamaño final. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
  weight: number,
  minSize: number,
): number {
  let size = baseSize;
  const apply = (s: number) => {
    ctx.font = `${weight} ${s}px system-ui, sans-serif`;
  };
  apply(size);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    apply(size);
  }
  return size;
}

/* Compone la tarjeta en un canvas y la devuelve como PNG (data-URL),
   lista para descargar y plastificar. El alto se calcula según el
   contenido (con o sin logo, nombres largos) para que nada se corte ni
   se superponga: el pie siempre va último. Solo cliente. */
export async function buildTableCardPNG(
  card: TableCardData,
  branding: TableCardBranding,
): Promise<string> {
  const name = branding.restaurantName.trim() || 'Nuestro restaurante';
  const place = `${formatZoneName(card.zoneName)} · Mesa ${card.tableNumber}`;
  const maxTextWidth = TABLE_CARD_W - 96;

  /* Precarga: el alto final depende del logo (si carga). */
  const [logo, qr] = await Promise.all([
    branding.logoUrl ? loadImage(branding.logoUrl).catch(() => null) : Promise.resolve(null),
    loadImage(card.qrDataUrl),
  ]);
  const logoBox = logo ? fitContain(logo.width, logo.height, 220, 120) : null;

  /* Medición en un canvas auxiliar para fijar el alto antes de dibujar. */
  const meas = document.createElement('canvas').getContext('2d');
  if (!meas) throw new Error('canvas');
  meas.textAlign = 'center';
  const nameSize = fitFont(meas, name, maxTextWidth, 44, 800, 26);
  const placeSize = fitFont(meas, place, maxTextWidth, 44, 800, 26);

  const QR_SIZE = 400;
  const height =
    56 + // margen superior
    (logoBox ? logoBox.h + 20 : 0) +
    (nameSize + 14) +
    (24 + 24) + // subtítulo + aire
    (QR_SIZE + 24 + 28) + // QR con marco + aire
    (placeSize + 28) + // zona · mesa + aire
    20 + // pie
    44; // margen inferior

  const canvas = document.createElement('canvas');
  canvas.width = TABLE_CARD_W;
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  /* Fondo + borde */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = 56;

  if (logo && logoBox) {
    ctx.drawImage(logo, (TABLE_CARD_W - logoBox.w) / 2, y, logoBox.w, logoBox.h);
    y += logoBox.h + 20;
  }

  /* Nombre del negocio */
  ctx.fillStyle = '#0f172a';
  fitFont(ctx, name, maxTextWidth, 44, 800, 26);
  ctx.fillText(name, TABLE_CARD_W / 2, y);
  y += nameSize + 14;

  ctx.fillStyle = '#64748b';
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText('Escaneá para pedir', TABLE_CARD_W / 2, y);
  y += 24 + 24;

  /* QR con marco */
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  const qrX = (TABLE_CARD_W - QR_SIZE) / 2;
  ctx.fillRect(qrX - 12, y - 12, QR_SIZE + 24, QR_SIZE + 24);
  ctx.strokeRect(qrX - 12, y - 12, QR_SIZE + 24, QR_SIZE + 24);
  ctx.drawImage(qr, qrX, y, QR_SIZE, QR_SIZE);
  y += QR_SIZE + 24 + 28;

  /* Zona + mesa */
  ctx.fillStyle = '#0f172a';
  fitFont(ctx, place, maxTextWidth, 44, 800, 26);
  ctx.fillText(place, TABLE_CARD_W / 2, y);
  y += placeSize + 28;

  /* Pie con sello Lumen (siempre último) */
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 20px system-ui, sans-serif';
  ctx.fillText('Hecho con Lumen', TABLE_CARD_W / 2, y);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* Una tarjeta como HTML autónomo (con estilos inline) para la ventana
   de impresión. Escapa el nombre para evitar inyección. */
export function tableCardPrintHtml(card: TableCardData, branding: TableCardBranding): string {
  const name = escapeHtml(branding.restaurantName.trim() || 'Nuestro restaurante');
  const place = escapeHtml(`${formatZoneName(card.zoneName)} · Mesa ${card.tableNumber}`);
  const logo = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" style="max-width:200px;max-height:120px;object-fit:contain;" />`
    : '';
  return `<div class="table-card">
    ${logo}
    <h1>${name}</h1>
    <p class="sub">Escaneá para pedir</p>
    <img class="qr" src="${card.qrDataUrl}" alt="QR ${place}" />
    <p class="place">${place}</p>
    <p class="foot">Hecho con Lumen</p>
  </div>`;
}

/* Hoja de impresión con todas las tarjetas (una por página). */
export function tableCardsPrintSheetHtml(cards: TableCardData[], branding: TableCardBranding): string {
  const body = cards.map((card) => tableCardPrintHtml(card, branding)).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Tarjetas QR</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #fff; }
  .table-card { width: 90mm; min-height: 127mm; margin: 8mm auto; padding: 10mm 8mm; border: 2px solid #e2e8f0; border-radius: 6mm; text-align: center; page-break-inside: avoid; }
  .table-card h1 { font-size: 22pt; margin: 4mm 0 1mm; }
  .table-card .sub { color: #64748b; margin: 0 0 4mm; font-size: 11pt; }
  .table-card .qr { width: 60mm; height: 60mm; }
  .table-card .place { font-size: 18pt; font-weight: 800; margin: 4mm 0 0; }
  .table-card .foot { color: #94a3b8; font-size: 9pt; margin: 3mm 0 0; }
  @media print { .table-card { border: 1px solid #cbd5e1; } }
</style></head><body>${body}<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script></body></html>`;
}

export function openPrintWindow(html: string): void {
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}
