-- Migration: 20261114000000_hu05_ventas_multicanal
-- Descripción: Creación de tablas de Venta Multicanal (HU-05) y Auditoría de Series Vendidas
-- Responsable: Cesar Sanchez (Desarrollador Backend)

-- CreateEnum: CanalVenta
CREATE TYPE "CanalVenta" AS ENUM ('TIKTOK', 'FACEBOOK', 'FERIA', 'WEB', 'WHATSAPP', 'OTRO');

-- CreateEnum: MedioPagoVenta
CREATE TYPE "MedioPagoVenta" AS ENUM ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA', 'OTRO');

-- CreateEnum: EstadoVenta
CREATE TYPE "EstadoVenta" AS ENUM ('COMPLETADA', 'ANULADA');

-- CreateTable: ventas
CREATE TABLE "ventas" (
    "id_venta" SERIAL NOT NULL,
    "codigo_venta" VARCHAR(30) NOT NULL,
    "canal_origen" "CanalVenta" NOT NULL DEFAULT 'FERIA',
    "medio_pago" "MedioPagoVenta" NOT NULL DEFAULT 'EFECTIVO',
    "monto_total" DECIMAL(10,2) NOT NULL,
    "estado_venta" "EstadoVenta" NOT NULL DEFAULT 'COMPLETADA',
    "cliente_referencia" VARCHAR(150),
    "telefono_cliente" VARCHAR(25),
    "email_cliente" VARCHAR(150),
    "observaciones" TEXT,
    "id_usuario_vendedor" INTEGER,
    "fecha_venta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id_venta")
);

-- CreateTable: ventas_detalle
CREATE TABLE "ventas_detalle" (
    "id_venta_detalle" SERIAL NOT NULL,
    "id_venta" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "series_vendidas" TEXT,

    CONSTRAINT "ventas_detalle_pkey" PRIMARY KEY ("id_venta_detalle")
);

-- AlterTable: inventario_unidades (vincular unidad a detalle de venta)
ALTER TABLE "inventario_unidades" ADD COLUMN "id_venta_detalle" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ventas_codigo_venta_key" ON "ventas"("codigo_venta");
CREATE INDEX "idx_venta_canal" ON "ventas"("canal_origen");
CREATE INDEX "idx_venta_fecha" ON "ventas"("fecha_venta");
CREATE INDEX "idx_venta_estado" ON "ventas"("estado_venta");
CREATE INDEX "idx_detalle_venta" ON "ventas_detalle"("id_venta");
CREATE INDEX "idx_detalle_producto" ON "ventas_detalle"("id_producto");
CREATE INDEX "idx_inventario_venta_detalle" ON "inventario_unidades"("id_venta_detalle");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_id_usuario_vendedor_fkey" FOREIGN KEY ("id_usuario_vendedor") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_id_venta_fkey" FOREIGN KEY ("id_venta") REFERENCES "ventas"("id_venta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_unidades" ADD CONSTRAINT "inventario_unidades_id_venta_detalle_fkey" FOREIGN KEY ("id_venta_detalle") REFERENCES "ventas_detalle"("id_venta_detalle") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (RLS) en Supabase
ALTER TABLE "ventas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ventas_detalle" ENABLE ROW LEVEL SECURITY;
