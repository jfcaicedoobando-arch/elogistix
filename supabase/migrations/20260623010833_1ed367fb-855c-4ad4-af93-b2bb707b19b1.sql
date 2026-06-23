
-- 1) Renombrar valor del enum: IndirectoOperacion → Venta
ALTER TYPE public.tipo_contable_categoria RENAME VALUE 'IndirectoOperacion' TO 'Venta';

-- 2) Por cada organización con categorías, insertar las 3 canónicas (si no existen
--    ya por nombre), remapear facturas y eliminar las antiguas.
DO $$
DECLARE
  org_rec RECORD;
  v_cogs_id UUID;
  v_admin_id UUID;
  v_venta_id UUID;
BEGIN
  FOR org_rec IN
    SELECT DISTINCT organization_id FROM public.presupuesto_categorias
  LOOP
    -- Upsert canónico por (org, nombre)
    INSERT INTO public.presupuesto_categorias (organization_id, nombre, tipo_contable, orden, activa)
    VALUES (org_rec.organization_id, 'Costos directos de embarque (COGS)', 'CostoDirectoEmbarque', 10, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.presupuesto_categorias (organization_id, nombre, tipo_contable, orden, activa)
    VALUES (org_rec.organization_id, 'Gastos de administración', 'Administracion', 20, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.presupuesto_categorias (organization_id, nombre, tipo_contable, orden, activa)
    VALUES (org_rec.organization_id, 'Gastos de venta', 'Venta', 30, true)
    ON CONFLICT DO NOTHING;

    -- Si no se insertaron por colisión de PK accidental, recuperar por nombre
    SELECT id INTO v_cogs_id  FROM public.presupuesto_categorias
      WHERE organization_id = org_rec.organization_id AND nombre = 'Costos directos de embarque (COGS)' LIMIT 1;
    SELECT id INTO v_admin_id FROM public.presupuesto_categorias
      WHERE organization_id = org_rec.organization_id AND nombre = 'Gastos de administración' LIMIT 1;
    SELECT id INTO v_venta_id FROM public.presupuesto_categorias
      WHERE organization_id = org_rec.organization_id AND nombre = 'Gastos de venta' LIMIT 1;

    -- Asegurar tipo_contable correcto (por si la fila ya existía con otro tipo)
    UPDATE public.presupuesto_categorias SET tipo_contable = 'CostoDirectoEmbarque', orden = 10, activa = true WHERE id = v_cogs_id;
    UPDATE public.presupuesto_categorias SET tipo_contable = 'Administracion',      orden = 20, activa = true WHERE id = v_admin_id;
    UPDATE public.presupuesto_categorias SET tipo_contable = 'Venta',               orden = 30, activa = true WHERE id = v_venta_id;

    -- Remapear facturas: cada factura cuya categoría NO sea una de las 3 canónicas
    -- se reasigna según el tipo_contable de su categoría actual.
    UPDATE public.proveedor_facturas pf
    SET categoria_presupuesto_id = CASE pc.tipo_contable
      WHEN 'CostoDirectoEmbarque' THEN v_cogs_id
      WHEN 'Administracion'       THEN v_admin_id
      WHEN 'Venta'                THEN v_venta_id
    END
    FROM public.presupuesto_categorias pc
    WHERE pf.categoria_presupuesto_id = pc.id
      AND pc.organization_id = org_rec.organization_id
      AND pc.id NOT IN (v_cogs_id, v_admin_id, v_venta_id);

    -- Remapear también filas de presupuesto_mensual si las hay
    UPDATE public.presupuesto_mensual pm
    SET categoria_id = CASE pc.tipo_contable
      WHEN 'CostoDirectoEmbarque' THEN v_cogs_id
      WHEN 'Administracion'       THEN v_admin_id
      WHEN 'Venta'                THEN v_venta_id
    END
    FROM public.presupuesto_categorias pc
    WHERE pm.categoria_id = pc.id
      AND pc.organization_id = org_rec.organization_id
      AND pc.id NOT IN (v_cogs_id, v_admin_id, v_venta_id);

    -- Eliminar categorías no canónicas
    DELETE FROM public.presupuesto_categorias
    WHERE organization_id = org_rec.organization_id
      AND id NOT IN (v_cogs_id, v_admin_id, v_venta_id);
  END LOOP;
END $$;

-- 3) Reescribir seed_presupuesto_categorias para nuevas organizaciones.
CREATE OR REPLACE FUNCTION public.seed_presupuesto_categorias(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_existing
  FROM public.presupuesto_categorias
  WHERE organization_id = p_organization_id;
  IF v_existing > 0 THEN RETURN; END IF;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, tipo_contable, orden, activa) VALUES
    (p_organization_id, 'Costos directos de embarque (COGS)', 'CostoDirectoEmbarque', 10, true),
    (p_organization_id, 'Gastos de administración',           'Administracion',        20, true),
    (p_organization_id, 'Gastos de venta',                    'Venta',                 30, true);
END;
$function$;
