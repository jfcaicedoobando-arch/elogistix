-- ===========================================================================
-- Ola E2 · Sub-ola B — M2-res (TC DOF en UPDATE de moneda), M5-res (evento
-- anterior a la creación del embarque) y N26 (enlaces de tracking eternos).
-- ===========================================================================

-- M2-res: el trigger de TC DOF también debe correr al cambiar la moneda.
DROP TRIGGER IF EXISTS trg_factura_tc_dof_obligatorio_upd ON public.facturas;

CREATE OR REPLACE FUNCTION public._factura_tc_dof_obligatorio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
  v_fecha date;
BEGIN
  IF NEW.moneda::text = 'MXN' THEN
    -- M2-res: al volver a MXN el T/C heredado deja de aplicar.
    IF TG_OP = 'UPDATE' AND OLD.moneda::text <> 'MXN' THEN
      NEW.tipo_cambio := 1;
    END IF;
    RETURN NEW;
  END IF;

  -- M2-res: si la moneda cambió, el T/C anterior no sirve: se recalcula.
  IF TG_OP = 'UPDATE'
     AND OLD.moneda::text IS DISTINCT FROM NEW.moneda::text
     AND NEW.tipo_cambio IS NOT DISTINCT FROM OLD.tipo_cambio THEN
    NEW.tipo_cambio := NULL;
  END IF;

  IF COALESCE(NEW.tipo_cambio, 0) > 1 THEN
    RETURN NEW;
  END IF;

  v_fecha := COALESCE(NEW.fecha_emision, (now() AT TIME ZONE 'America/Mexico_City')::date);

  SELECT CASE
           WHEN NEW.moneda::text = 'USD' THEN d.usd_mxn
           WHEN NEW.moneda::text = 'EUR' THEN d.eur_mxn
         END
    INTO v_tc
  FROM public.tc_dof_vigente(v_fecha) d;

  IF COALESCE(v_tc, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_FACTURA_SIN_TC_DOF: no hay tipo de cambio DOF para % al %; captúralo antes de generar la factura',
      NEW.moneda, v_fecha
      USING ERRCODE = '22023';
  END IF;

  NEW.tipo_cambio := v_tc;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_factura_tc_dof_obligatorio_upd
BEFORE UPDATE OF moneda ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._factura_tc_dof_obligatorio();

-- M5-res: ningún evento real puede ser anterior a la creación del embarque.
CREATE OR REPLACE FUNCTION public._validar_cronologia_evento_embarque()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_zarpe timestamptz;
  v_arribo timestamptz;
  v_creado timestamptz;
  v_reales text[] := ARRAY[
    'Zarpe','Arribo a Puerto','Descarga','Despacho Aduanal','Liberación','Entrega'
  ];
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo::text = ANY (v_reales) AND NEW.fecha > now() + interval '1 day' THEN
    RAISE EXCEPTION 'LC_EVENTO_FECHA_FUTURA: el evento "%" no puede registrarse con fecha futura.', NEW.tipo
      USING ERRCODE = 'check_violation';
  END IF;

  -- M5-res: margen de 1 día para embarques capturados con historia previa
  -- (el expediente se abre después de que el buque zarpó).
  SELECT e.created_at INTO v_creado
  FROM public.embarques e
  WHERE e.id = NEW.embarque_id;

  IF v_creado IS NOT NULL
     AND NEW.tipo::text = ANY (v_reales)
     AND NEW.fecha < (v_creado - interval '1 day') THEN
    RAISE EXCEPTION 'LC_EVENTO_ANTERIOR_A_EMBARQUE: el evento "%" (%) es anterior a la creación del embarque (%).',
      NEW.tipo, NEW.fecha, v_creado
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT min(e.fecha) INTO v_zarpe
  FROM public.eventos_embarque e
  WHERE e.embarque_id = NEW.embarque_id
    AND e.deleted_at IS NULL
    AND e.id <> NEW.id
    AND e.tipo = 'Zarpe';

  IF v_zarpe IS NOT NULL
     AND NEW.tipo::text IN ('Arribo a Puerto','Descarga','Despacho Aduanal','Liberación','Entrega')
     AND NEW.fecha < v_zarpe THEN
    RAISE EXCEPTION 'LC_EVENTO_ORDEN_INVALIDO: "%" no puede ser anterior al zarpe (%).', NEW.tipo, v_zarpe
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.tipo::text = 'Entrega' THEN
    SELECT min(e.fecha) INTO v_arribo
    FROM public.eventos_embarque e
    WHERE e.embarque_id = NEW.embarque_id
      AND e.deleted_at IS NULL
      AND e.id <> NEW.id
      AND e.tipo = 'Arribo a Puerto';

    IF v_arribo IS NOT NULL AND NEW.fecha < v_arribo THEN
      RAISE EXCEPTION 'LC_EVENTO_ORDEN_INVALIDO: la entrega no puede ser anterior al arribo (%).', v_arribo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- N26: los enlaces públicos de tracking no pueden ser eternos.
UPDATE public.tracking_links
   SET expires_at = LEAST(COALESCE(expires_at, now() + interval '30 days'),
                          COALESCE(created_at, now()) + interval '90 days')
 WHERE expires_at IS NULL
    OR expires_at > COALESCE(created_at, now()) + interval '90 days';

ALTER TABLE public.tracking_links
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

UPDATE public.tracking_links SET expires_at = now() + interval '30 days'
 WHERE expires_at IS NULL;

ALTER TABLE public.tracking_links
  ALTER COLUMN expires_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public._tracking_link_vigencia_maxima()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_base timestamptz := COALESCE(NEW.created_at, now());
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := v_base + interval '30 days';
  END IF;
  IF NEW.expires_at > v_base + interval '90 days' THEN
    RAISE EXCEPTION 'LC_TRACKING_VIGENCIA_EXCEDIDA: un enlace público de rastreo no puede durar más de 90 días.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tracking_link_vigencia ON public.tracking_links;
CREATE TRIGGER trg_tracking_link_vigencia
BEFORE INSERT OR UPDATE OF expires_at ON public.tracking_links
FOR EACH ROW EXECUTE FUNCTION public._tracking_link_vigencia_maxima();

CREATE INDEX IF NOT EXISTS idx_tracking_links_expires_at
  ON public.tracking_links (expires_at);
