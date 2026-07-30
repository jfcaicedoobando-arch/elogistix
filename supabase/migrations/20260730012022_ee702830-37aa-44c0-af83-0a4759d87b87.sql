-- ============================================================
-- Q-03 · Unicidad de catálogos + resolución por código
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS puertos_code_uniq_idx
  ON public.puertos (upper(btrim(code)));

CREATE UNIQUE INDEX IF NOT EXISTS tipos_contenedor_code_uniq_idx
  ON public.tipos_contenedor (upper(btrim(code)));

CREATE OR REPLACE FUNCTION public.resolver_puerto_id(p_valor text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT p.id
    FROM public.puertos p
   WHERE p_valor IS NOT NULL
     AND btrim(p_valor) <> ''
     AND (
       upper(btrim(p.code)) = upper(btrim(p_valor))
       OR lower(btrim(p.name)) = lower(btrim(p_valor))
     )
   ORDER BY (upper(btrim(p.code)) = upper(btrim(p_valor))) DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolver_tipo_contenedor_id(p_valor text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT t.id
    FROM public.tipos_contenedor t
   WHERE p_valor IS NOT NULL
     AND btrim(p_valor) <> ''
     AND (
       upper(btrim(t.code)) = upper(btrim(p_valor))
       OR lower(btrim(t.name)) = lower(btrim(p_valor))
     )
   ORDER BY (upper(btrim(t.code)) = upper(btrim(p_valor))) DESC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolver_puerto_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_puerto_id(text) TO authenticated;
REVOKE ALL ON FUNCTION public.resolver_tipo_contenedor_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_tipo_contenedor_id(text) TO authenticated;

-- Búsqueda de Top 3 por código (nombre distinto para evitar sobrecargas ambiguas)
CREATE OR REPLACE FUNCTION public.get_top_tarifas_por_codigo(
  p_origen_code text,
  p_destino_code text,
  p_contenedor_code text,
  p_fecha date DEFAULT CURRENT_DATE,
  p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS SETOF public.costeo_tarifas_vigentes_v
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.get_top_tarifas(
    public.resolver_puerto_id(p_origen_code),
    public.resolver_puerto_id(p_destino_code),
    public.resolver_tipo_contenedor_id(p_contenedor_code),
    p_fecha,
    p_organization_id
  );
$$;

REVOKE ALL ON FUNCTION public.get_top_tarifas_por_codigo(text, text, text, date, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_tarifas_por_codigo(text, text, text, date, uuid)
  TO authenticated;

-- ============================================================
-- Q-04 · Segregación de funciones: no auto-aceptar cotizaciones
-- ============================================================

CREATE OR REPLACE FUNCTION public._cotizaciones_bloquear_auto_aceptacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.estado = 'Aceptada'::estado_cotizacion
     AND COALESCE(OLD.estado, 'Borrador'::estado_cotizacion) <> 'Aceptada'::estado_cotizacion
     AND v_uid IS NOT NULL
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by = v_uid
     AND NOT (
       public.has_role(v_uid, 'admin'::app_role)
       OR public.has_role(v_uid, 'admin_org'::app_role)
       OR public.has_role(v_uid, 'super_admin'::app_role)
     )
  THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: quien creó la cotización no puede aceptarla'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizaciones_sod_aceptacion ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_sod_aceptacion
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public._cotizaciones_bloquear_auto_aceptacion();