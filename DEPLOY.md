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
   (idempotente) y luego la app.
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
4. Deploy → crear cuenta dueña en `/sign-up`. Listo.

## 4. Actualizar a todos los clientes
1. Pushear los cambios al repo.
2. En Dokploy, **Redeploy** en cada App (o activar auto-deploy por push).
3. La migración corre sola en cada arranque; es segura de repetir.

## 5. Backups
- Activar **Scheduled Backups** de cada database en Dokploy (o `pg_dump`
  por cron a almacenamiento externo). Probar restaurar una vez.

## Notas
- Nunca compartir `BETTER_AUTH_SECRET` entre clientes.
- Los QR generados usan el dominio del env: verificar un QR impreso real
  por cliente nuevo.
- Alternativa sin panel: `docker-compose.cliente.yml` + Caddy como proxy
  (ver ese archivo).
