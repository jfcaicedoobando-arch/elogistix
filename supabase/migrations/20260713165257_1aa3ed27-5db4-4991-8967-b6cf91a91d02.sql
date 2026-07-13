
ALTER TABLE public.embarques DISABLE TRIGGER trg_bloquear_embarque_self;

UPDATE public.embarques
   SET expediente = 'ELIMP00317', updated_at = now()
 WHERE id = 'f71683b9-5858-4183-8370-292da4745a49'
   AND expediente = 'ELIMP00150';

UPDATE public.embarques
   SET expediente = 'ELIMP00318', updated_at = now()
 WHERE id = '39b67ce7-a957-4f5a-b068-1febe0cd9115'
   AND expediente = 'ELIMP00304';

ALTER TABLE public.embarques ENABLE TRIGGER trg_bloquear_embarque_self;

CREATE UNIQUE INDEX IF NOT EXISTS embarques_expediente_org_unico
  ON public.embarques (organization_id, expediente)
  WHERE deleted_at IS NULL;
