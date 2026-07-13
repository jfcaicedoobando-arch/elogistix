
-- ============================================================================
-- P3 · Cotizaciones — Duplicar & Versionar (v13.297.0)
-- ============================================================================

-- 1) Nueva columna "duplicada_de_id" para trazar el linaje de las copias.
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS duplicada_de_id uuid NULL
    REFERENCES public.cotizaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_duplicada_de
  ON public.cotizaciones(duplicada_de_id)
  WHERE duplicada_de_id IS NOT NULL;

-- 2) Tabla cotizacion_versiones — snapshots inmutables al pasar a "Enviada".
CREATE TABLE IF NOT EXISTS public.cotizacion_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_num integer NOT NULL,
  folio text NOT NULL,
  estado_al_snapshot text NOT NULL,
  snapshot jsonb NOT NULL,
  costos_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cotizacion_id, version_num)
);

GRANT SELECT, INSERT ON public.cotizacion_versiones TO authenticated;
GRANT ALL ON public.cotizacion_versiones TO service_role;

ALTER TABLE public.cotizacion_versiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cotizacion_versiones lectura por org"
ON public.cotizacion_versiones
FOR SELECT TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'viewer')
  )
);

CREATE POLICY "cotizacion_versiones insert por trigger/service"
ON public.cotizacion_versiones
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_versiones_cotizacion
  ON public.cotizacion_versiones(cotizacion_id, version_num DESC);

CREATE INDEX IF NOT EXISTS idx_cotizacion_versiones_org
  ON public.cotizacion_versiones(organization_id, created_at DESC);

-- 3) Trigger: snapshot automático al pasar a estado 'Enviada' (política elegida).
CREATE OR REPLACE FUNCTION public.snapshot_cotizacion_al_enviar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version integer;
  v_costos jsonb;
BEGIN
  -- Sólo dispara cuando la cotización transita a 'Enviada' desde otro estado.
  IF NEW.estado::text = 'Enviada'
     AND (OLD.estado IS DISTINCT FROM NEW.estado) THEN

    SELECT COALESCE(MAX(version_num), 0) + 1
      INTO v_next_version
      FROM public.cotizacion_versiones
     WHERE cotizacion_id = NEW.id;

    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
      INTO v_costos
      FROM public.cotizacion_costos c
     WHERE c.cotizacion_id = NEW.id;

    INSERT INTO public.cotizacion_versiones (
      cotizacion_id, organization_id, version_num, folio,
      estado_al_snapshot, snapshot, costos_snapshot, created_by
    ) VALUES (
      NEW.id, NEW.organization_id, v_next_version, NEW.folio,
      NEW.estado::text, to_jsonb(NEW), v_costos, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_cotizacion_al_enviar ON public.cotizaciones;
CREATE TRIGGER trg_snapshot_cotizacion_al_enviar
AFTER UPDATE OF estado ON public.cotizaciones
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_cotizacion_al_enviar();

-- 4) RPC duplicar_cotizacion(uuid) → uuid.
--    Copia una cotización en estado 'Borrador' con folio nuevo, replica los
--    conceptos_venta (jsonb en la fila) y los cotizacion_costos.
CREATE OR REPLACE FUNCTION public.duplicar_cotizacion(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_nueva_id uuid := gen_random_uuid();
  v_anio integer := EXTRACT(YEAR FROM now())::int;
  v_prefijo text := 'COT-' || v_anio || '-';
  v_ultimo text;
  v_num integer := 1;
  v_folio text;
BEGIN
  -- Validar acceso por org + rol.
  SELECT organization_id INTO v_org
    FROM public.cotizaciones
   WHERE id = p_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_org <> public.current_user_org_id() THEN
    RAISE EXCEPTION 'No pertenece a tu organización' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador')) THEN
    RAISE EXCEPTION 'Rol insuficiente para duplicar cotizaciones' USING ERRCODE = '42501';
  END IF;

  -- Calcular siguiente folio del año.
  SELECT folio INTO v_ultimo
    FROM public.cotizaciones
   WHERE organization_id = v_org
     AND folio LIKE v_prefijo || '%'
   ORDER BY folio DESC
   LIMIT 1;

  IF v_ultimo IS NOT NULL THEN
    BEGIN
      v_num := (regexp_replace(v_ultimo, '^' || v_prefijo, ''))::int + 1;
    EXCEPTION WHEN OTHERS THEN
      v_num := 1;
    END;
  END IF;

  v_folio := v_prefijo || lpad(v_num::text, 4, '0');

  -- Copia principal (folio nuevo, estado Borrador, embarque desligado).
  INSERT INTO public.cotizaciones AS c
  SELECT
    v_nueva_id           AS id,
    v_folio              AS folio,
    cliente_id, cliente_nombre, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, origen, destino,
    conceptos_venta, subtotal, moneda, vigencia_dias,
    NULL::date           AS fecha_vigencia,
    notas,
    'Borrador'::estado_cotizacion AS estado,
    NULL::uuid           AS embarque_id,
    operador,
    now()                AS created_at,
    now()                AS updated_at
  FROM public.cotizaciones
  WHERE id = p_id;

  -- Ajustar columnas que quedaron fuera de la lista posicional (org + linaje).
  UPDATE public.cotizaciones
     SET organization_id = v_org,
         duplicada_de_id = p_id
   WHERE id = v_nueva_id;

  -- Replicar cotizacion_costos.
  INSERT INTO public.cotizacion_costos
    (cotizacion_id, concepto, moneda, proveedor, cantidad, costo_unitario)
  SELECT v_nueva_id, concepto, moneda, proveedor, cantidad, costo_unitario
    FROM public.cotizacion_costos
   WHERE cotizacion_id = p_id;

  RETURN v_nueva_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicar_cotizacion(uuid) TO authenticated;
