
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes','contactos_cliente',
    'embarques','documentos_embarque','eventos_embarque','notas_embarque',
    'cotizaciones','cotizacion_costos',
    'facturas','conceptos_factura',
    'proformas','proforma_conceptos_consolidados',
    'conceptos_costo','conceptos_venta'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_deleted_at ON public.%I(deleted_at) WHERE deleted_at IS NOT NULL', t, t);
  END LOOP;
END $$;
