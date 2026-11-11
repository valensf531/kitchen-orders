# Deploy multi-cliente con Dokploy (1 VPS, N restaurantes)

Modelo: **una imagen, un contenedor + una base por cliente**. El código no se
duplica nunca; lo que cambia por cliente son 4 env vars + dominio + DB.

## 0. Requisitos
- VPS con 4 GB RAM mínimo (Hetzner/Contabo, ~€6–12/mes) y Ubuntu.
- Repo git accesible (GitHub) con este código.
- DNS de cada cliente apuntando a la IP de la VPS (registro A).

## 1. Instalar Dokploy en la VPS
```bash
curl -sSL https://dokploy.com/install.sh | sh
```
Entrá al panel en `http://IP-VPS:3000` y creá el usuario admin.

## 2. Primer cliente
1. En Dokploy: **Create Project** (ej. `lumen`) → **Create Application** desde el repo
   GitHub, rama principal. Dokploy detecta el `Dockerfile` solo.
2. **Add Database → PostgreSQL 16** dentro del mismo proyecto.
3. En la App → **Environment**, definir (ver `.env.example`):
   - `DATABASE_URL` = la interna de la database (formato
     `postgresql://usuario:password@nombre-db:5432/nombre-db`).
   - `BETTER_AUTH_URL` y `NEXT_PUBLIC_BASE_URL` = `https://dominio-del-cliente`.
   - `BETTER_AUTH_SECRET` = uno nuevo por cliente (`openssl rand -hex 32`).
     Nunca repetir entre clientes.
   - `ADDITIONAL_TRUSTED_ORIGINS` = alias extra separados por coma (opcional).
4. En la App → **Domains**: agregar el dominio del cliente (TLS automático).
5. **Deploy**. Al arrancar, el contenedor corre `node scripts/migrate.mjs`
   (idempotente) y luego la app. La migración crea también las tablas de
   Better Auth (`user`, `session`, `account`, `verification`): no hace falta
   correr el CLI de Better Auth ni ningún paso manual sobre una base nueva.
6. Entrar a `https://dominio-del-cliente/sign-in` con la cuenta dueña
   (creada abajo). El registro público está desactivado a propósito.

## 2b. Crear la cuenta dueña de un cliente
El registro desde la web está cerrado (nadie se auto-crea restaurantes).
El dueño lo das de alta vos por única vez contra SU base:
```bash
DATABASE_URL="postgresql://..." npm run create-owner -- \
  --email dueno@ejemplo.com --password ClaveSegura123 --name "Nombre"
```
El personal (vendedores/cocineros) lo crea después cada dueño desde
Configuración → Personal.

## 3. Cliente nuevo (5 minutos)
1. Duplicar la App dentro del proyecto (o crear otra igual).
2. Nueva Database Postgres + `DATABASE_URL` nueva.
3. Nuevo `BETTER_AUTH_SECRET`, nuevo dominio, `BETTER_AUTH_URL` nuevo.
4. Deploy (la migración crea todas las tablas) → crear la cuenta dueña con
   `npm run create-owner` contra la base del cliente (ver sección 2b). Listo.
   No uses `/sign-up`: el registro público está deshabilitado a propósito.

## 4. Actualizar a todos los clientes
1. Pushear los cambios al repo.
2. En Dokploy, **Redeploy** en cada App (o activar auto-deploy por push).
3. La migración corre sola en cada arranque; es segura de repetir.

## 5. Backups
- Opción recomendada: activar **Scheduled Backups** de cada database en Dokploy
  (o `pg_dump` por cron a almacenamiento externo).
- Backups manuales desde el repo o el contenedor:
  ```bash
  DATABASE_URL="postgresql://..." npm run db:backup
  ```
  Genera `backups/lumen-YYYYMMDD-HHmmss.dump` (configurable con `BACKUP_DIR`).
- Restore (destructivo, probarlo siempre contra una base de prueba):
  ```bash
  DATABASE_URL="postgresql://..." npm run db:restore -- \
    --file backups/lumen-20260101-120000.dump --yes
  ```
- El CI prueba migración, create-owner, backup y restore contra un Postgres
  limpio en cada push (job `integration`).

## 6. Salud y alertas
- La app expone `GET /api/health`: responde 200 si la app y la base están bien,
  503 si la base falla. Docker y Dokploy usan ese endpoint como healthcheck.
- `ALERT_WEBHOOK_URL` (opcional) recibe un POST por cada error de servidor;
  sirve para Discord, Slack o un endpoint propio. Los logs salen en JSON por
  línea para poder filtrarlos en el panel.
- Monitoreo externo sugerido: apuntar Uptime Kuma/Better Stack a `/api/health`
  y alertar si falla 2 veces seguidas.

## Notas
- La app usa `pg` (TCP) contra cualquier Postgres: sirve el Postgres de
  Dokploy/compose y también Neon. En Neon la URL debe incluir `sslmode=require`.
- La migración incluye las tablas de Better Auth en `src/lib/schema.sql`.
  Al actualizar `better-auth`, revisar esa sección contra el schema oficial
  antes de desplegar (el test `src/lib/schema.test.ts` valida la base vacía).
- Los QR de mesa incluyen un token firmado. Después de este cambio hay que
  **reimprimir los QR existentes**: los códigos viejos sin token ya no aceptan
  pedidos. El token usa `PUBLIC_ORDER_SECRET` o, si no está definido,
  `BETTER_AUTH_SECRET`. Cambiar ese secreto también obliga a reimprimir.
- La zona horaria y la moneda se configuran por restaurante en
  Configuración → Marca del local.
- Nunca compartir `BETTER_AUTH_SECRET` entre clientes.
- Los QR generados usan el dominio del env: verificar un QR impreso real
  por cliente nuevo.
- Alternativa sin panel: `docker-compose.cliente.yml` + Caddy como proxy
  (ver ese archivo).
