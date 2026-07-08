DROP TRIGGER IF EXISTS trg_embarques_log_eta_change ON public.embarques;
DROP FUNCTION IF EXISTS public.log_embarque_eta_change();

WITH ranked AS (
  SELECT ev.id,
         ROW_NUMBER() OVER (
           PARTITION BY ev.embarque_id, ev.tipo, date_trunc('minute', ev.created_at)
           ORDER BY ev.created_at ASC
         ) AS rn
  FROM public.eventos_embarque ev
  JOIN public.embarques e ON e.id = ev.embarque_id
  WHERE ev.tipo IN ('Cambio de ETA', 'Arribo a Puerto')
    AND ev.deleted_at IS NULL
    AND e.estado <> 'Cerrado'
)
UPDATE public.eventos_embarque
SET deleted_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);