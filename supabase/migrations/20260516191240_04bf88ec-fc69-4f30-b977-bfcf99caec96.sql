
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proformas_organization_id_fkey') THEN
    ALTER TABLE public.proformas ADD CONSTRAINT proformas_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pcc_embarque_id_fkey') THEN
    ALTER TABLE public.proforma_conceptos_consolidados ADD CONSTRAINT pcc_embarque_id_fkey FOREIGN KEY (embarque_id) REFERENCES public.embarques(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pcc_organization_id_fkey') THEN
    ALTER TABLE public.proforma_conceptos_consolidados ADD CONSTRAINT pcc_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizaciones_cliente_id_fkey') THEN
    ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizaciones_embarque_id_fkey') THEN
    ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_embarque_id_fkey FOREIGN KEY (embarque_id) REFERENCES public.embarques(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auditoria_revisiones_embarque_id_fkey') THEN
    ALTER TABLE public.auditoria_revisiones ADD CONSTRAINT auditoria_revisiones_embarque_id_fkey FOREIGN KEY (embarque_id) REFERENCES public.embarques(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auditoria_revisiones_organization_id_fkey') THEN
    ALTER TABLE public.auditoria_revisiones ADD CONSTRAINT auditoria_revisiones_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auditoria_comentarios_organization_id_fkey') THEN
    ALTER TABLE public.auditoria_comentarios ADD CONSTRAINT auditoria_comentarios_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embarques_peso_kg_nonneg') THEN ALTER TABLE public.embarques ADD CONSTRAINT embarques_peso_kg_nonneg CHECK (peso_kg >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embarques_volumen_nonneg') THEN ALTER TABLE public.embarques ADD CONSTRAINT embarques_volumen_nonneg CHECK (volumen_m3 >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embarques_piezas_nonneg') THEN ALTER TABLE public.embarques ADD CONSTRAINT embarques_piezas_nonneg CHECK (piezas >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embarques_eta_after_etd') THEN ALTER TABLE public.embarques ADD CONSTRAINT embarques_eta_after_etd CHECK (etd IS NULL OR eta IS NULL OR eta >= etd); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embarques_tc_usd_pos') THEN ALTER TABLE public.embarques ADD CONSTRAINT embarques_tc_usd_pos CHECK (tipo_cambio_usd > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embarques_tc_eur_pos') THEN ALTER TABLE public.embarques ADD CONSTRAINT embarques_tc_eur_pos CHECK (tipo_cambio_eur > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conceptos_costo_monto_nonneg') THEN ALTER TABLE public.conceptos_costo ADD CONSTRAINT conceptos_costo_monto_nonneg CHECK (monto >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conceptos_venta_precio_nonneg') THEN ALTER TABLE public.conceptos_venta ADD CONSTRAINT conceptos_venta_precio_nonneg CHECK (precio_unitario >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conceptos_venta_cantidad_pos') THEN ALTER TABLE public.conceptos_venta ADD CONSTRAINT conceptos_venta_cantidad_pos CHECK (cantidad >= 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conceptos_venta_total_nonneg') THEN ALTER TABLE public.conceptos_venta ADD CONSTRAINT conceptos_venta_total_nonneg CHECK (total >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conceptos_factura_precio_nonneg') THEN ALTER TABLE public.conceptos_factura ADD CONSTRAINT conceptos_factura_precio_nonneg CHECK (precio_unitario >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conceptos_factura_cantidad_pos') THEN ALTER TABLE public.conceptos_factura ADD CONSTRAINT conceptos_factura_cantidad_pos CHECK (cantidad >= 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conceptos_factura_total_nonneg') THEN ALTER TABLE public.conceptos_factura ADD CONSTRAINT conceptos_factura_total_nonneg CHECK (total >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='facturas_subtotal_nonneg') THEN ALTER TABLE public.facturas ADD CONSTRAINT facturas_subtotal_nonneg CHECK (subtotal >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='facturas_iva_nonneg') THEN ALTER TABLE public.facturas ADD CONSTRAINT facturas_iva_nonneg CHECK (iva >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='facturas_total_nonneg') THEN ALTER TABLE public.facturas ADD CONSTRAINT facturas_total_nonneg CHECK (total >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='facturas_tipo_cambio_pos') THEN ALTER TABLE public.facturas ADD CONSTRAINT facturas_tipo_cambio_pos CHECK (tipo_cambio > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='facturas_venc_despues_emision') THEN ALTER TABLE public.facturas ADD CONSTRAINT facturas_venc_despues_emision CHECK (fecha_vencimiento >= fecha_emision); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proformas_subtotal_usd_nonneg') THEN ALTER TABLE public.proformas ADD CONSTRAINT proformas_subtotal_usd_nonneg CHECK (subtotal_usd >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proformas_iva_usd_nonneg') THEN ALTER TABLE public.proformas ADD CONSTRAINT proformas_iva_usd_nonneg CHECK (iva_usd >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proformas_total_usd_nonneg') THEN ALTER TABLE public.proformas ADD CONSTRAINT proformas_total_usd_nonneg CHECK (total_usd >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proformas_subtotal_mxn_nonneg') THEN ALTER TABLE public.proformas ADD CONSTRAINT proformas_subtotal_mxn_nonneg CHECK (subtotal_mxn >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proformas_iva_mxn_nonneg') THEN ALTER TABLE public.proformas ADD CONSTRAINT proformas_iva_mxn_nonneg CHECK (iva_mxn >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proformas_total_mxn_nonneg') THEN ALTER TABLE public.proformas ADD CONSTRAINT proformas_total_mxn_nonneg CHECK (total_mxn >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizaciones_peso_nonneg') THEN ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_peso_nonneg CHECK (peso_kg >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizaciones_volumen_nonneg') THEN ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_volumen_nonneg CHECK (volumen_m3 >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizaciones_piezas_nonneg') THEN ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_piezas_nonneg CHECK (piezas >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizaciones_subtotal_nonneg') THEN ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_subtotal_nonneg CHECK (subtotal >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizacion_costos_cantidad_pos') THEN ALTER TABLE public.cotizacion_costos ADD CONSTRAINT cotizacion_costos_cantidad_pos CHECK (cantidad >= 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizacion_costos_costo_unit_nonneg') THEN ALTER TABLE public.cotizacion_costos ADD CONSTRAINT cotizacion_costos_costo_unit_nonneg CHECK (costo_unitario >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizacion_costos_precio_venta_nonneg') THEN ALTER TABLE public.cotizacion_costos ADD CONSTRAINT cotizacion_costos_precio_venta_nonneg CHECK (precio_venta >= 0); END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_embarques_cliente_id ON public.embarques(cliente_id);
CREATE INDEX IF NOT EXISTS idx_embarques_cotizacion_id ON public.embarques(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_embarques_organization_id ON public.embarques(organization_id);
CREATE INDEX IF NOT EXISTS idx_embarques_estado ON public.embarques(estado);
CREATE INDEX IF NOT EXISTS idx_embarques_etd ON public.embarques(etd);
CREATE INDEX IF NOT EXISTS idx_embarques_eta ON public.embarques(eta);
CREATE INDEX IF NOT EXISTS idx_conceptos_costo_embarque_id ON public.conceptos_costo(embarque_id);
CREATE INDEX IF NOT EXISTS idx_conceptos_costo_proveedor_id ON public.conceptos_costo(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_conceptos_costo_org ON public.conceptos_costo(organization_id);
CREATE INDEX IF NOT EXISTS idx_conceptos_venta_embarque_id ON public.conceptos_venta(embarque_id);
CREATE INDEX IF NOT EXISTS idx_conceptos_venta_proforma_id ON public.conceptos_venta(proforma_id);
CREATE INDEX IF NOT EXISTS idx_conceptos_factura_factura_id ON public.conceptos_factura(factura_id);
CREATE INDEX IF NOT EXISTS idx_facturas_embarque_id ON public.facturas(embarque_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id ON public.facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_proforma_id ON public.facturas(proforma_id);
CREATE INDEX IF NOT EXISTS idx_facturas_org ON public.facturas(organization_id);
CREATE INDEX IF NOT EXISTS idx_proformas_embarque_id ON public.proformas(embarque_id);
CREATE INDEX IF NOT EXISTS idx_proformas_cliente_id ON public.proformas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proformas_factura_id ON public.proformas(factura_id);
CREATE INDEX IF NOT EXISTS idx_proformas_org ON public.proformas(organization_id);
CREATE INDEX IF NOT EXISTS idx_pcc_proforma_id ON public.proforma_conceptos_consolidados(proforma_id);
CREATE INDEX IF NOT EXISTS idx_pcc_embarque_id ON public.proforma_conceptos_consolidados(embarque_id);
CREATE INDEX IF NOT EXISTS idx_documentos_embarque_embarque_id ON public.documentos_embarque(embarque_id);
CREATE INDEX IF NOT EXISTS idx_eventos_embarque_embarque_id ON public.eventos_embarque(embarque_id);
CREATE INDEX IF NOT EXISTS idx_notas_embarque_embarque_id ON public.notas_embarque(embarque_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente_id ON public.cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_org ON public.cotizaciones(organization_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_costos_cotizacion_id ON public.cotizacion_costos(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_contactos_cliente_cliente_id ON public.contactos_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_client_users_cliente_id ON public.client_users(cliente_id);
CREATE INDEX IF NOT EXISTS idx_client_users_user_id ON public.client_users(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_revisiones_embarque_id ON public.auditoria_revisiones(embarque_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_comentarios_revision_id ON public.auditoria_comentarios(revision_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_org_created_at ON public.bitacora_actividad(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_entidad_id ON public.bitacora_actividad(entidad_id);
