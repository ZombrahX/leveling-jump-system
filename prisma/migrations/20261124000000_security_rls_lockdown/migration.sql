-- Migration: 20261124000000_security_rls_lockdown
-- Descripción: Endurecimiento integral de Row Level Security (RLS) en Supabase PostgreSQL
-- Garantiza RLS activo en las 12 tablas del esquema public y revoca políticas permisivas (FOR ALL TO anon) en PostgREST.

-- 1. Activar Row Level Security (RLS) en todas las tablas del esquema public
ALTER TABLE IF EXISTS public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lotes_ingreso ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventario_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pagos_reserva ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ventas_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cotizaciones_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.intereses_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public._prisma_migrations ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas permisivas previas que permitían acceso o mutación directa a 'anon' vía PostgREST
DROP POLICY IF EXISTS allow_public_select_insert_cotizaciones ON public.cotizaciones;
DROP POLICY IF EXISTS allow_public_select_insert_cotizaciones_detalle ON public.cotizaciones_detalle;
DROP POLICY IF EXISTS allow_insert_intereses_producto ON public.intereses_producto;
DROP POLICY IF EXISTS allow_select_staff_intereses_producto ON public.intereses_producto;

-- 3. Permitir a PostgREST (anon / authenticated) únicamente lectura del catálogo público activo (productos)
DROP POLICY IF EXISTS public_read_active_products ON public.productos;
CREATE POLICY public_read_active_products
  ON public.productos
  FOR SELECT
  TO anon, authenticated
  USING (estado_producto = 'ACTIVO');

-- 4. Revocar permisos de escritura directa desde el rol público 'anon' de PostgREST
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
