-- HU-08: Registro de interés en productos futuros o agotados
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoInteres') THEN
        CREATE TYPE "EstadoInteres" AS ENUM ('PENDIENTE', 'NOTIFICADO', 'CONVERTIDO_RESERVA', 'CANCELADO');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS intereses_producto (
    id_interes SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL,
    nombre_cliente VARCHAR(150) NOT NULL,
    telefono_cliente VARCHAR(25) NOT NULL,
    email_cliente VARCHAR(150),
    estado_interes "EstadoInteres" NOT NULL DEFAULT 'PENDIENTE',
    notas TEXT,
    fecha_registro TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_interes_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE CASCADE,
    CONSTRAINT unique_interes_cliente_producto UNIQUE (id_producto, telefono_cliente)
);

CREATE INDEX IF NOT EXISTS idx_interes_producto ON intereses_producto (id_producto);
CREATE INDEX IF NOT EXISTS idx_interes_estado ON intereses_producto (estado_interes);

ALTER TABLE intereses_producto ENABLE ROW LEVEL SECURITY;

-- Protección de privacidad de datos de clientes: anon solo puede insertar; solo authenticated (Staff) puede consultar
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'intereses_producto' AND policyname = 'allow_insert_intereses_producto'
    ) THEN
        CREATE POLICY allow_insert_intereses_producto ON intereses_producto FOR INSERT TO authenticated, anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'intereses_producto' AND policyname = 'allow_select_staff_intereses_producto'
    ) THEN
        CREATE POLICY allow_select_staff_intereses_producto ON intereses_producto FOR SELECT TO authenticated USING (true);
    END IF;
END $$;
