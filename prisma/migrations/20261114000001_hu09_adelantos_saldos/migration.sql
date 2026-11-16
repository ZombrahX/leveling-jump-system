-- Migration: 20261114000001_hu09_adelantos_saldos
-- Descripción: Creación de tablas y estados para Gestión de Adelantos y Saldos de Reservas (HU-09)
-- Responsable: Cesar Sanchez (Desarrollador Backend)

-- CreateEnum: EstadoPagoReserva
CREATE TYPE "EstadoPagoReserva" AS ENUM ('PENDIENTE', 'PARCIAL', 'COMPLETADO');

-- AlterTable: reservas (agregar estado_pago)
ALTER TABLE "reservas" ADD COLUMN "estado_pago" "EstadoPagoReserva" NOT NULL DEFAULT 'PENDIENTE';
CREATE INDEX "idx_reserva_estado_pago" ON "reservas"("estado_pago");

-- CreateTable: pagos_reserva
CREATE TABLE "pagos_reserva" (
    "id_pago_reserva" SERIAL NOT NULL,
    "id_reserva" INTEGER NOT NULL,
    "monto_pago" DECIMAL(10,2) NOT NULL,
    "medio_pago" "MedioPagoVenta" NOT NULL DEFAULT 'YAPE',
    "referencia_operacion" VARCHAR(100),
    "idempotency_key" VARCHAR(100) UNIQUE,
    "id_usuario_registra" INTEGER,
    "observaciones" TEXT,
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_reserva_pkey" PRIMARY KEY ("id_pago_reserva")
);

-- CreateIndex
CREATE INDEX "idx_pago_reserva" ON "pagos_reserva"("id_reserva");
CREATE INDEX "idx_pago_fecha" ON "pagos_reserva"("fecha_pago");

-- AddForeignKey
ALTER TABLE "pagos_reserva" ADD CONSTRAINT "pagos_reserva_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "reservas"("id_reserva") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_reserva" ADD CONSTRAINT "pagos_reserva_id_usuario_registra_fkey" FOREIGN KEY ("id_usuario_registra") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (RLS) en Supabase
ALTER TABLE "pagos_reserva" ENABLE ROW LEVEL SECURITY;
