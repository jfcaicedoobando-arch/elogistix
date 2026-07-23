
ALTER TABLE public.facturas DISABLE TRIGGER trg_bloquear_factura_emitida;
ALTER TABLE public.facturas DISABLE TRIGGER trg_congelar_factura;
ALTER TABLE public.proformas DISABLE TRIGGER trg_proforma_no_soft_delete_facturada;
ALTER TABLE public.proformas DISABLE TRIGGER trg_congelar_proforma;
ALTER TABLE public.proformas DISABLE TRIGGER trg_enforce_proforma_aceptada;

-- Reasignar factura 726 → PRO-2026-0084
UPDATE public.facturas SET proforma_id = '6bb133bc-f2f7-4a46-bc39-1db2d811e324', updated_at = now()
WHERE id = 'ad6350f2-4727-4e23-a6b9-676133381673';

UPDATE public.proformas
SET estado_proforma = 'facturada',
    factura_id = 'ad6350f2-4727-4e23-a6b9-676133381673',
    folio_factura_externa = '726',
    fecha_facturacion = DATE '2026-02-18',
    origen = 'externa',
    updated_at = now()
WHERE id = '6bb133bc-f2f7-4a46-bc39-1db2d811e324';

UPDATE public.proformas
SET deleted_at = now(),
    notas = COALESCE(notas,'') || E'\n[Reasignada a PRO-2026-0084 por backfill legacy ERP]',
    factura_id = NULL,
    updated_at = now()
WHERE id = 'dcf5793e-6fa4-490a-b9b1-a5aa9ce0eae8';

-- Reasignar factura 755 → PRO-2026-0085
UPDATE public.facturas SET proforma_id = '9b8a8a06-783f-45c8-aeba-efc640007318', updated_at = now()
WHERE id = '2c204143-6f25-4559-962d-c2ccdb7e187d';

UPDATE public.proformas
SET estado_proforma = 'facturada',
    factura_id = '2c204143-6f25-4559-962d-c2ccdb7e187d',
    folio_factura_externa = '755',
    fecha_facturacion = DATE '2026-02-27',
    origen = 'externa',
    updated_at = now()
WHERE id = '9b8a8a06-783f-45c8-aeba-efc640007318';

UPDATE public.proformas
SET deleted_at = now(),
    notas = COALESCE(notas,'') || E'\n[Reasignada a PRO-2026-0085 por backfill legacy ERP]',
    factura_id = NULL,
    updated_at = now()
WHERE id = '3594741e-5513-45c2-98df-d9d6ddd2bf6e';

-- Bloque A: 8 stubs
WITH src(numero_p, folio, fecha) AS (
  VALUES
    ('PRO-2026-0195','889', DATE '2026-05-13'),
    ('PRO-2026-0278','729', DATE '2026-02-18'),
    ('PRO-2026-0287','721', DATE '2026-02-17'),
    ('PRO-2026-0297','915', DATE '2026-06-03'),
    ('PRO-2026-0322','930', DATE '2026-06-12'),
    ('PRO-2026-0337','940', DATE '2026-06-19'),
    ('PRO-2026-0340','944', DATE '2026-06-23'),
    ('PRO-2026-0948','948', DATE '2026-06-26')
),
ins AS (
  INSERT INTO public.facturas (
    numero, embarque_id, expediente, cliente_id, cliente_nombre,
    subtotal, iva, total, moneda, fecha_emision, fecha_vencimiento,
    estado, notas, organization_id, proforma_id, origen,
    ret_isr, ret_iva, uuid_verificado
  )
  SELECT
    s.folio, p.embarque_id, p.expediente, p.cliente_id, p.cliente_nombre,
    p.subtotal_usd, p.iva_usd, p.total_usd, 'USD', s.fecha, s.fecha,
    'Pagada', 'Factura emitida fuera de sistema — backfill legacy ERP',
    p.organization_id, p.id, 'manual',
    0, 0, false
  FROM src s
  JOIN public.proformas p ON p.numero = s.numero_p AND p.deleted_at IS NULL
  RETURNING id, proforma_id, numero, fecha_emision
),
upd AS (
  UPDATE public.proformas p
  SET estado_proforma = 'facturada',
      factura_id = ins.id,
      folio_factura_externa = ins.numero,
      fecha_facturacion = ins.fecha_emision,
      origen = 'externa',
      updated_at = now()
  FROM ins
  WHERE p.id = ins.proforma_id
  RETURNING p.id, p.numero, p.organization_id, ins.numero AS folio_ext
)
INSERT INTO public.bitacora_actividad (usuario_id, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id)
SELECT '38f502b3-2261-4c0a-ba54-28d90d3ce7a1'::uuid,
       'PROFORMA_VINCULADA_FACTURA_EXTERNA', 'proformas', upd.id, upd.numero,
       jsonb_build_object('folio_externo', upd.folio_ext, 'backfill', true),
       upd.organization_id
FROM upd;

ALTER TABLE public.proformas ENABLE TRIGGER trg_enforce_proforma_aceptada;
ALTER TABLE public.proformas ENABLE TRIGGER trg_congelar_proforma;
ALTER TABLE public.proformas ENABLE TRIGGER trg_proforma_no_soft_delete_facturada;
ALTER TABLE public.facturas ENABLE TRIGGER trg_congelar_factura;
ALTER TABLE public.facturas ENABLE TRIGGER trg_bloquear_factura_emitida;

INSERT INTO public.bitacora_actividad (usuario_id, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id)
VALUES
  ('38f502b3-2261-4c0a-ba54-28d90d3ce7a1'::uuid,'PROFORMA_REASIGNADA_FACTURA_EXTERNA','proformas','6bb133bc-f2f7-4a46-bc39-1db2d811e324','PRO-2026-0084',
   jsonb_build_object('folio_externo','726','proforma_reasignada_desde','PRO-2026-0083','factura_id','ad6350f2-4727-4e23-a6b9-676133381673'),
   '00000000-0000-0000-0000-000000000001'::uuid),
  ('38f502b3-2261-4c0a-ba54-28d90d3ce7a1'::uuid,'PROFORMA_REASIGNADA_FACTURA_EXTERNA','proformas','9b8a8a06-783f-45c8-aeba-efc640007318','PRO-2026-0085',
   jsonb_build_object('folio_externo','755','proforma_reasignada_desde','PRO-2026-0078','factura_id','2c204143-6f25-4559-962d-c2ccdb7e187d'),
   '00000000-0000-0000-0000-000000000001'::uuid);
