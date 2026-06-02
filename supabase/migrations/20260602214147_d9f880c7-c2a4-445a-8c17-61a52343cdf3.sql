DROP FUNCTION public.consolidar_proformas(
  p_organization_id uuid,
  p_proforma_ids uuid[],
  p_embarque_id uuid,
  p_cliente_id uuid,
  p_cliente_nombre text,
  p_expediente text,
  p_bl_master text,
  p_operador text,
  p_dias_credito integer,
  p_tasa_iva numeric,
  p_request_id uuid
);