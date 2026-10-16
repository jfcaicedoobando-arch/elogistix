-- Exact corrected serial test fixture, kept session-local.
CREATE OR REPLACE FUNCTION pg_temp.cxp_fixture(p_org uuid, p_creator uuid, p_concepts boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_prov uuid := gen_random_uuid(); v_cat uuid := gen_random_uuid(); v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES (v_prov, p_org, 'Autoaprobación proveedor efímero', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, tipo_contable)
    VALUES (v_cat, p_org, 'Autoaprobación administración ' || v_cat::text, 'Administracion');
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, proveedor_nombre,
    categoria_presupuesto_id, folio_proveedor, fecha_emision, moneda, tipo_cambio_usd,
    subtotal, total, estado, estado_aprobacion, created_by)
  VALUES (v_id, p_org, v_prov, 'Autoaprobación proveedor efímero', v_cat,
    'AUTO-' || v_id::text, public.fecha_negocio_mx(), 'MXN', 1, 100, 100, 'Vigente', 'pendiente', p_creator);
  IF p_concepts THEN
    INSERT INTO public.proveedor_facturas_conceptos(organization_id, proveedor_factura_id,
      descripcion, cantidad, monto, iva, ieps)
    VALUES (p_org, v_id, 'Gasto sintético', 1, 100, 0, 0);
  END IF;
  RETURN v_id;
END;
$$;
