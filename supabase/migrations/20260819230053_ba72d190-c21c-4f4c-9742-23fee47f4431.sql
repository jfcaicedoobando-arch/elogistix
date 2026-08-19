-- Duplicados previos (message_id repetido) romperían el índice único total.
-- Se conserva la fila más reciente por message_id.
DELETE FROM public.email_send_log a
USING public.email_send_log b
WHERE a.message_id IS NOT NULL
  AND a.message_id = b.message_id
  AND (a.created_at, a.id) < (b.created_at, b.id);

DROP INDEX IF EXISTS public.uq_email_send_log_message_id;
DROP INDEX IF EXISTS public.idx_email_send_log_message_sent_unique;

-- Índice único TOTAL: requerido para que `ON CONFLICT (message_id)` infiera el
-- árbitro. Un índice parcial (WHERE ...) no es inferible sin cláusula WHERE en
-- el INSERT y provocaba 42P10 en auth-email-hook (Sentry JAVASCRIPT-REACT-5G).
CREATE UNIQUE INDEX uq_email_send_log_message_id
  ON public.email_send_log (message_id);