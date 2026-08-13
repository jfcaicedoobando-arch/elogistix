-- FIX REF-03 (re-auditoría v13.544.2): auth-email-hook inserta email_send_log
-- con message_id aleatorio por intento y su marca de 'failed' crea una segunda
-- fila en vez de actualizar la primera. Con el índice único parcial, el hook
-- deduplica por message_id determinista (auth-<run_id>) con ON CONFLICT DO NOTHING.

DELETE FROM public.email_send_log l
WHERE l.message_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.email_send_log t
    WHERE t.message_id = l.message_id
      AND t.status <> 'pending'
  )
  AND l.status = 'pending';

DELETE FROM public.email_send_log l
WHERE l.message_id IS NOT NULL
  AND l.id <> (
    SELECT t.id FROM public.email_send_log t
    WHERE t.message_id = l.message_id
    ORDER BY t.created_at ASC, t.id ASC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_send_log_message_id
  ON public.email_send_log (message_id)
  WHERE message_id IS NOT NULL;