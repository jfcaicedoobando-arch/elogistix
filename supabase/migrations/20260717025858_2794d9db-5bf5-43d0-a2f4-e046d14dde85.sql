-- Fix: la secuencia embarque_consecutivo_seq quedó contaminada porque las
-- migraciones 20260713165742 y 20260713190941 aplicaron
--   MAX(regexp_replace(expediente, '\D', '', 'g')::bigint)
-- sobre TODOS los embarques, incluyendo los DEMO-2026-004 (→ 2026004). Eso
-- disparó el consecutivo a ~2026800 y produjo folios ELIMP20260-ELIMP20268.

-- 1) Renombrar los 9 folios contaminados a la serie esperada 00319-00327.
--    (ELIMP00317 y ELIMP00318 ya existen desde la migración 20260713165257.)
ALTER TABLE public.embarques DISABLE TRIGGER trg_bloquear_embarque_self;

UPDATE public.embarques SET expediente = 'ELIMP00319', updated_at = now()
 WHERE id = 'fc07a199-94b0-4399-8649-fcef1e2ad5b1' AND expediente = 'ELIMP20260';

UPDATE public.embarques SET expediente = 'ELIMP00320', updated_at = now()
 WHERE id = 'e7558e76-60ce-4ac2-b73a-be7b98519b64' AND expediente = 'ELIMP20261';

UPDATE public.embarques SET expediente = 'ELIMP00321', updated_at = now()
 WHERE id = '8081369e-85e5-4af9-9b11-f605ba8847bf' AND expediente = 'ELIMP20262';

UPDATE public.embarques SET expediente = 'ELIMP00322', updated_at = now()
 WHERE id = '8d216d63-d7f4-4cdb-a19d-659119df0ea3' AND expediente = 'ELIMP20263';

UPDATE public.embarques SET expediente = 'ELIMP00323', updated_at = now()
 WHERE id = 'cfc31a2d-844a-441e-90bf-cf07870baaba' AND expediente = 'ELIMP20264';

UPDATE public.embarques SET expediente = 'ELIMP00324', updated_at = now()
 WHERE id = 'acdacd83-b0b6-4c9f-a32b-e52d7d93e82a' AND expediente = 'ELIMP20265';

UPDATE public.embarques SET expediente = 'ELIMP00325', updated_at = now()
 WHERE id = 'f00feea7-a58b-4448-97e8-292de318be6e' AND expediente = 'ELIMP20266';

UPDATE public.embarques SET expediente = 'ELIMP00326', updated_at = now()
 WHERE id = '22492e4c-239f-42bb-b242-fb48e2773ff1' AND expediente = 'ELIMP20267';

UPDATE public.embarques SET expediente = 'ELIMP00327', updated_at = now()
 WHERE id = '9d44ba9e-a41b-4050-9a51-1a0ec37e6b2e' AND expediente = 'ELIMP20268';

ALTER TABLE public.embarques ENABLE TRIGGER trg_bloquear_embarque_self;

-- 2) Realinear la secuencia usando SOLO folios con formato estándar EL<PREFIJO>NNNNN.
--    Los DEMO-YYYY-### quedan excluidos por el regex estricto.
DO $$
DECLARE
  v_max_real bigint;
BEGIN
  SELECT COALESCE(MAX(substring(expediente FROM 6)::bigint), 1)
    INTO v_max_real
    FROM public.embarques
   WHERE expediente ~ '^EL[A-Z]{3}[0-9]+$'
     AND deleted_at IS NULL;

  PERFORM setval('public.embarque_consecutivo_seq', GREATEST(v_max_real, 1), true);
END $$;

-- 3) Registrar los renombrados en bitácora (auditoría interna).
INSERT INTO public.bitacora_actividad
  (usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  'sistema@librecarga.com',
  'renombrar_expediente',
  'Embarques',
  v.embarque_id::uuid,
  v.nuevo,
  jsonb_build_object(
    'anterior', v.anterior,
    'nuevo',    v.nuevo,
    'motivo',   'fix-secuencia-contaminada-por-demo'
  ),
  '00000000-0000-0000-0000-000000000001'::uuid
FROM (VALUES
  ('fc07a199-94b0-4399-8649-fcef1e2ad5b1', 'ELIMP20260', 'ELIMP00319'),
  ('e7558e76-60ce-4ac2-b73a-be7b98519b64', 'ELIMP20261', 'ELIMP00320'),
  ('8081369e-85e5-4af9-9b11-f605ba8847bf', 'ELIMP20262', 'ELIMP00321'),
  ('8d216d63-d7f4-4cdb-a19d-659119df0ea3', 'ELIMP20263', 'ELIMP00322'),
  ('cfc31a2d-844a-441e-90bf-cf07870baaba', 'ELIMP20264', 'ELIMP00323'),
  ('acdacd83-b0b6-4c9f-a32b-e52d7d93e82a', 'ELIMP20265', 'ELIMP00324'),
  ('f00feea7-a58b-4448-97e8-292de318be6e', 'ELIMP20266', 'ELIMP00325'),
  ('22492e4c-239f-42bb-b242-fb48e2773ff1', 'ELIMP20267', 'ELIMP00326'),
  ('9d44ba9e-a41b-4050-9a51-1a0ec37e6b2e', 'ELIMP20268', 'ELIMP00327')
) AS v(embarque_id, anterior, nuevo);
