-- HU-08: Registro de interés en productos futuros o agotados
CREATE TABLE IF NOT EXISTS intereses_producto (
    id_interes SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL,
    nombre_cliente VARCHAR(150) NOT NULL,
    telefono_cliente VARCHAR(25) NOT NULL,
    email_cliente VARCHAR(150),
    estado_interes VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    notas TEXT,
    fecha_registro TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_interes_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE CASCADE,
    CONSTRAINT unique_interes_cliente_producto UNIQUE (id_producto, telefono_cliente)
);

CREATE INDEX IF NOT EXISTS idx_interes_producto ON intereses_producto (id_producto);
CREATE INDEX IF NOT EXISTS idx_interes_estado ON intereses_producto (estado_interes);

ALTER TABLE intereses_producto ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'intereses_producto' AND policyname = 'allow_all_intereses_producto'
    ) THEN
        CREATE POLICY allow_all_intereses_producto ON intereses_producto FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    END IF;
END $$;
