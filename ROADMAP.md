# Roadmap — Lumen (kitchen-orders)

## Fase actual: cierre del proyecto
- [ ] Flujos por rol probados end-to-end (admin, vendedor, cocinero)
- [ ] Limpieza de usuarios/sesiones de prueba
- [ ] QR impreso real verificado con celular
- [ ] Caja real: cobro → libera mesa → suma en estadísticas
- [ ] Quitar `console.log` de debug en auth
- [ ] Rediseño de la página de login
- [ ] Deshabilitar la creación de cuentas desde el panel de login
- [ ] Bugs que aparezcan en prueba diaria
- [ ] **Fase Docker** (al final): Dockerfile + compose plantilla + script multi-cliente + guía de alta

## Futuro — alta prioridad (en orden)
1. **Puntos de fidelidad** — 1 punto por $X, canje configurable, puntos visibles en `/menu`. Retiene clientes y justifica el abono.
2. **Aviso "pedido listo" al mozo** — cuando cocina finaliza, notificar en Salón (sonido/badge). Cierra el loop cocina→salón.
3. **Cierre de caja y arqueo** — cerrar turno con total declarado vs. sistema.
4. **Modo kiosco con PIN** — PIN de 4 dígitos por personal para tablets compartidas, sin email+contraseña.
5. **Reporte diario al dueño** — ventas del día, ticket promedio y top platos por WhatsApp/email.
6. **Gestión de reservas** — calendario, turnos, no-shows, estado `reservada`. Producto aparte: hacerlo bien lleva 2–3 semanas.

## Futuro — baja prioridad (solo a pedido)
7. **Personalización de QR por mesa** — colores, mensaje promo, QR por zona. (Base 80% hecha: tarjeta con logo/nombre/QR/mesa.)
8. **Preferencias por trabajador** — orden de secciones, sonido, idioma, modo oscuro.

## Modelo de negocio
- VPS única (€6–12/mes) + 1 contenedor + 1 DB por cliente + dominios personales con Caddy.
- Actualizar a todos = rebuild de imagen + redeploy (minutos, sin duplicar código).
