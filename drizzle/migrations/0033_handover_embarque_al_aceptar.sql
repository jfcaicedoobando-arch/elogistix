-- Fase 5: al aceptar el cliente, el handover crea el embarque en borrador.
CREATE OR REPLACE FUNCTION public._cotizacion_embarque_al_aceptar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_emb uuid; v_coord uuid; v_actor uuid; v_titulo text; v_msg text; v_enlace text;
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
BEGIN
  SELECT coordinador_id INTO v_coord FROM cotizacion_handovers WHERE cotizacion_id = NEW.id;
  -- El borrador se crea a nombre del coordinador del handover (o un gerente de
  -- operaciones), así aplica la misma cerradura de rol que el botón manual.
  v_actor := COALESCE(v_coord, (SELECT user_id FROM organization_members
    WHERE organization_id = NEW.organization_id AND role = 'gerente_operaciones'
    ORDER BY created_at LIMIT 1));
  BEGIN
    IF v_actor IS NULL THEN
      RAISE EXCEPTION 'no hay coordinador ni gerente de operaciones asignado';
    END IF;
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
    v_emb := public.crear_embarque_borrador_desde_cotizacion(NEW.id, 'sin_cambios', NULL, NULL);
    PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
    PERFORM set_config('request.jwt.claim.sub', COALESCE(v_sub, ''), true);
    v_titulo := 'Embarque en borrador ' || COALESCE(NEW.folio, '');
    v_msg := 'El cliente aceptó la cotización; revisa y completa el embarque.';
    v_enlace := '/embarques/' || v_emb;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
    PERFORM set_config('request.jwt.claim.sub', COALESCE(v_sub, ''), true);
    v_titulo := 'Crear embarque manualmente ' || COALESCE(NEW.folio, '');
    v_msg := 'No se pudo crear el embarque automático: ' || left(SQLERRM, 200)
             || '. Usa "Crear embarque" en la cotización.';
    v_enlace := '/cotizaciones/' || NEW.id;
  END;
  INSERT INTO notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT DISTINCT NEW.organization_id, x.uid, 'handover', v_titulo, v_msg, v_enlace, 'cotizacion', NEW.id
    FROM (
      SELECT v_coord AS uid WHERE v_coord IS NOT NULL
      UNION SELECT user_id FROM organization_members
             WHERE organization_id = NEW.organization_id AND role = 'gerente_operaciones'
    ) x;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._cotizacion_embarque_al_aceptar() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_cotizacion_zz_embarque_al_aceptar
  AFTER UPDATE OF estado ON public.cotizaciones FOR EACH ROW
  WHEN (NEW.estado = 'Aceptada'::estado_cotizacion AND OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION public._cotizacion_embarque_al_aceptar();

-- Primero se cancela el embarque y después la cotización.
CREATE OR REPLACE FUNCTION public._cotizacion_bloquear_cierre_con_embarque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (NEW.estado IN ('Rechazada','Vencida','Archivada') AND OLD.estado IS DISTINCT FROM NEW.estado)
     OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    IF EXISTS (SELECT 1 FROM embarques e
                WHERE e.deleted_at IS NULL AND e.estado <> 'Cancelado'::estado_embarque
                  AND (e.cotizacion_id = NEW.id OR e.id = NEW.embarque_id)) THEN
      RAISE EXCEPTION 'LC_COT_EMBARQUE_VIVO: cancela primero el embarque y después la cotización'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._cotizacion_bloquear_cierre_con_embarque() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_cotizacion_bloquear_cierre_con_embarque
  BEFORE UPDATE OF estado, deleted_at ON public.cotizaciones FOR EACH ROW
  EXECUTE FUNCTION public._cotizacion_bloquear_cierre_con_embarque();