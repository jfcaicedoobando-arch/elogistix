-- =====================================================================
-- Ola 2 (ajuste) · El aislamiento por organización se aplica con
-- triggers de validación en lugar de FKs compuestas.
--
-- Motivo: PostgREST no resuelve el hint por columna (`embarques:embarque_id(...)`)
-- cuando la FK es compuesta → PGRST200 y la app se rompe en decenas de
-- consultas embebidas. Se restauran las FKs de una columna (para el schema
-- cache) y la garantía multi-tenant queda en un trigger genérico.
-- =====================================================================

-- 1) Trigger genérico -------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_padre_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col    text := TG_ARGV[0];
  v_padre  text := TG_ARGV[1];
  v_id     uuid;
  v_org    uuid;
BEGIN
  v_id  := (to_jsonb(NEW) ->> v_col)::uuid;
  v_org := (to_jsonb(NEW) ->> 'organization_id')::uuid;

  IF v_id IS NULL OR v_org IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT organization_id FROM public.%I WHERE id = $1', v_padre
  ) INTO v_org USING v_id;

  IF v_org IS NULL THEN
    RETURN NEW; -- la FK se encarga de la existencia
  END IF;

  IF v_org <> (to_jsonb(NEW) ->> 'organization_id')::uuid THEN
    RAISE EXCEPTION
      'LC_ORG_CRUZADA: %.% apunta a un registro de otra organización (%)',
      TG_TABLE_NAME, v_col, v_padre
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_padre_misma_org() FROM PUBLIC, anon, authenticated;

-- 2) Restaurar FKs de una columna y colocar el trigger ----------------------
DO $ola2$
DECLARE
  r record;
  v_trg text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('facturas','embarque_id','embarques','facturas_embarque_id_fkey','facturas_embarque_org_fkey',''),
      ('facturas','cliente_id','clientes','facturas_cliente_id_fkey','facturas_cliente_org_fkey',''),
      ('facturas','cotizacion_id','cotizaciones','facturas_cotizacion_id_fkey','facturas_cotizacion_org_fkey',' ON DELETE SET NULL'),
      ('facturas','proforma_id','proformas','facturas_proforma_id_fkey','facturas_proforma_org_fkey',' ON DELETE SET NULL'),
      ('facturas','sustituye_a','facturas','facturas_sustituye_a_fkey','facturas_sustituye_a_org_fkey',' ON DELETE SET NULL'),
      ('facturas','sustituida_por','facturas','facturas_sustituida_por_fkey','facturas_sustituida_por_org_fkey',' ON DELETE SET NULL'),
      ('pagos_factura','factura_id','facturas','pagos_factura_factura_id_fkey','pagos_factura_factura_org_fkey',' ON DELETE CASCADE'),
      ('pagos_factura','embarque_id','embarques','pagos_factura_embarque_id_fkey','pagos_factura_embarque_org_fkey',' ON DELETE SET NULL'),
      ('factura_notas_credito','factura_id','facturas','factura_notas_credito_factura_id_fkey','factura_notas_credito_factura_org_fkey',' ON DELETE CASCADE'),
      ('conceptos_venta','embarque_id','embarques','conceptos_venta_embarque_id_fkey','conceptos_venta_embarque_org_fkey',' ON DELETE CASCADE'),
      ('conceptos_venta','contenedor_id','embarque_contenedores','conceptos_venta_contenedor_id_fkey','conceptos_venta_contenedor_org_fkey',' ON DELETE SET NULL'),
      ('conceptos_venta','proforma_id','proformas','conceptos_venta_proforma_id_fkey','conceptos_venta_proforma_org_fkey',' ON DELETE SET NULL'),
      ('conceptos_costo','embarque_id','embarques','conceptos_costo_embarque_id_fkey','conceptos_costo_embarque_org_fkey',' ON DELETE CASCADE'),
      ('conceptos_costo','contenedor_id','embarque_contenedores','conceptos_costo_contenedor_id_fkey','conceptos_costo_contenedor_org_fkey',' ON DELETE SET NULL'),
      ('conceptos_costo','proveedor_id','proveedores','conceptos_costo_proveedor_id_fkey','conceptos_costo_proveedor_org_fkey',''),
      ('conceptos_factura','factura_id','facturas','conceptos_factura_factura_id_fkey','conceptos_factura_factura_org_fkey',' ON DELETE CASCADE'),
      ('conceptos_factura','embarque_id','embarques','conceptos_factura_embarque_id_fkey','conceptos_factura_embarque_org_fkey',' ON DELETE SET NULL'),
      ('conceptos_factura','proforma_id_origen','proformas','conceptos_factura_proforma_id_origen_fkey','conceptos_factura_proforma_origen_org_fkey',' ON DELETE SET NULL'),
      ('cotizacion_costos','cotizacion_id','cotizaciones','cotizacion_costos_cotizacion_id_fkey','cotizacion_costos_cotizacion_org_fkey',' ON DELETE CASCADE'),
      ('proformas','embarque_id','embarques','proformas_embarque_id_fkey','proformas_embarque_org_fkey',' ON DELETE CASCADE'),
      ('proformas','cliente_id','clientes','proformas_cliente_id_fkey','proformas_cliente_org_fkey',''),
      ('proformas','factura_id','facturas','proformas_factura_id_fkey','proformas_factura_org_fkey',' ON DELETE SET NULL'),
      ('proformas','factura_secundaria_id','facturas','proformas_factura_secundaria_id_fkey','proformas_factura_secundaria_org_fkey',' ON DELETE SET NULL'),
      ('proformas','consolidada_en','proformas','proformas_consolidada_en_fkey','proformas_consolidada_en_org_fkey',' ON DELETE SET NULL'),
      ('proveedor_facturas','proveedor_id','proveedores','proveedor_facturas_proveedor_id_fkey','proveedor_facturas_proveedor_org_fkey',' ON DELETE RESTRICT'),
      ('proveedor_facturas','embarque_id','embarques','proveedor_facturas_embarque_id_fkey','proveedor_facturas_embarque_org_fkey',' ON DELETE SET NULL'),
      ('pagos_proveedor','proveedor_factura_id','proveedor_facturas','pagos_proveedor_proveedor_factura_id_fkey','pagos_proveedor_factura_org_fkey',' ON DELETE RESTRICT'),
      ('embarque_contenedores','embarque_id','embarques','embarque_contenedores_embarque_id_fkey','embarque_contenedores_embarque_org_fkey',' ON DELETE CASCADE')
    ) AS v(hijo, col, padre, fk_simple, fk_compuesta, accion)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.hijo, r.fk_compuesta);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id)%s',
      r.hijo, r.fk_simple, r.col, r.padre, r.accion
    );

    v_trg := format('trg_org_%s_%s', r.hijo, r.col);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trg, r.hijo);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I, organization_id ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public._assert_padre_misma_org(%L, %L)',
      v_trg, r.col, r.hijo, r.col, r.padre
    );
  END LOOP;
END
$ola2$;

-- 3) Las llaves candidatas (id, organization_id) se conservan: son inocuas y
--    habilitan FKs compuestas futuras si PostgREST llega a soportar el hint.
