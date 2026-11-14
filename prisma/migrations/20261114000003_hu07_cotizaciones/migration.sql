-- HU-07: Solicitud y registro de cotizaciones formales
CREATE TABLE IF NOT EXISTS cotizaciones (
    id_cotizacion SERIAL PRIMARY KEY,
    codigo_cotizacion VARCHAR(30) UNIQUE NOT NULL,
    nombre_cliente VARCHAR(150) NOT NULL,
    email_cliente VARCHAR(150),
    telefono_cliente VARCHAR(25) NOT NULL,
    total_soles DECIMAL(10, 2) NOT NULL,
    fecha_emision TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento TIMESTAMP(3) NOT NULL,
    observaciones TEXT
);

CREATE TABLE IF NOT EXISTS cotizaciones_detalle (
    id_cotizacion_detalle SERIAL PRIMARY KEY,
    id_cotizacion INTEGER NOT NULL,
    id_producto INTEGER NOT NULL,
    nombre_producto VARCHAR(150) NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones (id_cotizacion) ON DELETE CASCADE,
    CONSTRAINT fk_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_codigo ON cotizaciones (codigo_cotizacion);
CREATE INDEX IF NOT EXISTS idx_cotizacion_fecha ON cotizaciones (fecha_emision);
CREATE INDEX IF NOT EXISTS idx_cotizacion_detalle_cotizacion ON cotizaciones_detalle (id_cotizacion);

ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones_detalle ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cotizaciones' AND policyname = 'allow_public_select_insert_cotizaciones'
    ) THEN
        CREATE POLICY allow_public_select_insert_cotizaciones ON cotizaciones FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cotizaciones_detalle' AND policyname = 'allow_public_select_insert_cotizaciones_detalle'
    ) THEN
        CREATE POLICY allow_public_select_insert_cotizaciones_detalle ON cotizaciones_detalle FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    END IF;
END $$;
