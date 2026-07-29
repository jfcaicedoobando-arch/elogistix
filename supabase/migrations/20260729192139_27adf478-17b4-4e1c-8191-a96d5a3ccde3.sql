CREATE TABLE IF NOT EXISTS public.tipos_cambio_dof (
  fecha date PRIMARY KEY,
  usd_mxn numeric(12,4) NOT NULL CHECK (usd_mxn > 0),
  eur_mxn numeric(12,4) CHECK (eur_mxn IS NULL OR eur_mxn > 0),
  fuente text NOT NULL DEFAULT 'banxico_sie',
  origen text NOT NULL DEFAULT 'cron' CHECK (origen IN ('cron','manual')),
  fecha_publicacion_usd date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tipos_cambio_dof TO authenticated;
GRANT ALL ON public.tipos_cambio_dof TO service_role;

ALTER TABLE public.tipos_cambio_dof ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tc_dof_select_authenticated" ON public.tipos_cambio_dof;
CREATE POLICY "tc_dof_select_authenticated"
  ON public.tipos_cambio_dof FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tc_dof_all_service_role" ON public.tipos_cambio_dof;
CREATE POLICY "tc_dof_all_service_role"
  ON public.tipos_cambio_dof FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_tipos_cambio_dof_updated_at ON public.tipos_cambio_dof;
CREATE TRIGGER trg_tipos_cambio_dof_updated_at
  BEFORE UPDATE ON public.tipos_cambio_dof
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tipos_cambio_dof_fecha_desc
  ON public.tipos_cambio_dof (fecha DESC);

CREATE OR REPLACE FUNCTION public.tc_dof_vigente(_fecha date DEFAULT CURRENT_DATE)
RETURNS TABLE (fecha date, usd_mxn numeric, eur_mxn numeric, fuente text, origen text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.fecha, t.usd_mxn, t.eur_mxn, t.fuente, t.origen
  FROM public.tipos_cambio_dof t
  WHERE t.fecha <= _fecha
  ORDER BY t.fecha DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.tc_dof_vigente(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tc_dof_vigente(date) TO authenticated, service_role;