ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS intentos integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.email_send_log_touch(
  p_message_id text,
  p_template text,
  p_recipient text,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.email_send_log
    (message_id, template_name, recipient_email, status, error_message, intentos)
  VALUES
    (p_message_id, p_template, p_recipient, p_status, p_error, 1)
  ON CONFLICT (message_id) DO UPDATE SET
    status = EXCLUDED.status,
    error_message = EXCLUDED.error_message,
    -- Sólo los estados de fallo consumen un intento (retry/DLQ de la cola).
    intentos = CASE
      WHEN EXCLUDED.status IN ('failed', 'rate_limited')
        THEN public.email_send_log.intentos + 1
      ELSE public.email_send_log.intentos
    END;
END;
$function$;

COMMENT ON FUNCTION public.email_send_log_touch(text, text, text, text, text) IS
  'R3 · P2 — Upsert idempotente de estado en email_send_log por message_id (índice uq_email_send_log_message_id). Reemplaza los inserts repetidos que reventaban 23505 en silencio y dejaban filas zombie en pending. Incrementa intentos en failed/rate_limited.';

REVOKE ALL ON FUNCTION public.email_send_log_touch(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_send_log_touch(text, text, text, text, text) TO service_role;

-- Limpieza única de zombies: pending que nunca llegaron a la cola (>24 h).
UPDATE public.email_send_log
   SET status = 'failed',
       error_message = COALESCE(error_message, 'zombie: enqueue nunca confirmó; marcado por limpieza R3')
 WHERE status = 'pending'
   AND created_at < now() - interval '24 hours';

CREATE TABLE IF NOT EXISTS public.cron_locks (
  key        text        PRIMARY KEY,
  locked_at  timestamptz NOT NULL DEFAULT now(),
  owner      text
);

GRANT ALL ON public.cron_locks TO service_role;
ALTER TABLE public.cron_locks ENABLE ROW LEVEL SECURITY;
-- Sin políticas: sólo service_role (vía las RPCs de abajo).

CREATE OR REPLACE FUNCTION public.cron_try_lock(
  p_key text,
  p_ttl_seconds integer DEFAULT 3600,
  p_owner text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_n integer;
BEGIN
  INSERT INTO public.cron_locks (key, locked_at, owner)
  VALUES (p_key, now(), p_owner)
  ON CONFLICT (key) DO UPDATE
    SET locked_at = now(), owner = EXCLUDED.owner
    WHERE public.cron_locks.locked_at
          < now() - make_interval(secs => GREATEST(p_ttl_seconds, 60));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$function$;

COMMENT ON FUNCTION public.cron_try_lock(text, integer, text) IS
  'R3 · P3 — Lease con TTL para serializar crons de edge functions. Expira solo si la edge muere a la mitad (anti-traslape de pg_cron).';

CREATE OR REPLACE FUNCTION public.cron_unlock(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  DELETE FROM public.cron_locks WHERE key = p_key;
END;
$function$;

REVOKE ALL ON FUNCTION public.cron_try_lock(text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_try_lock(text, integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.cron_unlock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_unlock(text) TO service_role;