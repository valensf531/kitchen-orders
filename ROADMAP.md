# Roadmap — Lumen (kitchen-orders)

## Fase actual: cierre del proyecto
- [x] Flujos por rol probados end-to-end (admin, vendedor, cocinero)
- [x] Quitar `console.log` de debug en auth
- [x] Rediseño de la página de login
- [x] Deshabilitar la creación de cuentas desde el panel de login (+ script create-owner)
- [x] Generador de contraseñas al crear personal
- [x] Checkbox de bebidas por categoría + bottom nav móvil + fixes de cocina
- [x] Auditoría de Configuración (errores visibles en zonas/menú/etiquetas/QRs)
- [x] Validación de mesa en menú digital (ila 78 no entra) + nombres de zona
- [x] Rediseño del menú digital (hero limpio, carrusel chef, steppers, carrito flotante)
- [ ] **Deployar lo último en Vercel** — pendiente desde la auditoría de Config: commit + push + `vercel --prod` (sin migrate, no hubo schema nuevo)
- [ ] Marcar categoría "Bebidas" como bebidas en Configuración → Menú y probar checkbox con pedido nuevo
- [ ] Limpieza de usuarios/sesiones de prueba
- [ ] QR impreso en papel verificado con celular
- [ ] Caja real: cobro → libera mesa → suma en estadísticas
- [ ] Botón "cambiar rol" en Personal (para no editar la DB a mano)
- [ ] Bugs que aparezcan en prueba diaria
- [ ] **Fase Docker** (al final): Dockerfile + compose + DEPLOY.md listos, falta ejecutar en la VPS con Dokploy

## Futuro — alta prioridad (en orden)
1. **Puntos de fidelidad** — 1 punto por $X, canje configurable, puntos visibles en `/menu`. Retiene clientes y justifica el abono.
2. **Aviso "pedido listo" al mozo** — cuando cocina finaliza, notificar en Salón (sonido/badge). Cierra el loop cocina→salón.
3. **Cierre de caja y arqueo** — cerrar turno con total declarado vs. sistema.
4. **Modo kiosco con PIN** — PIN de 4 dígitos por personal para tablets compartidas, sin email+contraseña.
5. **Reporte diario al dueño** — ventas del día, ticket promedio y top platos por WhatsApp/email.
6. **Gestión de reservas** — calendario, turnos, no-shows, estado `reservada`. Producto aparte: hacerlo bien lleva 2–3 semanas.
7. **Estadisticas de trabajadores** - 

## Futuro — baja prioridad (solo a pedido)
7. **Personalización de QR por mesa** — colores, mensaje promo, QR por zona. (Base 80% hecha: tarjeta con logo/nombre/QR/mesa.)
8. **Preferencias por trabajador** — orden de secciones, sonido, idioma, modo oscuro.

## Modelo de negocio
- VPS única (€6–12/mes) + 1 contenedor + 1 DB por cliente + dominios personales con Dokploy.
- Actualizar a todos = rebuild de imagen + redeploy (minutos, sin duplicar código).
