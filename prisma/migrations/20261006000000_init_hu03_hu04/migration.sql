-- Migration: 20261006000000_init_hu03_hu04
-- Descripción: Creación de tablas de Catálogo de Productos (HU-03) y Lotes/Inventario (HU-04)
-- Responsable: Cesar Sanchez (Desarrollador Backend)

-- CreateEnum: Categorías de Producto
CREATE TYPE "CategoriaProducto" AS ENUM ('MODEL_KITS', 'FIGURAS', 'ACCESORIOS', 'HERRAMIENTAS', 'OTROS');

-- CreateEnum: Escalas
CREATE TYPE "EscalaProducto" AS ENUM ('ESCALA_1_144', 'ESCALA_1_100', 'ESCALA_1_60', 'SIN_ESCALA', 'NO_APLICA');

-- CreateEnum: Estado del Producto
CREATE TYPE "EstadoProducto" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum: Estado del Lote
CREATE TYPE "EstadoLote" AS ENUM ('EN_TRANSITO', 'RECIBIDO', 'PROCESADO', 'CANCELADO');

-- CreateEnum: Estado de Unidad de Stock
CREATE TYPE "EstadoUnidadStock" AS ENUM ('DISPONIBLE', 'RESERVADO', 'VENDIDO', 'DEFECTUOSO');

-- CreateTable: productos (HU-03)
CREATE TABLE "productos" (
    "id_producto" SERIAL NOT NULL,
    "codigo_sku" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "categoria" "CategoriaProducto" NOT NULL DEFAULT 'MODEL_KITS',
    "serie_franquicia" VARCHAR(100),
    "escala" "EscalaProducto" NOT NULL DEFAULT 'NO_APLICA',
    "marca_fabricante" VARCHAR(100) NOT NULL,
    "precio_soles" DECIMAL(10,2) NOT NULL,
    "imagen_principal_url" VARCHAR(500) NOT NULL,
    "estado_producto" "EstadoProducto" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable: lotes_ingreso (HU-04)
CREATE TABLE "lotes_ingreso" (
    "id_lote" SERIAL NOT NULL,
    "codigo_lote" VARCHAR(30) NOT NULL,
    "proveedor" VARCHAR(150) NOT NULL,
    "fecha_llegada" TIMESTAMP(3),
    "estado_lote" "EstadoLote" NOT NULL DEFAULT 'RECIBIDO',
    "costo_flete_total" DECIMAL(10,2),
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_ingreso_pkey" PRIMARY KEY ("id_lote")
);

-- CreateTable: inventario_unidades (HU-04 / Cálculo dinámico de disponibilidad para HU-03)
CREATE TABLE "inventario_unidades" (
    "id_inventario" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "id_lote" INTEGER,
    "codigo_serie_unitario" VARCHAR(50) NOT NULL,
    "estado_stock" "EstadoUnidadStock" NOT NULL DEFAULT 'DISPONIBLE',
    "costo_adquisicion" DECIMAL(10,2),
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_unidades_pkey" PRIMARY KEY ("id_inventario")
);

-- CreateIndexes & Unique Constraints
CREATE UNIQUE INDEX "productos_codigo_sku_key" ON "productos"("codigo_sku");
CREATE UNIQUE INDEX "unique_producto_version" ON "productos"("nombre", "marca_fabricante", "escala", "serie_franquicia");
CREATE INDEX "idx_producto_nombre" ON "productos"("nombre");
CREATE INDEX "idx_producto_categoria" ON "productos"("categoria");
CREATE INDEX "idx_producto_estado" ON "productos"("estado_producto");

CREATE UNIQUE INDEX "lotes_ingreso_codigo_lote_key" ON "lotes_ingreso"("codigo_lote");

CREATE UNIQUE INDEX "inventario_unidades_codigo_serie_unitario_key" ON "inventario_unidades"("codigo_serie_unitario");
CREATE INDEX "idx_inventario_disp" ON "inventario_unidades"("id_producto", "estado_stock");

-- AddForeignKey
ALTER TABLE "inventario_unidades" ADD CONSTRAINT "inventario_unidades_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventario_unidades" ADD CONSTRAINT "inventario_unidades_id_lote_fkey" FOREIGN KEY ("id_lote") REFERENCES "lotes_ingreso"("id_lote") ON DELETE SET NULL ON UPDATE CASCADE;
