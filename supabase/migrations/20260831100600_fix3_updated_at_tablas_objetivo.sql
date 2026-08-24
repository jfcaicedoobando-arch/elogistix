-- ============================================================================
-- FIX3 · M-5 / O1.14: triggers updated_at en las 10 tablas REALES del hallazgo.
-- ============================================================================
-- Contexto: la migración ola1 (20260821002602:510-538) creó triggers en 6
-- tablas que NO eran las del hallazgo (anticipos_aplicaciones,
-- anticipos_proveedor, configuracion_global, crm_comentarios_oportunidad,
-- crm_plantillas_mensaje, organizations — esas quedan, no estorban).
--
-- Verificación en HEAD (5e6fdd2) de las 10 tablas objetivo:
--   conceptos_venta, conceptos_costo, conceptos_factura, contactos_cliente,
--   documentos_embarque, eventos_embarque, notas_embarque,
--   proforma_conceptos_consolidados, proveedor_facturas_conceptos,
--   crm_notificaciones
-- NINGUNA tiene trigger updated_at y —contrario a lo estimado en la revisión
-- (que creía 8 con columna, probablemente por drift manual en prod)— ninguna
-- tiene la columna `updated_at` en el esquema versionado (verificado por
-- replay: los CREATE TABLE de 20260228011257/20260318050744/20260424232518/
-- 20260602185003/20260525033411 no la incluyen y no existe ALTER que la añada).
--
-- Por eso esta migración hace AMBAS cosas, idempotente:
--   1. ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
--      (nullable y SIN NOT NULL: el default no es constante, así que un NOT
--      NULL inmediato requeriría reescribir tablas potencialmente grandes
--      como eventos_embarque; las filas históricas quedan en NULL hasta su
--      primer UPDATE — semántica "nunca modificado"— y toda escritura nueva
--      la sella vía trigger/default).
--   2. BEFORE UPDATE trigger con public.update_updated_at_column()
--      (helper existente desde 20260228011257).
-- ============================================================================

ALTER TABLE public.conceptos_venta                  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.conceptos_costo                  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.conceptos_factura                ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.contactos_cliente                ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.documentos_embarque              ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.eventos_embarque                 ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.notas_embarque                   ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.proforma_conceptos_consolidados  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.proveedor_facturas_conceptos     ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.crm_notificaciones               ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS update_conceptos_venta_updated_at ON public.conceptos_venta;
CREATE TRIGGER update_conceptos_venta_updated_at
  BEFORE UPDATE ON public.conceptos_venta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conceptos_costo_updated_at ON public.conceptos_costo;
CREATE TRIGGER update_conceptos_costo_updated_at
  BEFORE UPDATE ON public.conceptos_costo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conceptos_factura_updated_at ON public.conceptos_factura;
CREATE TRIGGER update_conceptos_factura_updated_at
  BEFORE UPDATE ON public.conceptos_factura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_contactos_cliente_updated_at ON public.contactos_cliente;
CREATE TRIGGER update_contactos_cliente_updated_at
  BEFORE UPDATE ON public.contactos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_documentos_embarque_updated_at ON public.documentos_embarque;
CREATE TRIGGER update_documentos_embarque_updated_at
  BEFORE UPDATE ON public.documentos_embarque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_eventos_embarque_updated_at ON public.eventos_embarque;
CREATE TRIGGER update_eventos_embarque_updated_at
  BEFORE UPDATE ON public.eventos_embarque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notas_embarque_updated_at ON public.notas_embarque;
CREATE TRIGGER update_notas_embarque_updated_at
  BEFORE UPDATE ON public.notas_embarque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_proforma_conceptos_consolidados_updated_at ON public.proforma_conceptos_consolidados;
CREATE TRIGGER update_proforma_conceptos_consolidados_updated_at
  BEFORE UPDATE ON public.proforma_conceptos_consolidados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_proveedor_facturas_conceptos_updated_at ON public.proveedor_facturas_conceptos;
CREATE TRIGGER update_proveedor_facturas_conceptos_updated_at
  BEFORE UPDATE ON public.proveedor_facturas_conceptos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_notificaciones_updated_at ON public.crm_notificaciones;
CREATE TRIGGER update_crm_notificaciones_updated_at
  BEFORE UPDATE ON public.crm_notificaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
