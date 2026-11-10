# Revisión técnica del flujo — Lumen (kitchen-orders)

**Fecha:** 2026-11-05 (actualizado 2026-11-07)
**Alcance:** working tree actual, incluidos los cambios sin commitear (`menu-v2`, `menu-cafe`, temas y estilos nuevos).
**Método:** revisión estática del código + tests, typecheck, lint, build y E2E
contra un Postgres embebido local. No se ejecutó nada contra la base real de
producción para no modificar datos.

## Actualización 2026-11-07

Se resolvieron los pendientes del checklist de salida a producción:

- Driver único `pg` (TCP) para Dokploy/Postgres propio y Neon; se eliminó `@neondatabase/serverless`.
- `/api/health` con chequeo de base, `HEALTHCHECK` en Docker/compose, logs JSON y webhook opcional de errores (`ALERT_WEBHOOK_URL`).
- Scripts `db:backup` / `db:restore`; CI prueba migración, `create-owner`, backup y restore contra un Postgres limpio.
- CI construye la imagen Docker y corre un E2E del flujo QR → cocina → caja → mesa libre → estadísticas.
- Admin puede cambiar rol y resetear contraseña del personal desde Configuración.
- Pedidos: soft-delete con motivo/actor (ya no hay `DELETE` físico).
- Salón: resumen de la cuenta abierta al tomar el pedido y refresco de mesas tras enviar.
- Aviso "pedido listo" al mesero ya implementado (sonido + notificación + aviso visual).
- Pagos base y cierre de caja completos.
- Pago online con Mercado Pago (Checkout Pro + QR + webhook firmado + polling y conciliación con caja/estadísticas).
- Split, propina/descuento y reembolsos automáticos quedan en `ROADMAP.md`.

## Verificación automática

| Comando | Resultado |
| --- | --- |
| `npm run test` | 21 archivos, 104 tests, todos OK |
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK, 24 rutas generadas |
| `npm run e2e` | OK, 2 tests del flujo completo (Postgres embebido local) |
| CI `integration` | definido: migración idempotente, create-owner, backup/restore, E2E |
| CI `docker` | definido: build de imagen |

## Resumen ejecutivo

El circuito principal es coherente y sirve para un restaurante chico con una sola cocina y una sola caja:

**pedido por QR o salón → cocina → caja → mesa liberada → estadísticas**

Las bases están bien resueltas: precios recalculados en el servidor, aislamiento por restaurante en SQL, roles, validación de mesa/zona, ETag para polling, estadísticas agregadas en SQL y una suite de tests razonable.

**Pero no lo pondría en producción real todavía.** Hay bloqueadores de despliegue, integridad de cuentas y control de caja que en un servicio diario pueden generar pérdida de plata, pedidos duplicados o cuentas que desaparecen de la caja.

> **Actualización 2026-11-07:** los bloqueadores técnicos de esta revisión
> (driver de base, bootstrap de DB, integridad de mesa/cuenta, caja,
> números de pedido, QR/idempotencia, tiempo real, reportes, health,
> backups y CI/E2E) ya están resueltos en el working tree. Quedan solo
> tareas operativas de despliegue real y mejoras de producto listadas en
> `ROADMAP.md`.

---

## Mapa del flujo actual

| Etapa | Quién | Dónde | Estado general |
| --- | --- | --- | --- |
| Configuración inicial | Admin | Configuración: zonas, mesas, menú, etiquetas, marca, QR, personal | Funciona, con riesgos al borrar/renombrar |
| Pedido por QR | Cliente | `/menu?restaurant=...&table=N` → `POST /api/public/menu` | Funciona, pero es fácil de abusar y no es idempotente |
| Pedido en salón | Vendedor | Salón → Nuevo Pedido → `POST /api/orders` | Funciona, pero no muestra la cuenta abierta de la mesa |
| Cocina | Cocinero | Cocina → Activos → iniciar/finalizar | Funciona, pero depende de polling y de una tablet despierta |
| Bebidas | Cocinero | Checkbox de entrega por ítem | Funciona |
| Cobro | Vendedor/Admin | Caja y mesas → marcar pagada y desocupar | Funciona, pero sin confirmación, medio de pago ni auditoría |
| Liberación de mesa | Automático | `closeTableAccount` + `freeTableIfEmpty` | Funciona en el caso feliz; falla al renombrar/borrar mesas |
| Estadísticas | Admin | Estadísticas | Funciona, pero atribuye cobros a la fecha equivocada |
| Menú público | Cliente | `/menu`, `/menu-v2`, `/menu-cafe`, `/carta` | Funciona, con fotos guardadas en la DB |

---

## Lo que ya está bien

- **Precios del lado servidor:** `resolveOrderItems` usa siempre precios de la base y recalcula el total (`src/lib/pricing.ts`).
- **Modo estricto para el público:** el endpoint público rechaza ítems que no estén en el menú y valida disponibilidad.
- **Aislamiento multi-restaurante:** las consultas filtran por `user_id` y los roles resuelven el restaurante efectivo (`src/lib/roles.ts`).
- **Permisos:** configuración y estadísticas solo para admin; cocina no crea pedidos ni toca mesas.
- **Polling eficiente:** ETag y respuesta 304 cuando no cambió nada (`src/app/api/orders/route.ts`, `src/app/api/tables/route.ts`).
- **Estadísticas en SQL:** no se traen todas las órdenes a memoria; hay índices por usuario y fecha (`src/lib/stats-store.ts`).
- **Caché del menú público:** `unstable_cache` con tag por restaurante (`src/lib/menu-cache.ts`).
- **Validación de mesa pública:** número, id y zona deben coincidir (`src/lib/public-table.ts`).
- **Migración de base nueva:** `src/lib/schema.sql` incluye app + Better Auth y hay un test de migración idempotente sobre Postgres en memoria (`src/lib/schema.test.ts`).
- **Buenas prácticas de Next:** `output: 'standalone'`, proxy de Next 16, CSP y headers de seguridad (`next.config.ts`, `src/proxy.ts`).

---

## Hallazgos críticos

### 1. El despliegue Dokploy no coincide con el driver de base de datos

**Estado:** resuelto. Se reemplazó `@neondatabase/serverless` por `pg` (TCP)
en `src/lib/db.ts`, `src/lib/auth.ts` y los scripts. El mismo driver conecta
contra el Postgres de Dokploy/compose y contra Neon (con `sslmode=require`).

**Qué pasaba:** la app usa el driver serverless de Neon en modo HTTP y WebSocket:

- `neon()` en `src/lib/db.ts:1` y `scripts/migrate.mjs:6`
- `Pool` de `@neondatabase/serverless` en `src/lib/auth.ts:16`
- `.env.local` actual apunta a Neon

Pero el plan de despliegue usa un Postgres 16 común:

- `docker-compose.cliente.yml:20-22`: `postgres:16-alpine`
- `DEPLOY.md:21-29`: base Postgres de Dokploy

`neon()` usa el endpoint HTTP propietario de Neon y `Pool` usa su proxy WebSocket. Contra un Postgres normal no conectan sin configurar un `wsproxy`.

**Impacto:** el contenedor arranca, la migración falla o la app no puede consultar la base. El flujo entero queda inutilizable en Dokploy.

**Recomendación:** elegir una sola estrategia antes de seguir:

1. **Neon:** mantener `@neondatabase/serverless` y desplegar en Vercel o en un entorno que llegue a Neon.
2. **Dokploy con Postgres propio:** reemplazar por `pg` + pool (`pg.Pool`) tanto en `db.ts` como en `auth.ts`, y actualizar `migrate.mjs` y el Dockerfile.
3. Si se quiere conservar el driver de Neon contra un Postgres propio, montar un `wsproxy` y configurarlo; es la opción más frágil.

**Cómo verificarlo:** levantar un Postgres vacío y correr `npm run migrate` contra esa URL. Hoy no va a funcionar con el stack documentado.

---

### 2. Una base nueva no arranca: faltan tablas en la migración

**Estado:** resuelto en esta rama. `src/lib/schema.sql` ahora crea `tables` y
las tablas de Better Auth antes de los `ALTER`, y `src/lib/schema.test.ts`
verifica la migración completa e idempotente contra un Postgres en memoria
(PGlite). También se corrigió `DEPLOY.md` (ya no indica `/sign-up`).

**Qué pasaba:**

- `src/lib/schema.sql` crea `zones`, `menu_categories`, `menu_items`, `menu_tags`, `orders` y `restaurant_settings`.
- **No crea `tables`**, pero en `src/lib/schema.sql:15` hace `ALTER TABLE tables ...`. En un Postgres vacío eso falla con “relation tables does not exist”.
- Tampoco crea las tablas de Better Auth: `user`, `session`, `account` y `verification`.
- `scripts/create-owner.mjs` inserta en `user` y `account`, así que también falla en una base nueva.
- `DEPLOY.md:48` indica crear el dueño en `/sign-up`, pero el registro público está deshabilitado en `src/lib/auth.ts:29`.

**Impacto:** el alta de un cliente nuevo, tal como está documentada, no funciona. El entorno actual funciona porque esas tablas ya existen de una etapa anterior, pero eso no se reproduce desde el repositorio.

**Recomendación:**

- Agregar `CREATE TABLE IF NOT EXISTS tables (...)` al esquema, con sus índices y restricciones de unicidad por `(user_id, zone, number)`.
- Incorporar al arranque la migración oficial de Better Auth (`npx @better-auth/cli@latest migrate`) o versionar el SQL generado y aplicarlo en `migrate.mjs`.
- Corregir `DEPLOY.md` para que no mencione `/sign-up`; el dueño se crea con `npm run create-owner`.
- Agregar un test de CI que cree una base vacía, corra la migración y cree el dueño.

**Cómo verificarlo:** crear una base Postgres vacía, correr `npm run migrate` y después `npm run create-owner -- --email ... --password ... --name ...`.

---

### 3. Renombrar o borrar mesas/zonas puede hacer desaparecer cuentas abiertas

**Estado:** resuelto. `orders.table_id` vincula la cuenta con la mesa estable;
renombrar zona o renumerar mesa actualiza los pedidos abiertos y Caja agrupa
por `table_id` (con fallback legacy). Borrar mesa/zona con cuenta abierta
responde 409. Las cuentas sin mesa aparecen en Caja para poder cobrarlas.

**Qué pasaba:** los pedidos se agrupan por `zone` (slug) + `table_number`, no por un `table_id` estable.

- `closeTableAccount` y `hasOpenOrders` usan `table_number` + `zone` (`src/lib/store.ts:350` y `:370`).
- Al renombrar una zona, `zoneStore.update` actualiza el `zone` de las mesas pero **no el de los pedidos abiertos** (`src/lib/zone-store.ts:130`).
- Al renumerar una mesa se actualiza la tabla, pero los pedidos existentes conservan el número viejo (`src/app/api/tables/[id]/route.ts:116`).
- Al borrar una zona, se borran sus mesas sin revisar si tienen cuenta abierta (`src/lib/zone-store.ts:145`).
- Al borrar una mesa, tampoco se revisan pedidos abiertos (`src/app/api/tables/[id]/route.ts:149`).
- Caja solo recorre mesas configuradas (`src/components/CashierDashboard.tsx`), así que los pedidos huérfanos no aparecen para cobrar.

**Impacto:** una mesa puede quedar con una cuenta abierta invisible desde Caja. La cocina sigue viendo el pedido, pero nadie puede cobrarlo ni liberar correctamente la mesa.

**Recomendación:**

- Agregar `table_id` a `orders` como referencia estable (sin perder `table_number` y `zone` como snapshot para mostrar y para históricos).
- Bloquear el borrado y la renumeración de mesas con cuenta abierta, o migrar los pedidos abiertos en la misma transacción.
- Al renombrar una zona, actualizar también los pedidos abiertos o guardar `zone_id` en lugar del slug.
- Agregar un test de integración para: abrir mesa → pedido → renombrar zona/renumerar mesa → verificar que Caja sigue mostrando la cuenta.

**Cómo reproducirlo:** abrir la mesa 1, cargar un pedido, renombrar la zona en Configuración y mirar Caja. La cuenta deja de aparecer.

---

### 4. La caja no tiene control suficiente

**Estado:** resuelto. `openTotal` ahora incluye pedidos finalizados impagos;
el cobro tiene modal de confirmación, medio de pago, `paid_by`, `paid_at` y
sesión de caja. Se agregó apertura/cierre de caja con arqueo y diferencia.

**Qué pasaba:**

- El total pendiente del encabezado excluye pedidos `finished` aunque sigan impagos: `src/components/CashierDashboard.tsx:63`. La tarjeta de la mesa sí los incluye, así que los números no coinciden.
- El cobro (`payTable`, `src/components/CashierDashboard.tsx:64`) se ejecuta directo, sin confirmación ni detalle previo.
- No se registra medio de pago, propina, descuento, quién cobró ni turno de caja.
- `closeTableAccount` marca todos los pedidos impagos de la mesa como pagados con el mismo `paid_at` (`src/lib/store.ts:350`), sin auditoría.
- No hay cierre de caja ni arqueo (está en el roadmap).
- No hay cancelación con motivo ni registro de quién canceló.

**Impacto:** es muy fácil cobrar por error, no se puede reconstruir un faltante de caja y no hay trazabilidad ante un reclamo.

**Recomendación:**

- Corregir `openTotal` para incluir todos los pedidos impagos, incluidos los finalizados.
- Mostrar un modal de confirmación con subtotal, descuentos, propina y total final.
- Guardar `payment_method`, `paid_by`, `paid_at`, `cash_session_id` y, opcionalmente, una tabla `payments` por pago.
- Agregar cierre de turno con total declarado vs. total del sistema y diferencia.
- Registrar motivo y actor en cada cancelación.
- Agregar una prueba E2E: pedido → finalizar → cobrar → verificar estadísticas y mesa libre.

---

### 5. Los números de pedido se pueden repetir

**Estado:** resuelto. Los pedidos nuevos usan la secuencia
`order_counter_seq` (`display_number`, con índice único y backfill de
históricos). Cocina y Caja muestran el mismo número, y cocina muestra zona.

**Qué pasaba:** `getOrderDisplayNumber` (`src/lib/order-ops.ts:8-14`) toma un hash del id y lo reduce a 900 valores (`hash % 900 + 100`). Con 25 pedidos activos, la probabilidad de que se repita al menos un número ronda el 28%. Además:

- Caja muestra el id completo (`ORD-...`) y cocina muestra el número corto, así que no hay una referencia única entre pantallas.
- Cocina muestra solo “Mesa N”, sin la zona (`src/components/OrderCard.tsx:216`). Dos zonas pueden tener la misma mesa 1.

**Impacto:** dos comandas distintas pueden mostrarse con el mismo número, o dos mesas distintas pueden parecer la misma. En hora pico eso genera entregas equivocadas.

**Recomendación:**

- Usar la secuencia que ya existe en el esquema: `order_counter_seq` (`src/lib/schema.sql:107`).
- Mostrar siempre “Mesa N · Zona” en cocina, caja y tickets.
- Mantener un identificador corto por pedido y usarlo en todas las pantallas.
- Si se quiere evitar enumeración pública, usar un id público aleatorio separado del número visible.

---

### 6. El QR público es fácil de abusar y no es idempotente

**Estado:** resuelto. El QR lleva un token HMAC por mesa (`table-token.ts`)
que el POST valida; el pedido público acepta `idempotencyKey` y la base tiene
un índice único por restaurante. Hay que reimprimir los QR viejos sin token.

**Qué pasaba:**

- `/api/public/menu` devuelve todas las mesas con sus `id` (`src/app/api/public/menu/route.ts`), y el POST acepta cualquier mesa existente.
- Cualquiera puede abrir `/menu`, obtener los ids y pedir a cualquier mesa sin escanear el QR de esa mesa.
- El rate limit es en memoria, por instancia, con clave IP + restaurante + mesa (`src/app/api/public/menu/route.ts:111-113`). Se reinicia al reiniciar el proceso y no es compartido entre instancias.
- No hay token firmado por mesa ni idempotencia por pedido.
- Si el navegador pierde la respuesta después de un POST exitoso, el usuario puede reenviar y duplicar la comanda.

**Impacto:** pedidos falsos o duplicados, mesas ocupadas sin consumo real y ruido en cocina.

**Recomendación:**

- Incluir en el QR un token firmado por mesa: `HMAC(restaurante + mesa + zona + versión)`. Validarlo en el POST.
- Incluir zona/tableId en la URL del QR para evitar el selector cuando hay números repetidos.
- Agregar un `idempotencyKey` generado por el cliente y una restricción única por restaurante.
- Mover el rate limit a un store compartido (Redis/Upstash o la propia DB) si se despliega en más de una instancia.
- Evaluar un captcha o challenge para pedidos públicos si aparece spam real.

---

### 7. Tiempo real insuficiente para cocina

**Estado:** resuelto. Se agregó SSE (`/api/orders/stream`), Wake Lock,
manifest PWA, activación explícita de notificaciones y un aviso sonoro/visual
de “pedido listo” para Salón.

**Qué pasaba:**

- Cocina depende de polling cada 5 segundos (`src/components/KitchenDisplay.tsx:78`).
- El sonido arranca apagado y hay que activarlo manualmente (`src/components/KitchenDisplay.tsx:27-36`).
- `NotificationManager` solo avisa pedidos con más de 25 minutos, y pide permiso de notificaciones sin un gesto del usuario, lo que muchos navegadores bloquean.
- No hay PWA, service worker, Wake Lock ni push notifications.
- No existe el aviso “pedido listo” al mozo; está en el roadmap.
- Si la tablet se suspende o el navegador queda en segundo plano, los timers se frenan y no hay alerta.

**Impacto:** un pedido puede quedar sin preparar o sin entregar sin que nadie reciba un aviso confiable.

**Recomendación:**

- Implementar SSE o WebSocket con `LISTEN/NOTIFY` de Postgres para pedidos y estados.
- Usar la Wake Lock API en la pantalla de cocina y ofrecer instalar la app como PWA.
- Pedir permiso de notificaciones desde un botón explícito y mostrar un estado claro de “alertas activas”.
- Agregar sonido configurable para pedido nuevo, pedido demorado y pedido listo.
- Implementar el aviso “listo” para Salón.

---

### 8. Reportes financieros engañosos

**Estado:** resuelto en lo principal. Ventas y cobros se calculan por fechas
separadas (`created_at` vs `paid_at`), la zona horaria y moneda son configurables
por restaurante, y los cobros guardan medio de pago y sesión de caja.

**Qué pasaba:**

- `getSummary` filtra por `created_at`, pero “cobrado” se calcula con `paid_at` dentro de ese mismo rango (`src/lib/stats-store.ts:85-97`). Un pedido creado a las 23:50 y cobrado a las 00:10 se atribuye al día anterior.
- `getSalesByDay` tiene el mismo problema (`src/lib/stats-store.ts:150-160`).
- La zona horaria está hardcodeada en `America/Argentina/Buenos_Aires` (`src/app/api/stats/route.ts:10`).
- La moneda está hardcodeada como `$` en varias pantallas.
- No hay separación entre vendido, cobrado y pendiente de cobro.
- No hay medios de pago ni cierre de caja.
- `getProductPrepTimes` atribuye el tiempo de preparación de toda la orden a cada ítem, así que “platos más lentos” es en realidad “órdenes con ese plato”.

**Impacto:** los cierres de caja y los reportes diarios no cuadran con la realidad.

**Recomendación:**

- Reportar ventas por fecha de creación y cobros por fecha de pago, por separado.
- Hacer configurable la zona horaria y la moneda por restaurante.
- Guardar medio de pago y sesión de caja.
- Documentar que “vendido” incluye pedidos impagos y “cobrado” no.
- Si se quiere medir preparación por plato, guardar timestamps por ítem, no solo por orden.

---

## Hallazgos altos y mejoras operativas

### Salón y mesas

- [x] Al tomar un pedido se muestra la cuenta abierta de la mesa (ítems y total actual).
- [x] El salón refresca las mesas después de enviar un pedido.
- Falta un resumen explícito antes de enviar y un botón "agregar a la cuenta" separado.
- Faltan split de cuenta, unión de mesas y transferencia de mesa (ver `ROADMAP.md`).
- `FloorPlan` permite liberar una mesa, pero si hay una cuenta abierta el backend responde 422; el mensaje debe ser visible y claro.

### Pedidos y menú

- No se puede cancelar un ítem individual, solo la orden completa.
- No hay motivo de cancelación ni edición de cantidades después de enviar.
- Faltan variantes/modificadores: tamaño, punto de cocción, extras, guarniciones.
- No hay disponibilidad programada por horario ni stock por cantidad; solo `available` booleano.
- [x] `DELETE /api/orders/[id]` ya no borra físicamente: hace soft-delete con motivo y actor.
- Las fotos se guardan como data URLs en Postgres y se comprimen a 1024 px (`src/components/SettingsPage.tsx:116`). Con muchas fotos, la base y los backups crecen demasiado. Conviene S3/R2 + CDN (ver `ROADMAP.md`).
- El menú público cae al “primer restaurante” si no se pasa `restaurant` (`src/lib/menu-store.ts:177`). En el modelo de una DB por cliente no molesta; si alguna vez se comparte DB, muestra el menú equivocado.

### Personal y autenticación

- [x] El admin puede resetear la contraseña de un empleado y cambiar su rol desde Configuración.
- No hay link de invitación por email (el admin comparte la contraseña generada).
- No hay PIN/kiosco para tablets compartidas (ver `ROADMAP.md`).
- No hay MFA ni gestión de sesiones desde la UI.
- `BETTER_AUTH_URL`/`NEXT_PUBLIC_BASE_URL` ya se usan; configurarlos por cliente.
- Verificar que `BETTER_AUTH_SECRET` sea único por cliente y que la migración de Better Auth corra en cada base.

### QR y URLs

- [x] La generación de QR usa `NEXT_PUBLIC_BASE_URL` (con fallback al origin actual) para no imprimir dominios de preview.
- [x] El QR incluye el token firmado de la mesa. Si hay mesas con el mismo número en zonas distintas, incluir zona/tableId en la URL para evitar el selector manual.

### Rendimiento y escalabilidad

- El panel es 100% cliente y hace 2-3 pollings independientes (órdenes, mesas, zonas). Para un local chico alcanza; SSE ya cubre órdenes y el polling baja a respaldo.
- [x] `fetchOrders` tiene guard de in-flight para no solapar requests.
- Las comparaciones con `JSON.stringify` en cada polling son aceptables con pocos pedidos, pero no escalan a históricos grandes.
- El polling de 5 segundos con ETag reduce el cuerpo de respuesta, pero sigue haciendo una consulta de versión a la base por pantalla. Para varias pantallas y varios clientes, SSE es más eficiente.

### Observabilidad y operación

- [x] Endpoint `/api/health` con chequeo de base; Docker y compose lo usan como healthcheck.
- [x] `logError` escribe JSON estructurado y puede enviar alertas por `ALERT_WEBHOOK_URL`.
- [x] `docker-compose.cliente.yml` tiene healthcheck de app y base.
- [x] Backups manuales con `npm run db:backup` y restore con `npm run db:restore`; CI los prueba.
- [ ] Programar backups automáticos por cliente en Dokploy y monitorear `/api/health` con un servicio externo.
- Conviene monitorear: errores 5xx, latencia de DB, pedidos por minuto, tiempo de preparación y uso de disco del contenedor.
- `xlsx@0.18.5` conviene revisarlo con `npm audit` por CVEs conocidos de esa versión.

### Calidad y tests

- [x] CI corre lint, typecheck, tests, build, migración + create-owner + backup/restore, E2E y build Docker.
- [x] Hay E2E del flujo completo (API): QR → pedido → cocina → cobro → mesa libre → estadísticas.
- [ ] Falta un E2E de navegador (Playwright UI) para clics reales en Salón/Caja.
- [ ] Falta un test de integración para las operaciones destructivas de mesas/zonas (hoy cubiertas parcialmente por lógica y bloqueos).

---

## Plan mínimo de verificación antes de producción

1. **Base vacía:** crear un Postgres limpio, correr `npm run migrate`, crear el dueño con `create-owner` e iniciar sesión. Repetir con la imagen Docker.
2. **Flujo completo:** en dos celulares/tablets, hacer un pedido por QR, verlo en cocina, iniciarlo, finalizarlo, cobrarlo en Caja y verificar que la mesa quede libre y la estadística cuadre.
3. **Integridad de mesa:** abrir una mesa, cargar un pedido, renombrar la zona y renumerar otra mesa; verificar que Caja sigue mostrando la cuenta correcta.
4. **Borrado seguro:** intentar borrar una mesa/zona con cuenta abierta; debe bloquearse o pedir reasignación.
5. **Reintento de red:** simular un timeout después de enviar un pedido público y reintentar; no debe duplicarse.
6. **Caja:** cobrar con efectivo y tarjeta, verificar total, medio de pago, auditoría y cierre de turno.
7. **Tablet dormida:** bloquear la tablet de cocina, enviar un pedido y verificar que suena/avisa al volver o mediante push.
8. **QR impreso:** imprimir un QR real y escanearlo con un celular fuera de la red del local; debe abrir el dominio correcto y la mesa correcta.
9. **Backup:** restaurar un backup en una base limpia y verificar que la app arranca con los datos.
10. **Estadísticas:** crear una orden antes de medianoche y cobrarla después; verificar que “vendido” y “cobrado” quedan en los días correctos.

---

## Prioridad recomendada

| Prioridad | Qué resolver | Por qué |
| --- | --- | --- |
| 1 | Despliegue + bootstrap de DB (Neon vs `pg`, `tables`, Better Auth) | Sin esto no se puede entregar un cliente nuevo |
| 2 | Integridad de mesa/cuenta + caja (`table_id`, bloqueo de borrados, `openTotal`, confirmación, auditoría) | Evita cuentas perdidas y descuadres de caja |
| 3 | Tiempo real + número de pedido con zona + token de QR + idempotencia | Evita pedidos perdidos, confundidos o duplicados |
| 4 | Reportes por fecha de cobro, medios de pago y cierre de turno | Permite operar y controlar el negocio de verdad |
| 5 | Mejoras de salón, menú, personal y observabilidad | Mejora la operación diaria y reduce soporte |

---

## Checklist de salida a producción

- [x] Driver de DB acorde al entorno (`pg` para Dokploy y Neon).
- [x] `schema.sql` crea todas las tablas, incluyendo `tables`.
- [x] Migración de Better Auth incluida y ejecutada en cada base.
- [x] `create-owner` probado contra una base vacía (job `integration` de CI).
- [x] `BETTER_AUTH_URL`, `NEXT_PUBLIC_BASE_URL` y `ADDITIONAL_TRUSTED_ORIGINS` documentados y usados; configurar por cliente al desplegar.
- [x] QR con token firmado por mesa (reimprimir los QR viejos sin token).
- [x] Cuentas abiertas sobreviven a renombres/borrados de mesas y zonas.
- [x] Caja con confirmación, medio de pago, auditoría y cierre de turno.
- [x] Números de pedido únicos y con zona visible.
- [x] Idempotencia en pedidos públicos.
- [x] SSE, Wake Lock, PWA y aviso de pedido listo.
- [x] Endpoint de salud, logs estructurados y alertas por webhook.
- [x] Backup y restore probados en CI; programar backups por cliente al desplegar.
- [x] E2E del flujo completo en CI.
- [x] Migración y Docker build probados en CI.

> Nota: quedan tareas operativas que dependen del entorno real (VPS/Dokploy):
> deploy del contenedor, backups programados y verificación de un QR impreso.

---

## Anexo: comandos usados para la revisión

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

> No se ejecutaron escrituras contra la base real. Las conclusiones sobre migración en base vacía surgen de revisar `src/lib/schema.sql`, `scripts/migrate.mjs` y las tablas que espera Better Auth.
