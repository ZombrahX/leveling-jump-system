-- Migration: 20261114000002_hu10_seguimiento_pedidos
-- Descripción: Creación de enums y columnas para Seguimiento de Pedidos y Modalidad de Entrega (HU-10)
-- Responsable: Cesar Sanchez (Desarrollador Backend)

-- CreateEnum: ModalidadEntrega
CREATE TYPE "ModalidadEntrega" AS ENUM ('RETIRO_FERIA', 'RETIRO_TIENDA', 'ENVIO_LIMA', 'ENVIO_PROVINCIA');

-- CreateEnum: EstadoEntrega
CREATE TYPE "EstadoEntrega" AS ENUM ('PENDIENTE_PREPARACION', 'LISTO_PARA_ENTREGA', 'EN_TRANSITO', 'ENTREGADO');

-- AlterTable: reservas (agregar modalidad_entrega, estado_entrega, fechas y guias)
ALTER TABLE "reservas" ADD COLUMN "modalidad_entrega" "ModalidadEntrega" NOT NULL DEFAULT 'RETIRO_FERIA';
ALTER TABLE "reservas" ADD COLUMN "estado_entrega" "EstadoEntrega" NOT NULL DEFAULT 'PENDIENTE_PREPARACION';
ALTER TABLE "reservas" ADD COLUMN "fecha_estimada_entrega" TIMESTAMP(3);
ALTER TABLE "reservas" ADD COLUMN "direccion_entrega" VARCHAR(255);
ALTER TABLE "reservas" ADD COLUMN "guia_courier" VARCHAR(100);

-- CreateIndex
CREATE INDEX "idx_reserva_estado_entrega" ON "reservas"("estado_entrega");
