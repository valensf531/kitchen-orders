# Lumen — gestión de pedidos para restaurantes

App Next.js (App Router) con cocina, salón, caja, menú público por QR y
estadísticas. Una imagen / un contenedor por restaurante (`output: standalone`).

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar DATABASE_URL y secretos
npm run migrate              # crea la base completa (idempotente)
npm run create-owner -- --email dueno@ejemplo.com --password ClaveSegura123 --name "Nombre"
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build de producción / arranque |
| `npm test` | Tests unitarios (Vitest + PGlite) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run migrate` | Aplica `src/lib/schema.sql` (app + Better Auth) |
| `npm run create-owner -- ...` | Alta del dueño de un restaurante |
| `npm run db:backup` | Backup con `pg_dump` en `backups/` |
| `npm run db:restore -- --file <dump> --yes` | Restore destructivo |
| `npm run seed:e2e` | Datos de prueba para el E2E |
| `npm run e2e` | E2E con Playwright (requiere build y base migrada) |

## Base de datos

Se usa `pg` (TCP) contra cualquier Postgres: el de Dokploy/compose o Neon
(con `sslmode=require` en la URL). La app expone `GET /api/health` para
Docker/Dokploy y monitoreo.

## Deploy

Ver [DEPLOY.md](./DEPLOY.md). Roadmap y estado de producto en
[ROADMAP.md](./ROADMAP.md); revisión técnica del flujo en
[REVISION-FLUJO.md](./REVISION-FLUJO.md).

## CI

`.github/workflows/ci.yml` corre lint, typecheck, tests, build, migración +
create-owner + backup/restore sobre Postgres limpio, E2E del flujo completo y
build de la imagen Docker.
