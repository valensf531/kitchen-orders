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

-- Eliminar restricción antigua de zone en tables
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_zone_check;
ALTER TABLE tables ALTER COLUMN zone TYPE VARCHAR(100);

-- Agregar user_id a tables para aislamiento multi-tenant
ALTER TABLE tables ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_tables_user_id ON tables(user_id);

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

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Auditoría de cocina: quién inició y quién finalizó cada pedido
-- (nombre como snapshot para que sobreviva si se borra el personal).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_by_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_by_name TEXT;

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
  source VARCHAR(50),
  notes TEXT,
  zone VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_paid ON orders(user_id, paid_at);

-- Secuencia de ids legibles de órdenes (ORD-0001, ORD-0002, ...)
CREATE SEQUENCE IF NOT EXISTS order_counter_seq AS BIGINT START 1;

-- Roles por restaurante (better-auth user.additionalFields: role, ownerId).
-- ownerId NULL = la cuenta es dueña de sus propios datos.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
CREATE INDEX IF NOT EXISTS idx_user_owner ON "user"("ownerId");
UPDATE "user" SET role = 'admin' WHERE role IS NULL OR role = '';

-- Marca del restaurante para tarjetas QR plastificables y menú público.
-- user_id = id del dueño (restaurantId efectivo). Solo el admin la edita.
CREATE TABLE IF NOT EXISTS restaurant_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(80) NOT NULL DEFAULT '',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
