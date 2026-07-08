ALTER TABLE public.embarques DISABLE TRIGGER trg_bloquear_embarque_self;

UPDATE public.embarques
SET expediente = 'ELIMP00304'
WHERE id = '14081b92-e11a-4159-8bbb-d1201004967f'
  AND expediente = 'ELIMP00149'
  AND estado = 'Cerrado';

ALTER TABLE public.embarques ENABLE TRIGGER trg_bloquear_embarque_self;

INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, entidad_id, entidad_nombre, accion, detalles)
SELECT
  '00000000-0000-0000-0000-000000000001',
  created_by,
  'system-migration',
  'embarques',
  id,
  'ELIMP00304',
  'reasignacion_folio',
  jsonb_build_object(
    'folio_anterior', 'ELIMP00149',
    'folio_nuevo', 'ELIMP00304',
    'motivo', 'Colisión de folio: embarque cerrado (BL 034G521324) reasignado para liberar ELIMP00149 al activo (BL 034G523190, EIR)'
  )
FROM public.embarques
WHERE id = '14081b92-e11a-4159-8bbb-d1201004967f';