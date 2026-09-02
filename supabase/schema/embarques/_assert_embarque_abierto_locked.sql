-- Espejo canónico de public._assert_embarque_abierto_locked,
-- public.bloquear_conceptos_en_embarque_cerrado y
-- public.tg_bloquear_si_embarque_cerrado.
-- Fuente vigente (mayor timestamp): 20260902183746_81af79ca-850f-4e4d-9aea-398ba2e77eec.sql
-- Vigilado por `bun run audit:replay-mirror` y `audit:schema-functions`.
-- DEFECTO 2 (P1, carrera cierre vs conceptos): lectura FOR KEY SHARE del
-- embarque, mutuamente exclusiva con el FOR UPDATE de cerrar_embarque.

CREATE OR REPLACE FUNCTION public._assert_embarque_abierto_locked(p_embarque_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_estado text;
BEGIN
  IF p_embarque_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT estado::text INTO v_estado
    FROM public.embarques
   WHERE id = p_embarque_id
   FOR KEY SHARE;
  RETURN v_estado;
END;
$$;

-- Helper interno: sólo lo invocan triggers SECURITY DEFINER (que corren como
-- dueño), por lo que NO se expone a `authenticated` (linter org-scope).
REVOKE ALL ON FUNCTION public._assert_embarque_abierto_locked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_embarque_abierto_locked(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bloquear_conceptos_en_embarque_cerrado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_estado text;
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_estado := public._assert_embarque_abierto_locked(COALESCE(NEW.embarque_id, OLD.embarque_id));
  IF v_estado = 'Cerrado' THEN
    IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND current_setting('app.auditoria_backfill_legacy', true) = 'on'
       AND OLD.estado_facturacion = 'pendiente'
       AND NEW.estado_facturacion = 'facturado'
       AND (to_jsonb(NEW) - 'estado_facturacion') = (to_jsonb(OLD) - 'estado_facturacion') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden agregar ni modificar conceptos en un embarque Cerrado. Reabre el embarque antes de editar.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_bloquear_si_embarque_cerrado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_emb_id uuid;
  v_estado text;
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_emb_id := COALESCE(
    (CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)->>'embarque_id' ELSE NULL END)::uuid,
    (CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD)->>'embarque_id' ELSE NULL END)::uuid
  );
  IF v_emb_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_estado := public._assert_embarque_abierto_locked(v_emb_id);
  IF v_estado = 'Cerrado' THEN
    RAISE EXCEPTION 'Embarque cerrado: edición bloqueada (tabla %)', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
