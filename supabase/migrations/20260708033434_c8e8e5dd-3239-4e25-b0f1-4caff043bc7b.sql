-- v13.214.3 — Registrar automáticamente eventos de tracking cuando cambian
-- eta o fecha_llegada_real en embarques. Con backfill para embarques
-- históricos afectados (excluyendo embarques Cerrados por el trigger de
-- bloqueo existente).

CREATE OR REPLACE FUNCTION public.log_embarque_eta_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario text;
  v_now timestamptz := now();
  v_recent_exists boolean;
BEGIN
  BEGIN
    v_usuario := COALESCE(NULLIF(auth.jwt()->>'email', ''), 'sistema');
  EXCEPTION WHEN OTHERS THEN
    v_usuario := 'sistema';
  END;

  IF NEW.eta IS DISTINCT FROM OLD.eta THEN
    SELECT EXISTS (
      SELECT 1 FROM public.eventos_embarque
      WHERE embarque_id = NEW.id
        AND tipo = 'Cambio de ETA'
        AND deleted_at IS NULL
        AND created_at >= v_now - interval '30 seconds'
    ) INTO v_recent_exists;

    IF NOT v_recent_exists THEN
      INSERT INTO public.eventos_embarque (
        embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id
      ) VALUES (
        NEW.id,
        'Cambio de ETA',
        format(
          'ETA actualizada de %s a %s',
          COALESCE(to_char(OLD.eta, 'DD/MM/YYYY'), '—'),
          COALESCE(to_char(NEW.eta, 'DD/MM/YYYY'), '—')
        ),
        '',
        v_now,
        v_usuario,
        NEW.organization_id
      );
    END IF;
  END IF;

  IF NEW.fecha_llegada_real IS DISTINCT FROM OLD.fecha_llegada_real
     AND NEW.fecha_llegada_real IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.eventos_embarque
      WHERE embarque_id = NEW.id
        AND tipo = 'Arribo a Puerto'
        AND deleted_at IS NULL
        AND created_at >= v_now - interval '30 seconds'
    ) INTO v_recent_exists;

    IF NOT v_recent_exists THEN
      INSERT INTO public.eventos_embarque (
        embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id
      ) VALUES (
        NEW.id,
        'Arribo a Puerto',
        format(
          'Llegada real registrada: %s',
          to_char(NEW.fecha_llegada_real, 'DD/MM/YYYY')
        ),
        '',
        v_now,
        v_usuario,
        NEW.organization_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_embarques_log_eta_change ON public.embarques;
CREATE TRIGGER trg_embarques_log_eta_change
AFTER UPDATE OF eta, fecha_llegada_real ON public.embarques
FOR EACH ROW
EXECUTE FUNCTION public.log_embarque_eta_change();

-- Backfill (excluye Cerrados que bloquean insert por otro trigger).
INSERT INTO public.eventos_embarque (
  embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id
)
SELECT
  e.id,
  'Cambio de ETA'::tipo_evento_tracking,
  format(
    'ETA actualizada de %s a %s (registro histórico)',
    COALESCE(to_char(e.eta_original, 'DD/MM/YYYY'), '—'),
    COALESCE(to_char(e.eta, 'DD/MM/YYYY'), '—')
  ),
  '',
  e.updated_at,
  'sistema (backfill)',
  e.organization_id
FROM public.embarques e
WHERE e.eta_original IS DISTINCT FROM e.eta
  AND e.eta IS NOT NULL
  AND e.estado::text <> 'Cerrado'
  AND NOT EXISTS (
    SELECT 1 FROM public.eventos_embarque ev
    WHERE ev.embarque_id = e.id
      AND ev.tipo = 'Cambio de ETA'
      AND ev.deleted_at IS NULL
  );
