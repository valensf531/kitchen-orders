# Roadmap — Lumen (kitchen-orders)

_Actualizado: 2026-11-11_

## Estado actual: cierre del proyecto
- [x] Flujos por rol probados end-to-end (admin, vendedor, cocinero)
- [x] Quitar `console.log` de debug en auth
- [x] Rediseño de la página de login
- [x] Deshabilitar la creación de cuentas desde el panel de login (+ script create-owner)
- [x] Generador de contraseñas al crear personal
- [x] Checkbox de bebidas por categoría + bottom nav móvil + fixes de cocina
- [x] Auditoría de Configuración (errores visibles en zonas/menú/etiquetas/QRs)
- [x] Validación de mesa en menú digital (ila 78 no entra) + nombres de zona
- [x] Rediseño del menú digital (hero limpio, carrusel chef, steppers, carrito flotante)
- [x] **Deployar lo último en Vercel** — `24891ad` deployado con `vercel --prod` (sin migrate; https://kitchen-orders-pi.vercel.app)
- [x] Categoría "Bebidas" marcada como bebidas + checkbox verificado con pedido nuevo
- [x] Botón "cambiar rol" en Personal (vendedor ↔ cocina)
- [x] Reset de contraseña de un miembro del personal desde Configuración
- [x] **Driver de base único:** `pg` (TCP) para Dokploy/Postgres propio y Neon
- [x] `/api/health` + `HEALTHCHECK` de Docker/compose + logs JSON + webhook de errores
- [x] Migración, `create-owner`, backup y restore probados en CI con Postgres limpio
- [x] Build de la imagen Docker en CI
- [x] E2E del flujo completo en CI (QR → cocina → caja → mesa libre → estadísticas)
- [x] Soft-delete de pedidos con motivo y actor (no se borra físicamente)
- [x] Salón: resumen de cuenta abierta al tomar el pedido + refresco de mesas
- [ ] Limpieza de usuarios/sesiones de prueba
- [ ] QR impreso en papel verificado con celular
- [ ] Caja real en producción: cobro → libera mesa → suma en estadísticas
- [ ] Deploy real en la VPS con Dokploy (imagen + base + dominio + backups programados)
- [ ] Bugs que aparezcan en prueba diaria

## Notificaciones (estado)
- [x] **Aviso al mesero:** cuando cocina finaliza un pedido, Salón recibe sonido,
  notificación del navegador y aviso visual de "Pedido listo" (12 s).
- [x] Aviso de pedido nuevo a cocina por SSE + sonido + Wake Lock/PWA.
- [ ] **Aviso al cliente:** ver el estado del pedido desde el menú público
  (recibido → en cocina → listo) con SSE y notificación push de la PWA.
- [ ] Notificaciones push reales (service worker + suscripción) para cocina,
  salón y cliente, incluso con la app cerrada.
- [ ] Sonidos configurables por rol (nuevo / demorado / listo).

## Pagos (estado)
- [x] **Pagos base:** medio de pago (efectivo, tarjeta, transferencia, otro),
  `paid_by`, `paid_at`, sesión de caja y auditoría por pedido.
- [x] **Cierre de caja y arqueo:** apertura/cierre de turno, total declarado vs.
  sistema y diferencia (implementado en Caja).
- [x] Cobro con confirmación, subtotal y liberación de mesa.
- [ ] **Split de cuenta:** dividir por comensal, por ítem o en partes iguales
  (hoy se puede cobrar por pedido individual).
- [ ] Propina y descuento manuales con registro en el cobro.
- [ ] **Pago online:** MercadoPago/QR o link de pago antes de enviar el pedido.
- [ ] Reembolsos/anulaciones de pago con motivo y actor.
- [ ] Conciliación automática completa contra el cierre de caja.

## Reportes (estado)
- [ ] **Motor de reportes agnóstico al canal** — períodos en la zona horaria del
  restaurante, comparación con el período anterior, idempotencia y registro de
  entregas (`report_settings`, `report_deliveries`).
- [ ] **Configuración → Reportes** — canal, frecuencia (diaria/semanal/
  quincenal/mensual), horario, email/teléfono, opt-in, botón de prueba,
  historial y baja.
- [ ] **Email primero (prioridad alta)** — resumen semanal por defecto y diario
  opt-in; Resend o SMTP. Costo: ~USD 0–20/mes en total, no por cliente.
- [ ] **Cron protegido** — `POST /api/reports/run` con `REPORT_CRON_SECRET`,
  tick diario/horario y envío único por período.
- [ ] **Botón "Compartir por WhatsApp"** en Estadísticas (manual, sin Meta).
- [ ] **WhatsApp Cloud API (fase 2)** — plantillas es_AR, opt-in, webhook de
  estados/bajas y número central. Costo: ~USD 0,026–0,03 por mensaje en AR.
- Análisis completo, contenido por frecuencia y plan técnico en
  `REPORTE-WHATSAPP.md`.

## Futuro — alta prioridad (en orden)
1. **Reporte periódico al dueño por email (WhatsApp después)** — ventas, cobrado/pendiente, ticket promedio, top platos, tiempos de cocina, cancelaciones y caja. Frecuencia configurable (semanal por defecto; diaria/quincenal/mensual). Email primero con Resend/SMTP; WhatsApp Cloud API como fase 2. Ver `REPORTE-WHATSAPP.md`.
2. **Puntos de fidelidad** — 1 punto por compra; tarjeta configurable (ej. 8 compras → 15% en la última), inicio de tarjeta configurable por el dueño.
3. **Aviso al cliente** — seguimiento del pedido en `/menu` con SSE + push PWA (ver sección Notificaciones).
4. **Pagos avanzados** — split, propina/descuento, pago online y conciliación.
5. **Modo kiosco con PIN** — PIN de 4 dígitos por personal para tablets compartidas, sin email+contraseña.
6. **Gestión de reservas** — calendario, turnos, no-shows, estado `reservada`. Producto aparte: 2–3 semanas.
7. **Estadísticas de trabajadores** — perfil por trabajador visible solo para el administrador.
8. **Mejorar módulo Configuración** — UI/UX, orden y separación de opciones nuevas.
9. **Salón avanzado** — unir/transferir mesas y dividir cuentas desde el salón.
10. **Menú avanzado** — variantes/modificadores (tamaño, punto de cocción, extras), stock por cantidad y disponibilidad por horario.
11. **Fotos en S3/R2 + CDN** — dejar de guardar data URLs en Postgres.
12. **Cancelar ítem individual** — con motivo y recálculo del total (hoy se cancela la orden completa).

## Futuro — baja prioridad (solo a pedido)
13. **Personalización de QR por mesa** — colores, mensaje promo, QR por zona. (Base 80% hecha.)
14. **Preferencias por trabajador** — orden de secciones, sonido, idioma, modo oscuro.

## Modelo de negocio
- VPS única (€6–12/mes) + 1 contenedor + 1 DB por cliente + dominios personales con Dokploy.
- Actualizar a todos = rebuild de imagen + redeploy (minutos, sin duplicar código).
- Backups: programados en Dokploy o `npm run db:backup` por cron; restore probado en CI.
