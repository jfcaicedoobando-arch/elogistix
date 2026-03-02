
CREATE TYPE public.estado_cotizacion AS ENUM ('Borrador', 'Enviada', 'Confirmada', 'Rechazada', 'Vencida');

CREATE TABLE public.cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL,
  cliente_id uuid NOT NULL,
  cliente_nombre text NOT NULL DEFAULT '',
  modo modo_transporte NOT NULL,
  tipo tipo_operacion NOT NULL,
  incoterm incoterm NOT NULL DEFAULT 'FOB',
  descripcion_mercancia text NOT NULL DEFAULT '',
  peso_kg numeric NOT NULL DEFAULT 0,
  volumen_m3 numeric NOT NULL DEFAULT 0,
  piezas integer NOT NULL DEFAULT 0,
  origen text NOT NULL DEFAULT '',
  destino text NOT NULL DEFAULT '',
  conceptos_venta jsonb NOT NULL DEFAULT '[]',
  subtotal numeric NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  vigencia_dias integer NOT NULL DEFAULT 15,
  fecha_vigencia date,
  notas text,
  estado estado_cotizacion NOT NULL DEFAULT 'Borrador',
  embarque_id uuid,
  operador text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD cotizaciones" ON public.cotizaciones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver cotizaciones" ON public.cotizaciones
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'));

CREATE TRIGGER update_cotizaciones_updated_at
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
