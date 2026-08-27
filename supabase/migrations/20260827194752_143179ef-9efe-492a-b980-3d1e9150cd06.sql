-- =====================================================================
-- Ola 2 · Auditoría 3 (H — aislamiento multi-tenant en relaciones)
--
-- Las FKs simples permitían que un hijo apuntara a un padre de OTRA
-- organización (amplificado por las funciones/Edge con service_role, que
-- no pasan por RLS). Se sustituyen por FKs compuestas (id, organization_id).
--
-- Precondición verificada en producción: 0 filas cruzadas en todas las
-- relaciones tocadas por esta migración.
-- =====================================================================

-- 1) Llaves candidatas (id, organization_id) en los padres -------------------
ALTER TABLE public.embarques
  ADD CONSTRAINT embarques_id_org_uniq UNIQUE (id, organization_id);
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_id_org_uniq UNIQUE (id, organization_id);
ALTER TABLE public.cotizaciones
  ADD CONSTRAINT cotizaciones_id_org_uniq UNIQUE (id, organization_id);
ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_id_org_uniq UNIQUE (id, organization_id);
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_id_org_uniq UNIQUE (id, organization_id);
ALTER TABLE public.proveedores
  ADD CONSTRAINT proveedores_id_org_uniq UNIQUE (id, organization_id);
ALTER TABLE public.proveedor_facturas
  ADD CONSTRAINT proveedor_facturas_id_org_uniq UNIQUE (id, organization_id);
ALTER TABLE public.embarque_contenedores
  ADD CONSTRAINT embarque_contenedores_id_org_uniq UNIQUE (id, organization_id);

-- 2) facturas ---------------------------------------------------------------
ALTER TABLE public.facturas DROP CONSTRAINT facturas_embarque_id_fkey;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_embarque_org_fkey
  FOREIGN KEY (embarque_id, organization_id)
  REFERENCES public.embarques (id, organization_id);

ALTER TABLE public.facturas DROP CONSTRAINT facturas_cliente_id_fkey;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_cliente_org_fkey
  FOREIGN KEY (cliente_id, organization_id)
  REFERENCES public.clientes (id, organization_id);

ALTER TABLE public.facturas DROP CONSTRAINT facturas_cotizacion_id_fkey;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_cotizacion_org_fkey
  FOREIGN KEY (cotizacion_id, organization_id)
  REFERENCES public.cotizaciones (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.facturas DROP CONSTRAINT facturas_proforma_id_fkey;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_proforma_org_fkey
  FOREIGN KEY (proforma_id, organization_id)
  REFERENCES public.proformas (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.facturas DROP CONSTRAINT facturas_sustituye_a_fkey;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_sustituye_a_org_fkey
  FOREIGN KEY (sustituye_a, organization_id)
  REFERENCES public.facturas (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.facturas DROP CONSTRAINT facturas_sustituida_por_fkey;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_sustituida_por_org_fkey
  FOREIGN KEY (sustituida_por, organization_id)
  REFERENCES public.facturas (id, organization_id) ON DELETE SET NULL;

-- 3) pagos_factura ----------------------------------------------------------
ALTER TABLE public.pagos_factura DROP CONSTRAINT pagos_factura_factura_id_fkey;
ALTER TABLE public.pagos_factura
  ADD CONSTRAINT pagos_factura_factura_org_fkey
  FOREIGN KEY (factura_id, organization_id)
  REFERENCES public.facturas (id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.pagos_factura DROP CONSTRAINT pagos_factura_embarque_id_fkey;
ALTER TABLE public.pagos_factura
  ADD CONSTRAINT pagos_factura_embarque_org_fkey
  FOREIGN KEY (embarque_id, organization_id)
  REFERENCES public.embarques (id, organization_id) ON DELETE SET NULL;

-- 4) factura_notas_credito --------------------------------------------------
ALTER TABLE public.factura_notas_credito DROP CONSTRAINT factura_notas_credito_factura_id_fkey;
ALTER TABLE public.factura_notas_credito
  ADD CONSTRAINT factura_notas_credito_factura_org_fkey
  FOREIGN KEY (factura_id, organization_id)
  REFERENCES public.facturas (id, organization_id) ON DELETE CASCADE;

-- 5) conceptos_venta --------------------------------------------------------
ALTER TABLE public.conceptos_venta DROP CONSTRAINT conceptos_venta_embarque_id_fkey;
ALTER TABLE public.conceptos_venta
  ADD CONSTRAINT conceptos_venta_embarque_org_fkey
  FOREIGN KEY (embarque_id, organization_id)
  REFERENCES public.embarques (id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.conceptos_venta DROP CONSTRAINT conceptos_venta_contenedor_id_fkey;
ALTER TABLE public.conceptos_venta
  ADD CONSTRAINT conceptos_venta_contenedor_org_fkey
  FOREIGN KEY (contenedor_id, organization_id)
  REFERENCES public.embarque_contenedores (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.conceptos_venta DROP CONSTRAINT conceptos_venta_proforma_id_fkey;
ALTER TABLE public.conceptos_venta
  ADD CONSTRAINT conceptos_venta_proforma_org_fkey
  FOREIGN KEY (proforma_id, organization_id)
  REFERENCES public.proformas (id, organization_id) ON DELETE SET NULL;

-- 6) conceptos_costo --------------------------------------------------------
ALTER TABLE public.conceptos_costo DROP CONSTRAINT conceptos_costo_embarque_id_fkey;
ALTER TABLE public.conceptos_costo
  ADD CONSTRAINT conceptos_costo_embarque_org_fkey
  FOREIGN KEY (embarque_id, organization_id)
  REFERENCES public.embarques (id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.conceptos_costo DROP CONSTRAINT conceptos_costo_contenedor_id_fkey;
ALTER TABLE public.conceptos_costo
  ADD CONSTRAINT conceptos_costo_contenedor_org_fkey
  FOREIGN KEY (contenedor_id, organization_id)
  REFERENCES public.embarque_contenedores (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.conceptos_costo DROP CONSTRAINT conceptos_costo_proveedor_id_fkey;
ALTER TABLE public.conceptos_costo
  ADD CONSTRAINT conceptos_costo_proveedor_org_fkey
  FOREIGN KEY (proveedor_id, organization_id)
  REFERENCES public.proveedores (id, organization_id);

-- 7) conceptos_factura ------------------------------------------------------
ALTER TABLE public.conceptos_factura DROP CONSTRAINT conceptos_factura_factura_id_fkey;
ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_factura_org_fkey
  FOREIGN KEY (factura_id, organization_id)
  REFERENCES public.facturas (id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.conceptos_factura DROP CONSTRAINT conceptos_factura_embarque_id_fkey;
ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_embarque_org_fkey
  FOREIGN KEY (embarque_id, organization_id)
  REFERENCES public.embarques (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.conceptos_factura DROP CONSTRAINT conceptos_factura_proforma_id_origen_fkey;
ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_proforma_origen_org_fkey
  FOREIGN KEY (proforma_id_origen, organization_id)
  REFERENCES public.proformas (id, organization_id) ON DELETE SET NULL;

-- 8) cotizacion_costos ------------------------------------------------------
ALTER TABLE public.cotizacion_costos DROP CONSTRAINT cotizacion_costos_cotizacion_id_fkey;
ALTER TABLE public.cotizacion_costos
  ADD CONSTRAINT cotizacion_costos_cotizacion_org_fkey
  FOREIGN KEY (cotizacion_id, organization_id)
  REFERENCES public.cotizaciones (id, organization_id) ON DELETE CASCADE;

-- 9) proformas --------------------------------------------------------------
ALTER TABLE public.proformas DROP CONSTRAINT proformas_embarque_id_fkey;
ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_embarque_org_fkey
  FOREIGN KEY (embarque_id, organization_id)
  REFERENCES public.embarques (id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.proformas DROP CONSTRAINT proformas_cliente_id_fkey;
ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_cliente_org_fkey
  FOREIGN KEY (cliente_id, organization_id)
  REFERENCES public.clientes (id, organization_id);

ALTER TABLE public.proformas DROP CONSTRAINT proformas_factura_id_fkey;
ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_factura_org_fkey
  FOREIGN KEY (factura_id, organization_id)
  REFERENCES public.facturas (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.proformas DROP CONSTRAINT proformas_factura_secundaria_id_fkey;
ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_factura_secundaria_org_fkey
  FOREIGN KEY (factura_secundaria_id, organization_id)
  REFERENCES public.facturas (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.proformas DROP CONSTRAINT proformas_consolidada_en_fkey;
ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_consolidada_en_org_fkey
  FOREIGN KEY (consolidada_en, organization_id)
  REFERENCES public.proformas (id, organization_id) ON DELETE SET NULL;

-- 10) proveedor_facturas / pagos_proveedor ---------------------------------
ALTER TABLE public.proveedor_facturas DROP CONSTRAINT proveedor_facturas_proveedor_id_fkey;
ALTER TABLE public.proveedor_facturas
  ADD CONSTRAINT proveedor_facturas_proveedor_org_fkey
  FOREIGN KEY (proveedor_id, organization_id)
  REFERENCES public.proveedores (id, organization_id) ON DELETE RESTRICT;

ALTER TABLE public.proveedor_facturas DROP CONSTRAINT proveedor_facturas_embarque_id_fkey;
ALTER TABLE public.proveedor_facturas
  ADD CONSTRAINT proveedor_facturas_embarque_org_fkey
  FOREIGN KEY (embarque_id, organization_id)
  REFERENCES public.embarques (id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.pagos_proveedor DROP CONSTRAINT pagos_proveedor_proveedor_factura_id_fkey;
ALTER TABLE public.pagos_proveedor
  ADD CONSTRAINT pagos_proveedor_factura_org_fkey
  FOREIGN KEY (proveedor_factura_id, organization_id)
  REFERENCES public.proveedor_facturas (id, organization_id) ON DELETE RESTRICT;

-- 11) embarque_contenedores ------------------------------------------------
ALTER TABLE public.embarque_contenedores DROP CONSTRAINT embarque_contenedores_embarque_id_fkey;
ALTER TABLE public.embarque_contenedores
  ADD CONSTRAINT embarque_contenedores_embarque_org_fkey
  FOREIGN KEY (embarque_id, organization_id)
  REFERENCES public.embarques (id, organization_id) ON DELETE CASCADE;
