-- ============================================================================
-- Better Auth 1.7.6 (PostgreSQL) + additionalFields de src/lib/auth.ts.
-- Estas tablas las usa src/lib/auth.ts. Se crean acá para que una base nueva
-- arranque completa con `npm run migrate` (sin correr el CLI de Better Auth).
-- Si se actualiza better-auth o cambian los user.additionalFields de auth.ts,
-- comparar esta sección con el schema oficial y actualizarla antes de migrar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL,
  image TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  role TEXT NOT NULL DEFAULT 'admin',
  "ownerId" TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_owner ON "user"("ownerId");

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON session("userId");

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
  "refreshTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON account("userId");

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

-- Compatibilidad con bases creadas antes de esta migración.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'admin';
UPDATE "user" SET role = 'admin' WHERE role IS NULL OR role = '';
ALTER TABLE "user" ALTER COLUMN role SET NOT NULL;

-- Tabla de zonas
CREATE TABLE IF NOT EXISTS zones (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_zones_user_id ON zones(user_id);

-- Tabla de mesas (zona guardada por slug, ver zones.slug)
CREATE TABLE IF NOT EXISTS tables (
  id VARCHAR(50) PRIMARY KEY,
  number INTEGER NOT NULL,
  zone VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  position_x NUMERIC DEFAULT 100,
  position_y NUMERIC DEFAULT 100,
  shape VARCHAR(20) DEFAULT 'circle',
  seats INTEGER DEFAULT 4,
  user_id VARCHAR(255),
  CONSTRAINT tables_number_zone_key UNIQUE (number, zone),
  CONSTRAINT tables_status_check CHECK (status IN ('available', 'occupied', 'pending_payment', 'paid')),
  CONSTRAINT tables_shape_check CHECK (shape IN ('circle', 'square', 'rectangle'))
);

CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);
CREATE INDEX IF NOT EXISTS idx_tables_zone ON tables(zone);
CREATE INDEX IF NOT EXISTS idx_tables_user_id ON tables(user_id);

-- Eliminar restricción antigua de zone en tables
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_zone_check;
ALTER TABLE tables ALTER COLUMN zone TYPE VARCHAR(100);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS position_x NUMERIC DEFAULT 100;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS position_y NUMERIC DEFAULT 100;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS shape VARCHAR(20) DEFAULT 'circle';
ALTER TABLE tables ADD COLUMN IF NOT EXISTS seats INTEGER DEFAULT 4;

-- Tabla de categorías de menú
CREATE TABLE IF NOT EXISTS menu_categories (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_user_id ON menu_categories(user_id);

-- Tipo de categoría: 'food' o 'drink'. La cocina usa 'drink' para mostrar
-- el checkbox de bebidas (se entregan primero).
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'food';

-- Tabla de items de menú
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  category_id VARCHAR(50) NOT NULL,
  available BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_user_id ON menu_items(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS ingredients TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

-- Tabla de etiquetas personalizadas del menú
CREATE TABLE IF NOT EXISTS menu_tags (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  label VARCHAR(50) NOT NULL,
  icon VARCHAR(10),
  tone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_tags_user_id ON menu_tags(user_id);

-- Tabla de órdenes (referencia del esquema real)
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  table_number INTEGER,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'received',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processing_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  started_by TEXT,
  started_by_name TEXT,
  finished_by TEXT,
  finished_by_name TEXT,
  canceled_at TIMESTAMP WITH TIME ZONE,
  canceled_by TEXT,
  canceled_by_name TEXT,
  cancel_reason TEXT,
  source VARCHAR(50),
  notes TEXT,
  zone VARCHAR(100),
  table_id VARCHAR(50),
  display_number INTEGER,
  client_order_id VARCHAR(100),
  payment_method VARCHAR(20),
  paid_by TEXT,
  paid_by_name TEXT,
  cash_session_id VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_updated ON orders(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_paid ON orders(user_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_cash_session ON orders(cash_session_id);

-- Compatibilidad con bases anteriores: columnas agregadas después del esquema
-- original de orders. En una base nueva ya existen por el CREATE de arriba.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_by_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_by_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS canceled_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS canceled_by_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS display_number INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_order_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_by_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_session_id VARCHAR(50);

-- Idempotencia del menú público: un mismo intento de pedido no se duplica.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_client
  ON orders(user_id, client_order_id)
  WHERE client_order_id IS NOT NULL;

-- Vincular pedidos históricos con su mesa estable (si la mesa todavía existe).
UPDATE orders o
SET table_id = t.id
FROM tables t
WHERE o.table_id IS NULL
  AND o.table_number IS NOT NULL
  AND t.number = o.table_number
  AND t.zone = o.zone
  AND t.user_id = o.user_id;

-- Número visible único y estable de cada pedido (no depende de un hash).
CREATE SEQUENCE IF NOT EXISTS order_counter_seq AS BIGINT START 1;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS display_number INTEGER;

UPDATE orders o
SET display_number = numbered.new_number
FROM (
  SELECT id, nextval('order_counter_seq') AS new_number
  FROM orders
  WHERE display_number IS NULL
  ORDER BY created_at, id
) numbered
WHERE o.id = numbered.id
  AND o.display_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_display_number
  ON orders(display_number)
  WHERE display_number IS NOT NULL;

-- Sesiones de caja (apertura, cierre y arqueo).
CREATE TABLE IF NOT EXISTS cash_sessions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  opened_by TEXT,
  opened_by_name TEXT,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  opening_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  closed_by TEXT,
  closed_by_name TEXT,
  closed_at TIMESTAMP WITH TIME ZONE,
  closing_amount NUMERIC(10, 2),
  expected_amount NUMERIC(10, 2),
  difference NUMERIC(10, 2),
  notes TEXT,
  CONSTRAINT cash_sessions_status_check CHECK (status IN ('open', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_status
  ON cash_sessions(user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_one_open
  ON cash_sessions(user_id)
  WHERE status = 'open';

-- Marca del restaurante para tarjetas QR plastificables y menú público.
-- user_id = id del dueño (restaurantId efectivo). Solo el admin la edita.
CREATE TABLE IF NOT EXISTS restaurant_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(80) NOT NULL DEFAULT '',
  logo_url TEXT,
  menu_style TEXT NOT NULL DEFAULT 'photos',
  theme_primary TEXT NOT NULL DEFAULT '#0f766e',
  theme_accent TEXT NOT NULL DEFAULT '#f59e0b',
  theme_background TEXT NOT NULL DEFAULT '#fffbf7',
  theme_surface TEXT NOT NULL DEFAULT '#ffffff',
  theme_text TEXT NOT NULL DEFAULT '#1c1917',
  custom_theme_name TEXT NOT NULL DEFAULT '',
  custom_theme_primary TEXT NOT NULL DEFAULT '#0f766e',
  custom_theme_accent TEXT NOT NULL DEFAULT '#f59e0b',
  custom_theme_background TEXT NOT NULL DEFAULT '#fffbf7',
  custom_theme_surface TEXT NOT NULL DEFAULT '#ffffff',
  custom_theme_text TEXT NOT NULL DEFAULT '#1c1917',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  currency_code TEXT NOT NULL DEFAULT 'ARS',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Estilo del menú público: 'photos' (tarjetas con foto) o 'list' (lista compacta).
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS menu_style TEXT NOT NULL DEFAULT 'photos';

-- Paleta del menú moderno (colores personalizables por restaurante).
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS theme_primary TEXT NOT NULL DEFAULT '#0f766e';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS theme_accent TEXT NOT NULL DEFAULT '#f59e0b';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS theme_background TEXT NOT NULL DEFAULT '#fffbf7';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS theme_surface TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS theme_text TEXT NOT NULL DEFAULT '#1c1917';

-- Tema personalizado guardado por el restaurante (nombre + paleta reutilizable).
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS custom_theme_name TEXT NOT NULL DEFAULT '';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS custom_theme_primary TEXT NOT NULL DEFAULT '#0f766e';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS custom_theme_accent TEXT NOT NULL DEFAULT '#f59e0b';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS custom_theme_background TEXT NOT NULL DEFAULT '#fffbf7';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS custom_theme_surface TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS custom_theme_text TEXT NOT NULL DEFAULT '#1c1917';

-- Reportes y precios por restaurante.
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS currency_symbol TEXT NOT NULL DEFAULT '$';
