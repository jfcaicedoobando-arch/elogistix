-- ============================================================
-- M5 (auditoría arquitectura 2026-07-29) · Espejos de nombre sincronizados
-- Regla: el FK manda; la columna texto es un espejo mantenido por trigger.
-- En facturas solo se propaga a borradores (CFDI emitido = nombre congelado).
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_embarques_sync_espejos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    SELECT c.nombre INTO NEW.cliente_nombre
      FROM public.clientes c WHERE c.id = NEW.cliente_id;
  END IF;
  IF NEW.naviera_id IS NOT NULL THEN
    SELECT n.name INTO NEW.naviera
      FROM public.navieras n WHERE n.id = NEW.naviera_id;
  END IF;
  IF NEW.agente_id IS NOT NULL THEN
    SELECT a.nombre INTO NEW.agente
      FROM public.costeo_agentes a WHERE a.id = NEW.agente_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_embarques_sync_espejos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_embarques_sync_espejos() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_embarques_sync_espejos ON public.embarques;
CREATE TRIGGER trg_embarques_sync_espejos
  BEFORE INSERT OR UPDATE OF cliente_id, naviera_id, agente_id ON public.embarques
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_embarques_sync_espejos();

CREATE OR REPLACE FUNCTION public.trg_clientes_propaga_nombre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nombre IS NOT DISTINCT FROM OLD.nombre THEN
    RETURN NEW;
  END IF;
  UPDATE public.cotizaciones
     SET cliente_nombre = NEW.nombre
   WHERE cliente_id = NEW.id
     AND cliente_nombre IS DISTINCT FROM NEW.nombre
     AND deleted_at IS NULL;
  UPDATE public.embarques
     SET cliente_nombre = NEW.nombre
   WHERE cliente_id = NEW.id
     AND cliente_nombre IS DISTINCT FROM NEW.nombre
     AND estado::text <> 'Cerrado'
     AND deleted_at IS NULL;
  UPDATE public.facturas
     SET cliente_nombre = NEW.nombre
   WHERE cliente_id = NEW.id
     AND estado = 'Borrador'
     AND cliente_nombre IS DISTINCT FROM NEW.nombre
     AND deleted_at IS NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_clientes_propaga_nombre() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_clientes_propaga_nombre() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_clientes_propaga_nombre ON public.clientes;
CREATE TRIGGER trg_clientes_propaga_nombre
  AFTER UPDATE OF nombre ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_clientes_propaga_nombre();

CREATE OR REPLACE FUNCTION public.trg_navieras_propaga_nombre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.embarques
       SET naviera = NEW.name
     WHERE naviera_id = NEW.id
       AND naviera IS DISTINCT FROM NEW.name
       AND estado::text <> 'Cerrado'
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_navieras_propaga_nombre() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_navieras_propaga_nombre() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_navieras_propaga_nombre ON public.navieras;
CREATE TRIGGER trg_navieras_propaga_nombre
  AFTER UPDATE OF name ON public.navieras
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_navieras_propaga_nombre();

CREATE OR REPLACE FUNCTION public.trg_agentes_propaga_nombre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
    UPDATE public.embarques
       SET agente = NEW.nombre
     WHERE agente_id = NEW.id
       AND agente IS DISTINCT FROM NEW.nombre
       AND estado::text <> 'Cerrado'
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_agentes_propaga_nombre() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_agentes_propaga_nombre() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_agentes_propaga_nombre ON public.costeo_agentes;
CREATE TRIGGER trg_agentes_propaga_nombre
  AFTER UPDATE OF nombre ON public.costeo_agentes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_agentes_propaga_nombre();

DO $$
DECLARE
  v bigint; v_total bigint := 0;
BEGIN
  UPDATE public.cotizaciones x
     SET cliente_nombre = c.nombre
    FROM public.clientes c
   WHERE x.cliente_id = c.id AND x.cliente_nombre IS DISTINCT FROM c.nombre;
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE 'M5 backfill cotizaciones.cliente_nombre: % filas', v;

  UPDATE public.embarques x
     SET cliente_nombre = c.nombre
    FROM public.clientes c
   WHERE x.cliente_id = c.id AND x.cliente_nombre IS DISTINCT FROM c.nombre
     AND x.estado::text <> 'Cerrado';
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE 'M5 backfill embarques.cliente_nombre: % filas', v;

  UPDATE public.facturas x
     SET cliente_nombre = c.nombre
    FROM public.clientes c
   WHERE x.cliente_id = c.id AND x.estado = 'Borrador'
     AND x.cliente_nombre IS DISTINCT FROM c.nombre;
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE 'M5 backfill facturas.cliente_nombre (Borrador): % filas', v;

  UPDATE public.embarques x
     SET naviera = n.name
    FROM public.navieras n
   WHERE x.naviera_id = n.id AND x.naviera IS DISTINCT FROM n.name
     AND x.estado::text <> 'Cerrado';
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE 'M5 backfill embarques.naviera: % filas', v;

  UPDATE public.embarques x
     SET agente = a.nombre
    FROM public.costeo_agentes a
   WHERE x.agente_id = a.id AND x.agente IS DISTINCT FROM a.nombre
     AND x.estado::text <> 'Cerrado';
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE 'M5 backfill embarques.agente: % filas', v;

  RAISE NOTICE 'M5 backfill TOTAL: % filas corregidas', v_total;
END $$;