-- Tabla para facturas generadas desde el Facturador (sin billing ni provider_invoices).
-- Contiene los datos necesarios para generar el DTE y el resultado de la emisión.
CREATE TABLE IF NOT EXISTS facturador_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  destino text NOT NULL CHECK (destino IN ('cliente', 'proveedor')),
  tipo_dte text NOT NULL CHECK (tipo_dte IN ('01', '03')),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  concept text NOT NULL,
  fiscal_data jsonb,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,

  dte_codigo_generacion text,
  dte_numero_control text,
  dte_sello_recepcion text,
  dte_estado text,
  dte_json jsonb,
  dte_fecha_emision date,
  dte_hora_emision text,

  CONSTRAINT facturador_invoices_total_positive CHECK (total_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_facturador_invoices_created_at ON facturador_invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facturador_invoices_destino ON facturador_invoices (destino);

COMMENT ON TABLE facturador_invoices IS 'Facturas emitidas desde el Facturador (admin). concept = descripción del ítem en el DTE.';

-- RLS: permitir lectura al servicio (la edge usa service_role). Ajustar políticas según tu auth.
ALTER TABLE facturador_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura facturador_invoices" ON facturador_invoices
  FOR SELECT USING (true);

CREATE POLICY "Permitir insert/update solo service_role" ON facturador_invoices
  FOR ALL USING (auth.role() = 'service_role');
