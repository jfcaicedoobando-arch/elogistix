-- REVIEW ONLY: generated bounded replay. No SQL has been executed.

-- Requires bootstrap-synthetic.sql and exact auth helpers in the NEW private cluster.

-- 33 relations include inert FK/read scaffolding; only 13 scoped mutation tables receive triggers.

-- No production data, endpoints, credentials, HTTP service or unrelated fiscal workflows.

SET check_function_bodies = off;

SET search_path TO public, extensions, pg_catalog;

CREATE EXTENSION pg_trgm WITH SCHEMA extensions;

CREATE TYPE public."ambiente_facturapi" AS ENUM ('sandbox', 'live');

CREATE TYPE public."app_role" AS ENUM ('admin', 'operador', 'viewer', 'super_admin', 'cliente', 'vendedor', 'admin_org', 'gerente_operaciones', 'coordinador_logistico', 'ejecutivo_pricing', 'contador', 'tesorero', 'customer_service', 'gerente_visor', 'gerente_comercial', 'auxiliar_contable', 'ejecutivo_cobranza', 'agente_carga');

CREATE TYPE public."categoria_proveedor" AS ENUM ('Logistico', 'GastoOperativo');

CREATE TYPE public."crm_etapa_tipo" AS ENUM ('abierta', 'ganada', 'perdida');

CREATE TYPE public."crm_lead_estado" AS ENUM ('Nuevo', 'Contactado', 'Calificado', 'Prospecto', 'Pendiente de alta', 'Descalificado', 'Convertido');

CREATE TYPE public."crm_lead_fuente" AS ENUM ('Web', 'Referido', 'Campaña', 'Llamada en frío', 'Evento', 'Otro', 'Prospección', 'Finkargo');

CREATE TYPE public."estado_cotizacion" AS ENUM ('Borrador', 'Solicitada', 'Enviada', 'Aceptada', 'Rechazada', 'Vencida', 'En operación', 'Archivada');

CREATE TYPE public."estado_embarque" AS ENUM ('Cotización', 'Borrador', 'Confirmado', 'En Tránsito', 'Llegada', 'En Proceso', 'Por liquidar', 'Cerrado', 'En Aduana', 'Entregado', 'Cancelado', 'Arribo', 'EIR');

CREATE TYPE public."estado_factura" AS ENUM ('Borrador', 'Por timbrar', 'Emitida', 'Pagada', 'Vencida', 'Cancelada', 'Parcialmente pagada', 'Sustituida');

CREATE TYPE public."incoterm" AS ENUM ('EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT', 'N/A');

CREATE TYPE public."modo_transporte" AS ENUM ('Marítimo', 'Aéreo', 'Terrestre', 'Multimodal');

CREATE TYPE public."moneda" AS ENUM ('MXN', 'USD', 'EUR');

CREATE TYPE public."origen_factura" AS ENUM ('proforma', 'manual', 'conversion_proforma');

CREATE TYPE public."origen_proveedor" AS ENUM ('Nacional', 'Extranjero');

CREATE TYPE public."subtipo_gasto_operativo" AS ENUM ('Renta', 'Servicios', 'Papeleria', 'Software', 'Honorarios', 'Mantenimiento', 'Marketing', 'Viaticos', 'Otros');

CREATE TYPE public."tipo_operacion" AS ENUM ('Importación', 'Exportación', 'Nacional', 'Cross Trade', 'Intra USA');

CREATE TYPE public."tipo_proveedor" AS ENUM ('Naviera', 'Aerolínea', 'Transportista', 'Agente Aduanal', 'Agente de Carga', 'Aseguradora', 'Custodia', 'Almacenes', 'Acondicionamiento de Carga', 'Materiales Peligrosos', 'Administrativo');

CREATE TYPE public."tipo_servicio_maritimo" AS ENUM ('FCL', 'LCL');

CREATE TABLE public."agente_users" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "agente_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."agente_users" OWNER TO postgres;

CREATE TABLE public."bitacora_actividad" (
  "id" uuid NOT NULL,
  "usuario_id" uuid,
  "usuario_email" text NOT NULL,
  "accion" text NOT NULL,
  "modulo" text NOT NULL,
  "entidad_id" uuid,
  "entidad_nombre" text,
  "detalles" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "organization_id" uuid,
  "fuente_evento" text
);

ALTER TABLE public."bitacora_actividad" OWNER TO postgres;

CREATE TABLE public."client_users" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "cliente_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp with time zone
);

ALTER TABLE public."client_users" OWNER TO postgres;

CREATE TABLE public."clientes" (
  "id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "rfc" text NOT NULL,
  "direccion" text NOT NULL,
  "ciudad" text NOT NULL,
  "estado" text NOT NULL,
  "cp" text NOT NULL,
  "contacto" text NOT NULL,
  "email" text NOT NULL,
  "telefono" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "organization_id" uuid NOT NULL,
  "dias_credito" integer,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "codigo_postal" text,
  "regimen_fiscal" text,
  "uso_cfdi_default" text,
  "forma_pago_default" text,
  "metodo_pago_default" text,
  "email_cc_default" text[],
  "email_destinatarios_default" text[],
  "limite_credito_mxn" numeric(14,2),
  "sin_comision" boolean NOT NULL,
  "requiere_autorizacion_cotizacion" boolean NOT NULL,
  "requiere_autorizacion_proforma" boolean NOT NULL
);

ALTER TABLE public."clientes" OWNER TO postgres;

CREATE TABLE public."costeo_agentes" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "proveedor_id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "pais" text NOT NULL,
  "dias_credito" integer NOT NULL,
  "contacto_tarifario" text,
  "email" text,
  "activo" boolean NOT NULL,
  "notas" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."costeo_agentes" OWNER TO postgres;

CREATE TABLE public."costeo_rutas" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "puerto_origen_id" uuid NOT NULL,
  "puerto_destino_id" uuid NOT NULL,
  "activa" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."costeo_rutas" OWNER TO postgres;

CREATE TABLE public."costeo_tarifa_recargos" (
  "id" uuid NOT NULL,
  "tarifa_id" uuid NOT NULL,
  "concepto" text NOT NULL,
  "lado" text NOT NULL,
  "monto" numeric(12,2) NOT NULL,
  "moneda" text NOT NULL,
  "incluido_en_total" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "organization_id" uuid NOT NULL
);

ALTER TABLE public."costeo_tarifa_recargos" OWNER TO postgres;

CREATE TABLE public."costeo_tarifas" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "agente_id" uuid NOT NULL,
  "naviera_id" uuid NOT NULL,
  "ruta_id" uuid NOT NULL,
  "tipo_contenedor_id" uuid NOT NULL,
  "moneda" text NOT NULL,
  "flete_base" numeric(12,2) NOT NULL,
  "dias_libres_demoras" integer NOT NULL,
  "vigente_desde" date NOT NULL,
  "vigente_hasta" date NOT NULL,
  "transit_time_dias" integer,
  "notas" text,
  "estado" text NOT NULL,
  "creado_por" uuid,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "reemplazada_por" uuid,
  "frecuencia_override" text,
  "dias_libres_almacenaje_lcl" integer,
  "estado_aprobacion" text NOT NULL,
  "motivo_rechazo" text,
  "aprobada_por" uuid,
  "aprobada_en" timestamp with time zone,
  "solicitud_pricing_id" uuid,
  "carta_garantia" boolean,
  "unidad_flete" text
);

ALTER TABLE public."costeo_tarifas" OWNER TO postgres;

CREATE TABLE public."cotizacion_costos" (
  "id" uuid NOT NULL,
  "cotizacion_id" uuid NOT NULL,
  "concepto" text NOT NULL,
  "moneda" text NOT NULL,
  "proveedor" text NOT NULL,
  "cantidad" numeric NOT NULL,
  "costo_unitario" numeric NOT NULL,
  "costo_total" numeric GENERATED ALWAYS AS ((cantidad * costo_unitario)) STORED,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "precio_venta" numeric NOT NULL,
  "precio_total" numeric GENERATED ALWAYS AS ((cantidad * precio_venta)) STORED,
  "profit" numeric GENERATED ALWAYS AS (((cantidad * precio_venta) - (cantidad * costo_unitario))) STORED,
  "porcentaje_profit" numeric GENERATED ALWAYS AS (
CASE
    WHEN ((cantidad * precio_venta) = (0)::numeric) THEN (0)::numeric
    ELSE round(((((cantidad * precio_venta) - (cantidad * costo_unitario)) / (cantidad * precio_venta)) * (100)::numeric), 2)
END) STORED,
  "unidad_medida" text NOT NULL,
  "organization_id" uuid NOT NULL,
  "notas" text NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "costeo_tarifa_id" uuid,
  "costeo_tarifa_recargo_id" uuid,
  "origen_venta_id" uuid
);

ALTER TABLE public."cotizacion_costos" OWNER TO postgres;

CREATE TABLE public."cotizacion_versiones" (
  "id" uuid NOT NULL,
  "cotizacion_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "version_num" integer NOT NULL,
  "folio" text NOT NULL,
  "estado_al_snapshot" text NOT NULL,
  "snapshot" jsonb NOT NULL,
  "costos_snapshot" jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."cotizacion_versiones" OWNER TO postgres;

CREATE TABLE public."cotizaciones" (
  "id" uuid NOT NULL,
  "folio" text NOT NULL,
  "cliente_id" uuid,
  "cliente_nombre" text NOT NULL,
  "modo" modo_transporte NOT NULL,
  "tipo" tipo_operacion NOT NULL,
  "incoterm" incoterm NOT NULL,
  "descripcion_mercancia" text NOT NULL,
  "peso_kg" numeric NOT NULL,
  "volumen_m3" numeric NOT NULL,
  "piezas" integer NOT NULL,
  "origen" text NOT NULL,
  "destino" text NOT NULL,
  "conceptos_venta" jsonb NOT NULL,
  "subtotal" numeric NOT NULL,
  "moneda" moneda NOT NULL,
  "vigencia_dias" integer NOT NULL,
  "fecha_vigencia" date,
  "notas" text,
  "estado" estado_cotizacion NOT NULL,
  "embarque_id" uuid,
  "operador" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "es_prospecto" boolean NOT NULL,
  "prospecto_empresa" text NOT NULL,
  "prospecto_contacto" text NOT NULL,
  "prospecto_email" text NOT NULL,
  "prospecto_telefono" text NOT NULL,
  "tipo_carga" text NOT NULL,
  "msds_archivo" text,
  "tipo_embarque" text NOT NULL,
  "tipo_contenedor" text,
  "tipo_peso" text NOT NULL,
  "descripcion_adicional" text NOT NULL,
  "sector_economico" text NOT NULL,
  "dimensiones_lcl" jsonb NOT NULL,
  "dimensiones_aereas" jsonb NOT NULL,
  "tiempo_transito_dias" integer,
  "frecuencia" text NOT NULL,
  "ruta_texto" text NOT NULL,
  "validez_propuesta" date,
  "tipo_movimiento" text NOT NULL,
  "seguro" boolean NOT NULL,
  "valor_seguro_usd" numeric NOT NULL,
  "dias_libres_destino" integer NOT NULL,
  "dias_almacenaje" integer NOT NULL,
  "carta_garantia" boolean NOT NULL,
  "num_contenedores" integer NOT NULL,
  "tipo_unidad" text,
  "organization_id" uuid NOT NULL,
  "comentario_cliente" text,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "oportunidad_id" uuid,
  "fecha_aceptacion" timestamp with time zone,
  "fecha_rechazo" timestamp with time zone,
  "modalidad_equipo" text,
  "punto_intermedio" text,
  "tipo_documento" text NOT NULL,
  "vigencia_desde" date,
  "vigencia_hasta" date,
  "tarifas_informativas" jsonb NOT NULL,
  "tarifa_id" uuid,
  "tarifa_override" jsonb NOT NULL,
  "sin_desglose_costos" boolean NOT NULL,
  "estado_anterior" estado_cotizacion,
  "fecha_envio" timestamp with time zone,
  "estado_revalidacion" text NOT NULL,
  "revalidacion_solicitada_en" timestamp with time zone,
  "revalidacion_resuelta_en" timestamp with time zone,
  "revalidacion_delta_jsonb" jsonb,
  "version" integer NOT NULL,
  "version_aceptada" integer,
  "aceptada_en" timestamp with time zone,
  "aceptada_por" uuid,
  "duplicada_de_id" uuid,
  "lcl_tarifa_wm" numeric(12,2),
  "lcl_minimo_flete" numeric(12,2),
  "lcl_dias_libres_almacenaje" integer,
  "lcl_consolidador_id" uuid,
  "agente_id" uuid,
  "naviera_id" uuid,
  "origen_portal" boolean NOT NULL,
  "created_by" uuid,
  "tipo_cambio_usd" numeric,
  "puerto_origen_id" uuid,
  "puerto_destino_id" uuid,
  "peso_fisico_kg" numeric
);

ALTER TABLE public."cotizaciones" OWNER TO postgres;

CREATE TABLE public."crm_empresas" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "lead_origen_id" uuid,
  "cliente_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "estado_crm" text NOT NULL
);

ALTER TABLE public."crm_empresas" OWNER TO postgres;

CREATE TABLE public."crm_etapas_pipeline" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "orden" integer NOT NULL,
  "probabilidad_default" integer NOT NULL,
  "color" text NOT NULL,
  "tipo" crm_etapa_tipo NOT NULL,
  "activa" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "crea_tarea_seguimiento" boolean NOT NULL,
  "dias_seguimiento" integer NOT NULL,
  "sla_dias" integer
);

ALTER TABLE public."crm_etapas_pipeline" OWNER TO postgres;

CREATE TABLE public."crm_historial_etapas" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "oportunidad_id" uuid NOT NULL,
  "etapa_origen_id" uuid,
  "etapa_destino_id" uuid NOT NULL,
  "dias_en_etapa" numeric(10,2),
  "usuario_id" uuid,
  "usuario_email" text,
  "created_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."crm_historial_etapas" OWNER TO postgres;

CREATE TABLE public."crm_leads" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "empresa" text NOT NULL,
  "contacto" text NOT NULL,
  "email" text NOT NULL,
  "telefono" text NOT NULL,
  "pais" text NOT NULL,
  "ciudad" text NOT NULL,
  "fuente" crm_lead_fuente NOT NULL,
  "interes_modo" text NOT NULL,
  "score" integer NOT NULL,
  "estado" crm_lead_estado NOT NULL,
  "vendedor_id" uuid,
  "vendedor_email" text NOT NULL,
  "notas" text NOT NULL,
  "cliente_convertido_id" uuid,
  "oportunidad_convertida_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "sector" text,
  "sitio_web" text,
  "anios_establecida" integer,
  "mercancia" text,
  "rutas" text,
  "aduana_puerto" text,
  "incoterm" text,
  "volumen" text,
  "frecuencia" text,
  "dolor_explicito" text,
  "consecuencia" text,
  "proveedor_actual" text,
  "estatus_icp" text,
  "motivo_nutricion" text,
  "fecha_nutricion" date,
  "cargo_contacto" text,
  "origen" text,
  "destino" text,
  "rfc" text NOT NULL,
  "direccion" text NOT NULL,
  "cp" text NOT NULL,
  "entidad_federativa" text NOT NULL
);

ALTER TABLE public."crm_leads" OWNER TO postgres;

CREATE TABLE public."crm_motivos_perdida" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "activa" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid
);

ALTER TABLE public."crm_motivos_perdida" OWNER TO postgres;

CREATE TABLE public."crm_notificaciones" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "mensaje" text NOT NULL,
  "link" text,
  "leida_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone
);

ALTER TABLE public."crm_notificaciones" OWNER TO postgres;

CREATE TABLE public."crm_oportunidades" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "cliente_id" uuid,
  "cliente_nombre" text NOT NULL,
  "lead_id" uuid,
  "vendedor_id" uuid,
  "vendedor_email" text NOT NULL,
  "etapa_id" uuid NOT NULL,
  "monto_estimado" numeric NOT NULL,
  "moneda" text NOT NULL,
  "probabilidad" integer NOT NULL,
  "fecha_estimada_cierre" date,
  "fecha_cierre_real" date,
  "motivo_perdida_id" uuid,
  "modo" text NOT NULL,
  "tipo_carga" text NOT NULL,
  "origen" text NOT NULL,
  "destino" text NOT NULL,
  "notas" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "valor_real" numeric,
  "cotizacion_ganadora_id" uuid,
  "embarque_ganador_id" uuid,
  "mercancia" text,
  "rutas" text,
  "aduana_puerto" text,
  "incoterm" text,
  "volumen" text,
  "frecuencia" text,
  "dolor_explicito" text,
  "proveedor_actual" text,
  "ultimo_movimiento_at" timestamp with time zone,
  "etapa_desde_at" timestamp with time zone,
  "monto_meta" numeric,
  "fecha_meta_cierre" date,
  "compromiso_nota" text,
  "margen_pct" numeric,
  "margen_autorizado_por" uuid,
  "margen_autorizado_at" timestamp with time zone,
  "riesgos_objeciones" text,
  "sector" text,
  "puerto_origen_id" uuid,
  "puerto_destino_id" uuid
);

ALTER TABLE public."crm_oportunidades" OWNER TO postgres;

CREATE TABLE public."crm_solicitudes_pricing" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "oportunidad_id" uuid NOT NULL,
  "folio" text NOT NULL,
  "solicitante_id" uuid NOT NULL,
  "fecha" date NOT NULL,
  "cliente" text,
  "servicio" text,
  "imo" boolean,
  "commodity" text,
  "container_size" text,
  "tipo_carga" text,
  "cantidad" integer,
  "estibable" boolean,
  "peso" text,
  "dimensiones" text,
  "incoterm" text,
  "pol" text,
  "pod" text,
  "origen" text,
  "destino" text,
  "fecha_tentativa_carga" date,
  "delivery" text,
  "notas" text,
  "complejidad" text NOT NULL,
  "estado" text NOT NULL,
  "enviada_at" timestamp with time zone,
  "vence_at" timestamp with time zone,
  "respondida_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "unidad_medida" text,
  "tarifa_tarifario_id" uuid
);

ALTER TABLE public."crm_solicitudes_pricing" OWNER TO postgres;

CREATE TABLE public."embarques" (
  "id" uuid NOT NULL,
  "expediente" text,
  "cliente_id" uuid NOT NULL,
  "cliente_nombre" text NOT NULL,
  "modo" modo_transporte NOT NULL,
  "tipo" tipo_operacion NOT NULL,
  "shipper" text NOT NULL,
  "consignatario" text NOT NULL,
  "descripcion_mercancia" text NOT NULL,
  "peso_kg" numeric NOT NULL,
  "volumen_m3" numeric NOT NULL,
  "piezas" integer NOT NULL,
  "incoterm" incoterm NOT NULL,
  "estado" estado_embarque NOT NULL,
  "operador" text NOT NULL,
  "puerto_origen" text,
  "puerto_destino" text,
  "naviera" text,
  "bl_master" text,
  "bl_house" text,
  "tipo_servicio" tipo_servicio_maritimo,
  "contenedor" text,
  "tipo_contenedor" text,
  "aeropuerto_origen" text,
  "aeropuerto_destino" text,
  "aerolinea" text,
  "mawb" text,
  "hawb" text,
  "ciudad_origen" text,
  "ciudad_destino" text,
  "transportista" text,
  "carta_porte" text,
  "etd" date,
  "eta" date,
  "fecha_llegada_real" date,
  "fecha_creacion" timestamp with time zone NOT NULL,
  "tipo_cambio_usd" numeric,
  "tipo_cambio_eur" numeric,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "tipo_carga" text NOT NULL,
  "msds_archivo" text,
  "_replay_empty_dropped_43" text,
  "_replay_empty_dropped_44" text,
  "agente" text,
  "cotizacion_id" uuid,
  "organization_id" uuid NOT NULL,
  "tiene_proforma" boolean NOT NULL,
  "etd_original" date,
  "eta_original" date,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "created_by" uuid,
  "created_by_email" text,
  "vendedora_id" uuid,
  "tarifa_id" uuid,
  "carta_garantia" boolean NOT NULL,
  "dias_libres_destino" integer NOT NULL,
  "dias_almacenaje" integer NOT NULL,
  "seguro" boolean NOT NULL,
  "valor_seguro_usd" numeric(14,2),
  "notas" text,
  "cerrado_at" timestamp with time zone,
  "cerrado_por" uuid,
  "cerrado_snapshot" jsonb,
  "reabierto_at" timestamp with time zone,
  "reabierto_por" uuid,
  "reabierto_motivo" text,
  "tarifa_id_original" uuid,
  "tarifa_id_aplicada" uuid,
  "tarifa_delta_jsonb" jsonb,
  "tarifa_decision" text,
  "tarifa_revalidada_en" timestamp with time zone,
  "tarifa_revalidada_por" uuid,
  "facturado_historico" boolean NOT NULL,
  "cobro_cliente_status" text NOT NULL,
  "cobro_cliente_actualizado_at" timestamp with time zone,
  "agente_id" uuid,
  "naviera_id" uuid,
  "sin_comision" boolean,
  "puerto_origen_id" uuid,
  "puerto_destino_id" uuid
);

ALTER TABLE public."embarques" DROP COLUMN "_replay_empty_dropped_43"; -- empty synthetic slot; preserves captured attnum

ALTER TABLE public."embarques" DROP COLUMN "_replay_empty_dropped_44"; -- empty synthetic slot; preserves captured attnum

ALTER TABLE public."embarques" OWNER TO postgres;

CREATE TABLE public."factura_series" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "codigo" text NOT NULL,
  "prefijo" text NOT NULL,
  "folio_actual" bigint NOT NULL,
  "folio_inicial" bigint NOT NULL,
  "activa" boolean NOT NULL,
  "es_default" boolean NOT NULL,
  "descripcion" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."factura_series" OWNER TO postgres;

CREATE TABLE public."facturas" (
  "id" uuid NOT NULL,
  "numero" text NOT NULL,
  "embarque_id" uuid,
  "expediente" text NOT NULL,
  "cliente_id" uuid NOT NULL,
  "cliente_nombre" text NOT NULL,
  "subtotal" numeric NOT NULL,
  "iva" numeric NOT NULL,
  "total" numeric NOT NULL,
  "moneda" moneda NOT NULL,
  "tipo_cambio" numeric,
  "fecha_emision" date NOT NULL,
  "fecha_vencimiento" date NOT NULL,
  "estado" estado_factura NOT NULL,
  "referencia_bl" text,
  "notas" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "organization_id" uuid NOT NULL,
  "proforma_id" uuid,
  "factura_pdf_url" text,
  "factura_xml_url" text,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "snapshot_emision" jsonb,
  "serie_id" uuid,
  "folio_fiscal" bigint,
  "rfc_cliente" text,
  "uso_cfdi" text,
  "forma_pago" text,
  "metodo_pago" text,
  "uuid_fiscal" text,
  "dias_credito" integer,
  "facturapi_id" text,
  "serie" text,
  "timbrado_en" timestamp with time zone,
  "timbrado_por" uuid,
  "cancelacion_motivo" text,
  "cancelado_en" timestamp with time zone,
  "enviada_cliente_at" timestamp with time zone,
  "cotizacion_id" uuid,
  "origen" origen_factura NOT NULL,
  "sustituye_a" uuid,
  "sustituida_por" uuid,
  "ambiente" ambiente_facturapi,
  "acuse_cancelacion_xml" text,
  "acuse_cancelacion_fecha" timestamp with time zone,
  "acuse_cancelacion_status" text,
  "factura_xml_backup_path" text,
  "ret_isr" numeric NOT NULL,
  "ret_iva" numeric NOT NULL,
  "uuid_verificado" boolean NOT NULL,
  "uuid_estatus_sat" text,
  "uuid_verificado_fecha" timestamp with time zone,
  "cancellation_status" text,
  "cancelacion_solicitada_en" timestamp with time zone,
  "cancelacion_vence_en" timestamp with time zone,
  "facturapi_claim_at" timestamp with time zone,
  "reconciliacion_checked_at" timestamp with time zone,
  "facturapi_pendiente_id" text,
  "facturapi_pendiente_at" timestamp with time zone
);

ALTER TABLE public."facturas" OWNER TO postgres;

CREATE TABLE public."folio_secuencias" (
  "organization_id" uuid NOT NULL,
  "tipo" text NOT NULL,
  "ultimo_numero" bigint NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."folio_secuencias" OWNER TO postgres;

CREATE TABLE public."navieras" (
  "id" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "activo" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "tracking_url_template" text
);

ALTER TABLE public."navieras" OWNER TO postgres;

CREATE TABLE public."notificaciones_cliente" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "cliente_id" uuid NOT NULL,
  "embarque_id" uuid,
  "factura_id" uuid,
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "mensaje" text NOT NULL,
  "url" text,
  "leida_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."notificaciones_cliente" OWNER TO postgres;

CREATE TABLE public."organization_members" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" app_role NOT NULL,
  "created_at" timestamp with time zone
);

ALTER TABLE public."organization_members" OWNER TO postgres;

CREATE TABLE public."organizations" (
  "id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "rfc" text,
  "logo_url" text,
  "plan" text,
  "activo" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "direccion" text,
  "moneda_preferida" text NOT NULL,
  "onboarding_completado" boolean NOT NULL,
  "sat_barrido_fecha" timestamp with time zone
);

ALTER TABLE public."organizations" OWNER TO postgres;

CREATE TABLE public."proformas" (
  "id" uuid NOT NULL,
  "numero" text NOT NULL,
  "embarque_id" uuid,
  "cliente_id" uuid NOT NULL,
  "cliente_nombre" text NOT NULL,
  "expediente" text NOT NULL,
  "bl_master" text,
  "subtotal_usd" numeric NOT NULL,
  "iva_usd" numeric NOT NULL,
  "total_usd" numeric NOT NULL,
  "subtotal_mxn" numeric NOT NULL,
  "iva_mxn" numeric NOT NULL,
  "total_mxn" numeric NOT NULL,
  "fecha_emision" date NOT NULL,
  "notas" text,
  "organization_id" uuid NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "operador" text,
  "dias_credito" integer,
  "estado_proforma" text NOT NULL,
  "folio_factura_externa" text,
  "fecha_facturacion" date,
  "factura_id" uuid,
  "es_consolidada" boolean NOT NULL,
  "embarques_ids" uuid[],
  "estado_aprobacion" text NOT NULL,
  "consolidada_en" uuid,
  "estado_revision" text NOT NULL,
  "proformas_origen" uuid[],
  "tasa_iva_aplicada" numeric NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "snapshot_emision" jsonb,
  "factura_secundaria_id" uuid,
  "estado_cliente" text NOT NULL,
  "aceptada_at" timestamp with time zone,
  "rechazada_at" timestamp with time zone,
  "aceptada_por" text,
  "motivo_rechazo" text,
  "enviada_at" timestamp with time zone,
  "enviada_por" uuid,
  "ultimo_envio_email" text,
  "token_publico" uuid,
  "token_expira_at" timestamp with time zone,
  "origen" text
);

ALTER TABLE public."proformas" OWNER TO postgres;

CREATE TABLE public."proveedores" (
  "id" uuid NOT NULL,
  "nombre" text NOT NULL,
  "tipo" tipo_proveedor,
  "pais" text,
  "rfc" text NOT NULL,
  "contacto" text NOT NULL,
  "email" text NOT NULL,
  "telefono" text NOT NULL,
  "moneda_preferida" moneda NOT NULL,
  "origen_proveedor" origen_proveedor,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "organization_id" uuid NOT NULL,
  "categoria" categoria_proveedor,
  "subtipo_gasto" subtipo_gasto_operativo,
  "cp" text,
  "direccion" text,
  "ciudad" text,
  "estado" text,
  "regimen_fiscal" text,
  "banco" text,
  "clabe" text,
  "banco_pais" text,
  "swift_bic" text,
  "iban" text,
  "aba_routing" text,
  "banco_direccion" text,
  "banco_intermediario" text,
  "banco_intermediario_swift" text,
  "beneficiario" text,
  "referencia_pago" text,
  "dias_credito" integer NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "estado_alta" text NOT NULL,
  "aprobado_por" uuid,
  "aprobado_at" timestamp with time zone
);

ALTER TABLE public."proveedores" OWNER TO postgres;

CREATE TABLE public."puertos" (
  "id" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "country" text NOT NULL,
  "activo" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."puertos" OWNER TO postgres;

CREATE TABLE public."super_admin_org_activa" (
  "user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."super_admin_org_activa" OWNER TO postgres;

CREATE TABLE public."tipos_contenedor" (
  "id" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "activo" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

ALTER TABLE public."tipos_contenedor" OWNER TO postgres;

CREATE TABLE public."user_roles" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" app_role NOT NULL
);

ALTER TABLE public."user_roles" OWNER TO postgres;

CREATE FUNCTION public._assert_padre_misma_org() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
$_$;

ALTER FUNCTION public._assert_padre_misma_org() OWNER TO "postgres";

CREATE FUNCTION public._bitacora_normalizar_modulo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE v text := lower(trim(COALESCE(NEW.modulo, '')));
BEGIN
  NEW.modulo := CASE v
    WHEN 'facturas' THEN 'facturacion'
    WHEN 'proformas' THEN 'facturacion'
    WHEN 'facturacion emitida' THEN 'facturacion'
    WHEN 'compras' THEN 'cxp'
    WHEN 'cuentas por pagar' THEN 'cxp'
    WHEN 'facturapi_credenciales' THEN 'configuracion'
    WHEN 'crm_oportunidades' THEN 'crm'
    WHEN 'crm_leads' THEN 'crm'
    WHEN 'costeo agentes' THEN 'costeo'
    WHEN 'costeo_agentes' THEN 'costeo'
    WHEN 'tracking' THEN 'embarques'
    WHEN 'bancos' THEN 'tesoreria'
    WHEN 'conciliacion' THEN 'tesoreria'
    WHEN '' THEN 'otro'
    ELSE v
  END;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._bitacora_normalizar_modulo() OWNER TO "postgres";

CREATE FUNCTION public._costeo_tarifa_solicitud_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_org uuid; v_estado text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.solicitud_pricing_id IS DISTINCT FROM OLD.solicitud_pricing_id THEN
    RAISE EXCEPTION 'LC_TARIFA_SOLICITUD_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.solicitud_pricing_id IS NOT NULL THEN
    SELECT organization_id, estado INTO v_org, v_estado
      FROM public.crm_solicitudes_pricing WHERE id = NEW.solicitud_pricing_id AND deleted_at IS NULL;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
    END IF;
    IF v_estado <> 'enviada' THEN
      RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public._crm_es_pricing(v_org) THEN
      RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

ALTER FUNCTION public._costeo_tarifa_solicitud_guard() OWNER TO "postgres";

CREATE FUNCTION public._cotizacion_oportunidad_misma_org() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.oportunidad_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_oportunidades o
     WHERE o.id = NEW.oportunidad_id
       AND o.organization_id = NEW.organization_id
       AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_AJENA: la oportunidad no existe, está eliminada o pertenece a otra organización';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._cotizacion_oportunidad_misma_org() OWNER TO "postgres";

CREATE FUNCTION public._cotizaciones_bloquear_auto_aceptacion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- SoD: quien elaboró la cotización no puede aceptarla. Sólo aplica a la
  -- aceptación real (estados previos a la aceptación). El regreso automático
  -- 'En operación' -> 'Aceptada' que hace eliminar_embarque_completo NO es una
  -- aceptación y no debe bloquearse.
  IF NEW.estado = 'Aceptada'::estado_cotizacion
     AND COALESCE(OLD.estado, 'Borrador'::estado_cotizacion) IN (
       'Borrador'::estado_cotizacion,
       'Solicitada'::estado_cotizacion,
       'Enviada'::estado_cotizacion,
       'Vencida'::estado_cotizacion
     )
     AND v_uid IS NOT NULL
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by = v_uid
     AND NOT (
       public.has_role(v_uid, 'admin'::app_role)
       OR public.has_role(v_uid, 'admin_org'::app_role)
       OR public.has_role(v_uid, 'super_admin'::app_role)
     )
  THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: quien creó la cotización no puede aceptarla'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._cotizaciones_bloquear_auto_aceptacion() OWNER TO "postgres";

CREATE FUNCTION public._cotizaciones_bloquear_envio_sin_importes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_total_usd numeric := 0;
  v_total_mxn numeric := 0;
BEGIN
  IF NEW.estado = 'Enviada'::estado_cotizacion
     AND COALESCE(OLD.estado, 'Borrador'::estado_cotizacion) <> 'Enviada'::estado_cotizacion
  THEN
    SELECT t.total_usd, t.total_mxn
      INTO v_total_usd, v_total_mxn
      FROM public.cotizacion_totales_conceptos(NEW.conceptos_venta) t;
    IF COALESCE(v_total_usd, 0) <= 0 AND COALESCE(v_total_mxn, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_COTIZACION_SIN_IMPORTES: la cotización no tiene importes de venta capturados'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._cotizaciones_bloquear_envio_sin_importes() OWNER TO "postgres";

CREATE FUNCTION public._cotizaciones_bloquear_envio_sin_oportunidad() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.estado IN ('Enviada'::estado_cotizacion, 'Solicitada'::estado_cotizacion)
     AND COALESCE(OLD.estado, 'Borrador'::estado_cotizacion) <> NEW.estado
     AND COALESCE(NEW.es_prospecto, false) = true
     AND NEW.oportunidad_id IS NULL
  THEN
    RAISE EXCEPTION 'LC_COT_SIN_OPORTUNIDAD: liga la cotización a una oportunidad del CRM antes de enviarla'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._cotizaciones_bloquear_envio_sin_oportunidad() OWNER TO "postgres";

CREATE FUNCTION public._cotizaciones_sync_puertos_tarifa() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_o uuid;
  v_d uuid;
BEGIN
  IF NEW.modo::text <> 'Marítimo' THEN
    NEW.puerto_origen_id := NULL;
    NEW.puerto_destino_id := NULL;
    RETURN NEW;
  END IF;
  IF NEW.tarifa_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT r.puerto_origen_id, r.puerto_destino_id
    INTO v_o, v_d
    FROM public.costeo_tarifas t
    JOIN public.costeo_rutas r ON r.id = t.ruta_id
   WHERE t.id = NEW.tarifa_id
     AND t.organization_id = NEW.organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_TARIFA_ORG_INVALIDA: la tarifa % no pertenece a la organización de la cotización.', NEW.tarifa_id
      USING ERRCODE = 'P0001';
  END IF;
  NEW.puerto_origen_id := v_o;
  NEW.puerto_destino_id := v_d;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._cotizaciones_sync_puertos_tarifa() OWNER TO "postgres";

CREATE FUNCTION public._cotizaciones_sync_vigencia() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_base date;
BEGIN
  -- Día de emisión en zona CDMX (estándar de fechas del proyecto): nunca
  -- `now()::date` en UTC, que después de las 18:00 locales adelanta un día.
  v_base := COALESCE(
    (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
    (now() AT TIME ZONE 'America/Mexico_City')::date
  );
  IF NEW.validez_propuesta IS NOT NULL THEN
    -- Fuente única de verdad: la fecha capturada por el usuario.
    NEW.fecha_vigencia := NEW.validez_propuesta;
    NEW.vigencia_dias := GREATEST(1, (NEW.validez_propuesta - v_base))::int;
  ELSE
    NEW.vigencia_dias := COALESCE(NEW.vigencia_dias, 15);
    NEW.fecha_vigencia := COALESCE(NEW.fecha_vigencia, v_base + NEW.vigencia_dias);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._cotizaciones_sync_vigencia() OWNER TO "postgres";

CREATE FUNCTION public._cotizaciones_validar_prospecto() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF COALESCE(NEW.es_prospecto, false) THEN
    -- Prospecto: jamás ligado a un cliente y siempre con empresa capturada.
    IF NEW.cliente_id IS NOT NULL THEN
      RAISE EXCEPTION 'LC_COT_PROSPECTO_CON_CLIENTE: una cotización de prospecto no puede tener cliente ligado';
    END IF;
    IF NULLIF(btrim(COALESCE(NEW.prospecto_empresa, '')), '') IS NULL THEN
      RAISE EXCEPTION 'LC_COT_PROSPECTO_SIN_EMPRESA: captura la empresa del prospecto';
    END IF;
  ELSIF NEW.cliente_id IS NULL AND NEW.estado <> 'Borrador' THEN
    -- Cliente: fuera de borrador, la cotización exige cliente ligado.
    RAISE EXCEPTION 'LC_COT_CLIENTE_REQUERIDO: una cotización de cliente requiere cliente ligado';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._cotizaciones_validar_prospecto() OWNER TO "postgres";

CREATE FUNCTION public._crm_empresa_estado_por_cliente() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN NEW.estado_crm := 'Cliente'; END IF;
  RETURN NEW;
END $$;

ALTER FUNCTION public._crm_empresa_estado_por_cliente() OWNER TO "postgres";

CREATE FUNCTION public._crm_es_pricing(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(auth.uid(), 'super_admin') OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.organization_id = p_org
      AND om.role IN ('ejecutivo_pricing','gerente_operaciones','admin_org','admin'));
$$;

ALTER FUNCTION public._crm_es_pricing(uuid) OWNER TO "postgres";

CREATE FUNCTION public._crm_folio_pricing_prefijo(p_ts timestamp with time zone) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT (ARRAY['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'])
           [extract(month FROM p_ts AT TIME ZONE 'America/Mexico_City')::int]
         || to_char(p_ts AT TIME ZONE 'America/Mexico_City', 'YY')
$$;

ALTER FUNCTION public._crm_folio_pricing_prefijo(timestamp with time zone) OWNER TO "postgres";

CREATE FUNCTION public._crm_lead_avanzar_por_cotizacion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lead_id uuid;
  v_destino text;
BEGIN
  IF NEW.oportunidad_id IS NULL OR COALESCE(NEW.es_prospecto, false) = false THEN
    RETURN NEW;
  END IF;
  IF NEW.estado::text = 'Aceptada' THEN
    v_destino := 'Pendiente de alta';
  ELSIF NEW.estado::text IN ('Solicitada', 'Enviada') THEN
    v_destino := 'Prospecto';
  ELSE
    RETURN NEW;
  END IF;
  SELECT o.lead_id INTO v_lead_id
  FROM public.crm_oportunidades o
  WHERE o.id = NEW.oportunidad_id
    AND o.organization_id = NEW.organization_id;
  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.crm_leads l
     SET estado = v_destino::public.crm_lead_estado,
         updated_at = now()
   WHERE l.id = v_lead_id
     AND l.organization_id = NEW.organization_id
     AND l.deleted_at IS NULL
     -- Rediseño CRM: no se promueven leads sin calificar; sólo prospectos.
     AND l.estado::text IN ('Prospecto', 'Pendiente de alta')
     AND l.estado::text <> v_destino
     AND NOT (v_destino = 'Prospecto' AND l.estado::text = 'Pendiente de alta');
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._crm_lead_avanzar_por_cotizacion() OWNER TO "postgres";

CREATE FUNCTION public._crm_lead_sync_estado_empresa() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.crm_empresas e
     SET estado_crm = CASE WHEN NEW.estado::text = 'Convertido' THEN 'Cliente' ELSE 'Prospecto' END
   WHERE e.lead_origen_id = NEW.id AND e.organization_id = NEW.organization_id
     AND e.estado_crm <> 'Cliente'
     AND NEW.estado::text IN ('Prospecto','Calificado','Pendiente de alta','Convertido');
  RETURN NEW;
END $$;

ALTER FUNCTION public._crm_lead_sync_estado_empresa() OWNER TO "postgres";

CREATE FUNCTION public._crm_oportunidad_etapa_motivo_misma_org() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_etapas_pipeline e
     WHERE e.id = NEW.etapa_id
       AND e.organization_id = NEW.organization_id
       AND e.deleted_at IS NULL
       AND e.activa
  ) THEN
    RAISE EXCEPTION 'LC_ETAPA_AJENA: la etapa no existe, está inactiva o pertenece a otra organización';
  END IF;
  IF NEW.motivo_perdida_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.crm_motivos_perdida m
     WHERE m.id = NEW.motivo_perdida_id
       AND m.organization_id = NEW.organization_id
       AND m.deleted_at IS NULL
       AND m.activa
  ) THEN
    RAISE EXCEPTION 'LC_MOTIVO_PERDIDA_AJENO: el motivo de pérdida no existe, está inactivo o pertenece a otra organización';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._crm_oportunidad_etapa_motivo_misma_org() OWNER TO "postgres";

CREATE FUNCTION public._crm_oportunidad_requiere_origen() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lead_org uuid;
  v_lead_estado public.crm_lead_estado;
  v_cliente_org uuid;
BEGIN
  IF NEW.lead_id IS NULL AND NEW.cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_SIN_ORIGEN';
  END IF;
  IF NEW.lead_id IS NOT NULL THEN
    SELECT organization_id, estado INTO v_lead_org, v_lead_estado
      FROM public.crm_leads
     WHERE id = NEW.lead_id
       AND organization_id = NEW.organization_id
       AND deleted_at IS NULL;
    IF v_lead_org IS NULL OR v_lead_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_CRM_LEAD_AJENO';
    END IF;
    IF v_lead_estado IN (
      'Nuevo'::public.crm_lead_estado,
      'Contactado'::public.crm_lead_estado,
      'Descalificado'::public.crm_lead_estado
    ) THEN
      RAISE EXCEPTION 'LC_OPORTUNIDAD_ORIGEN_NO_CALIFICADO';
    END IF;
  END IF;
  IF NEW.cliente_id IS NOT NULL THEN
    SELECT organization_id INTO v_cliente_org
      FROM public.clientes
     WHERE id = NEW.cliente_id
       AND organization_id = NEW.organization_id
       AND deleted_at IS NULL;
    IF v_cliente_org IS NULL OR v_cliente_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_CRM_CLIENTE_AJENO';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._crm_oportunidad_requiere_origen() OWNER TO "postgres";

CREATE FUNCTION public._crm_probabilidad_terminal() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tipo crm_etapa_tipo;
BEGIN
  IF NEW.etapa_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT tipo INTO v_tipo
    FROM public.crm_etapas_pipeline
   WHERE id = NEW.etapa_id
     AND organization_id = NEW.organization_id
     AND deleted_at IS NULL;
  IF v_tipo = 'ganada'::crm_etapa_tipo THEN
    NEW.probabilidad := 100;
  ELSIF v_tipo = 'perdida'::crm_etapa_tipo THEN
    NEW.probabilidad := 0;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._crm_probabilidad_terminal() OWNER TO "postgres";

CREATE FUNCTION public._crm_registrar_cambio_etapa() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.ultimo_movimiento_at := now();
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    INSERT INTO public.crm_historial_etapas (
      organization_id, oportunidad_id, etapa_origen_id, etapa_destino_id,
      dias_en_etapa, usuario_id, usuario_email
    ) VALUES (
      NEW.organization_id, NEW.id, OLD.etapa_id, NEW.etapa_id,
      ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(OLD.etapa_desde_at, OLD.created_at, now()))) / 86400.0, 2),
      auth.uid(),
      NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'email'
    );
    NEW.etapa_desde_at := now();
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._crm_registrar_cambio_etapa() OWNER TO "postgres";

CREATE FUNCTION public._crm_sol_pricing_before_ins() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_org uuid; v_num bigint; v_tipo text;
BEGIN
  SELECT organization_id INTO v_org FROM public.crm_oportunidades WHERE id = NEW.oportunidad_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'LC_PRICING_OPORTUNIDAD_INVALIDA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = NEW.solicitante_id AND organization_id = v_org) THEN
    RAISE EXCEPTION 'LC_PRICING_SOLICITANTE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  v_tipo := 'pricing_' || to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYMM');
  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero) VALUES (v_org, v_tipo, 1)
  ON CONFLICT (organization_id, tipo) DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1, updated_at = now()
  RETURNING ultimo_numero INTO v_num;
  NEW.folio := public._crm_folio_pricing_prefijo(now()) || lpad(v_num::text, 4, '0');
  NEW.created_by := auth.uid();
  NEW.estado := 'borrador';
  NEW.enviada_at := NULL; NEW.vence_at := NULL; NEW.respondida_at := NULL;
  RETURN NEW;
END $$;

ALTER FUNCTION public._crm_sol_pricing_before_ins() OWNER TO "postgres";

CREATE FUNCTION public._crm_sol_pricing_before_upd() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.folio <> OLD.folio OR NEW.organization_id <> OLD.organization_id
     OR NEW.oportunidad_id <> OLD.oportunidad_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'LC_PRICING_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(current_setting('lc.pricing_rpc', true), '') <> '1' AND (
     NEW.estado IS DISTINCT FROM OLD.estado OR NEW.enviada_at IS DISTINCT FROM OLD.enviada_at
     OR NEW.vence_at IS DISTINCT FROM OLD.vence_at OR NEW.respondida_at IS DISTINCT FROM OLD.respondida_at) THEN
    RAISE EXCEPTION 'LC_PRICING_ESTADO_SOLO_RPC' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

ALTER FUNCTION public._crm_sol_pricing_before_upd() OWNER TO "postgres";

CREATE FUNCTION public._crm_sync_oportunidad_desde_cotizacion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_subtotal numeric := NULLIF(NEW.subtotal, 0);
BEGIN
  IF NEW.oportunidad_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Sólo oportunidades vivas, ABIERTAS y de la misma organización: una
  -- cotización alternativa/Borrador no puede mover una ganada o perdida.
  -- La moneda sólo se alinea junto con un importe real (v_subtotal NOT NULL).
  UPDATE public.crm_oportunidades o
     SET monto_estimado = COALESCE(v_subtotal, o.monto_estimado),
         moneda         = CASE
                            WHEN v_subtotal IS NOT NULL
                              THEN COALESCE(NEW.moneda::text, o.moneda)
                            ELSE o.moneda
                          END,
         cliente_id     = COALESCE(o.cliente_id, NEW.cliente_id),
         updated_at     = now()
   WHERE o.id = NEW.oportunidad_id
     AND o.organization_id = NEW.organization_id
     AND o.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.crm_etapas_pipeline e
        WHERE e.id = o.etapa_id
          AND e.tipo = 'abierta'::crm_etapa_tipo
          AND e.deleted_at IS NULL
     )
     AND (
       COALESCE(o.monto_estimado, 0) <> COALESCE(v_subtotal, o.monto_estimado, 0)
       OR (v_subtotal IS NOT NULL
           AND COALESCE(o.moneda, '') <> COALESCE(NEW.moneda::text, o.moneda, ''))
       OR (o.cliente_id IS NULL AND NEW.cliente_id IS NOT NULL)
     );
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._crm_sync_oportunidad_desde_cotizacion() OWNER TO "postgres";

CREATE FUNCTION public._crm_validar_motivo_perdida() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tipo public.crm_etapa_tipo;
BEGIN
  IF NEW.etapa_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT tipo INTO v_tipo
    FROM public.crm_etapas_pipeline
   WHERE id = NEW.etapa_id
     AND organization_id = NEW.organization_id
     AND deleted_at IS NULL;
  IF v_tipo = 'perdida' AND NEW.motivo_perdida_id IS NULL THEN
    RAISE EXCEPTION
      'LC_MOTIVO_PERDIDA_REQUERIDO: indica el motivo de pérdida para cerrar la oportunidad'
      USING ERRCODE = '22023';
  END IF;
  IF v_tipo IS DISTINCT FROM 'perdida' AND NEW.motivo_perdida_id IS NOT NULL THEN
    NEW.motivo_perdida_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._crm_validar_motivo_perdida() OWNER TO "postgres";

CREATE FUNCTION public._guard_soft_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_new jsonb;
  v_uid uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.papelera_restore', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'LC_RESTORE_DIRECTO: para restaurar este registro usa la Papelera'
      USING ERRCODE = 'P0001';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_DELETED_AT_INMUTABLE: la fecha de borrado de un registro en papelera no se puede modificar'
      USING ERRCODE = 'P0001';
  END IF;
  v_uid := auth.uid();
  v_new := to_jsonb(NEW) || jsonb_build_object('deleted_at', now());
  IF v_new ? 'deleted_by' AND v_uid IS NOT NULL THEN
    v_new := v_new || jsonb_build_object('deleted_by', v_uid);
  END IF;
  NEW := jsonb_populate_record(NEW, v_new);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._guard_soft_delete() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public._notif_cliente_validar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT c.organization_id INTO v_org
  FROM public.clientes c WHERE c.id = NEW.cliente_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_NOTIF_CLIENTE_INEXISTENTE: el cliente de la notificación no existe'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_NOTIF_CROSS_ORG: el cliente no pertenece a la organización de la notificación'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.embarque_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.embarques e
    WHERE e.id = NEW.embarque_id
      AND e.organization_id = v_org
      AND e.cliente_id = NEW.cliente_id
  ) THEN
    RAISE EXCEPTION 'LC_NOTIF_EMBARQUE_AJENO: el embarque referido no pertenece a ese cliente'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.factura_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.facturas f
    WHERE f.id = NEW.factura_id
      AND f.organization_id = v_org
      AND f.cliente_id = NEW.cliente_id
  ) THEN
    RAISE EXCEPTION 'LC_NOTIF_FACTURA_AJENA: la factura referida no pertenece a ese cliente'
      USING ERRCODE = '42501';
  END IF;

  -- Allowlist: sólo rutas internas del portal (nunca URLs absolutas).
  IF NEW.url IS NOT NULL AND NEW.url <> '' THEN
    IF NEW.url !~ '^/portal(/[A-Za-z0-9._~-]+)*$' THEN
      RAISE EXCEPTION 'LC_NOTIF_URL_NO_PERMITIDA: sólo se permiten enlaces internos del portal'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public._notif_cliente_validar() OWNER TO "postgres";

CREATE FUNCTION public.costeo_tarifa_estado_actual(p_estado text, p_vigente_hasta date) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE
           WHEN p_estado IN ('borrador','reemplazada') THEN p_estado
           WHEN p_vigente_hasta IS NOT NULL
                AND p_vigente_hasta < (now() AT TIME ZONE 'America/Mexico_City')::date
             THEN 'vencida'
           ELSE 'vigente'
         END;
$$;

ALTER FUNCTION public.costeo_tarifa_estado_actual(text,date) OWNER TO "postgres";

CREATE FUNCTION public.costeo_tarifas_agente_force_borrador() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.has_role(auth.uid(), 'agente_carga') THEN
    IF TG_OP = 'UPDATE' AND OLD.estado_aprobacion IN ('vigente','reemplazada') THEN
      RAISE EXCEPTION 'no se puede editar una tarifa % directamente; duplica para crear una nueva versión', OLD.estado_aprobacion;
    END IF;
    NEW.estado_aprobacion := 'borrador';
    NEW.motivo_rechazo := NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.costeo_tarifas_agente_force_borrador() OWNER TO "postgres";

CREATE FUNCTION public.costeo_tarifas_marcar_reemplazadas() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF NEW.estado <> 'vigente' OR NEW.estado_aprobacion <> 'vigente' THEN
    RETURN NEW;
  END IF;
  IF NEW.vigente_hasta IS NOT NULL AND NEW.vigente_hasta < v_hoy_mx THEN
    RETURN NEW;
  END IF;
  UPDATE public.costeo_tarifas
     SET estado = 'reemplazada',
         reemplazada_por = NEW.id,
         updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND agente_id = NEW.agente_id
     AND naviera_id = NEW.naviera_id
     AND ruta_id = NEW.ruta_id
     AND tipo_contenedor_id = NEW.tipo_contenedor_id
     AND id <> NEW.id
     AND estado = 'vigente'
     AND reemplazada_por IS NULL
     AND vigente_desde <= NEW.vigente_desde
     AND vigente_hasta >= NEW.vigente_desde;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.costeo_tarifas_marcar_reemplazadas() OWNER TO "postgres";

CREATE FUNCTION public.costeo_tarifas_match_agente_org() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_agente_org uuid;
BEGIN
  SELECT organization_id INTO v_agente_org
    FROM public.costeo_agentes
   WHERE id = NEW.agente_id;
  IF v_agente_org IS NULL THEN
    RAISE EXCEPTION 'Agente % no existe', NEW.agente_id;
  END IF;
  -- Si vino con org distinta, la corregimos silenciosamente.
  NEW.organization_id := v_agente_org;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.costeo_tarifas_match_agente_org() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.cotizacion_totales_conceptos(p_conceptos jsonb)
 RETURNS TABLE(subtotal_usd numeric, iva_usd numeric, total_usd numeric, subtotal_mxn numeric, iva_mxn numeric, total_mxn numeric)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_elem   jsonb;
  v_cant   numeric;
  v_precio numeric;
  v_tasa   numeric;
  v_moneda text;
  v_sub    numeric;
  v_iva    numeric;
BEGIN
  subtotal_usd := 0; iva_usd := 0; total_usd := 0;
  subtotal_mxn := 0; iva_mxn := 0; total_mxn := 0;

  IF p_conceptos IS NULL OR jsonb_typeof(p_conceptos) IS NULL THEN
    RETURN NEXT; RETURN;
  END IF;
  IF jsonb_typeof(p_conceptos) <> 'array' THEN
    RAISE EXCEPTION 'LC_COTIZACION_CONCEPTO_INVALIDO: conceptos_venta debe ser un arreglo jsonb'
      USING ERRCODE = '23514';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_conceptos)
  LOOP
    v_cant   := COALESCE((v_elem ->> 'cantidad')::numeric, 0);
    v_precio := COALESCE((v_elem ->> 'precio_unitario')::numeric, 0);
    v_tasa   := COALESCE(
                  (v_elem ->> 'tasa_iva_aplicada')::numeric,
                  CASE WHEN COALESCE((v_elem ->> 'aplica_iva')::boolean, false) THEN 0.16 ELSE 0 END
                );
    v_moneda := upper(COALESCE(NULLIF(v_elem ->> 'moneda', ''), 'USD'));

    IF v_cant < 0 OR v_precio < 0 OR v_tasa < 0 OR v_tasa > 1 THEN
      RAISE EXCEPTION 'LC_COTIZACION_CONCEPTO_INVALIDO: cantidad/precio negativos o tasa de IVA fuera de [0,1] en concepto "%"',
        COALESCE(v_elem ->> 'descripcion', '?')
        USING ERRCODE = '23514';
    END IF;

    v_sub := ROUND(v_cant * v_precio, 2);
    v_iva := ROUND(v_sub * v_tasa, 2);

    IF v_moneda = 'USD' THEN
      subtotal_usd := subtotal_usd + v_sub;
      iva_usd      := iva_usd + v_iva;
    ELSIF v_moneda = 'MXN' THEN
      subtotal_mxn := subtotal_mxn + v_sub;
      iva_mxn      := iva_mxn + v_iva;
    ELSE
      -- BUG-11: moneda no soportada — antes el concepto no sumaba ni fallaba
      -- (un concepto EUR quedaba en 0 en silencio y la cotización pasaba).
      RAISE EXCEPTION 'LC_COTIZACION_MONEDA_NO_SOPORTADA: moneda "%" no soportada en concepto "%" (soportadas: USD, MXN)',
        v_moneda, COALESCE(v_elem ->> 'descripcion', '?')
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  total_usd := subtotal_usd + iva_usd;
  total_mxn := subtotal_mxn + iva_mxn;
  RETURN NEXT;
END;
$function$;

ALTER FUNCTION public.cotizacion_totales_conceptos(jsonb) OWNER TO "postgres";

CREATE FUNCTION public.cotizaciones_guard_en_operacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- QA-R2 R-04: procesos internos de sincronización (p.ej.
  -- recalcular_subtotal_cotizacion) levantan esta GUC transaccional.
  IF current_setting('app.cotizacion_sync', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF (OLD.estado IN ('En operación'::public.estado_cotizacion,
                     'Aceptada'::public.estado_cotizacion)
      OR OLD.embarque_id IS NOT NULL)
     AND (NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.moneda IS DISTINCT FROM OLD.moneda
       OR NEW.conceptos_venta IS DISTINCT FROM OLD.conceptos_venta) THEN
    RAISE EXCEPTION
      'LC_COTIZACION_INMUTABLE: la cotización ya fue aceptada o está en operación; sus importes y conceptos no pueden cambiar (usa una nueva versión)'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.cotizaciones_guard_en_operacion() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.crm_aplicar_tarifa_tarifario(p_solicitud_id uuid, p_tarifa_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v record;
  t record;
  v_pedido text;
  v_tipo_code text;
  v_tipo_name text;
  v_compatible boolean;
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing
   WHERE id = p_solicitud_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF v.solicitante_id IS DISTINCT FROM auth.uid() AND v.created_by IS DISTINCT FROM auth.uid()
     AND NOT public._crm_es_pricing(v.organization_id) THEN
    RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
  END IF;

  -- The form persists tipo_carga. container_size is a legacy fallback only.
  v_pedido := coalesce(
    nullif(regexp_replace(v.tipo_carga, '^\s+|\s+$', '', 'g'), ''),
    nullif(regexp_replace(v.container_size, '^\s+|\s+$', '', 'g'), ''));
  IF v_pedido IS NULL THEN
    RAISE EXCEPTION 'LC_PRICING_CONTENEDOR_REQUERIDO' USING ERRCODE = 'P0001';
  END IF;
  SELECT tc.code, tc.name INTO v_tipo_code, v_tipo_name
    FROM public.costeo_tarifas ct
    JOIN public.tipos_contenedor tc ON tc.id = ct.tipo_contenedor_id
   WHERE ct.id = p_tarifa_id AND ct.organization_id = v.organization_id
   FOR SHARE OF ct, tc;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_TARIFA_NO_VIGENTE' USING ERRCODE = 'P0001';
  END IF;

  -- Mirror claveCanonicaTipoContenedor without adding a public helper or ACL.
  -- A full semantic key accepts aliases, but never substitutes dry for HC.
  -- Raw keys preserve the shared helper's normalized-name-first priority.
  -- Conflicting known code/name size or category and empty raw keys fail closed.
  WITH entradas AS (
    SELECT 'pedido'::text AS fuente, v_pedido AS nombre, ''::text AS codigo
    UNION ALL
    SELECT 'tarifa', v_tipo_name, v_tipo_code
    UNION ALL
    SELECT 'tarifa_codigo', '', v_tipo_code
    UNION ALL
    SELECT 'tarifa_nombre', v_tipo_name, ''
  ), normalizados AS (
    SELECT fuente,
      btrim(regexp_replace(lower(regexp_replace(normalize(coalesce(nombre, ''), NFD),
        U&'[\0300-\036f]', '', 'g')), '[^a-z0-9]+', ' ', 'g')) AS nombre,
      btrim(regexp_replace(lower(regexp_replace(normalize(coalesce(codigo, ''), NFD),
        U&'[\0300-\036f]', '', 'g')), '[^a-z0-9]+', ' ', 'g')) AS codigo
    FROM entradas
  ), separados AS (
    SELECT *, regexp_replace(regexp_replace(btrim(nombre || ' ' || codigo),
      '([0-9]+)([a-z]+)', '\1 \2', 'g'), '([a-z]+)([0-9]+)', '\1 \2', 'g') AS texto
    FROM normalizados
  ), categorias AS (
    SELECT *, (regexp_match(texto, '\m(20|40|45|53)\M'))[1] AS tamano,
      CASE
        WHEN texto ~ '\m(reefer|refrigerad[[:alnum:]_]*|rf)\M' THEN 'reefer'
        WHEN texto ~ '\m(high cube|highcube|hc|hq)\M' THEN 'hc'
        WHEN texto ~ '\m(open top|opentop|ot)\M' THEN 'opentop'
        WHEN texto ~ '\m(flat rack|flatrack|fr)\M' THEN 'flatrack'
        WHEN texto ~ '\m(iso tank|tank|tanque)\M' THEN 'tank'
        WHEN texto ~ '\m(platform|plataforma)\M' THEN 'platform'
        WHEN texto ~ '\m(dry|standard|std|estandar|st|dv|gp)\M' THEN 'dry'
      END AS categoria
    FROM separados
  ), claves AS (
    SELECT *, CASE WHEN tamano IS NOT NULL AND categoria IS NOT NULL
      THEN tamano || '|' || categoria
      ELSE 'raw:' || coalesce(nullif(nombre, ''), codigo) END AS clave
    FROM categorias
  )
  SELECT pedido.clave = tarifa.clave
    AND pedido.clave <> 'raw:' AND tarifa.clave <> 'raw:'
    AND NOT (codigo.tamano IS NOT NULL AND nombre.tamano IS NOT NULL
      AND codigo.tamano <> nombre.tamano)
    AND NOT (codigo.categoria IS NOT NULL AND nombre.categoria IS NOT NULL
      AND codigo.categoria <> nombre.categoria)
    INTO v_compatible
    FROM claves pedido CROSS JOIN claves tarifa
    CROSS JOIN claves codigo CROSS JOIN claves nombre
   WHERE pedido.fuente = 'pedido' AND tarifa.fuente = 'tarifa'
     AND codigo.fuente = 'tarifa_codigo' AND nombre.fuente = 'tarifa_nombre';
  IF v_compatible IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE' USING ERRCODE = 'P0001';
  END IF;

  -- Recheck compatibility even for an idempotent call, without rewriting history.
  IF v.estado = 'respondida' AND v.tarifa_tarifario_id = p_tarifa_id THEN
    RETURN jsonb_build_object('id', v.id, 'ya_respondida', true);
  END IF;
  IF v.estado NOT IN ('borrador','enviada') THEN
    RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO t FROM public.costeo_tarifas
   WHERE id = p_tarifa_id AND organization_id = v.organization_id AND estado = 'vigente'
     AND (vigente_hasta IS NULL OR vigente_hasta >= current_date);
  IF t.id IS NULL THEN RAISE EXCEPTION 'LC_TARIFA_NO_VIGENTE' USING ERRCODE = 'P0001'; END IF;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing
     SET tarifa_tarifario_id = p_tarifa_id, estado = 'respondida',
         enviada_at = coalesce(enviada_at, now()), respondida_at = now()
   WHERE id = p_solicitud_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  RETURN jsonb_build_object('id', v.id, 'ya_respondida', false);
END $function$;

ALTER FUNCTION public.crm_aplicar_tarifa_tarifario(uuid,uuid) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_terminales estado_cotizacion[] := ARRAY['Aceptada'::estado_cotizacion,
                                            'En operación'::estado_cotizacion];
  v_es_terminal  boolean;
  v_era_terminal boolean;
  v_op_id uuid; v_op_org uuid; v_op_vendedor uuid; v_op_nombre text;
  v_etapa_tipo crm_etapa_tipo; v_etapa_ganada uuid;
  v_ganadora uuid; v_valor_previo numeric; v_emb_ganador uuid; v_op_moneda text;
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_uid uuid := auth.uid();
BEGIN
  -- (j) La cotización ganadora no migra de oportunidad ni de organización.
  IF TG_OP = 'UPDATE'
     AND (NEW.oportunidad_id IS DISTINCT FROM OLD.oportunidad_id
          OR NEW.organization_id IS DISTINCT FROM OLD.organization_id)
     AND EXISTS (
       SELECT 1 FROM public.crm_oportunidades o
        WHERE o.cotizacion_ganadora_id = OLD.id
          AND o.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'LC_COTIZACION_GANADORA_INMUTABLE: la cotización ganadora no puede cambiar de oportunidad ni de organización'
      USING ERRCODE = 'P0001';
  END IF;

  -- (i) Papelera: se conserva cotizacion_ganadora_id, valor_real y snapshot.
  IF NEW.deleted_at IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
      UPDATE public.crm_oportunidades o
         SET embarque_ganador_id = NULL, updated_at = now()
       WHERE o.cotizacion_ganadora_id = NEW.id
         AND o.organization_id = NEW.organization_id
         AND o.deleted_at IS NULL
         AND o.embarque_ganador_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.embarques e
            WHERE e.id = o.embarque_ganador_id AND e.deleted_at IS NULL
         );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.oportunidad_id IS NULL THEN RETURN NEW; END IF;

  v_es_terminal := NEW.estado = ANY (v_terminales);
  IF NOT v_es_terminal THEN RETURN NEW; END IF;
  v_era_terminal := TG_OP = 'UPDATE'
                    AND OLD.deleted_at IS NULL
                    AND OLD.estado = ANY (v_terminales);

  -- (b) lock de la oportunidad: serializa aceptaciones concurrentes.
  -- El lock se toma sobre la tabla SOLA: un FOR UPDATE OF o con JOIN, al
  -- despertar tras esperar a otra transaccion, reevalua el join completo
  -- (EvalPlanQual) y puede devolver 0 filas aunque la oportunidad exista,
  -- disparando un falso LC_OPORTUNIDAD_AJENA en aceptaciones concurrentes.
  SELECT o.id INTO v_op_id
    FROM public.crm_oportunidades o
   WHERE o.id = NEW.oportunidad_id
     AND o.organization_id = NEW.organization_id
     AND o.deleted_at IS NULL
   FOR UPDATE;

  IF v_op_id IS NOT NULL THEN
    SELECT o.organization_id, o.vendedor_id, o.nombre, e.tipo,
           o.cotizacion_ganadora_id, o.valor_real, o.embarque_ganador_id, o.moneda
      INTO v_op_org, v_op_vendedor, v_op_nombre, v_etapa_tipo,
           v_ganadora, v_valor_previo, v_emb_ganador, v_op_moneda
      FROM public.crm_oportunidades o
      JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
     WHERE o.id = v_op_id;
  END IF;

  -- (a) cross-org / inexistente / eliminada
  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_AJENA: la oportunidad no existe, está eliminada o pertenece a otra organización'
      USING ERRCODE = 'P0001';
  END IF;

  -- (c) un único ganador por oportunidad
  IF v_ganadora IS NOT NULL AND v_ganadora <> NEW.id THEN
    RAISE EXCEPTION 'LC_COTIZACION_GANADORA_EXISTE: la oportunidad ya tiene una cotización ganadora'
      USING ERRCODE = 'P0001',
            HINT = format('ganadora_actual=%s; intentada=%s (%s)',
                          v_ganadora, NEW.id, COALESCE(NEW.folio, 'sin folio'));
  END IF;

  -- (k) no se escribe valor_real de una cotización en otra moneda distinta
  -- a la de la oportunidad: evita mezclar, p. ej., subtotal USD dentro de
  -- una oportunidad MXN.
  IF v_op_moneda IS NOT NULL AND NEW.moneda::text IS DISTINCT FROM v_op_moneda THEN
    RAISE EXCEPTION 'LC_MONEDA_INCOMPATIBLE: la cotización está en % y la oportunidad en %; actualiza la moneda de la oportunidad o cotiza en la misma moneda antes de aceptarla',
      NEW.moneda, v_op_moneda
      USING ERRCODE = 'P0001';
  END IF;

  -- (h) una oportunidad perdida exige reapertura explícita
  IF v_etapa_tipo = 'perdida'::crm_etapa_tipo THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_PERDIDA_REQUIERE_REAPERTURA: reabre la oportunidad antes de aceptar una cotización'
      USING ERRCODE = 'P0001';
  END IF;

  -- (d) sellado sólo en la primera transición no-terminal → terminal
  IF NOT v_era_terminal THEN
    NEW.version_aceptada := NEW.version;
    NEW.aceptada_en := now();
    NEW.aceptada_por := COALESCE(v_uid, NEW.aceptada_por);
  END IF;

  SELECT id INTO v_etapa_ganada
    FROM public.crm_etapas_pipeline
   WHERE organization_id = v_op_org
     AND tipo = 'ganada'::crm_etapa_tipo
     AND activa = true
     AND deleted_at IS NULL
   ORDER BY orden ASC
   LIMIT 1;
  IF v_etapa_ganada IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_SIN_ETAPA_GANADA: configura una etapa ganada activa en el pipeline antes de aceptar cotizaciones'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_etapa_tipo = 'abierta'::crm_etapa_tipo THEN
    -- (e) primer cierre abierta → ganada
    UPDATE public.crm_oportunidades
       SET etapa_id = v_etapa_ganada,
           probabilidad = 100,
           fecha_cierre_real = v_hoy,
           valor_real = NEW.subtotal,
           cotizacion_ganadora_id = NEW.id,
           embarque_ganador_id = COALESCE(NEW.embarque_id, embarque_ganador_id),
           updated_at = now()
     WHERE id = v_op_id AND organization_id = v_op_org AND deleted_at IS NULL;

    INSERT INTO public.bitacora_actividad (
      organization_id, modulo, accion, entidad_id, entidad_nombre,
      usuario_id, usuario_email, detalles
    ) VALUES (
      v_op_org, 'crm', 'oportunidad_ganada_auto', v_op_id, COALESCE(v_op_nombre, ''),
      COALESCE(v_uid, v_op_vendedor), COALESCE((auth.jwt() ->> 'email')::text, ''),
      jsonb_build_object('cotizacion_id', NEW.id, 'cotizacion_folio', NEW.folio,
                         'embarque_id', NEW.embarque_id, 'monto', NEW.subtotal,
                         'version_aceptada', NEW.version)
    );

    IF v_op_vendedor IS NOT NULL THEN
      INSERT INTO public.crm_notificaciones (
        organization_id, user_id, tipo, titulo, mensaje, link
      ) VALUES (
        v_op_org, v_op_vendedor, 'oportunidad_ganada', '¡Oportunidad ganada!',
        '“' || COALESCE(v_op_nombre, 'Oportunidad') || '” se cerró con la cotización '
          || COALESCE(NEW.folio, ''),
        '/crm/oportunidades/' || v_op_id::text
      );
    END IF;

  ELSIF v_ganadora IS NULL THEN
    -- Etapa ya ganada sin ganador registrado: enlaza sin tocar el monto histórico.
    UPDATE public.crm_oportunidades
       SET cotizacion_ganadora_id = NEW.id,
           valor_real = COALESCE(valor_real, NEW.subtotal),
           embarque_ganador_id = COALESCE(embarque_ganador_id, NEW.embarque_id),
           updated_at = now()
     WHERE id = v_op_id AND organization_id = v_op_org AND deleted_at IS NULL;

    INSERT INTO public.bitacora_actividad (
      organization_id, modulo, accion, entidad_id, entidad_nombre,
      usuario_id, usuario_email, detalles
    ) VALUES (
      v_op_org, 'crm', 'oportunidad_ganada_vinculada', v_op_id, COALESCE(v_op_nombre, ''),
      COALESCE(v_uid, v_op_vendedor), COALESCE((auth.jwt() ->> 'email')::text, ''),
      jsonb_build_object('cotizacion_id', NEW.id, 'cotizacion_folio', NEW.folio,
                         'valor_real_conservado', v_valor_previo)
    );

  ELSIF NOT v_era_terminal THEN
    -- (g) la misma ganadora se recotizó y se vuelve a aceptar.
    UPDATE public.crm_oportunidades
       SET valor_real = NEW.subtotal,
           embarque_ganador_id = COALESCE(embarque_ganador_id, NEW.embarque_id),
           updated_at = now()
     WHERE id = v_op_id AND organization_id = v_op_org AND deleted_at IS NULL;

    INSERT INTO public.bitacora_actividad (
      organization_id, modulo, accion, entidad_id, entidad_nombre,
      usuario_id, usuario_email, detalles
    ) VALUES (
      v_op_org, 'crm', 'oportunidad_ganada_revalorada', v_op_id, COALESCE(v_op_nombre, ''),
      COALESCE(v_uid, v_op_vendedor), COALESCE((auth.jwt() ->> 'email')::text, ''),
      jsonb_build_object('cotizacion_id', NEW.id, 'cotizacion_folio', NEW.folio,
                         'valor_previo', v_valor_previo, 'valor_nuevo', NEW.subtotal,
                         'version_aceptada', NEW.version)
    );

  ELSE
    -- (f) reintento idempotente / Aceptada → En operación: sólo embarque.
    IF NEW.embarque_id IS NOT NULL AND v_emb_ganador IS NULL THEN
      UPDATE public.crm_oportunidades
         SET embarque_ganador_id = NEW.embarque_id, updated_at = now()
       WHERE id = v_op_id AND organization_id = v_op_org AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.crm_vincular_cotizacion(p_cotizacion_id uuid, p_prospecto jsonb DEFAULT '{}'::jsonb, p_lead_id uuid DEFAULT NULL::uuid, p_oportunidad_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_folio text;
  v_modo text;
  v_cliente_id uuid;
  v_es_prospecto boolean;
  v_op_existente uuid;
  v_op_id uuid;
  v_lead_id uuid;
  v_lead_existente uuid;
  v_lead_empresa text;
  v_lead_vendedor_id uuid;
  v_lead_vendedor_email text;
  v_etapa_id uuid;
  v_etapa_prob integer;
  v_creada boolean := false;
  v_updated_at timestamptz;
  v_actor_email text;
  v_cot_moneda public.moneda;
  v_op_moneda text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_SESION: se requiere sesión activa' USING ERRCODE = '42501';
  END IF;

  IF p_lead_id IS NULL AND p_oportunidad_id IS NULL THEN
    RAISE EXCEPTION 'LC_COT_VINCULO_SIN_ORIGEN' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id, folio, modo, cliente_id, COALESCE(es_prospecto, false), oportunidad_id, moneda
    INTO v_org, v_folio, v_modo, v_cliente_id, v_es_prospecto, v_op_existente, v_cot_moneda
  FROM public.cotizaciones
  WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA: la cotización no existe';
  END IF;

  IF NOT public.is_org_member(v_org)
     OR NOT public.rls_tenant_scope_ok(v_org)
     OR NOT public.puede_escribir_cotizaciones() THEN
    RAISE EXCEPTION 'LC_COTIZACION_SIN_PERMISO_ESCRITURA' USING ERRCODE = '42501';
  END IF;

  IF v_cliente_id IS NOT NULL OR v_es_prospecto = false THEN
    RAISE EXCEPTION 'LC_COT_PROSPECTO_CON_CLIENTE' USING ERRCODE = '22023';
  END IF;

  -- ── Idempotencia histórica ANTES de la elegibilidad nueva ────────────────
  IF v_op_existente IS NOT NULL THEN
    SELECT o.id, o.lead_id
      INTO v_op_id, v_lead_existente
    FROM public.crm_oportunidades o
    WHERE o.id = v_op_existente
      AND o.organization_id = v_org
      AND o.deleted_at IS NULL
    FOR UPDATE OF o;

    IF v_op_id IS NULL THEN
      RAISE EXCEPTION 'LC_COT_VINCULO_ROTO' USING ERRCODE = '22023';
    END IF;

    IF NOT (
      (p_oportunidad_id = v_op_existente
        AND (p_lead_id IS NULL OR p_lead_id = v_lead_existente))
      OR (p_oportunidad_id IS NULL
        AND p_lead_id IS NOT NULL AND p_lead_id = v_lead_existente)
    ) THEN
      RAISE EXCEPTION 'LC_COT_VINCULO_CONFIRMADO' USING ERRCODE = '22023';
    END IF;

    SELECT updated_at INTO v_updated_at FROM public.cotizaciones WHERE id = p_cotizacion_id;
    RETURN jsonb_build_object(
      'oportunidad_id', v_op_id, 'lead_id', v_lead_existente,
      'creado_lead', false, 'creado_oportunidad', false, 'ya_ligada', true,
      'updated_at', v_updated_at
    );
  END IF;

  -- ── Vínculo NUEVO: elegibilidad estricta ────────────────────────────────
  IF p_oportunidad_id IS NOT NULL THEN
    SELECT o.id, o.lead_id, o.moneda
      INTO v_op_id, v_lead_id, v_op_moneda
    FROM public.crm_oportunidades o
    JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
    WHERE o.id = p_oportunidad_id
      AND o.organization_id = v_org
      AND o.deleted_at IS NULL
      AND o.cliente_id IS NULL
      AND e.organization_id = v_org
      AND e.deleted_at IS NULL
      AND e.activa = true
      AND e.tipo = 'abierta'::crm_etapa_tipo
    FOR UPDATE OF o;

    IF v_op_id IS NULL THEN
      RAISE EXCEPTION 'LC_CRM_OPORTUNIDAD_NO_ELEGIBLE' USING ERRCODE = '22023';
    END IF;

    IF p_lead_id IS NOT NULL AND v_lead_id IS DISTINCT FROM p_lead_id THEN
      RAISE EXCEPTION 'LC_CRM_OPORTUNIDAD_NO_ELEGIBLE' USING ERRCODE = '22023';
    END IF;

    -- Candado de moneda: la oportunidad objetivo ya existe con moneda propia,
    -- si difiere de la cotización el vínculo dejaría valores cruzados.
    IF v_op_moneda IS DISTINCT FROM v_cot_moneda::text THEN
      RAISE EXCEPTION 'LC_CRM_MONEDA_INCOMPATIBLE: la cotización está en % y la oportunidad ya tiene registrada la moneda %. Corrige la moneda de la cotización o vincúlala a una oportunidad en %, o crea una oportunidad nueva.',
        v_cot_moneda, v_op_moneda, v_cot_moneda
        USING ERRCODE = '22023';
    END IF;
  ELSE
    v_lead_id := p_lead_id;
  END IF;

  SELECT l.empresa, l.vendedor_id, l.vendedor_email
    INTO v_lead_empresa, v_lead_vendedor_id, v_lead_vendedor_email
  FROM public.crm_leads l
  WHERE l.id = v_lead_id
    AND l.organization_id = v_org
    AND l.deleted_at IS NULL
    AND l.estado IN ('Calificado'::crm_lead_estado, 'Prospecto'::crm_lead_estado)
  FOR UPDATE;

  IF v_lead_empresa IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_LEAD_NO_ELEGIBLE' USING ERRCODE = '22023';
  END IF;

  IF v_op_id IS NULL THEN
    SELECT o.id, o.moneda INTO v_op_id, v_op_moneda
    FROM public.crm_oportunidades o
    JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
    WHERE o.organization_id = v_org
      AND o.lead_id = v_lead_id
      AND o.deleted_at IS NULL
      AND o.cliente_id IS NULL
      AND e.organization_id = v_org
      AND e.deleted_at IS NULL
      AND e.activa = true
      AND e.tipo = 'abierta'::crm_etapa_tipo
    ORDER BY o.created_at ASC
    LIMIT 1
    FOR UPDATE OF o;

    IF v_op_id IS NOT NULL THEN
      IF v_op_moneda IS DISTINCT FROM v_cot_moneda::text THEN
        RAISE EXCEPTION 'LC_CRM_MONEDA_INCOMPATIBLE: la cotización está en % y la oportunidad abierta del prospecto ya tiene registrada la moneda %. Corrige la moneda de la cotización o vincúlala a una oportunidad en %, o crea una oportunidad nueva.',
          v_cot_moneda, v_op_moneda, v_cot_moneda
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF v_op_id IS NULL THEN
      SELECT id, probabilidad_default INTO v_etapa_id, v_etapa_prob
      FROM public.crm_etapas_pipeline
      WHERE organization_id = v_org
        AND deleted_at IS NULL
        AND activa = true
        AND tipo = 'abierta'::crm_etapa_tipo
      ORDER BY (nombre ILIKE '%cotiz%') DESC, orden ASC
      LIMIT 1;

      IF v_etapa_id IS NULL THEN
        RAISE EXCEPTION 'LC_CRM_SIN_ETAPA_ABIERTA: configura al menos una etapa abierta en el pipeline';
      END IF;

      -- Vendedor: hereda del lead; si el lead no tiene vendedor asignado,
      -- el usuario actual queda como responsable por fallback.
      IF v_lead_vendedor_id IS NOT NULL THEN
        v_actor_email := v_lead_vendedor_email;
      ELSE
        v_lead_vendedor_id := auth.uid();
        SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();
      END IF;

      INSERT INTO public.crm_oportunidades (
        organization_id, nombre, cliente_nombre, lead_id, etapa_id, probabilidad, modo,
        vendedor_id, vendedor_email, moneda
      ) VALUES (
        v_org,
        CASE WHEN v_folio IS NOT NULL AND btrim(v_folio) <> ''
             THEN v_lead_empresa || ' — ' || v_folio
             ELSE 'Cotización · ' || v_lead_empresa END,
        v_lead_empresa,
        v_lead_id,
        v_etapa_id,
        COALESCE(v_etapa_prob, 30),
        COALESCE(v_modo, ''),
        v_lead_vendedor_id,
        COALESCE(v_actor_email, ''),
        v_cot_moneda::text
      )
      RETURNING id INTO v_op_id;
      v_creada := true;
    END IF;
  END IF;

  UPDATE public.cotizaciones
     SET oportunidad_id = v_op_id, updated_at = now()
   WHERE id = p_cotizacion_id
  RETURNING updated_at INTO v_updated_at;

  RETURN jsonb_build_object(
    'oportunidad_id', v_op_id, 'lead_id', v_lead_id,
    'creado_lead', false, 'creado_oportunidad', v_creada, 'ya_ligada', false,
    'updated_at', v_updated_at
  );
END;
$function$;

ALTER FUNCTION public.crm_vincular_cotizacion(uuid,jsonb,uuid,uuid) OWNER TO "postgres";

CREATE FUNCTION public.current_agente_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT agente_id FROM public.agente_users
   WHERE user_id = auth.uid()
   ORDER BY created_at ASC, id ASC
   LIMIT 1
$$;

ALTER FUNCTION public.current_agente_id() OWNER TO "postgres";

CREATE FUNCTION public.current_agente_org() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_id FROM public.agente_users
   WHERE user_id = auth.uid()
   ORDER BY created_at ASC, id ASC
   LIMIT 1
$$;

ALTER FUNCTION public.current_agente_org() OWNER TO "postgres";

CREATE FUNCTION public.current_user_client_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT cu.cliente_id
  FROM public.client_users cu
  JOIN public.clientes c
    ON c.id = cu.cliente_id
   AND c.organization_id = cu.organization_id
  WHERE cu.user_id = auth.uid();
$$;

ALTER FUNCTION public.current_user_client_ids() OWNER TO "postgres";

CREATE FUNCTION public.current_user_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'super_admin'::app_role)
      THEN COALESCE(
             (SELECT s.organization_id FROM public.super_admin_org_activa s
               WHERE s.user_id = auth.uid()),
             public.default_user_org_id())
    ELSE public.default_user_org_id()
  END;
$$;

ALTER FUNCTION public.current_user_org_id() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.default_user_org_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_count FROM public.organization_members WHERE user_id = v_uid;
  IF v_count = 0 THEN RETURN NULL; END IF;

  IF v_count = 1 THEN
    SELECT organization_id INTO v_org FROM public.organization_members WHERE user_id = v_uid;
    RETURN v_org;
  END IF;

  SELECT m.organization_id INTO v_org
  FROM public.organization_members m
  LEFT JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = v_uid
  ORDER BY
    (CASE WHEN EXISTS (SELECT 1 FROM public.embarques e WHERE e.organization_id = m.organization_id)
            OR EXISTS (SELECT 1 FROM public.cotizaciones c WHERE c.organization_id = m.organization_id)
          THEN 0 ELSE 1 END) ASC,
    (CASE WHEN coalesce(o.nombre, '') ILIKE '%demo%' THEN 1 ELSE 0 END) ASC,
    m.created_at ASC,
    m.organization_id ASC
  LIMIT 1;

  RETURN v_org;
END;
$function$;

ALTER FUNCTION public.default_user_org_id() OWNER TO "postgres";

CREATE FUNCTION public.es_admin_catalogo(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin','admin','admin_org')
  );
$$;

ALTER FUNCTION public.es_admin_catalogo(uuid) OWNER TO "postgres";

CREATE FUNCTION public.get_user_org_ids(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id;
$$;

ALTER FUNCTION public.get_user_org_ids(uuid) OWNER TO "postgres";

CREATE FUNCTION public.guard_cotizacion_vinculo_cliente() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- 1) Bypass por UPDATE directo desde el cliente (PostgREST): prohibido.
  IF TG_OP = 'UPDATE' AND current_user IN ('authenticated', 'anon') THEN
    IF COALESCE(OLD.es_prospecto, false) = true
       AND (
         (NEW.cliente_id IS NOT NULL AND OLD.cliente_id IS NULL)
         OR COALESCE(NEW.es_prospecto, false) IS DISTINCT FROM true
       ) THEN
      RAISE EXCEPTION 'LC_CONVERSION_SOLO_RPC' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- 2) Cualquier rol: el cliente ligado debe existir, estar vivo y ser de la
  --    misma organización de la cotización.
  IF NEW.cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = NEW.cliente_id
        AND c.organization_id = NEW.organization_id
        AND c.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LC_COTIZACION_CLIENTE_AJENO_INEXISTENTE' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_cotizacion_vinculo_cliente() OWNER TO "postgres";

CREATE FUNCTION public.guard_crm_lead_estado_canonico() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  -- Fuente única en base: espeja LEAD_ESTADOS_MANUALES del frontend.
  c_manuales constant text[] := ARRAY['Nuevo', 'Contactado', 'Descalificado'];
  v_mensaje constant text :=
    'Ese estado lo administra el ERP: se asigna al calificar, cotizar o convertir el lead. A mano sólo puedes usar Nuevo, Contactado o Descalificado.';
BEGIN
  -- Sólo aplica a escritores directos por la Data API. Los escritores canónicos
  -- son SECURITY DEFINER propiedad de postgres, así que current_user no es
  -- anon/authenticated cuando corren y quedan fuera del candado.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT (NEW.estado::text = ANY (c_manuales)) THEN
      RAISE EXCEPTION 'LC_LEAD_ESTADO_DERIVADO: %', v_mensaje USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: conservar exactamente el mismo estado (incluido uno derivado) es
  -- válido; sólo se vigila el CAMBIO de estado, y debe ser manual → manual.
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NOT (NEW.estado::text = ANY (c_manuales)) OR NOT (OLD.estado::text = ANY (c_manuales)) THEN
      RAISE EXCEPTION 'LC_LEAD_ESTADO_DERIVADO: %', v_mensaje USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_crm_lead_estado_canonico() OWNER TO "postgres";

CREATE FUNCTION public.guard_estado_cotizacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_old text := OLD.estado::text;
  v_new text := NEW.estado::text;
BEGIN
  IF v_old IS NULL OR v_new IS NULL OR v_old = v_new THEN
    RETURN NEW;
  END IF;
  -- Vencida siempre puede aplicarse desde cualquier estado no terminal
  IF v_new = 'Vencida' AND v_old IN ('Solicitada','Borrador','Enviada','Aceptada') THEN
    RETURN NEW;
  END IF;
  -- Housekeeping: Vencida >90 días → Archivada (C5)
  IF v_old = 'Vencida' AND v_new = 'Archivada' THEN
    RETURN NEW;
  END IF;
  -- Reactivación manual desde estados de housekeeping (A3).
  -- RG11: 'Aceptada' fuera de la lista (requiere snapshot del flujo normal).
  IF v_old IN ('Vencida','Archivada')
     AND v_new IN ('Solicitada','Borrador','Enviada') THEN
    RETURN NEW;
  END IF;
  -- Transiciones válidas
  IF (v_old = 'Solicitada'    AND v_new IN ('Borrador','Enviada','Aceptada','Rechazada'))
  OR (v_old = 'Borrador'      AND v_new IN ('Enviada','Aceptada','Rechazada'))
  OR (v_old = 'Enviada'       AND v_new IN ('Aceptada','Rechazada'))
  OR (v_old = 'Aceptada'      AND v_new IN ('En operación'))
  THEN
    RETURN NEW;
  END IF;
  -- FIX4 N-1: la papelera de embarques (sync_cotizacion_embarque_link)
  -- revierte 'En operación' → 'Aceptada' al liberar la cotización. Es la
  -- única transición admitida bajo la GUC transaccional
  -- app.liberando_papelera; sin ella, LC_COT_TRANSICION_INVALIDA.
  IF v_old = 'En operación' AND v_new = 'Aceptada'
     AND current_setting('app.liberando_papelera', true) = 'on' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'LC_COT_TRANSICION_INVALIDA: no se puede pasar de % a %', v_old, v_new
    USING ERRCODE = 'P0001';
END;
$$;

ALTER FUNCTION public.guard_estado_cotizacion() OWNER TO "postgres";

CREATE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (
        SELECT DISTINCT e
        FROM unnest(_roles) AS r,
             unnest(public.roles_jerarquia(r)) AS e
      )
  )
$$;

ALTER FUNCTION public.has_any_role(uuid,app_role[]) OWNER TO "postgres";

CREATE FUNCTION public.has_any_role_efectivo(_user_id uuid, _roles public.app_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id, 'super_admin'::app_role)
     OR (
       public.has_any_role(_user_id, _roles)
       AND (
         NOT EXISTS (
           SELECT 1 FROM public.organization_members om
            WHERE om.user_id = _user_id
              AND om.organization_id = public.current_user_org_id()
         )
         OR EXISTS (
           SELECT 1 FROM public.organization_members om
            WHERE om.user_id = _user_id
              AND om.organization_id = public.current_user_org_id()
              AND om.role = ANY (
                SELECT DISTINCT e
                FROM unnest(_roles) AS r, unnest(public.roles_jerarquia(r)) AS e
              )
         )
       )
     );
$$;

ALTER FUNCTION public.has_any_role_efectivo(uuid,app_role[]) OWNER TO "postgres";

CREATE FUNCTION public.has_any_role_in_org(_user_id uuid, _roles public.app_role[], _org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT _user_id IS NOT NULL
     AND _org IS NOT NULL
     AND (
       public.has_role(_user_id, 'super_admin'::app_role)
       OR EXISTS (
         SELECT 1
           FROM public.organization_members om
          WHERE om.user_id = _user_id
            AND om.organization_id = _org
            AND om.role = ANY (
              SELECT DISTINCT e
                FROM unnest(_roles) AS r,
                     unnest(public.roles_jerarquia(r)) AS e
            )
       )
     )
$$;

ALTER FUNCTION public.has_any_role_in_org(uuid,app_role[],uuid) OWNER TO "postgres";

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (public.roles_jerarquia(_role))
  )
$$;

ALTER FUNCTION public.has_role(uuid,app_role) OWNER TO "postgres";

CREATE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    public.has_role(_user_id, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = _user_id
        AND om.organization_id = _org_id
        AND om.role IN ('admin','admin_org')
    );
$$;

ALTER FUNCTION public.is_org_admin(uuid,uuid) OWNER TO "postgres";

CREATE FUNCTION public.is_org_member(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(public.current_user_org_id() = p_org, false)
      OR COALESCE(public.has_role(auth.uid(), 'super_admin'::app_role), false);
$$;

ALTER FUNCTION public.is_org_member(uuid) OWNER TO "postgres";

CREATE FUNCTION public.org_scope() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'super_admin')
      THEN (SELECT s.organization_id FROM public.super_admin_org_activa s WHERE s.user_id = auth.uid())
    ELSE public.current_user_org_id()
  END
$$;

ALTER FUNCTION public.org_scope() OWNER TO "postgres";

CREATE FUNCTION public.puede_escribir_cotizaciones(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'super_admin'::app_role)
    OR public.has_role(_user_id, 'admin_org'::app_role)
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'gerente_comercial'::app_role)
    OR public.has_role(_user_id, 'vendedor'::app_role)
    OR public.has_role(_user_id, 'ejecutivo_pricing'::app_role)
    -- v13.750.0: roles operativos habilitados para cotizar.
    OR public.has_role(_user_id, 'coordinador_logistico'::app_role)
    OR public.has_role(_user_id, 'gerente_operaciones'::app_role)
    OR public.has_role(_user_id, 'operador'::app_role)
    OR public.has_role(_user_id, 'customer_service'::app_role)
  )
$$;

ALTER FUNCTION public.puede_escribir_cotizaciones(uuid) OWNER TO "postgres";

CREATE FUNCTION public.puede_ver_costos_cotizacion(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT _user_id IS NOT NULL AND public.has_any_role_efectivo(
    _user_id,
    ARRAY['admin','admin_org','super_admin',
          'gerente_operaciones','gerente_comercial','gerente_visor',
          'coordinador_logistico',
          'contador','tesorero','auxiliar_contable','ejecutivo_cobranza',
          'vendedor','ejecutivo_pricing']::app_role[]
  );
$$;

ALTER FUNCTION public.puede_ver_costos_cotizacion(uuid) OWNER TO "postgres";

CREATE FUNCTION public.puede_ver_costos_cotizacion_propia(_cotizacion_id uuid, _user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT _user_id IS NOT NULL
     AND _cotizacion_id IS NOT NULL
     AND public.has_any_role_efectivo(_user_id, ARRAY['vendedor']::app_role[])
     AND EXISTS (
       SELECT 1
       FROM public.cotizaciones c
       WHERE c.id = _cotizacion_id
         AND c.created_by = _user_id
         AND c.organization_id = public.current_user_org_id()
     );
$$;

ALTER FUNCTION public.puede_ver_costos_cotizacion_propia(uuid,uuid) OWNER TO "postgres";

CREATE FUNCTION public.rls_tenant_scope_ok(_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN (SELECT public.has_role(auth.uid(), 'super_admin'::app_role))
      THEN _org IS NOT NULL AND _org = (SELECT public.org_scope())
    ELSE true
  END;
$$;

ALTER FUNCTION public.rls_tenant_scope_ok(uuid) OWNER TO "postgres";

CREATE FUNCTION public.roles_jerarquia(_role public.app_role) RETURNS public.app_role[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE _role
    WHEN 'super_admin'::app_role THEN ARRAY['super_admin']::app_role[]
    WHEN 'admin'::app_role THEN ARRAY['admin','admin_org','super_admin']::app_role[]
    WHEN 'admin_org'::app_role THEN ARRAY['admin_org','super_admin']::app_role[]
    WHEN 'operador'::app_role THEN ARRAY['operador','coordinador_logistico','gerente_operaciones','admin','admin_org','super_admin']::app_role[]
    WHEN 'viewer'::app_role THEN ARRAY['viewer','customer_service','vendedor','contador','tesorero','auxiliar_contable','ejecutivo_cobranza','ejecutivo_pricing','gerente_operaciones','gerente_visor','gerente_comercial','coordinador_logistico','admin','admin_org','super_admin']::app_role[]
    WHEN 'vendedor'::app_role THEN ARRAY['vendedor','gerente_comercial','admin_org','super_admin']::app_role[]
    WHEN 'contador'::app_role THEN ARRAY['contador','auxiliar_contable','admin_org','super_admin']::app_role[]
    WHEN 'tesorero'::app_role THEN ARRAY['tesorero','admin_org','super_admin']::app_role[]
    WHEN 'auxiliar_contable'::app_role THEN ARRAY['auxiliar_contable','contador','admin_org','super_admin']::app_role[]
    WHEN 'ejecutivo_cobranza'::app_role THEN ARRAY['ejecutivo_cobranza','contador','admin_org','super_admin']::app_role[]
    ELSE ARRAY[_role]::app_role[]
  END
$$;

ALTER FUNCTION public.roles_jerarquia(app_role) OWNER TO "postgres";

CREATE FUNCTION public.snapshot_cotizacion_al_enviar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_next_version integer;
  v_costos jsonb;
  v_should_snapshot boolean := false;
BEGIN
  IF (OLD.estado IS DISTINCT FROM NEW.estado) THEN
    IF NEW.estado::text = 'Enviada' THEN
      v_should_snapshot := true;
    ELSIF NEW.estado::text = 'Aceptada' AND OLD.estado::text IN ('Borrador','Solicitada') THEN
      v_should_snapshot := true;
    END IF;
  END IF;
  IF v_should_snapshot THEN
    SELECT COALESCE(MAX(version_num), 0) + 1
      INTO v_next_version
      FROM public.cotizacion_versiones
     WHERE cotizacion_id = NEW.id;
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
      INTO v_costos
      FROM public.cotizacion_costos c
     WHERE c.cotizacion_id = NEW.id;
    INSERT INTO public.cotizacion_versiones (
      cotizacion_id, organization_id, version_num, folio,
      estado_al_snapshot, snapshot, costos_snapshot, created_by
    ) VALUES (
      NEW.id, NEW.organization_id, v_next_version, NEW.folio,
      NEW.estado::text, to_jsonb(NEW), v_costos, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.snapshot_cotizacion_al_enviar() OWNER TO "postgres";

CREATE FUNCTION public.trg_costeo_tarifas_estado_derivado() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.estado := public.costeo_tarifa_estado_actual(NEW.estado, NEW.vigente_hasta);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_costeo_tarifas_estado_derivado() OWNER TO "postgres";

CREATE FUNCTION public.trg_cotizacion_subtotal_server() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_t record;
  v_n int;
BEGIN
  v_n := CASE WHEN jsonb_typeof(NEW.conceptos_venta) = 'array'
              THEN jsonb_array_length(NEW.conceptos_venta) ELSE 0 END;
  IF v_n = 0 THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_t FROM public.cotizacion_totales_conceptos(NEW.conceptos_venta);
  NEW.subtotal := COALESCE(
    NULLIF(CASE WHEN NEW.moneda::text = 'USD' THEN v_t.subtotal_usd ELSE v_t.subtotal_mxn END, 0),
    NULLIF(CASE WHEN NEW.moneda::text = 'USD' THEN v_t.subtotal_mxn ELSE v_t.subtotal_usd END, 0),
    0
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_cotizacion_subtotal_server() OWNER TO "postgres";

CREATE FUNCTION public.trg_notificar_cotizacion_enviada() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ruta text;
  v_detalles text;
BEGIN
  IF NEW.estado = 'Enviada'::estado_cotizacion
     AND (OLD.estado IS DISTINCT FROM 'Enviada'::estado_cotizacion)
     AND NEW.cliente_id IS NOT NULL
     AND NEW.organization_id IS NOT NULL THEN
    v_ruta := nullif(concat_ws(' → ', nullif(NEW.origen, ''), nullif(NEW.destino, '')), '');
    v_detalles := nullif(concat_ws(' · ', v_ruta, nullif(NEW.tipo::text, '')), '');
    IF NOT EXISTS (
      SELECT 1 FROM public.notificaciones_cliente n
      WHERE n.cliente_id = NEW.cliente_id
        AND n.tipo = 'cotizacion_enviada'
        AND n.url = '/portal/cotizaciones/' || NEW.id
    ) THEN
      INSERT INTO public.notificaciones_cliente
        (cliente_id, organization_id, tipo, titulo, mensaje, url)
      VALUES (
        NEW.cliente_id, NEW.organization_id, 'cotizacion_enviada',
        trim('Nueva cotización enviada ' || coalesce(NEW.folio, '')),
        coalesce(v_detalles || '. ', '') || 'Tienes una nueva cotización lista para revisar.',
        '/portal/cotizaciones/' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_notificar_cotizacion_enviada() OWNER TO "postgres";

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.update_updated_at_column() OWNER TO "postgres";

CREATE FUNCTION public.validate_cotizacion_informativa() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.tipo_documento = 'informativa' THEN
    IF NEW.vigencia_desde IS NULL OR NEW.vigencia_hasta IS NULL THEN
      RAISE EXCEPTION 'Cotización informativa requiere vigencia_desde y vigencia_hasta';
    END IF;
    IF NEW.vigencia_desde > NEW.vigencia_hasta THEN
      RAISE EXCEPTION 'vigencia_desde no puede ser posterior a vigencia_hasta';
    END IF;
    IF jsonb_array_length(COALESCE(NEW.tarifas_informativas, '[]'::jsonb)) < 1 THEN
      RAISE EXCEPTION 'Cotización informativa requiere al menos una tarifa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_cotizacion_informativa() OWNER TO "postgres";

ALTER TABLE public."agente_users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."agente_users" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."bitacora_actividad" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."bitacora_actividad" ALTER COLUMN "usuario_email" SET DEFAULT ''::text;

ALTER TABLE public."bitacora_actividad" ALTER COLUMN "entidad_nombre" SET DEFAULT ''::text;

ALTER TABLE public."bitacora_actividad" ALTER COLUMN "detalles" SET DEFAULT '{}'::jsonb;

ALTER TABLE public."bitacora_actividad" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."bitacora_actividad" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."client_users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."client_users" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."clientes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."clientes" ALTER COLUMN "rfc" SET DEFAULT ''::text;

ALTER TABLE public."clientes" ALTER COLUMN "direccion" SET DEFAULT ''::text;

ALTER TABLE public."clientes" ALTER COLUMN "ciudad" SET DEFAULT ''::text;

ALTER TABLE public."clientes" ALTER COLUMN "estado" SET DEFAULT ''::text;

ALTER TABLE public."clientes" ALTER COLUMN "cp" SET DEFAULT ''::text;

ALTER TABLE public."clientes" ALTER COLUMN "contacto" SET DEFAULT ''::text;

ALTER TABLE public."clientes" ALTER COLUMN "email" SET DEFAULT ''::text;

ALTER TABLE public."clientes" ALTER COLUMN "telefono" SET DEFAULT ''::text;

ALTER TABLE public."clientes" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."clientes" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."clientes" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."clientes" ALTER COLUMN "sin_comision" SET DEFAULT false;

ALTER TABLE public."clientes" ALTER COLUMN "requiere_autorizacion_cotizacion" SET DEFAULT true;

ALTER TABLE public."clientes" ALTER COLUMN "requiere_autorizacion_proforma" SET DEFAULT true;

ALTER TABLE public."costeo_agentes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."costeo_agentes" ALTER COLUMN "pais" SET DEFAULT 'CN'::text;

ALTER TABLE public."costeo_agentes" ALTER COLUMN "dias_credito" SET DEFAULT 0;

ALTER TABLE public."costeo_agentes" ALTER COLUMN "activo" SET DEFAULT true;

ALTER TABLE public."costeo_agentes" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."costeo_agentes" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."costeo_rutas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."costeo_rutas" ALTER COLUMN "activa" SET DEFAULT true;

ALTER TABLE public."costeo_rutas" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."costeo_rutas" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."costeo_tarifa_recargos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."costeo_tarifa_recargos" ALTER COLUMN "monto" SET DEFAULT 0;

ALTER TABLE public."costeo_tarifa_recargos" ALTER COLUMN "moneda" SET DEFAULT 'USD'::text;

ALTER TABLE public."costeo_tarifa_recargos" ALTER COLUMN "incluido_en_total" SET DEFAULT true;

ALTER TABLE public."costeo_tarifa_recargos" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."costeo_tarifas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."costeo_tarifas" ALTER COLUMN "moneda" SET DEFAULT 'USD'::text;

ALTER TABLE public."costeo_tarifas" ALTER COLUMN "dias_libres_demoras" SET DEFAULT 0;

ALTER TABLE public."costeo_tarifas" ALTER COLUMN "estado" SET DEFAULT 'vigente'::text;

ALTER TABLE public."costeo_tarifas" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."costeo_tarifas" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."costeo_tarifas" ALTER COLUMN "estado_aprobacion" SET DEFAULT 'vigente'::text;

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "proveedor" SET DEFAULT ''::text;

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "cantidad" SET DEFAULT 1;

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "costo_unitario" SET DEFAULT 0;

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "precio_venta" SET DEFAULT 0;

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "unidad_medida" SET DEFAULT 'Contenedor'::text;

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."cotizacion_costos" ALTER COLUMN "notas" SET DEFAULT ''::text;

ALTER TABLE public."cotizacion_versiones" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."cotizacion_versiones" ALTER COLUMN "costos_snapshot" SET DEFAULT '[]'::jsonb;

ALTER TABLE public."cotizacion_versiones" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."cotizaciones" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."cotizaciones" ALTER COLUMN "cliente_nombre" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "incoterm" SET DEFAULT 'FOB'::incoterm;

ALTER TABLE public."cotizaciones" ALTER COLUMN "descripcion_mercancia" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "peso_kg" SET DEFAULT 0;

ALTER TABLE public."cotizaciones" ALTER COLUMN "volumen_m3" SET DEFAULT 0;

ALTER TABLE public."cotizaciones" ALTER COLUMN "piezas" SET DEFAULT 0;

ALTER TABLE public."cotizaciones" ALTER COLUMN "origen" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "destino" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "conceptos_venta" SET DEFAULT '[]'::jsonb;

ALTER TABLE public."cotizaciones" ALTER COLUMN "subtotal" SET DEFAULT 0;

ALTER TABLE public."cotizaciones" ALTER COLUMN "moneda" SET DEFAULT 'MXN'::moneda;

ALTER TABLE public."cotizaciones" ALTER COLUMN "vigencia_dias" SET DEFAULT 15;

ALTER TABLE public."cotizaciones" ALTER COLUMN "estado" SET DEFAULT 'Borrador'::estado_cotizacion;

ALTER TABLE public."cotizaciones" ALTER COLUMN "operador" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."cotizaciones" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."cotizaciones" ALTER COLUMN "es_prospecto" SET DEFAULT false;

ALTER TABLE public."cotizaciones" ALTER COLUMN "prospecto_empresa" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "prospecto_contacto" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "prospecto_email" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "prospecto_telefono" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "tipo_carga" SET DEFAULT 'Carga General'::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "tipo_embarque" SET DEFAULT 'FCL'::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "tipo_peso" SET DEFAULT 'Peso Normal'::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "descripcion_adicional" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "sector_economico" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "dimensiones_lcl" SET DEFAULT '[]'::jsonb;

ALTER TABLE public."cotizaciones" ALTER COLUMN "dimensiones_aereas" SET DEFAULT '[]'::jsonb;

ALTER TABLE public."cotizaciones" ALTER COLUMN "frecuencia" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "ruta_texto" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "tipo_movimiento" SET DEFAULT ''::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "seguro" SET DEFAULT false;

ALTER TABLE public."cotizaciones" ALTER COLUMN "valor_seguro_usd" SET DEFAULT 0;

ALTER TABLE public."cotizaciones" ALTER COLUMN "dias_libres_destino" SET DEFAULT 0;

ALTER TABLE public."cotizaciones" ALTER COLUMN "dias_almacenaje" SET DEFAULT 0;

ALTER TABLE public."cotizaciones" ALTER COLUMN "carta_garantia" SET DEFAULT false;

ALTER TABLE public."cotizaciones" ALTER COLUMN "num_contenedores" SET DEFAULT 1;

ALTER TABLE public."cotizaciones" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."cotizaciones" ALTER COLUMN "tipo_documento" SET DEFAULT 'transaccional'::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "tarifas_informativas" SET DEFAULT '[]'::jsonb;

ALTER TABLE public."cotizaciones" ALTER COLUMN "tarifa_override" SET DEFAULT '{}'::jsonb;

ALTER TABLE public."cotizaciones" ALTER COLUMN "sin_desglose_costos" SET DEFAULT false;

ALTER TABLE public."cotizaciones" ALTER COLUMN "estado_revalidacion" SET DEFAULT 'ninguna'::text;

ALTER TABLE public."cotizaciones" ALTER COLUMN "version" SET DEFAULT 1;

ALTER TABLE public."cotizaciones" ALTER COLUMN "origen_portal" SET DEFAULT false;

ALTER TABLE public."cotizaciones" ALTER COLUMN "created_by" SET DEFAULT auth.uid();

ALTER TABLE public."crm_empresas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."crm_empresas" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."crm_empresas" ALTER COLUMN "created_by" SET DEFAULT auth.uid();

ALTER TABLE public."crm_empresas" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."crm_empresas" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."crm_empresas" ALTER COLUMN "estado_crm" SET DEFAULT 'Lead'::text;

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "orden" SET DEFAULT 0;

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "probabilidad_default" SET DEFAULT 0;

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "color" SET DEFAULT '#3b82f6'::text;

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "tipo" SET DEFAULT 'abierta'::crm_etapa_tipo;

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "activa" SET DEFAULT true;

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "crea_tarea_seguimiento" SET DEFAULT false;

ALTER TABLE public."crm_etapas_pipeline" ALTER COLUMN "dias_seguimiento" SET DEFAULT 3;

ALTER TABLE public."crm_historial_etapas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."crm_historial_etapas" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."crm_leads" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."crm_leads" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."crm_leads" ALTER COLUMN "contacto" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "email" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "telefono" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "pais" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "ciudad" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "fuente" SET DEFAULT 'Otro'::crm_lead_fuente;

ALTER TABLE public."crm_leads" ALTER COLUMN "interes_modo" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "score" SET DEFAULT 3;

ALTER TABLE public."crm_leads" ALTER COLUMN "estado" SET DEFAULT 'Nuevo'::crm_lead_estado;

ALTER TABLE public."crm_leads" ALTER COLUMN "vendedor_email" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "notas" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."crm_leads" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."crm_leads" ALTER COLUMN "rfc" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "direccion" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "cp" SET DEFAULT ''::text;

ALTER TABLE public."crm_leads" ALTER COLUMN "entidad_federativa" SET DEFAULT ''::text;

ALTER TABLE public."crm_motivos_perdida" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."crm_motivos_perdida" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."crm_motivos_perdida" ALTER COLUMN "activa" SET DEFAULT true;

ALTER TABLE public."crm_motivos_perdida" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."crm_notificaciones" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."crm_notificaciones" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."crm_notificaciones" ALTER COLUMN "mensaje" SET DEFAULT ''::text;

ALTER TABLE public."crm_notificaciones" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."crm_notificaciones" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "cliente_nombre" SET DEFAULT ''::text;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "vendedor_email" SET DEFAULT ''::text;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "monto_estimado" SET DEFAULT 0;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "moneda" SET DEFAULT 'MXN'::text;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "probabilidad" SET DEFAULT 0;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "modo" SET DEFAULT ''::text;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "tipo_carga" SET DEFAULT ''::text;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "origen" SET DEFAULT ''::text;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "destino" SET DEFAULT ''::text;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "notas" SET DEFAULT ''::text;

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "ultimo_movimiento_at" SET DEFAULT now();

ALTER TABLE public."crm_oportunidades" ALTER COLUMN "etapa_desde_at" SET DEFAULT now();

ALTER TABLE public."crm_solicitudes_pricing" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."crm_solicitudes_pricing" ALTER COLUMN "fecha" SET DEFAULT ((now() AT TIME ZONE 'America/Mexico_City'::text))::date;

ALTER TABLE public."crm_solicitudes_pricing" ALTER COLUMN "complejidad" SET DEFAULT 'media'::text;

ALTER TABLE public."crm_solicitudes_pricing" ALTER COLUMN "estado" SET DEFAULT 'borrador'::text;

ALTER TABLE public."crm_solicitudes_pricing" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."crm_solicitudes_pricing" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."embarques" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."embarques" ALTER COLUMN "cliente_nombre" SET DEFAULT ''::text;

ALTER TABLE public."embarques" ALTER COLUMN "shipper" SET DEFAULT ''::text;

ALTER TABLE public."embarques" ALTER COLUMN "consignatario" SET DEFAULT ''::text;

ALTER TABLE public."embarques" ALTER COLUMN "descripcion_mercancia" SET DEFAULT ''::text;

ALTER TABLE public."embarques" ALTER COLUMN "peso_kg" SET DEFAULT 0;

ALTER TABLE public."embarques" ALTER COLUMN "volumen_m3" SET DEFAULT 0;

ALTER TABLE public."embarques" ALTER COLUMN "piezas" SET DEFAULT 0;

ALTER TABLE public."embarques" ALTER COLUMN "incoterm" SET DEFAULT 'FOB'::incoterm;

ALTER TABLE public."embarques" ALTER COLUMN "estado" SET DEFAULT 'Confirmado'::estado_embarque;

ALTER TABLE public."embarques" ALTER COLUMN "operador" SET DEFAULT ''::text;

ALTER TABLE public."embarques" ALTER COLUMN "fecha_creacion" SET DEFAULT now();

ALTER TABLE public."embarques" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."embarques" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."embarques" ALTER COLUMN "tipo_carga" SET DEFAULT 'Carga General'::text;

ALTER TABLE public."embarques" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."embarques" ALTER COLUMN "tiene_proforma" SET DEFAULT false;

ALTER TABLE public."embarques" ALTER COLUMN "carta_garantia" SET DEFAULT false;

ALTER TABLE public."embarques" ALTER COLUMN "dias_libres_destino" SET DEFAULT 0;

ALTER TABLE public."embarques" ALTER COLUMN "dias_almacenaje" SET DEFAULT 0;

ALTER TABLE public."embarques" ALTER COLUMN "seguro" SET DEFAULT false;

ALTER TABLE public."embarques" ALTER COLUMN "facturado_historico" SET DEFAULT false;

ALTER TABLE public."embarques" ALTER COLUMN "cobro_cliente_status" SET DEFAULT 'pendiente'::text;

ALTER TABLE public."factura_series" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."factura_series" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."factura_series" ALTER COLUMN "prefijo" SET DEFAULT ''::text;

ALTER TABLE public."factura_series" ALTER COLUMN "folio_actual" SET DEFAULT 0;

ALTER TABLE public."factura_series" ALTER COLUMN "folio_inicial" SET DEFAULT 1;

ALTER TABLE public."factura_series" ALTER COLUMN "activa" SET DEFAULT true;

ALTER TABLE public."factura_series" ALTER COLUMN "es_default" SET DEFAULT false;

ALTER TABLE public."factura_series" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."factura_series" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."facturas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."facturas" ALTER COLUMN "expediente" SET DEFAULT ''::text;

ALTER TABLE public."facturas" ALTER COLUMN "cliente_nombre" SET DEFAULT ''::text;

ALTER TABLE public."facturas" ALTER COLUMN "subtotal" SET DEFAULT 0;

ALTER TABLE public."facturas" ALTER COLUMN "iva" SET DEFAULT 0;

ALTER TABLE public."facturas" ALTER COLUMN "total" SET DEFAULT 0;

ALTER TABLE public."facturas" ALTER COLUMN "moneda" SET DEFAULT 'MXN'::moneda;

ALTER TABLE public."facturas" ALTER COLUMN "fecha_emision" SET DEFAULT CURRENT_DATE;

ALTER TABLE public."facturas" ALTER COLUMN "estado" SET DEFAULT 'Borrador'::estado_factura;

ALTER TABLE public."facturas" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."facturas" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."facturas" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."facturas" ALTER COLUMN "origen" SET DEFAULT 'proforma'::origen_factura;

ALTER TABLE public."facturas" ALTER COLUMN "ret_isr" SET DEFAULT 0;

ALTER TABLE public."facturas" ALTER COLUMN "ret_iva" SET DEFAULT 0;

ALTER TABLE public."facturas" ALTER COLUMN "uuid_verificado" SET DEFAULT false;

ALTER TABLE public."folio_secuencias" ALTER COLUMN "ultimo_numero" SET DEFAULT 0;

ALTER TABLE public."folio_secuencias" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."navieras" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."navieras" ALTER COLUMN "activo" SET DEFAULT true;

ALTER TABLE public."navieras" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."notificaciones_cliente" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."notificaciones_cliente" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."notificaciones_cliente" ALTER COLUMN "mensaje" SET DEFAULT ''::text;

ALTER TABLE public."notificaciones_cliente" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."organization_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."organization_members" ALTER COLUMN "role" SET DEFAULT 'viewer'::app_role;

ALTER TABLE public."organization_members" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."organizations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."organizations" ALTER COLUMN "rfc" SET DEFAULT ''::text;

ALTER TABLE public."organizations" ALTER COLUMN "plan" SET DEFAULT 'basic'::text;

ALTER TABLE public."organizations" ALTER COLUMN "activo" SET DEFAULT true;

ALTER TABLE public."organizations" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."organizations" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."organizations" ALTER COLUMN "moneda_preferida" SET DEFAULT 'MXN'::text;

ALTER TABLE public."organizations" ALTER COLUMN "onboarding_completado" SET DEFAULT false;

ALTER TABLE public."proformas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."proformas" ALTER COLUMN "subtotal_usd" SET DEFAULT 0;

ALTER TABLE public."proformas" ALTER COLUMN "iva_usd" SET DEFAULT 0;

ALTER TABLE public."proformas" ALTER COLUMN "total_usd" SET DEFAULT 0;

ALTER TABLE public."proformas" ALTER COLUMN "subtotal_mxn" SET DEFAULT 0;

ALTER TABLE public."proformas" ALTER COLUMN "iva_mxn" SET DEFAULT 0;

ALTER TABLE public."proformas" ALTER COLUMN "total_mxn" SET DEFAULT 0;

ALTER TABLE public."proformas" ALTER COLUMN "fecha_emision" SET DEFAULT CURRENT_DATE;

ALTER TABLE public."proformas" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."proformas" ALTER COLUMN "created_by" SET DEFAULT auth.uid();

ALTER TABLE public."proformas" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."proformas" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."proformas" ALTER COLUMN "estado_proforma" SET DEFAULT 'pendiente'::text;

ALTER TABLE public."proformas" ALTER COLUMN "es_consolidada" SET DEFAULT false;

ALTER TABLE public."proformas" ALTER COLUMN "estado_aprobacion" SET DEFAULT 'borrador'::text;

ALTER TABLE public."proformas" ALTER COLUMN "estado_revision" SET DEFAULT 'pendiente'::text;

ALTER TABLE public."proformas" ALTER COLUMN "tasa_iva_aplicada" SET DEFAULT 0.16;

ALTER TABLE public."proformas" ALTER COLUMN "estado_cliente" SET DEFAULT 'pendiente'::text;

ALTER TABLE public."proveedores" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."proveedores" ALTER COLUMN "rfc" SET DEFAULT ''::text;

ALTER TABLE public."proveedores" ALTER COLUMN "contacto" SET DEFAULT ''::text;

ALTER TABLE public."proveedores" ALTER COLUMN "email" SET DEFAULT ''::text;

ALTER TABLE public."proveedores" ALTER COLUMN "telefono" SET DEFAULT ''::text;

ALTER TABLE public."proveedores" ALTER COLUMN "moneda_preferida" SET DEFAULT 'MXN'::moneda;

ALTER TABLE public."proveedores" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."proveedores" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."proveedores" ALTER COLUMN "organization_id" SET DEFAULT current_user_org_id();

ALTER TABLE public."proveedores" ALTER COLUMN "categoria" SET DEFAULT 'Logistico'::categoria_proveedor;

ALTER TABLE public."proveedores" ALTER COLUMN "dias_credito" SET DEFAULT 0;

ALTER TABLE public."proveedores" ALTER COLUMN "estado_alta" SET DEFAULT 'aprobado'::text;

ALTER TABLE public."puertos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."puertos" ALTER COLUMN "activo" SET DEFAULT true;

ALTER TABLE public."puertos" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."super_admin_org_activa" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."super_admin_org_activa" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE public."tipos_contenedor" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."tipos_contenedor" ALTER COLUMN "activo" SET DEFAULT true;

ALTER TABLE public."tipos_contenedor" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE public."user_roles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."user_roles" ALTER COLUMN "role" SET DEFAULT 'viewer'::app_role;

ALTER TABLE public."agente_users" ADD CONSTRAINT "agente_users_pkey" PRIMARY KEY (id);

ALTER TABLE public."agente_users" ADD CONSTRAINT "agente_users_user_id_agente_id_key" UNIQUE (user_id, agente_id);

ALTER TABLE public."bitacora_actividad" ADD CONSTRAINT "bitacora_actividad_pkey" PRIMARY KEY (id);

ALTER TABLE public."client_users" ADD CONSTRAINT "client_users_pkey" PRIMARY KEY (id);

ALTER TABLE public."client_users" ADD CONSTRAINT "client_users_user_id_cliente_id_key" UNIQUE (user_id, cliente_id);

ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_id_org_uniq" UNIQUE (id, organization_id);

ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_limite_credito_mxn_nonneg" CHECK (limite_credito_mxn IS NULL OR limite_credito_mxn >= 0::numeric);

ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_pkey" PRIMARY KEY (id);

ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_rfc_formato" CHECK (rfc IS NULL OR rfc = ''::text OR rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'::text) NOT VALID;

ALTER TABLE public."costeo_agentes" ADD CONSTRAINT "costeo_agentes_dias_credito_check" CHECK (dias_credito >= 0);

ALTER TABLE public."costeo_agentes" ADD CONSTRAINT "costeo_agentes_organization_id_nombre_key" UNIQUE (organization_id, nombre);

ALTER TABLE public."costeo_agentes" ADD CONSTRAINT "costeo_agentes_pkey" PRIMARY KEY (id);

ALTER TABLE public."costeo_rutas" ADD CONSTRAINT "costeo_rutas_organization_id_puerto_origen_id_puerto_destin_key" UNIQUE (organization_id, puerto_origen_id, puerto_destino_id);

ALTER TABLE public."costeo_rutas" ADD CONSTRAINT "costeo_rutas_pkey" PRIMARY KEY (id);

ALTER TABLE public."costeo_tarifa_recargos" ADD CONSTRAINT "costeo_tarifa_recargos_lado_check" CHECK (lado = ANY (ARRAY['origen'::text, 'destino'::text]));

ALTER TABLE public."costeo_tarifa_recargos" ADD CONSTRAINT "costeo_tarifa_recargos_monto_check" CHECK (monto >= 0::numeric);

ALTER TABLE public."costeo_tarifa_recargos" ADD CONSTRAINT "costeo_tarifa_recargos_pkey" PRIMARY KEY (id);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_check" CHECK (vigente_hasta >= vigente_desde);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_dias_libres_almacenaje_lcl_chk" CHECK (dias_libres_almacenaje_lcl IS NULL OR dias_libres_almacenaje_lcl >= 0);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_dias_libres_demoras_check" CHECK (dias_libres_demoras >= 0);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_estado_aprobacion_check" CHECK (estado_aprobacion = ANY (ARRAY['borrador'::text, 'vigente'::text, 'rechazada'::text]));

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_estado_check" CHECK (estado = ANY (ARRAY['borrador'::text, 'vigente'::text, 'vencida'::text, 'reemplazada'::text]));

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_flete_base_check" CHECK (flete_base >= 0::numeric);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_frecuencia_override_chk" CHECK (frecuencia_override IS NULL OR (frecuencia_override = ANY (ARRAY['Diaria'::text, 'Semanal'::text, 'Quincenal'::text, 'Mensual'::text, 'Bajo demanda'::text])));

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_organization_id_agente_id_naviera_id_ruta_id_key" UNIQUE (organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id, vigente_desde);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_pkey" PRIMARY KEY (id);

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_cantidad_pos" CHECK (cantidad >= 1::numeric);

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_costo_unit_nonneg" CHECK (costo_unitario >= 0::numeric);

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_moneda_check" CHECK (moneda = ANY (ARRAY['USD'::text, 'MXN'::text]));

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_pkey" PRIMARY KEY (id);

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_precio_venta_nonneg" CHECK (precio_venta >= 0::numeric);

ALTER TABLE public."cotizacion_versiones" ADD CONSTRAINT "cotizacion_versiones_cotizacion_id_version_num_key" UNIQUE (cotizacion_id, version_num);

ALTER TABLE public."cotizacion_versiones" ADD CONSTRAINT "cotizacion_versiones_pkey" PRIMARY KEY (id);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_estado_revalidacion_chk" CHECK (estado_revalidacion = ANY (ARRAY['ninguna'::text, 'pendiente_reaprobacion'::text, 'reaprobada'::text, 'rechazada'::text]));

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_id_org_uniq" UNIQUE (id, organization_id);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_peso_fisico_kg_valido" CHECK (peso_fisico_kg IS NULL OR peso_fisico_kg >= 0::numeric AND peso_fisico_kg < 'Infinity'::numeric AND peso_fisico_kg <> 'NaN'::numeric);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_peso_nonneg" CHECK (peso_kg >= 0::numeric);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_piezas_nonneg" CHECK (piezas >= 0);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_pkey" PRIMARY KEY (id);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_puertos_distintos_chk" CHECK (puerto_origen_id IS NULL OR puerto_destino_id IS NULL OR puerto_origen_id <> puerto_destino_id);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_subtotal_nonneg" CHECK (subtotal >= 0::numeric);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_tipo_cambio_usd_positivo" CHECK (tipo_cambio_usd IS NULL OR tipo_cambio_usd > 0::numeric) NOT VALID;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_tipo_documento_check" CHECK (tipo_documento = ANY (ARRAY['transaccional'::text, 'informativa'::text]));

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_volumen_nonneg" CHECK (volumen_m3 >= 0::numeric);

ALTER TABLE public."crm_empresas" ADD CONSTRAINT "crm_empresas_estado_crm_chk" CHECK (estado_crm = ANY (ARRAY['Lead'::text, 'Sospechoso'::text, 'Prospecto'::text, 'Cliente'::text]));

ALTER TABLE public."crm_empresas" ADD CONSTRAINT "crm_empresas_lead_origen_id_key" UNIQUE (lead_origen_id);

ALTER TABLE public."crm_empresas" ADD CONSTRAINT "crm_empresas_pkey" PRIMARY KEY (id);

ALTER TABLE public."crm_etapas_pipeline" ADD CONSTRAINT "crm_etapas_pipeline_organization_id_nombre_key" UNIQUE (organization_id, nombre);

ALTER TABLE public."crm_etapas_pipeline" ADD CONSTRAINT "crm_etapas_pipeline_pkey" PRIMARY KEY (id);

ALTER TABLE public."crm_etapas_pipeline" ADD CONSTRAINT "crm_etapas_pipeline_probabilidad_default_check" CHECK (probabilidad_default >= 0 AND probabilidad_default <= 100);

ALTER TABLE public."crm_historial_etapas" ADD CONSTRAINT "crm_historial_etapas_pkey" PRIMARY KEY (id);

ALTER TABLE public."crm_leads" ADD CONSTRAINT "crm_leads_pkey" PRIMARY KEY (id);

ALTER TABLE public."crm_leads" ADD CONSTRAINT "crm_leads_score_check" CHECK (score >= 1 AND score <= 5);

ALTER TABLE public."crm_motivos_perdida" ADD CONSTRAINT "crm_motivos_perdida_organization_id_nombre_key" UNIQUE (organization_id, nombre);

ALTER TABLE public."crm_motivos_perdida" ADD CONSTRAINT "crm_motivos_perdida_pkey" PRIMARY KEY (id);

ALTER TABLE public."crm_notificaciones" ADD CONSTRAINT "crm_notificaciones_pkey" PRIMARY KEY (id);

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_pkey" PRIMARY KEY (id);

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_probabilidad_check" CHECK (probabilidad >= 0 AND probabilidad <= 100);

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_puertos_distintos_chk" CHECK (puerto_origen_id IS NULL OR puerto_destino_id IS NULL OR puerto_origen_id <> puerto_destino_id);

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_cantidad_check" CHECK (cantidad IS NULL OR cantidad > 0);

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_complejidad_check" CHECK (complejidad = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text]));

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_estado_check" CHECK (estado = ANY (ARRAY['borrador'::text, 'enviada'::text, 'respondida'::text, 'cancelada'::text]));

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_incoterm_check" CHECK (incoterm = ANY (ARRAY['EXW'::text, 'FAS'::text, 'FCA'::text, 'FOB'::text, 'CFR'::text, 'CIF'::text, 'DAP'::text, 'DDP'::text, 'DPU'::text]));

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_organization_id_folio_key" UNIQUE (organization_id, folio);

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_pkey" PRIMARY KEY (id);

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_servicio_check" CHECK (servicio = ANY (ARRAY['Marítimo'::text, 'Terrestre'::text, 'Aéreo'::text]));

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_unidad_medida_check" CHECK (unidad_medida IS NULL OR (unidad_medida = ANY (ARRAY['kg'::text, 'lb'::text, 't'::text, 'g'::text])));

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_cobro_cliente_status_check" CHECK (cobro_cliente_status = ANY (ARRAY['pendiente'::text, 'parcial'::text, 'pagado'::text]));

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_eta_after_etd" CHECK (etd IS NULL OR eta IS NULL OR eta >= etd);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_expediente_formato_valido" CHECK (expediente IS NULL OR expediente ~ '^EL[A-Z]{3}[0-9]+$'::text OR expediente ~ '^DEMO-[0-9]{4}-[0-9]+$'::text) NOT VALID;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_id_org_uniq" UNIQUE (id, organization_id);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_medidas_no_negativas" CHECK (COALESCE(peso_kg, 0::numeric) >= 0::numeric AND COALESCE(volumen_m3, 0::numeric) >= 0::numeric AND COALESCE(piezas, 0) >= 0);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_peso_kg_nonneg" CHECK (peso_kg >= 0::numeric);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_piezas_nonneg" CHECK (piezas >= 0);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_pkey" PRIMARY KEY (id);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_puertos_distintos_chk" CHECK (puerto_origen_id IS NULL OR puerto_destino_id IS NULL OR puerto_origen_id <> puerto_destino_id);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_tarifa_decision_chk" CHECK (tarifa_decision IS NULL OR (tarifa_decision = ANY (ARRAY['sin_cambios'::text, 'mantenida_por_operaciones'::text, 'refrescada'::text, 'sustituida'::text, 'reaprobada_ventas'::text])));

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_tc_eur_pos" CHECK (tipo_cambio_eur > 0::numeric);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_tc_usd_pos" CHECK (tipo_cambio_usd > 0::numeric);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_volumen_nonneg" CHECK (volumen_m3 >= 0::numeric);

ALTER TABLE public."factura_series" ADD CONSTRAINT "factura_series_codigo_unique" UNIQUE (organization_id, codigo);

ALTER TABLE public."factura_series" ADD CONSTRAINT "factura_series_pkey" PRIMARY KEY (id);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_cancelacion_motivo_sat" CHECK (cancelacion_motivo IS NULL OR (cancelacion_motivo = ANY (ARRAY['01'::text, '02'::text, '03'::text, '04'::text])));

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_cancellation_status_check" CHECK (cancellation_status = ANY (ARRAY['none'::text, 'verifying'::text, 'pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text]));

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_id_org_uniq" UNIQUE (id, organization_id);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_iva_nonneg" CHECK (iva >= 0::numeric);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_no_autosustitucion" CHECK (sustituye_a IS NULL OR sustituye_a <> id) NOT VALID;

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_pkey" PRIMARY KEY (id);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_subtotal_nonneg" CHECK (subtotal >= 0::numeric);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_tipo_cambio_pos" CHECK (tipo_cambio IS NULL OR tipo_cambio > 0::numeric);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_total_escala" CHECK (total IS NULL OR total = round(total, 2)) NOT VALID;

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_total_nonneg" CHECK (total >= 0::numeric);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_totales_consistentes" CHECK (abs(total - (subtotal + iva - COALESCE(ret_isr, 0::numeric) - COALESCE(ret_iva, 0::numeric))) <= 0.01) NOT VALID;

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_venc_despues_emision" CHECK (fecha_vencimiento >= fecha_emision);

ALTER TABLE public."folio_secuencias" ADD CONSTRAINT "folio_secuencias_pkey" PRIMARY KEY (organization_id, tipo);

ALTER TABLE public."navieras" ADD CONSTRAINT "navieras_code_key" UNIQUE (code);

ALTER TABLE public."navieras" ADD CONSTRAINT "navieras_code_scac_format" CHECK (code ~ '^[A-Z]{4}$'::text) NOT VALID;

ALTER TABLE public."navieras" ADD CONSTRAINT "navieras_pkey" PRIMARY KEY (id);

ALTER TABLE public."notificaciones_cliente" ADD CONSTRAINT "notificaciones_cliente_pkey" PRIMARY KEY (id);

ALTER TABLE public."organization_members" ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE (organization_id, user_id);

ALTER TABLE public."organization_members" ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY (id);

ALTER TABLE public."organization_members" ADD CONSTRAINT "organization_members_user_id_unique" UNIQUE (user_id);

ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_moneda_preferida_check" CHECK (moneda_preferida = ANY (ARRAY['MXN'::text, 'USD'::text, 'EUR'::text]));

ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY (id);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_estado_aprobacion_check" CHECK (estado_aprobacion = ANY (ARRAY['borrador'::text, 'aprobada'::text, 'consolidada'::text]));

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_estado_cliente_check" CHECK (estado_cliente = ANY (ARRAY['pendiente'::text, 'aceptada'::text, 'rechazada'::text]));

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_estado_proforma_check" CHECK (estado_proforma = ANY (ARRAY['pendiente'::text, 'facturada'::text, 'cancelada'::text]));

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_estado_revision_check" CHECK (estado_revision = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'consolidada'::text]));

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_id_org_uniq" UNIQUE (id, organization_id);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_iva_mxn_nonneg" CHECK (iva_mxn >= 0::numeric);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_iva_usd_nonneg" CHECK (iva_usd >= 0::numeric);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_organization_id_numero_key" UNIQUE (organization_id, numero);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_pkey" PRIMARY KEY (id);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_subtotal_mxn_nonneg" CHECK (subtotal_mxn >= 0::numeric);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_subtotal_usd_nonneg" CHECK (subtotal_usd >= 0::numeric);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_token_publico_key" UNIQUE (token_publico);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_total_mxn_nonneg" CHECK (total_mxn >= 0::numeric);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_total_usd_nonneg" CHECK (total_usd >= 0::numeric);

ALTER TABLE public."proveedores" ADD CONSTRAINT "proveedores_categoria_check" CHECK (categoria = 'Logistico'::categoria_proveedor AND tipo IS NOT NULL OR categoria = 'GastoOperativo'::categoria_proveedor AND subtipo_gasto IS NOT NULL);

ALTER TABLE public."proveedores" ADD CONSTRAINT "proveedores_dias_credito_check" CHECK (dias_credito >= 0);

ALTER TABLE public."proveedores" ADD CONSTRAINT "proveedores_estado_alta_chk" CHECK (estado_alta = ANY (ARRAY['provisional'::text, 'aprobado'::text]));

ALTER TABLE public."proveedores" ADD CONSTRAINT "proveedores_id_org_uniq" UNIQUE (id, organization_id);

ALTER TABLE public."proveedores" ADD CONSTRAINT "proveedores_pkey" PRIMARY KEY (id);

ALTER TABLE public."puertos" ADD CONSTRAINT "puertos_code_key" UNIQUE (code);

ALTER TABLE public."puertos" ADD CONSTRAINT "puertos_pkey" PRIMARY KEY (id);

ALTER TABLE public."super_admin_org_activa" ADD CONSTRAINT "super_admin_org_activa_pkey" PRIMARY KEY (user_id);

ALTER TABLE public."tipos_contenedor" ADD CONSTRAINT "tipos_contenedor_code_key" UNIQUE (code);

ALTER TABLE public."tipos_contenedor" ADD CONSTRAINT "tipos_contenedor_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_unique" UNIQUE (user_id);

ALTER TABLE public."agente_users" ADD CONSTRAINT "agente_users_agente_id_fkey" FOREIGN KEY (agente_id) REFERENCES costeo_agentes(id) ON DELETE CASCADE;

ALTER TABLE public."agente_users" ADD CONSTRAINT "agente_users_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."agente_users" ADD CONSTRAINT "agente_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."bitacora_actividad" ADD CONSTRAINT "bitacora_actividad_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE public."client_users" ADD CONSTRAINT "client_users_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

ALTER TABLE public."client_users" ADD CONSTRAINT "client_users_cliente_org_fkey" FOREIGN KEY (cliente_id, organization_id) REFERENCES clientes(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public."client_users" ADD CONSTRAINT "client_users_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."client_users" ADD CONSTRAINT "client_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE public."costeo_agentes" ADD CONSTRAINT "costeo_agentes_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL;

ALTER TABLE public."costeo_rutas" ADD CONSTRAINT "costeo_rutas_puerto_destino_id_fkey" FOREIGN KEY (puerto_destino_id) REFERENCES puertos(id);

ALTER TABLE public."costeo_rutas" ADD CONSTRAINT "costeo_rutas_puerto_origen_id_fkey" FOREIGN KEY (puerto_origen_id) REFERENCES puertos(id);

ALTER TABLE public."costeo_tarifa_recargos" ADD CONSTRAINT "costeo_tarifa_recargos_org_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."costeo_tarifa_recargos" ADD CONSTRAINT "costeo_tarifa_recargos_tarifa_id_fkey" FOREIGN KEY (tarifa_id) REFERENCES costeo_tarifas(id) ON DELETE CASCADE;

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_agente_id_fkey" FOREIGN KEY (agente_id) REFERENCES costeo_agentes(id) ON DELETE RESTRICT;

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_creado_por_fkey" FOREIGN KEY (creado_por) REFERENCES auth.users(id);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_naviera_id_fkey" FOREIGN KEY (naviera_id) REFERENCES navieras(id);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_reemplazada_por_fkey" FOREIGN KEY (reemplazada_por) REFERENCES costeo_tarifas(id) ON DELETE SET NULL;

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_ruta_id_fkey" FOREIGN KEY (ruta_id) REFERENCES costeo_rutas(id);

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_solicitud_pricing_id_fkey" FOREIGN KEY (solicitud_pricing_id) REFERENCES crm_solicitudes_pricing(id) ON DELETE RESTRICT;

ALTER TABLE public."costeo_tarifas" ADD CONSTRAINT "costeo_tarifas_tipo_contenedor_id_fkey" FOREIGN KEY (tipo_contenedor_id) REFERENCES tipos_contenedor(id);

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_costeo_tarifa_id_fkey" FOREIGN KEY (costeo_tarifa_id) REFERENCES costeo_tarifas(id) ON DELETE SET NULL;

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_costeo_tarifa_recargo_id_fkey" FOREIGN KEY (costeo_tarifa_recargo_id) REFERENCES costeo_tarifa_recargos(id) ON DELETE SET NULL;

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_cotizacion_id_fkey" FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE;

ALTER TABLE public."cotizacion_costos" ADD CONSTRAINT "cotizacion_costos_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE public."cotizacion_versiones" ADD CONSTRAINT "cotizacion_versiones_cotizacion_id_fkey" FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE;

ALTER TABLE public."cotizacion_versiones" ADD CONSTRAINT "cotizacion_versiones_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public."cotizacion_versiones" ADD CONSTRAINT "cotizacion_versiones_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_agente_id_fkey" FOREIGN KEY (agente_id) REFERENCES costeo_agentes(id) ON DELETE SET NULL;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_duplicada_de_id_fkey" FOREIGN KEY (duplicada_de_id) REFERENCES cotizaciones(id) ON DELETE SET NULL;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_embarque_id_fkey" FOREIGN KEY (embarque_id) REFERENCES embarques(id) ON DELETE SET NULL;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_lcl_consolidador_id_fkey" FOREIGN KEY (lcl_consolidador_id) REFERENCES proveedores(id) ON DELETE SET NULL;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_naviera_id_fkey" FOREIGN KEY (naviera_id) REFERENCES navieras(id) ON DELETE SET NULL;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_puerto_destino_id_fkey" FOREIGN KEY (puerto_destino_id) REFERENCES puertos(id) ON DELETE SET NULL;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_puerto_origen_id_fkey" FOREIGN KEY (puerto_origen_id) REFERENCES puertos(id) ON DELETE SET NULL;

ALTER TABLE public."cotizaciones" ADD CONSTRAINT "cotizaciones_tarifa_id_fkey" FOREIGN KEY (tarifa_id) REFERENCES costeo_tarifas(id) ON DELETE SET NULL;

ALTER TABLE public."crm_historial_etapas" ADD CONSTRAINT "crm_historial_etapas_etapa_destino_id_fkey" FOREIGN KEY (etapa_destino_id) REFERENCES crm_etapas_pipeline(id);

ALTER TABLE public."crm_historial_etapas" ADD CONSTRAINT "crm_historial_etapas_etapa_origen_id_fkey" FOREIGN KEY (etapa_origen_id) REFERENCES crm_etapas_pipeline(id);

ALTER TABLE public."crm_historial_etapas" ADD CONSTRAINT "crm_historial_etapas_oportunidad_id_fkey" FOREIGN KEY (oportunidad_id) REFERENCES crm_oportunidades(id) ON DELETE CASCADE;

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_etapa_id_fkey" FOREIGN KEY (etapa_id) REFERENCES crm_etapas_pipeline(id) ON DELETE RESTRICT;

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL;

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_motivo_perdida_id_fkey" FOREIGN KEY (motivo_perdida_id) REFERENCES crm_motivos_perdida(id) ON DELETE SET NULL;

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_puerto_destino_id_fkey" FOREIGN KEY (puerto_destino_id) REFERENCES puertos(id) ON DELETE SET NULL;

ALTER TABLE public."crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_puerto_origen_id_fkey" FOREIGN KEY (puerto_origen_id) REFERENCES puertos(id) ON DELETE SET NULL;

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_oportunidad_id_fkey" FOREIGN KEY (oportunidad_id) REFERENCES crm_oportunidades(id) ON DELETE RESTRICT;

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE public."crm_solicitudes_pricing" ADD CONSTRAINT "crm_solicitudes_pricing_tarifa_tarifario_id_fkey" FOREIGN KEY (tarifa_tarifario_id) REFERENCES costeo_tarifas(id) ON DELETE RESTRICT;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_agente_id_fkey" FOREIGN KEY (agente_id) REFERENCES costeo_agentes(id) ON DELETE SET NULL;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_cotizacion_id_fkey" FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE SET NULL;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_naviera_id_fkey" FOREIGN KEY (naviera_id) REFERENCES navieras(id) ON DELETE SET NULL;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_puerto_destino_id_fkey" FOREIGN KEY (puerto_destino_id) REFERENCES puertos(id) ON DELETE SET NULL;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_puerto_origen_id_fkey" FOREIGN KEY (puerto_origen_id) REFERENCES puertos(id) ON DELETE SET NULL;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_tarifa_id_aplicada_fkey" FOREIGN KEY (tarifa_id_aplicada) REFERENCES costeo_tarifas(id) ON DELETE SET NULL;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_tarifa_id_fkey" FOREIGN KEY (tarifa_id) REFERENCES costeo_tarifas(id) ON DELETE SET NULL;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_tarifa_id_original_fkey" FOREIGN KEY (tarifa_id_original) REFERENCES costeo_tarifas(id) ON DELETE SET NULL;

ALTER TABLE public."embarques" ADD CONSTRAINT "embarques_tarifa_revalidada_por_fkey" FOREIGN KEY (tarifa_revalidada_por) REFERENCES auth.users(id);

ALTER TABLE public."factura_series" ADD CONSTRAINT "factura_series_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_cotizacion_id_fkey" FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE SET NULL;

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_embarque_id_fkey" FOREIGN KEY (embarque_id) REFERENCES embarques(id);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_proforma_id_fkey" FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE SET NULL;

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_serie_id_fkey" FOREIGN KEY (serie_id) REFERENCES factura_series(id);

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_sustituida_por_fkey" FOREIGN KEY (sustituida_por) REFERENCES facturas(id) ON DELETE SET NULL;

ALTER TABLE public."facturas" ADD CONSTRAINT "facturas_sustituye_a_fkey" FOREIGN KEY (sustituye_a) REFERENCES facturas(id) ON DELETE SET NULL;

ALTER TABLE public."organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_consolidada_en_fkey" FOREIGN KEY (consolidada_en) REFERENCES proformas(id) ON DELETE SET NULL;

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_embarque_id_fkey" FOREIGN KEY (embarque_id) REFERENCES embarques(id) ON DELETE RESTRICT;

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_factura_id_fkey" FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE SET NULL;

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_factura_secundaria_id_fkey" FOREIGN KEY (factura_secundaria_id) REFERENCES facturas(id) ON DELETE SET NULL;

ALTER TABLE public."proformas" ADD CONSTRAINT "proformas_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE public."proveedores" ADD CONSTRAINT "proveedores_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE public."super_admin_org_activa" ADD CONSTRAINT "super_admin_org_activa_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."super_admin_org_activa" ADD CONSTRAINT "super_admin_org_activa_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_agente_users_agente ON public.agente_users USING btree (agente_id);

CREATE INDEX idx_agente_users_org ON public.agente_users USING btree (organization_id);

CREATE INDEX idx_agente_users_user ON public.agente_users USING btree (user_id);

CREATE INDEX idx_bitacora_accion_created_at ON public.bitacora_actividad USING btree (accion, created_at DESC);

CREATE INDEX idx_bitacora_created_at ON public.bitacora_actividad USING btree (created_at DESC);

CREATE INDEX idx_bitacora_entidad ON public.bitacora_actividad USING btree (entidad_id);

CREATE INDEX idx_bitacora_modulo ON public.bitacora_actividad USING btree (modulo);

CREATE INDEX idx_bitacora_org_created ON public.bitacora_actividad USING btree (organization_id, created_at DESC);

CREATE INDEX idx_bitacora_usuario ON public.bitacora_actividad USING btree (usuario_id);

CREATE INDEX idx_client_users_cliente_id ON public.client_users USING btree (cliente_id);

CREATE INDEX idx_client_users_org ON public.client_users USING btree (organization_id);

CREATE INDEX idx_client_users_user ON public.client_users USING btree (user_id);

CREATE INDEX idx_client_users_user_id ON public.client_users USING btree (user_id);

CREATE UNIQUE INDEX clientes_org_rfc_unique ON public.clientes USING btree (organization_id, upper(btrim(rfc))) WHERE ((rfc IS NOT NULL) AND (btrim(rfc) <> ''::text) AND (upper(btrim(rfc)) <> ALL (ARRAY['XEXX010101000'::text, 'XAXX010101000'::text])) AND (deleted_at IS NULL));

CREATE INDEX idx_clientes_deleted_at ON public.clientes USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX idx_clientes_nombre_trgm ON public.clientes USING gin (nombre gin_trgm_ops);

CREATE INDEX idx_clientes_org ON public.clientes USING btree (organization_id);

CREATE INDEX idx_clientes_rfc_trgm ON public.clientes USING gin (rfc gin_trgm_ops);

CREATE UNIQUE INDEX ux_clientes_email_org ON public.clientes USING btree (organization_id, lower(btrim(email))) WHERE ((deleted_at IS NULL) AND (email IS NOT NULL) AND (btrim(email) <> ''::text));

CREATE INDEX idx_costeo_recargos_org ON public.costeo_tarifa_recargos USING btree (organization_id);

CREATE INDEX idx_costeo_tarifa_recargos_tarifa ON public.costeo_tarifa_recargos USING btree (tarifa_id);

CREATE INDEX costeo_tarifas_solicitud_pricing_idx ON public.costeo_tarifas USING btree (solicitud_pricing_id) WHERE (solicitud_pricing_id IS NOT NULL);

CREATE INDEX idx_costeo_tarifas_estado_aprobacion ON public.costeo_tarifas USING btree (estado_aprobacion);

CREATE INDEX idx_costeo_tarifas_lookup ON public.costeo_tarifas USING btree (organization_id, ruta_id, tipo_contenedor_id, vigente_desde, vigente_hasta);

CREATE INDEX idx_costeo_tarifas_reemplazada_por ON public.costeo_tarifas USING btree (reemplazada_por);

CREATE UNIQUE INDEX cotizacion_costos_origen_venta_unique ON public.cotizacion_costos USING btree (cotizacion_id, origen_venta_id) WHERE (origen_venta_id IS NOT NULL);

CREATE INDEX idx_cotizacion_costos_costeo_tarifa ON public.cotizacion_costos USING btree (costeo_tarifa_id);

CREATE INDEX idx_cotizacion_costos_cotizacion ON public.cotizacion_costos USING btree (cotizacion_id);

CREATE INDEX idx_cotizacion_costos_cotizacion_id ON public.cotizacion_costos USING btree (cotizacion_id);

CREATE INDEX idx_cotizacion_costos_deleted_at ON public.cotizacion_costos USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX idx_cotizacion_costos_org ON public.cotizacion_costos USING btree (organization_id);

CREATE INDEX idx_cotizacion_versiones_cotizacion ON public.cotizacion_versiones USING btree (cotizacion_id, version_num DESC);

CREATE INDEX idx_cotizacion_versiones_org ON public.cotizacion_versiones USING btree (organization_id, created_at DESC);

CREATE INDEX idx_cotizaciones_agente_id ON public.cotizaciones USING btree (agente_id);

CREATE INDEX idx_cotizaciones_cliente_id ON public.cotizaciones USING btree (cliente_id);

CREATE INDEX idx_cotizaciones_cliente_nombre_trgm ON public.cotizaciones USING gin (cliente_nombre gin_trgm_ops);

CREATE INDEX idx_cotizaciones_cliente_trgm ON public.cotizaciones USING gin (cliente_nombre gin_trgm_ops);

CREATE INDEX idx_cotizaciones_created_by ON public.cotizaciones USING btree (created_by);

CREATE INDEX idx_cotizaciones_deleted_at ON public.cotizaciones USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX idx_cotizaciones_descripcion_trgm ON public.cotizaciones USING gin (descripcion_mercancia gin_trgm_ops);

CREATE INDEX idx_cotizaciones_duplicada_de ON public.cotizaciones USING btree (duplicada_de_id) WHERE (duplicada_de_id IS NOT NULL);

CREATE INDEX idx_cotizaciones_estado ON public.cotizaciones USING btree (estado);

CREATE INDEX idx_cotizaciones_folio_trgm ON public.cotizaciones USING gin (folio gin_trgm_ops);

CREATE INDEX idx_cotizaciones_naviera_id ON public.cotizaciones USING btree (naviera_id);

CREATE INDEX idx_cotizaciones_oportunidad ON public.cotizaciones USING btree (oportunidad_id);

CREATE INDEX idx_cotizaciones_org ON public.cotizaciones USING btree (organization_id);

CREATE INDEX idx_cotizaciones_org_created_at ON public.cotizaciones USING btree (organization_id, created_at DESC);

CREATE INDEX idx_cotizaciones_org_tipo_doc ON public.cotizaciones USING btree (organization_id, tipo_documento);

CREATE INDEX idx_cotizaciones_prospecto_trgm ON public.cotizaciones USING gin (prospecto_empresa gin_trgm_ops);

CREATE INDEX idx_cotizaciones_tarifa_id ON public.cotizaciones USING btree (tarifa_id);

CREATE UNIQUE INDEX uq_cotizaciones_embarque_id ON public.cotizaciones USING btree (embarque_id) WHERE (embarque_id IS NOT NULL);

CREATE UNIQUE INDEX uq_cotizaciones_org_folio ON public.cotizaciones USING btree (organization_id, folio) WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX ux_cotizaciones_ganadora_viva_por_oportunidad ON public.cotizaciones USING btree (organization_id, oportunidad_id) WHERE ((deleted_at IS NULL) AND (oportunidad_id IS NOT NULL) AND (estado = ANY (ARRAY['Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion])));

CREATE INDEX crm_empresas_org_estado_idx ON public.crm_empresas USING btree (organization_id, estado_crm);

CREATE INDEX idx_crm_etapas_org ON public.crm_etapas_pipeline USING btree (organization_id, orden);

CREATE INDEX idx_crm_historial_etapas_op ON public.crm_historial_etapas USING btree (oportunidad_id, created_at DESC);

CREATE INDEX idx_crm_historial_etapas_org ON public.crm_historial_etapas USING btree (organization_id, created_at DESC);

CREATE INDEX idx_crm_leads_estado ON public.crm_leads USING btree (estado);

CREATE INDEX idx_crm_leads_org ON public.crm_leads USING btree (organization_id);

CREATE INDEX idx_crm_leads_vendedor ON public.crm_leads USING btree (vendedor_id);

CREATE INDEX idx_crm_notif_user_unread ON public.crm_notificaciones USING btree (user_id, leida_at NULLS FIRST, created_at DESC);

CREATE INDEX idx_crm_op_cliente ON public.crm_oportunidades USING btree (cliente_id);

CREATE INDEX idx_crm_op_etapa ON public.crm_oportunidades USING btree (etapa_id);

CREATE INDEX idx_crm_op_org ON public.crm_oportunidades USING btree (organization_id);

CREATE INDEX idx_crm_op_vendedor ON public.crm_oportunidades USING btree (vendedor_id);

CREATE INDEX idx_crm_oportunidades_cliente_id ON public.crm_oportunidades USING btree (cliente_id);

CREATE INDEX idx_crm_oportunidades_cot_ganadora ON public.crm_oportunidades USING btree (cotizacion_ganadora_id) WHERE (cotizacion_ganadora_id IS NOT NULL);

CREATE INDEX idx_crm_oportunidades_etapa_id ON public.crm_oportunidades USING btree (etapa_id);

CREATE INDEX idx_crm_oportunidades_lead_id ON public.crm_oportunidades USING btree (lead_id);

CREATE INDEX crm_solicitudes_pricing_estado_idx ON public.crm_solicitudes_pricing USING btree (organization_id, estado);

CREATE INDEX crm_solicitudes_pricing_op_idx ON public.crm_solicitudes_pricing USING btree (oportunidad_id);

CREATE UNIQUE INDEX embarques_cotizacion_unica_viva ON public.embarques USING btree (cotizacion_id) WHERE ((cotizacion_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX embarques_expediente_org_unico ON public.embarques USING btree (organization_id, expediente) WHERE (deleted_at IS NULL);

CREATE INDEX idx_embarques_agente_id ON public.embarques USING btree (agente_id);

CREATE INDEX idx_embarques_bl_master_trgm ON public.embarques USING gin (bl_master gin_trgm_ops);

CREATE INDEX idx_embarques_cliente_id ON public.embarques USING btree (cliente_id);

CREATE INDEX idx_embarques_cliente_nombre_trgm ON public.embarques USING gin (cliente_nombre gin_trgm_ops);

CREATE INDEX idx_embarques_contenedor_trgm ON public.embarques USING gin (contenedor gin_trgm_ops);

CREATE INDEX idx_embarques_cotizacion_id ON public.embarques USING btree (cotizacion_id);

CREATE INDEX idx_embarques_deleted_at ON public.embarques USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX idx_embarques_descripcion_trgm ON public.embarques USING gin (descripcion_mercancia gin_trgm_ops);

CREATE INDEX idx_embarques_estado ON public.embarques USING btree (estado);

CREATE INDEX idx_embarques_estado_admin_pendiente ON public.embarques USING btree (organization_id, estado) WHERE ((estado = ANY (ARRAY['Entregado'::estado_embarque, 'EIR'::estado_embarque])) AND (deleted_at IS NULL));

CREATE INDEX idx_embarques_eta ON public.embarques USING btree (eta);

CREATE INDEX idx_embarques_etd ON public.embarques USING btree (etd);

CREATE INDEX idx_embarques_expediente_trgm ON public.embarques USING gin (expediente gin_trgm_ops);

CREATE INDEX idx_embarques_facturado_historico ON public.embarques USING btree (facturado_historico) WHERE (facturado_historico = true);

CREATE INDEX idx_embarques_modo ON public.embarques USING btree (modo);

CREATE INDEX idx_embarques_naviera_id ON public.embarques USING btree (naviera_id);

CREATE INDEX idx_embarques_operador ON public.embarques USING btree (operador);

CREATE INDEX idx_embarques_org_created_at ON public.embarques USING btree (organization_id, created_at DESC);

CREATE INDEX idx_embarques_org_eta ON public.embarques USING btree (organization_id, eta);

CREATE INDEX idx_embarques_organization_id ON public.embarques USING btree (organization_id);

CREATE INDEX idx_embarques_tarifa_id ON public.embarques USING btree (tarifa_id);

CREATE INDEX idx_embarques_vendedora_id ON public.embarques USING btree (vendedora_id);

CREATE UNIQUE INDEX uq_embarques_bl_house_org ON public.embarques USING btree (organization_id, upper(bl_house)) WHERE ((bl_house IS NOT NULL) AND (bl_house <> ''::text) AND (organization_id <> '00000000-0000-0000-0000-000000000001'::uuid));

CREATE UNIQUE INDEX idx_factura_series_default ON public.factura_series USING btree (organization_id) WHERE (es_default = true);

CREATE INDEX idx_factura_series_org ON public.factura_series USING btree (organization_id);

CREATE UNIQUE INDEX facturas_numero_org_unico ON public.facturas USING btree (organization_id, numero) WHERE ((deleted_at IS NULL) AND (numero IS NOT NULL));

CREATE UNIQUE INDEX facturas_uuid_fiscal_unico ON public.facturas USING btree (organization_id, uuid_fiscal) WHERE ((uuid_fiscal IS NOT NULL) AND (deleted_at IS NULL));

CREATE INDEX idx_facturas_cancellation_pending ON public.facturas USING btree (organization_id, cancelacion_solicitada_en) WHERE (cancellation_status = ANY (ARRAY['pending'::text, 'verifying'::text]));

CREATE INDEX idx_facturas_cliente ON public.facturas USING btree (cliente_id);

CREATE INDEX idx_facturas_cliente_estado ON public.facturas USING btree (cliente_id, estado) WHERE (estado = ANY (ARRAY['Emitida'::estado_factura, 'Vencida'::estado_factura, 'Parcialmente pagada'::estado_factura, 'Pagada'::estado_factura]));

CREATE INDEX idx_facturas_cliente_id ON public.facturas USING btree (cliente_id);

CREATE INDEX idx_facturas_cliente_trgm ON public.facturas USING gin (cliente_nombre gin_trgm_ops);

CREATE INDEX idx_facturas_cotizacion_id ON public.facturas USING btree (cotizacion_id);

CREATE INDEX idx_facturas_deleted_at ON public.facturas USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX idx_facturas_embarque ON public.facturas USING btree (embarque_id);

CREATE INDEX idx_facturas_embarque_id ON public.facturas USING btree (embarque_id);

CREATE INDEX idx_facturas_facturapi_id ON public.facturas USING btree (facturapi_id) WHERE (facturapi_id IS NOT NULL);

CREATE INDEX idx_facturas_facturapi_pendiente_id ON public.facturas USING btree (facturapi_pendiente_id) WHERE (facturapi_pendiente_id IS NOT NULL);

CREATE INDEX idx_facturas_facturapi_pending ON public.facturas USING btree (organization_id, facturapi_claim_at) WHERE (facturapi_id ~~ 'PENDING:%'::text);

CREATE INDEX idx_facturas_numero_trgm ON public.facturas USING gin (numero gin_trgm_ops);

CREATE INDEX idx_facturas_org ON public.facturas USING btree (organization_id);

CREATE INDEX idx_facturas_org_estado ON public.facturas USING btree (organization_id, estado);

CREATE INDEX idx_facturas_org_estado_vencimiento ON public.facturas USING btree (organization_id, estado, fecha_vencimiento) WHERE (deleted_at IS NULL);

CREATE INDEX idx_facturas_org_vencimiento ON public.facturas USING btree (organization_id, fecha_vencimiento) WHERE (estado <> 'Pagada'::estado_factura);

CREATE INDEX idx_facturas_proforma_id ON public.facturas USING btree (proforma_id);

CREATE INDEX idx_facturas_reconciliacion_cursor ON public.facturas USING btree (reconciliacion_checked_at) WHERE (cancellation_status = ANY (ARRAY['pending'::text, 'verifying'::text]));

CREATE INDEX idx_facturas_serie ON public.facturas USING btree (serie_id);

CREATE INDEX idx_facturas_sustituida_por ON public.facturas USING btree (sustituida_por) WHERE (sustituida_por IS NOT NULL);

CREATE INDEX idx_facturas_sustituye_a ON public.facturas USING btree (sustituye_a) WHERE (sustituye_a IS NOT NULL);

CREATE UNIQUE INDEX uq_facturas_facturapi_id ON public.facturas USING btree (facturapi_id) WHERE (facturapi_id IS NOT NULL);

CREATE UNIQUE INDEX uq_facturas_proforma_moneda_viva ON public.facturas USING btree (proforma_id, moneda) WHERE ((proforma_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_facturas_sustituye_a_viva ON public.facturas USING btree (sustituye_a) WHERE ((sustituye_a IS NOT NULL) AND (estado <> 'Cancelada'::estado_factura));

CREATE INDEX idx_notif_cli_cliente ON public.notificaciones_cliente USING btree (cliente_id, created_at DESC);

CREATE INDEX idx_notif_cli_unread ON public.notificaciones_cliente USING btree (cliente_id) WHERE (leida_at IS NULL);

CREATE INDEX idx_org_members_org_id ON public.organization_members USING btree (organization_id);

CREATE INDEX idx_org_members_user ON public.organization_members USING btree (user_id);

CREATE INDEX idx_org_members_user_id ON public.organization_members USING btree (user_id);

CREATE INDEX idx_proformas_cliente ON public.proformas USING btree (cliente_id);

CREATE INDEX idx_proformas_cliente_id ON public.proformas USING btree (cliente_id);

CREATE INDEX idx_proformas_consolidada_en ON public.proformas USING btree (consolidada_en);

CREATE INDEX idx_proformas_deleted_at ON public.proformas USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX idx_proformas_embarque ON public.proformas USING btree (embarque_id);

CREATE INDEX idx_proformas_embarque_id ON public.proformas USING btree (embarque_id);

CREATE INDEX idx_proformas_embarques_ids ON public.proformas USING gin (embarques_ids);

CREATE INDEX idx_proformas_estado_aprobacion ON public.proformas USING btree (estado_aprobacion);

CREATE INDEX idx_proformas_factura_id ON public.proformas USING btree (factura_id);

CREATE INDEX idx_proformas_org ON public.proformas USING btree (organization_id);

CREATE INDEX idx_proformas_origen ON public.proformas USING btree (organization_id, origen) WHERE (origen IS NOT NULL);

CREATE INDEX idx_proformas_token_publico ON public.proformas USING btree (token_publico) WHERE (token_publico IS NOT NULL);

CREATE INDEX idx_proveedores_deleted_at ON public.proveedores USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX idx_proveedores_nombre_trgm ON public.proveedores USING gin (nombre gin_trgm_ops);

CREATE INDEX idx_proveedores_rfc_trgm ON public.proveedores USING gin (rfc gin_trgm_ops);

CREATE UNIQUE INDEX proveedores_org_rfc_unique ON public.proveedores USING btree (organization_id, upper(btrim(rfc))) WHERE ((rfc IS NOT NULL) AND (btrim(rfc) <> ''::text) AND (upper(btrim(rfc)) <> ALL (ARRAY['XEXX010101000'::text, 'XAXX010101000'::text])) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX puertos_code_uniq_idx ON public.puertos USING btree (upper(btrim(code)));

CREATE UNIQUE INDEX tipos_contenedor_code_uniq_idx ON public.tipos_contenedor USING btree (upper(btrim(code)));

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);

CREATE POLICY "Agente read own row" ON public."agente_users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Org staff manage agente_users" ON public."agente_users" AS PERMISSIVE FOR ALL TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = agente_users.organization_id) AND (om.role = ANY (ARRAY['admin'::app_role, 'admin_org'::app_role, 'gerente_operaciones'::app_role, 'coordinador_logistico'::app_role, 'ejecutivo_pricing'::app_role, 'operador'::app_role]))))))) WITH CHECK ((( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = agente_users.organization_id) AND (om.role = ANY (ARRAY['admin'::app_role, 'admin_org'::app_role, 'gerente_operaciones'::app_role, 'coordinador_logistico'::app_role, 'ejecutivo_pricing'::app_role])))))));

CREATE POLICY "Org admin bitacora" ON public."bitacora_actividad" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR ((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND (is_org_admin(( SELECT auth.uid() AS uid), organization_id) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)))));

CREATE POLICY "Scope tenant activo super admin" ON public."bitacora_actividad" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant insert bitacora" ON public."bitacora_actividad" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((usuario_id = ( SELECT auth.uid() AS uid)) AND ((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))));

CREATE POLICY "Tenant members read bitacora" ON public."bitacora_actividad" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((organization_id IN ( SELECT m.organization_id
   FROM organization_members m
  WHERE (m.user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY "Client read own client_users" ON public."client_users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Org staff read client_users" ON public."client_users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))));

CREATE POLICY "Admin catalog delete clientes" ON public."clientes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND es_admin_catalogo(( SELECT auth.uid() AS uid))));

CREATE POLICY "Cliente read own clientes" ON public."clientes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (id IN ( SELECT current_user_client_ids() AS current_user_client_ids))));

CREATE POLICY "Scope tenant activo super admin" ON public."clientes" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant read clientes" ON public."clientes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role))));

CREATE POLICY "Tenant update clientes" ON public."clientes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'contador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'contador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))));

CREATE POLICY "Tenant viewer clientes" ON public."clientes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role)));

CREATE POLICY "Scope tenant activo super admin" ON public."costeo_agentes" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "costeo_agentes_select_org" ON public."costeo_agentes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_agentes.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "costeo_agentes_write_org" ON public."costeo_agentes" AS PERMISSIVE FOR ALL TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_agentes.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_agentes.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Agente read org rutas" ON public."costeo_rutas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AS has_role) AND (organization_id = current_agente_org())));

CREATE POLICY "Scope tenant activo super admin" ON public."costeo_rutas" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "costeo_rutas_select_org" ON public."costeo_rutas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_rutas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "costeo_rutas_write_org" ON public."costeo_rutas" AS PERMISSIVE FOR ALL TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_rutas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_rutas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Agente CRUD own recargos" ON public."costeo_tarifa_recargos" AS PERMISSIVE FOR ALL TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AS has_role) AND (EXISTS ( SELECT 1
   FROM costeo_tarifas t
  WHERE ((t.id = costeo_tarifa_recargos.tarifa_id) AND (t.agente_id = ( SELECT current_agente_id() AS current_agente_id))))))) WITH CHECK ((( SELECT has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AS has_role) AND (EXISTS ( SELECT 1
   FROM costeo_tarifas t
  WHERE ((t.id = costeo_tarifa_recargos.tarifa_id) AND (t.agente_id = ( SELECT current_agente_id() AS current_agente_id)))))));

CREATE POLICY "Scope tenant activo super admin" ON public."costeo_tarifa_recargos" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "costeo_recargos_select_org" ON public."costeo_tarifa_recargos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (costeo_tarifas t
     JOIN organization_members m ON ((m.organization_id = t.organization_id)))
  WHERE ((t.id = costeo_tarifa_recargos.tarifa_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "costeo_recargos_write_org" ON public."costeo_tarifa_recargos" AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_tarifa_recargos.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_tarifa_recargos.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Agente borra solo tarifas no aprobadas" ON public."costeo_tarifas" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (((NOT has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role)) OR (estado_aprobacion = ANY (ARRAY['borrador'::text, 'rechazada'::text]))));

CREATE POLICY "Agente escribe own tarifas" ON public."costeo_tarifas" AS PERMISSIVE FOR ALL TO "authenticated" USING ((has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AND (agente_id = current_agente_id()) AND (organization_id = current_agente_org()))) WITH CHECK ((has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AND (agente_id = current_agente_id()) AND (organization_id = current_agente_org()) AND (estado_aprobacion = ANY (ARRAY['borrador'::text, 'rechazada'::text]))));

CREATE POLICY "Scope tenant activo super admin" ON public."costeo_tarifas" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "costeo_tarifas_select_org" ON public."costeo_tarifas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_tarifas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "costeo_tarifas_write_org" ON public."costeo_tarifas" AS PERMISSIVE FOR ALL TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_tarifas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_tarifas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Scope tenant activo super admin" ON public."cotizacion_costos" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant delete cotizacion_costos" ON public."cotizacion_costos" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones)));

CREATE POLICY "Tenant insert cotizacion_costos" ON public."cotizacion_costos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones)));

CREATE POLICY "Tenant read cotizacion_costos" ON public."cotizacion_costos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT puede_ver_costos_cotizacion(( SELECT auth.uid() AS uid)) AS puede_ver_costos_cotizacion) OR puede_ver_costos_cotizacion_propia(cotizacion_id, ( SELECT auth.uid() AS uid)))));

CREATE POLICY "Tenant update cotizacion_costos" ON public."cotizacion_costos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones)));

CREATE POLICY "Scope tenant activo super admin" ON public."cotizacion_versiones" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "cotizacion_versiones insert por trigger/service" ON public."cotizacion_versiones" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'ejecutivo_pricing'::app_role) AS has_role))));

CREATE POLICY "cotizacion_versiones lectura por org" ON public."cotizacion_versiones" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role))));

CREATE POLICY "Cliente read own cotizaciones" ON public."cotizaciones" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((deleted_at IS NULL) AND has_role(auth.uid(), 'cliente'::app_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids))));

CREATE POLICY "Scope tenant activo super admin" ON public."cotizaciones" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant CRUD cotizaciones" ON public."cotizaciones" AS PERMISSIVE FOR ALL TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones)));

CREATE POLICY "Tenant viewer cotizaciones" ON public."cotizaciones" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role)));

CREATE POLICY "crm_empresas_org" ON public."crm_empresas" AS PERMISSIVE FOR ALL TO "authenticated" USING ((organization_id = current_user_org_id())) WITH CHECK ((organization_id = current_user_org_id()));

CREATE POLICY "crm_empresas_tenant_restrictive" ON public."crm_empresas" AS RESTRICTIVE FOR ALL TO "authenticated" USING (rls_tenant_scope_ok(organization_id)) WITH CHECK (rls_tenant_scope_ok(organization_id));

CREATE POLICY "Scope tenant activo super admin" ON public."crm_etapas_pipeline" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant admin crm_etapas_pipeline" ON public."crm_etapas_pipeline" AS PERMISSIVE FOR ALL TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)) AND (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)) AND (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))));

CREATE POLICY "Tenant read crm_etapas_pipeline" ON public."crm_etapas_pipeline" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Lectura historial etapas de la org" ON public."crm_historial_etapas" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Scope tenant activo super admin" ON public."crm_historial_etapas" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Gestion leads in-org insert crm_leads" ON public."crm_leads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'gerente_comercial'::app_role], organization_id)));

CREATE POLICY "Gestion leads in-org select crm_leads" ON public."crm_leads" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'gerente_comercial'::app_role], organization_id)));

CREATE POLICY "Gestion leads in-org update crm_leads" ON public."crm_leads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'gerente_comercial'::app_role], organization_id))) WITH CHECK ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'gerente_comercial'::app_role], organization_id)));

CREATE POLICY "Lectura in-org crm_leads" ON public."crm_leads" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['viewer'::app_role, 'operador'::app_role], organization_id)));

CREATE POLICY "Scope tenant activo super admin" ON public."crm_leads" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Vendedor bolsa crm_leads" ON public."crm_leads" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND (vendedor_id IS NULL) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['vendedor'::app_role], organization_id)));

CREATE POLICY "Vendedor own insert crm_leads" ON public."crm_leads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND (vendedor_id = ( SELECT auth.uid() AS uid)) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['vendedor'::app_role], organization_id)));

CREATE POLICY "Vendedor own select crm_leads" ON public."crm_leads" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND (vendedor_id = ( SELECT auth.uid() AS uid)) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['vendedor'::app_role], organization_id)));

CREATE POLICY "Vendedor own update crm_leads" ON public."crm_leads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND (vendedor_id = ( SELECT auth.uid() AS uid)) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['vendedor'::app_role], organization_id))) WITH CHECK ((is_org_member(organization_id) AND rls_tenant_scope_ok(organization_id) AND (vendedor_id = ( SELECT auth.uid() AS uid)) AND has_any_role_in_org(( SELECT auth.uid() AS uid), ARRAY['vendedor'::app_role], organization_id)));

CREATE POLICY "Scope tenant activo super admin" ON public."crm_motivos_perdida" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant admin crm_motivos_perdida" ON public."crm_motivos_perdida" AS PERMISSIVE FOR ALL TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))));

CREATE POLICY "Tenant read crm_motivos_perdida" ON public."crm_motivos_perdida" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Scope tenant activo super admin" ON public."crm_notificaciones" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Staff inserta notificaciones org" ON public."crm_notificaciones" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'vendedor'::app_role) AS has_role))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Super admin lee todas notificaciones" ON public."crm_notificaciones" AS PERMISSIVE FOR SELECT TO "authenticated" USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role));

CREATE POLICY "Usuario lee sus notificaciones" ON public."crm_notificaciones" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) AND (organization_id = ( SELECT current_user_org_id() AS current_user_org_id))));

CREATE POLICY "Usuario marca leida su notificacion" ON public."crm_notificaciones" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) AND (organization_id = ( SELECT current_user_org_id() AS current_user_org_id)))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (organization_id = ( SELECT current_user_org_id() AS current_user_org_id))));

CREATE POLICY "Scope tenant activo super admin" ON public."crm_oportunidades" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Staff CRUD crm_oportunidades" ON public."crm_oportunidades" AS PERMISSIVE FOR ALL TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))));

CREATE POLICY "Tenant viewer crm_oportunidades" ON public."crm_oportunidades" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role)));

CREATE POLICY "Vendedor own crm_oportunidades" ON public."crm_oportunidades" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'vendedor'::app_role) AS has_role) AND (vendedor_id = ( SELECT auth.uid() AS uid)))) WITH CHECK (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'vendedor'::app_role) AS has_role) AND (vendedor_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "crm_sol_pricing_crear" ON public."crm_solicitudes_pricing" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((organization_id = org_scope()) AND (estado = 'borrador'::text)));

CREATE POLICY "crm_sol_pricing_editar" ON public."crm_solicitudes_pricing" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((organization_id = org_scope()) AND (((estado = 'borrador'::text) AND (created_by = auth.uid())) OR _crm_es_pricing(organization_id)))) WITH CHECK ((organization_id = org_scope()));

CREATE POLICY "crm_sol_pricing_leer" ON public."crm_solicitudes_pricing" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((organization_id = org_scope()));

CREATE POLICY "crm_solicitudes_pricing_tenant_restrictive" ON public."crm_solicitudes_pricing" AS RESTRICTIVE FOR ALL TO "authenticated" USING (rls_tenant_scope_ok(organization_id)) WITH CHECK (rls_tenant_scope_ok(organization_id));

CREATE POLICY "Agente read own embarques" ON public."embarques" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AS has_role) AND (organization_id = current_agente_org()) AND (agente_id IS NOT NULL) AND (agente_id = current_agente_id())));

CREATE POLICY "Cliente read own embarques" ON public."embarques" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((deleted_at IS NULL) AND has_role(auth.uid(), 'cliente'::app_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids))));

CREATE POLICY "Scope tenant activo super admin" ON public."embarques" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant delete embarques" ON public."embarques" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'operador'::app_role, 'super_admin'::app_role]) AS has_any_role)));

CREATE POLICY "Tenant read embarques" ON public."embarques" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role(( SELECT auth.uid() AS uid), ARRAY['viewer'::app_role]) AS has_any_role)));

CREATE POLICY "Tenant update embarques" ON public."embarques" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'operador'::app_role, 'super_admin'::app_role]) AS has_any_role))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'operador'::app_role, 'super_admin'::app_role]) AS has_any_role)));

CREATE POLICY "Tenant write embarques" ON public."embarques" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'operador'::app_role, 'super_admin'::app_role]) AS has_any_role)));

CREATE POLICY "Scope tenant activo super admin" ON public."factura_series" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant manage factura_series" ON public."factura_series" AS PERMISSIVE FOR ALL TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))));

CREATE POLICY "Tenant read factura_series" ON public."factura_series" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Cliente read own facturas" ON public."facturas" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((deleted_at IS NULL) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids))));

CREATE POLICY "Scope tenant activo super admin" ON public."facturas" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant read facturas" ON public."facturas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role(( SELECT auth.uid() AS uid), ARRAY['viewer'::app_role]) AS has_any_role)));

CREATE POLICY "Tenant update facturas" ON public."facturas" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role, 'super_admin'::app_role]) AS has_any_role))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role, 'super_admin'::app_role]) AS has_any_role)));

CREATE POLICY "Tenant write facturas" ON public."facturas" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role, 'super_admin'::app_role]) AS has_any_role)));

CREATE POLICY "Scope tenant activo super admin" ON public."folio_secuencias" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "folio_secuencias lectura org" ON public."folio_secuencias" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)));

CREATE POLICY "Autenticados pueden leer navieras" ON public."navieras" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Super admin CRUD navieras" ON public."navieras" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role));

CREATE POLICY "Cliente lee sus notificaciones" ON public."notificaciones_cliente" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids))));

CREATE POLICY "Cliente marca leida su notificacion" ON public."notificaciones_cliente" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids)))) WITH CHECK ((( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids))));

CREATE POLICY "Scope tenant activo super admin" ON public."notificaciones_cliente" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant staff inserta notificaciones" ON public."notificaciones_cliente" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR (organization_id IN ( SELECT m.organization_id
   FROM organization_members m
  WHERE (m.user_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM clientes c
  WHERE ((c.id = notificaciones_cliente.cliente_id) AND (c.organization_id = notificaciones_cliente.organization_id))))));

CREATE POLICY "Tenant staff lee notificaciones" ON public."notificaciones_cliente" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR (organization_id IN ( SELECT m.organization_id
   FROM organization_members m
  WHERE (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Org admins manage own org members" ON public."organization_members" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_org_admin(( SELECT auth.uid() AS uid), organization_id)) WITH CHECK (is_org_admin(( SELECT auth.uid() AS uid), organization_id));

CREATE POLICY "Super admins manage members" ON public."organization_members" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role));

CREATE POLICY "Users read own memberships" ON public."organization_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Client read own org" ON public."organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (id IN ( SELECT client_users.organization_id
   FROM client_users
  WHERE (client_users.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Members can read own org" ON public."organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((id IN ( SELECT get_user_org_ids(( SELECT auth.uid() AS uid)) AS get_user_org_ids)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Super admins manage organizations" ON public."organizations" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role));

CREATE POLICY "Cliente read own proformas" ON public."proformas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids))));

CREATE POLICY "Scope tenant activo super admin" ON public."proformas" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant delete proformas" ON public."proformas" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role, 'super_admin'::app_role]) AS has_any_role)));

CREATE POLICY "Tenant read proformas" ON public."proformas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role(( SELECT auth.uid() AS uid), ARRAY['viewer'::app_role, 'vendedor'::app_role]) AS has_any_role)));

CREATE POLICY "Tenant update proformas" ON public."proformas" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role, 'super_admin'::app_role]) AS has_any_role))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role, 'super_admin'::app_role]) AS has_any_role)));

CREATE POLICY "Tenant write proformas" ON public."proformas" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_any_role_efectivo(( SELECT auth.uid() AS uid), ARRAY['admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role, 'super_admin'::app_role]) AS has_any_role)));

CREATE POLICY "Admin catalog delete proveedores" ON public."proveedores" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND es_admin_catalogo(( SELECT auth.uid() AS uid))));

CREATE POLICY "Scope tenant activo super admin" ON public."proveedores" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))) WITH CHECK (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)));

CREATE POLICY "Tenant read proveedores" ON public."proveedores" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));

CREATE POLICY "Tenant update proveedores" ON public."proveedores" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'contador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'contador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))));

CREATE POLICY "Tenant viewer proveedores" ON public."proveedores" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role)));

CREATE POLICY "Tenant write proveedores" ON public."proveedores" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'contador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))));

CREATE POLICY "Autenticados pueden leer puertos" ON public."puertos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Super admin CRUD puertos" ON public."puertos" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role));

CREATE POLICY "Super admin maneja su tenant activo" ON public."super_admin_org_activa" AS PERMISSIVE FOR ALL TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)));

CREATE POLICY "Autenticados pueden leer tipos_contenedor" ON public."tipos_contenedor" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Super admin CRUD tipos_contenedor" ON public."tipos_contenedor" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role));

CREATE POLICY "Super admins manage all roles" ON public."user_roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role));

CREATE POLICY "Users can view own roles" ON public."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE TRIGGER trg_bitacora_normalizar_modulo BEFORE INSERT OR UPDATE OF modulo ON bitacora_actividad FOR EACH ROW EXECUTE FUNCTION _bitacora_normalizar_modulo();

ALTER TABLE public."bitacora_actividad" ENABLE TRIGGER "trg_bitacora_normalizar_modulo";

CREATE TRIGGER costeo_tarifas_match_agente_org_trg BEFORE INSERT OR UPDATE OF organization_id, agente_id ON costeo_tarifas FOR EACH ROW EXECUTE FUNCTION costeo_tarifas_match_agente_org();

ALTER TABLE public."costeo_tarifas" ENABLE TRIGGER "costeo_tarifas_match_agente_org_trg";

CREATE TRIGGER trg_costeo_tarifa_solicitud_guard BEFORE INSERT OR UPDATE ON costeo_tarifas FOR EACH ROW EXECUTE FUNCTION _costeo_tarifa_solicitud_guard();

ALTER TABLE public."costeo_tarifas" ENABLE TRIGGER "trg_costeo_tarifa_solicitud_guard";

CREATE TRIGGER trg_costeo_tarifas_agente_force_borrador BEFORE INSERT OR UPDATE ON costeo_tarifas FOR EACH ROW EXECUTE FUNCTION costeo_tarifas_agente_force_borrador();

ALTER TABLE public."costeo_tarifas" ENABLE TRIGGER "trg_costeo_tarifas_agente_force_borrador";

CREATE TRIGGER trg_costeo_tarifas_estado_derivado BEFORE INSERT OR UPDATE OF estado, vigente_desde, vigente_hasta ON costeo_tarifas FOR EACH ROW EXECUTE FUNCTION trg_costeo_tarifas_estado_derivado();

ALTER TABLE public."costeo_tarifas" ENABLE TRIGGER "trg_costeo_tarifas_estado_derivado";

CREATE TRIGGER trg_costeo_tarifas_marcar_reemplazadas AFTER INSERT OR UPDATE OF estado, estado_aprobacion ON costeo_tarifas FOR EACH ROW EXECUTE FUNCTION costeo_tarifas_marcar_reemplazadas();

ALTER TABLE public."costeo_tarifas" ENABLE TRIGGER "trg_costeo_tarifas_marcar_reemplazadas";

CREATE TRIGGER trg_costeo_tarifas_updated BEFORE UPDATE ON costeo_tarifas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public."costeo_tarifas" ENABLE TRIGGER "trg_costeo_tarifas_updated";

CREATE TRIGGER trg_guard_soft_delete BEFORE UPDATE ON cotizacion_costos FOR EACH ROW EXECUTE FUNCTION _guard_soft_delete();

ALTER TABLE public."cotizacion_costos" ENABLE TRIGGER "trg_guard_soft_delete";

CREATE TRIGGER trg_org_cotizacion_costos_cotizacion_id BEFORE INSERT OR UPDATE OF cotizacion_id, organization_id ON cotizacion_costos FOR EACH ROW EXECUTE FUNCTION _assert_padre_misma_org('cotizacion_id', 'cotizaciones');

ALTER TABLE public."cotizacion_costos" ENABLE TRIGGER "trg_org_cotizacion_costos_cotizacion_id";

CREATE TRIGGER update_cotizacion_costos_updated_at BEFORE UPDATE ON cotizacion_costos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public."cotizacion_costos" ENABLE TRIGGER "update_cotizacion_costos_updated_at";

CREATE TRIGGER notificar_cotizacion_enviada AFTER UPDATE OF estado ON cotizaciones FOR EACH ROW EXECUTE FUNCTION trg_notificar_cotizacion_enviada();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "notificar_cotizacion_enviada";

CREATE TRIGGER trg_cotizacion_oportunidad_misma_org BEFORE INSERT OR UPDATE OF oportunidad_id, organization_id ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _cotizacion_oportunidad_misma_org();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizacion_oportunidad_misma_org";

CREATE TRIGGER trg_cotizaciones_bloquear_envio_sin_importes BEFORE UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _cotizaciones_bloquear_envio_sin_importes();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizaciones_bloquear_envio_sin_importes";

CREATE TRIGGER trg_cotizaciones_envio_sin_oportunidad BEFORE UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _cotizaciones_bloquear_envio_sin_oportunidad();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizaciones_envio_sin_oportunidad";

CREATE TRIGGER trg_cotizaciones_guard_en_operacion BEFORE UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION cotizaciones_guard_en_operacion();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizaciones_guard_en_operacion";

CREATE TRIGGER trg_cotizaciones_sod_aceptacion BEFORE UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _cotizaciones_bloquear_auto_aceptacion();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizaciones_sod_aceptacion";

CREATE TRIGGER trg_cotizaciones_subtotal_server BEFORE INSERT OR UPDATE OF conceptos_venta, moneda ON cotizaciones FOR EACH ROW EXECUTE FUNCTION trg_cotizacion_subtotal_server();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizaciones_subtotal_server";

CREATE TRIGGER trg_cotizaciones_sync_puertos_tarifa BEFORE INSERT OR UPDATE OF modo, tarifa_id, puerto_origen_id, puerto_destino_id ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _cotizaciones_sync_puertos_tarifa();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizaciones_sync_puertos_tarifa";

CREATE TRIGGER trg_cotizaciones_sync_vigencia BEFORE INSERT OR UPDATE OF validez_propuesta, vigencia_dias, fecha_vigencia ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _cotizaciones_sync_vigencia();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizaciones_sync_vigencia";

CREATE TRIGGER trg_cotizaciones_validar_prospecto BEFORE INSERT OR UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _cotizaciones_validar_prospecto();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_cotizaciones_validar_prospecto";

CREATE TRIGGER trg_crm_lead_avanzar_por_cotizacion AFTER UPDATE OF estado ON cotizaciones FOR EACH ROW WHEN (old.estado IS DISTINCT FROM new.estado) EXECUTE FUNCTION _crm_lead_avanzar_por_cotizacion();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_crm_lead_avanzar_por_cotizacion";

CREATE TRIGGER trg_crm_sync_oportunidad_desde_cotizacion AFTER INSERT OR UPDATE OF subtotal, moneda, cliente_id, oportunidad_id ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _crm_sync_oportunidad_desde_cotizacion();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_crm_sync_oportunidad_desde_cotizacion";

CREATE TRIGGER trg_guard_cotizacion_vinculo_cliente BEFORE INSERT OR UPDATE OF cliente_id, es_prospecto, organization_id ON cotizaciones FOR EACH ROW EXECUTE FUNCTION guard_cotizacion_vinculo_cliente();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_guard_cotizacion_vinculo_cliente";

CREATE TRIGGER trg_guard_estado_cotizacion BEFORE UPDATE OF estado ON cotizaciones FOR EACH ROW WHEN (old.estado IS DISTINCT FROM new.estado) EXECUTE FUNCTION guard_estado_cotizacion();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_guard_estado_cotizacion";

CREATE TRIGGER trg_guard_soft_delete BEFORE UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _guard_soft_delete();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_guard_soft_delete";

CREATE TRIGGER trg_snapshot_cotizacion_al_enviar AFTER UPDATE OF estado ON cotizaciones FOR EACH ROW EXECUTE FUNCTION snapshot_cotizacion_al_enviar();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_snapshot_cotizacion_al_enviar";

CREATE TRIGGER trg_validate_cotizacion_informativa BEFORE INSERT OR UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION validate_cotizacion_informativa();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "trg_validate_cotizacion_informativa";

CREATE TRIGGER update_cotizaciones_updated_at BEFORE UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "update_cotizaciones_updated_at";

CREATE TRIGGER zz_crm_cerrar_oportunidad_desde_cotizacion BEFORE INSERT OR UPDATE OF estado, embarque_id, oportunidad_id, organization_id, deleted_at ON cotizaciones FOR EACH ROW EXECUTE FUNCTION crm_cerrar_oportunidad_desde_cotizacion();

ALTER TABLE public."cotizaciones" ENABLE TRIGGER "zz_crm_cerrar_oportunidad_desde_cotizacion";

CREATE TRIGGER trg_crm_empresa_estado_por_cliente BEFORE INSERT OR UPDATE OF cliente_id ON crm_empresas FOR EACH ROW EXECUTE FUNCTION _crm_empresa_estado_por_cliente();

ALTER TABLE public."crm_empresas" ENABLE TRIGGER "trg_crm_empresa_estado_por_cliente";

CREATE TRIGGER trg_crm_lead_sync_estado_empresa AFTER UPDATE OF estado ON crm_leads FOR EACH ROW WHEN (new.estado IS DISTINCT FROM old.estado) EXECUTE FUNCTION _crm_lead_sync_estado_empresa();

ALTER TABLE public."crm_leads" ENABLE TRIGGER "trg_crm_lead_sync_estado_empresa";

CREATE TRIGGER trg_crm_leads_updated_at BEFORE UPDATE ON crm_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public."crm_leads" ENABLE TRIGGER "trg_crm_leads_updated_at";

CREATE TRIGGER trg_guard_crm_lead_estado_canonico BEFORE INSERT OR UPDATE OF estado ON crm_leads FOR EACH ROW EXECUTE FUNCTION guard_crm_lead_estado_canonico();

ALTER TABLE public."crm_leads" ENABLE TRIGGER "trg_guard_crm_lead_estado_canonico";

CREATE TRIGGER trg_guard_soft_delete BEFORE UPDATE ON crm_leads FOR EACH ROW EXECUTE FUNCTION _guard_soft_delete();

ALTER TABLE public."crm_leads" ENABLE TRIGGER "trg_guard_soft_delete";

CREATE TRIGGER update_crm_notificaciones_updated_at BEFORE UPDATE ON crm_notificaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public."crm_notificaciones" ENABLE TRIGGER "update_crm_notificaciones_updated_at";

CREATE TRIGGER trg_crm_etapa_motivo_misma_org BEFORE INSERT OR UPDATE OF etapa_id, motivo_perdida_id, organization_id ON crm_oportunidades FOR EACH ROW EXECUTE FUNCTION _crm_oportunidad_etapa_motivo_misma_org();

ALTER TABLE public."crm_oportunidades" ENABLE TRIGGER "trg_crm_etapa_motivo_misma_org";

CREATE TRIGGER trg_crm_op_updated_at BEFORE UPDATE ON crm_oportunidades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public."crm_oportunidades" ENABLE TRIGGER "trg_crm_op_updated_at";

CREATE TRIGGER trg_crm_oportunidad_requiere_origen BEFORE INSERT OR UPDATE OF lead_id, cliente_id, organization_id ON crm_oportunidades FOR EACH ROW EXECUTE FUNCTION _crm_oportunidad_requiere_origen();

ALTER TABLE public."crm_oportunidades" ENABLE TRIGGER "trg_crm_oportunidad_requiere_origen";

CREATE TRIGGER trg_crm_probabilidad_terminal BEFORE INSERT OR UPDATE OF etapa_id, probabilidad ON crm_oportunidades FOR EACH ROW EXECUTE FUNCTION _crm_probabilidad_terminal();

ALTER TABLE public."crm_oportunidades" ENABLE TRIGGER "trg_crm_probabilidad_terminal";

CREATE TRIGGER trg_crm_registrar_cambio_etapa BEFORE UPDATE ON crm_oportunidades FOR EACH ROW EXECUTE FUNCTION _crm_registrar_cambio_etapa();

ALTER TABLE public."crm_oportunidades" ENABLE TRIGGER "trg_crm_registrar_cambio_etapa";

CREATE TRIGGER trg_crm_validar_motivo_perdida BEFORE INSERT OR UPDATE OF etapa_id, motivo_perdida_id ON crm_oportunidades FOR EACH ROW EXECUTE FUNCTION _crm_validar_motivo_perdida();

ALTER TABLE public."crm_oportunidades" ENABLE TRIGGER "trg_crm_validar_motivo_perdida";

CREATE TRIGGER trg_guard_soft_delete BEFORE UPDATE ON crm_oportunidades FOR EACH ROW EXECUTE FUNCTION _guard_soft_delete();

ALTER TABLE public."crm_oportunidades" ENABLE TRIGGER "trg_guard_soft_delete";

CREATE TRIGGER trg_crm_sol_pricing_ins BEFORE INSERT ON crm_solicitudes_pricing FOR EACH ROW EXECUTE FUNCTION _crm_sol_pricing_before_ins();

ALTER TABLE public."crm_solicitudes_pricing" ENABLE TRIGGER "trg_crm_sol_pricing_ins";

CREATE TRIGGER trg_crm_sol_pricing_upd BEFORE UPDATE ON crm_solicitudes_pricing FOR EACH ROW EXECUTE FUNCTION _crm_sol_pricing_before_upd();

ALTER TABLE public."crm_solicitudes_pricing" ENABLE TRIGGER "trg_crm_sol_pricing_upd";

CREATE TRIGGER trg_notif_cliente_validar BEFORE INSERT OR UPDATE OF cliente_id, organization_id, embarque_id, factura_id, url ON notificaciones_cliente FOR EACH ROW EXECUTE FUNCTION _notif_cliente_validar();

ALTER TABLE public."notificaciones_cliente" ENABLE TRIGGER "trg_notif_cliente_validar";

REVOKE ALL ON TABLE public."agente_users" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."agente_users" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."agente_users" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."agente_users" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."agente_users" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."agente_users" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."agente_users" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."agente_users" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."bitacora_actividad" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."bitacora_actividad" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."bitacora_actividad" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."bitacora_actividad" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."bitacora_actividad" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."bitacora_actividad" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."bitacora_actividad" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."bitacora_actividad" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."client_users" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."client_users" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."client_users" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."client_users" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."client_users" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."client_users" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."client_users" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."client_users" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."clientes" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."clientes" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."clientes" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."clientes" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."clientes" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."clientes" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."clientes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."clientes" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."costeo_agentes" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_agentes" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_agentes" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_agentes" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_agentes" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."costeo_agentes" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."costeo_agentes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."costeo_agentes" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."costeo_rutas" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_rutas" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_rutas" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_rutas" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_rutas" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."costeo_rutas" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."costeo_rutas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."costeo_rutas" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."costeo_tarifa_recargos" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_tarifa_recargos" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_tarifa_recargos" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_tarifa_recargos" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_tarifa_recargos" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."costeo_tarifa_recargos" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."costeo_tarifa_recargos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."costeo_tarifa_recargos" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."costeo_tarifas" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_tarifas" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_tarifas" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_tarifas" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."costeo_tarifas" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."costeo_tarifas" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."costeo_tarifas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."costeo_tarifas" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."cotizacion_costos" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizacion_costos" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizacion_costos" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizacion_costos" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizacion_costos" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."cotizacion_costos" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."cotizacion_costos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cotizacion_costos" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."cotizacion_versiones" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizacion_versiones" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizacion_versiones" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizacion_versiones" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizacion_versiones" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."cotizacion_versiones" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."cotizacion_versiones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cotizacion_versiones" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."cotizaciones" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizaciones" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizaciones" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizaciones" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."cotizaciones" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."cotizaciones" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."cotizaciones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cotizaciones" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."crm_empresas" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_empresas" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_empresas" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_empresas" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_empresas" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."crm_empresas" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."crm_empresas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_empresas" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."crm_etapas_pipeline" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_etapas_pipeline" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_etapas_pipeline" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_etapas_pipeline" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_etapas_pipeline" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."crm_etapas_pipeline" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."crm_etapas_pipeline" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_etapas_pipeline" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."crm_historial_etapas" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_historial_etapas" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_historial_etapas" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_historial_etapas" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_historial_etapas" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."crm_historial_etapas" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."crm_historial_etapas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_historial_etapas" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."crm_leads" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_leads" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_leads" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."crm_leads" TO "sandbox_exec";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE public."crm_leads" TO "authenticated";

RESET ROLE;

ALTER TABLE public."crm_leads" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_leads" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."crm_motivos_perdida" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_motivos_perdida" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_motivos_perdida" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_motivos_perdida" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_motivos_perdida" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."crm_motivos_perdida" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."crm_motivos_perdida" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_motivos_perdida" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."crm_notificaciones" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_notificaciones" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_notificaciones" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_notificaciones" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_notificaciones" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."crm_notificaciones" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."crm_notificaciones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_notificaciones" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."crm_oportunidades" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_oportunidades" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_oportunidades" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_oportunidades" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_oportunidades" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."crm_oportunidades" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."crm_oportunidades" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_oportunidades" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."crm_solicitudes_pricing" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_solicitudes_pricing" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_solicitudes_pricing" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_solicitudes_pricing" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."crm_solicitudes_pricing" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."crm_solicitudes_pricing" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."crm_solicitudes_pricing" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_solicitudes_pricing" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."embarques" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."embarques" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."embarques" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."embarques" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."embarques" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."embarques" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."factura_series" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."factura_series" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."factura_series" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."factura_series" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."factura_series" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."factura_series" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."factura_series" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."factura_series" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."facturas" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."facturas" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."facturas" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."facturas" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."facturas" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."facturas" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."facturas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."facturas" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."folio_secuencias" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."folio_secuencias" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."folio_secuencias" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."folio_secuencias" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."folio_secuencias" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."folio_secuencias" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."folio_secuencias" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."folio_secuencias" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."navieras" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."navieras" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."navieras" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."navieras" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."navieras" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."navieras" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."navieras" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."navieras" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."notificaciones_cliente" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."notificaciones_cliente" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."notificaciones_cliente" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."notificaciones_cliente" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."notificaciones_cliente" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."notificaciones_cliente" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."notificaciones_cliente" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."notificaciones_cliente" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."organization_members" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."organization_members" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."organization_members" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."organization_members" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."organization_members" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."organization_members" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."organization_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."organization_members" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."organizations" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."organizations" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."organizations" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."organizations" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."organizations" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."organizations" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."organizations" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."proformas" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."proformas" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."proformas" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."proformas" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."proformas" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."proformas" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."proformas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."proformas" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."proveedores" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."proveedores" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."proveedores" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."proveedores" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."proveedores" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."proveedores" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."proveedores" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."proveedores" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."puertos" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."puertos" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."puertos" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."puertos" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."puertos" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."puertos" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."puertos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."puertos" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."super_admin_org_activa" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."super_admin_org_activa" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."super_admin_org_activa" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."super_admin_org_activa" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."super_admin_org_activa" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."super_admin_org_activa" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."super_admin_org_activa" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."super_admin_org_activa" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."tipos_contenedor" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."tipos_contenedor" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."tipos_contenedor" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."tipos_contenedor" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."tipos_contenedor" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."tipos_contenedor" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."tipos_contenedor" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."tipos_contenedor" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."user_roles" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."user_roles" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."user_roles" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."user_roles" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public."user_roles" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT INSERT, SELECT ON TABLE public."user_roles" TO "sandbox_exec";

RESET ROLE;

ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."user_roles" NO FORCE ROW LEVEL SECURITY;

SET LOCAL ROLE "postgres";

GRANT SELECT ("id") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("id") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("expediente") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("expediente") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cliente_id") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cliente_id") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cliente_nombre") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cliente_nombre") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("modo") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("modo") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("shipper") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("shipper") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("consignatario") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("consignatario") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("descripcion_mercancia") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("descripcion_mercancia") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("peso_kg") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("peso_kg") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("volumen_m3") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("volumen_m3") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("piezas") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("piezas") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("incoterm") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("incoterm") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("estado") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("estado") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("operador") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("operador") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("puerto_origen") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("puerto_origen") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("puerto_destino") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("puerto_destino") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("naviera") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("naviera") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("bl_master") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("bl_master") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("bl_house") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("bl_house") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_servicio") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_servicio") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("contenedor") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("contenedor") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_contenedor") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_contenedor") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("aeropuerto_origen") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("aeropuerto_origen") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("aeropuerto_destino") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("aeropuerto_destino") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("aerolinea") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("aerolinea") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("mawb") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("mawb") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("hawb") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("hawb") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("ciudad_origen") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("ciudad_origen") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("ciudad_destino") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("ciudad_destino") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("transportista") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("transportista") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("carta_porte") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("carta_porte") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("etd") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("etd") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("eta") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("eta") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("fecha_llegada_real") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("fecha_llegada_real") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("fecha_creacion") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("fecha_creacion") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_cambio_usd") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_cambio_usd") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_cambio_eur") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_cambio_eur") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("created_at") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("created_at") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("updated_at") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("updated_at") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_carga") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tipo_carga") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("msds_archivo") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("msds_archivo") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("agente") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("agente") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cotizacion_id") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cotizacion_id") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("organization_id") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("organization_id") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tiene_proforma") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tiene_proforma") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("etd_original") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("etd_original") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("eta_original") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("eta_original") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("deleted_at") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("deleted_at") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("deleted_by") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("deleted_by") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("created_by") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("created_by") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("vendedora_id") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("vendedora_id") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_id") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_id") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("carta_garantia") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("carta_garantia") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("dias_libres_destino") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("dias_libres_destino") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("dias_almacenaje") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("dias_almacenaje") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("seguro") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("seguro") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("valor_seguro_usd") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("valor_seguro_usd") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("notas") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("notas") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cerrado_at") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cerrado_at") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cerrado_por") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cerrado_por") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("reabierto_at") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("reabierto_at") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("reabierto_por") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("reabierto_por") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_id_original") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_id_original") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_id_aplicada") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_id_aplicada") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_decision") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_decision") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_revalidada_en") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_revalidada_en") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_revalidada_por") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("tarifa_revalidada_por") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("facturado_historico") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("facturado_historico") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cobro_cliente_status") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cobro_cliente_status") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cobro_cliente_actualizado_at") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("cobro_cliente_actualizado_at") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("agente_id") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("agente_id") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("naviera_id") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("naviera_id") ON TABLE public."embarques" TO "anon";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("sin_comision") ON TABLE public."embarques" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT SELECT ("sin_comision") ON TABLE public."embarques" TO "anon";

RESET ROLE;

ALTER FUNCTION public._assert_padre_misma_org() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._assert_padre_misma_org() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._assert_padre_misma_org() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._assert_padre_misma_org() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._bitacora_normalizar_modulo() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._bitacora_normalizar_modulo() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._bitacora_normalizar_modulo() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._bitacora_normalizar_modulo() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._bitacora_normalizar_modulo() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._costeo_tarifa_solicitud_guard() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._costeo_tarifa_solicitud_guard() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._costeo_tarifa_solicitud_guard() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._costeo_tarifa_solicitud_guard() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._costeo_tarifa_solicitud_guard() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._costeo_tarifa_solicitud_guard() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._cotizacion_oportunidad_misma_org() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._cotizacion_oportunidad_misma_org() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizacion_oportunidad_misma_org() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizacion_oportunidad_misma_org() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._cotizaciones_bloquear_auto_aceptacion() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._cotizaciones_bloquear_envio_sin_importes() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._cotizaciones_bloquear_envio_sin_importes() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_envio_sin_importes() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_envio_sin_importes() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_envio_sin_importes() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._cotizaciones_bloquear_envio_sin_oportunidad() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._cotizaciones_bloquear_envio_sin_oportunidad() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_envio_sin_oportunidad() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_envio_sin_oportunidad() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._cotizaciones_sync_puertos_tarifa() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._cotizaciones_sync_puertos_tarifa() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_sync_puertos_tarifa() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_sync_puertos_tarifa() TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_sync_puertos_tarifa() TO "authenticated";

RESET ROLE;

ALTER FUNCTION public._cotizaciones_sync_vigencia() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._cotizaciones_sync_vigencia() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_sync_vigencia() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_sync_vigencia() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_sync_vigencia() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_sync_vigencia() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._cotizaciones_validar_prospecto() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._cotizaciones_validar_prospecto() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_validar_prospecto() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_validar_prospecto() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_validar_prospecto() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._cotizaciones_validar_prospecto() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_empresa_estado_por_cliente() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_empresa_estado_por_cliente() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_empresa_estado_por_cliente() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_empresa_estado_por_cliente() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_empresa_estado_por_cliente() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_empresa_estado_por_cliente() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_es_pricing(uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_es_pricing(uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_es_pricing(uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_es_pricing(uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_es_pricing(uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_folio_pricing_prefijo(timestamp with time zone) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_folio_pricing_prefijo(timestamp with time zone) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_folio_pricing_prefijo(timestamp with time zone) TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_folio_pricing_prefijo(timestamp with time zone) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_folio_pricing_prefijo(timestamp with time zone) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_folio_pricing_prefijo(timestamp with time zone) TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_lead_avanzar_por_cotizacion() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_lead_avanzar_por_cotizacion() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_lead_avanzar_por_cotizacion() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_lead_avanzar_por_cotizacion() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_lead_avanzar_por_cotizacion() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_lead_sync_estado_empresa() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_lead_sync_estado_empresa() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_lead_sync_estado_empresa() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_lead_sync_estado_empresa() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_oportunidad_etapa_motivo_misma_org() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_oportunidad_etapa_motivo_misma_org() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_oportunidad_etapa_motivo_misma_org() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_oportunidad_etapa_motivo_misma_org() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_oportunidad_requiere_origen() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_oportunidad_requiere_origen() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_oportunidad_requiere_origen() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_oportunidad_requiere_origen() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_probabilidad_terminal() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_probabilidad_terminal() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_probabilidad_terminal() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_probabilidad_terminal() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_registrar_cambio_etapa() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_registrar_cambio_etapa() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_registrar_cambio_etapa() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_registrar_cambio_etapa() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_registrar_cambio_etapa() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_sol_pricing_before_ins() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_sol_pricing_before_ins() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_sol_pricing_before_ins() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_sol_pricing_before_ins() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_sol_pricing_before_upd() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_sol_pricing_before_upd() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_sol_pricing_before_upd() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_sol_pricing_before_upd() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_sol_pricing_before_upd() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_sol_pricing_before_upd() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_sync_oportunidad_desde_cotizacion() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_sync_oportunidad_desde_cotizacion() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_sync_oportunidad_desde_cotizacion() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_sync_oportunidad_desde_cotizacion() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._crm_validar_motivo_perdida() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._crm_validar_motivo_perdida() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_validar_motivo_perdida() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_validar_motivo_perdida() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._crm_validar_motivo_perdida() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._guard_soft_delete() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._guard_soft_delete() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._guard_soft_delete() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._guard_soft_delete() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._guard_soft_delete() TO "service_role";

RESET ROLE;

ALTER FUNCTION public._notif_cliente_validar() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._notif_cliente_validar() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._notif_cliente_validar() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._notif_cliente_validar() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public._notif_cliente_validar() TO "service_role";

RESET ROLE;

ALTER FUNCTION auth.jwt() OWNER TO "supabase_auth_admin";

REVOKE ALL ON FUNCTION auth.jwt() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.jwt() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.jwt() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.jwt() TO "supabase_auth_admin";

RESET ROLE;

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.jwt() TO "dashboard_user";

RESET ROLE;

ALTER FUNCTION auth.role() OWNER TO "supabase_auth_admin";

REVOKE ALL ON FUNCTION auth.role() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.role() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.role() TO "supabase_auth_admin";

RESET ROLE;

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.role() TO "dashboard_user";

RESET ROLE;

ALTER FUNCTION auth.uid() OWNER TO "supabase_auth_admin";

REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.uid() TO "supabase_auth_admin";

RESET ROLE;

SET LOCAL ROLE "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION auth.uid() TO "dashboard_user";

RESET ROLE;

ALTER FUNCTION public.costeo_tarifa_estado_actual(text,date) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.costeo_tarifa_estado_actual(text,date) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifa_estado_actual(text,date) TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifa_estado_actual(text,date) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifa_estado_actual(text,date) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifa_estado_actual(text,date) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.costeo_tarifas_agente_force_borrador() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.costeo_tarifas_agente_force_borrador() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_agente_force_borrador() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_agente_force_borrador() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_agente_force_borrador() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.costeo_tarifas_marcar_reemplazadas() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.costeo_tarifas_marcar_reemplazadas() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_marcar_reemplazadas() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_marcar_reemplazadas() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_marcar_reemplazadas() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.costeo_tarifas_match_agente_org() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.costeo_tarifas_match_agente_org() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_match_agente_org() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_match_agente_org() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.costeo_tarifas_match_agente_org() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.cotizacion_totales_conceptos(jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.cotizacion_totales_conceptos(jsonb) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.cotizacion_totales_conceptos(jsonb) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.cotizacion_totales_conceptos(jsonb) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.cotizacion_totales_conceptos(jsonb) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.cotizaciones_guard_en_operacion() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.cotizaciones_guard_en_operacion() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.cotizaciones_guard_en_operacion() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.cotizaciones_guard_en_operacion() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.cotizaciones_guard_en_operacion() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.crm_aplicar_tarifa_tarifario(uuid,uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.crm_aplicar_tarifa_tarifario(uuid,uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.crm_aplicar_tarifa_tarifario(uuid,uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.crm_aplicar_tarifa_tarifario(uuid,uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.crm_aplicar_tarifa_tarifario(uuid,uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.crm_vincular_cotizacion(uuid,jsonb,uuid,uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.crm_vincular_cotizacion(uuid,jsonb,uuid,uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion(uuid,jsonb,uuid,uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion(uuid,jsonb,uuid,uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion(uuid,jsonb,uuid,uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.current_agente_id() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.current_agente_id() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_agente_id() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_agente_id() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_agente_id() TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_agente_id() TO "anon";

RESET ROLE;

ALTER FUNCTION public.current_agente_org() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.current_agente_org() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_agente_org() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_agente_org() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_agente_org() TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_agente_org() TO "anon";

RESET ROLE;

ALTER FUNCTION public.current_user_client_ids() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.current_user_client_ids() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_user_client_ids() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_user_client_ids() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_user_client_ids() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.current_user_org_id() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.default_user_org_id() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.default_user_org_id() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.default_user_org_id() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.default_user_org_id() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.default_user_org_id() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.es_admin_catalogo(uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.es_admin_catalogo(uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.es_admin_catalogo(uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.es_admin_catalogo(uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.es_admin_catalogo(uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.get_user_org_ids(uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.get_user_org_ids(uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.get_user_org_ids(uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.get_user_org_ids(uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.get_user_org_ids(uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.guard_cotizacion_vinculo_cliente() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.guard_cotizacion_vinculo_cliente() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_cotizacion_vinculo_cliente() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_cotizacion_vinculo_cliente() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_cotizacion_vinculo_cliente() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_cotizacion_vinculo_cliente() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.guard_crm_lead_estado_canonico() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.guard_crm_lead_estado_canonico() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_crm_lead_estado_canonico() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_crm_lead_estado_canonico() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_crm_lead_estado_canonico() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_crm_lead_estado_canonico() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.guard_estado_cotizacion() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.guard_estado_cotizacion() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_estado_cotizacion() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_estado_cotizacion() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.guard_estado_cotizacion() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.has_any_role_efectivo(uuid,app_role[]) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.has_any_role_efectivo(uuid,app_role[]) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role_efectivo(uuid,app_role[]) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role_efectivo(uuid,app_role[]) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role_efectivo(uuid,app_role[]) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.has_any_role_in_org(uuid,app_role[],uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.has_any_role_in_org(uuid,app_role[],uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role_in_org(uuid,app_role[],uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role_in_org(uuid,app_role[],uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role_in_org(uuid,app_role[],uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.has_any_role(uuid,app_role[]) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.has_any_role(uuid,app_role[]) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role(uuid,app_role[]) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role(uuid,app_role[]) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role(uuid,app_role[]) TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_any_role(uuid,app_role[]) TO "anon";

RESET ROLE;

ALTER FUNCTION public.has_role(uuid,app_role) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.has_role(uuid,app_role) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role) TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role) TO "anon";

RESET ROLE;

ALTER FUNCTION public.is_org_admin(uuid,uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.is_org_admin(uuid,uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid,uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid,uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid,uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.is_org_member(uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.org_scope() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.org_scope() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.org_scope() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.org_scope() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.org_scope() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.puede_escribir_cotizaciones(uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.puede_escribir_cotizaciones(uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_escribir_cotizaciones(uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_escribir_cotizaciones(uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_escribir_cotizaciones(uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.puede_ver_costos_cotizacion_propia(uuid,uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion_propia(uuid,uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion_propia(uuid,uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion_propia(uuid,uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion_propia(uuid,uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.puede_ver_costos_cotizacion(uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion(uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.rls_tenant_scope_ok(uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.rls_tenant_scope_ok(uuid) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.rls_tenant_scope_ok(uuid) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.rls_tenant_scope_ok(uuid) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.rls_tenant_scope_ok(uuid) TO "service_role";

RESET ROLE;

ALTER FUNCTION public.roles_jerarquia(app_role) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.roles_jerarquia(app_role) FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.roles_jerarquia(app_role) TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.roles_jerarquia(app_role) TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.roles_jerarquia(app_role) TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.roles_jerarquia(app_role) TO "anon";

RESET ROLE;

ALTER FUNCTION public.snapshot_cotizacion_al_enviar() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.snapshot_cotizacion_al_enviar() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.snapshot_cotizacion_al_enviar() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.snapshot_cotizacion_al_enviar() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.snapshot_cotizacion_al_enviar() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.trg_costeo_tarifas_estado_derivado() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.trg_costeo_tarifas_estado_derivado() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_costeo_tarifas_estado_derivado() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_costeo_tarifas_estado_derivado() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_costeo_tarifas_estado_derivado() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_costeo_tarifas_estado_derivado() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.trg_cotizacion_subtotal_server() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.trg_cotizacion_subtotal_server() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_cotizacion_subtotal_server() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_cotizacion_subtotal_server() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_cotizacion_subtotal_server() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.trg_notificar_cotizacion_enviada() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.trg_notificar_cotizacion_enviada() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_notificar_cotizacion_enviada() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_notificar_cotizacion_enviada() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.trg_notificar_cotizacion_enviada() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.update_updated_at_column() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO "service_role";

RESET ROLE;

ALTER FUNCTION public.validate_cotizacion_informativa() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.validate_cotizacion_informativa() FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.validate_cotizacion_informativa() TO PUBLIC;

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.validate_cotizacion_informativa() TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.validate_cotizacion_informativa() TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT EXECUTE ON FUNCTION public.validate_cotizacion_informativa() TO "service_role";

RESET ROLE;

ALTER SCHEMA "auth" OWNER TO "supabase_admin";

REVOKE ALL ON SCHEMA "auth" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "supabase_admin";

GRANT USAGE, CREATE ON SCHEMA "auth" TO "supabase_admin";

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT USAGE ON SCHEMA "auth" TO "anon";

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT USAGE ON SCHEMA "auth" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT USAGE ON SCHEMA "auth" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT USAGE, CREATE ON SCHEMA "auth" TO "supabase_auth_admin";

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT USAGE, CREATE ON SCHEMA "auth" TO "dashboard_user";

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT USAGE ON SCHEMA "auth" TO "postgres";

RESET ROLE;

ALTER SCHEMA "extensions" OWNER TO "postgres";

REVOKE ALL ON SCHEMA "extensions" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

SET LOCAL ROLE "postgres";

GRANT USAGE, CREATE ON SCHEMA "extensions" TO "postgres";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT USAGE ON SCHEMA "extensions" TO "authenticated";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT USAGE ON SCHEMA "extensions" TO "service_role";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT USAGE, CREATE ON SCHEMA "extensions" TO "dashboard_user";

RESET ROLE;

SET LOCAL ROLE "postgres";

GRANT USAGE ON SCHEMA "extensions" TO "sandbox_exec";

RESET ROLE;

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

REVOKE ALL ON SCHEMA "public" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

GRANT USAGE, CREATE ON SCHEMA "public" TO "pg_database_owner";

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT USAGE ON SCHEMA "public" TO "sandbox_exec";

GRANT "pg_read_all_settings" TO "pg_monitor" WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;

GRANT "pg_read_all_stats" TO "pg_monitor" WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;

GRANT "pg_stat_scan_tables" TO "pg_monitor" WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;

GRANT "pg_monitor" TO "postgres" WITH ADMIN TRUE, INHERIT TRUE, SET TRUE;

GRANT "pg_signal_backend" TO "postgres" WITH ADMIN TRUE, INHERIT TRUE, SET TRUE;

GRANT "pg_read_all_data" TO "postgres" WITH ADMIN TRUE, INHERIT TRUE, SET TRUE;

GRANT "pg_create_subscription" TO "postgres" WITH ADMIN TRUE, INHERIT TRUE, SET TRUE;

GRANT "anon" TO "postgres" WITH ADMIN TRUE, INHERIT TRUE, SET TRUE;

GRANT "authenticated" TO "postgres" WITH ADMIN TRUE, INHERIT TRUE, SET TRUE;

GRANT "service_role" TO "postgres" WITH ADMIN TRUE, INHERIT TRUE, SET TRUE;

GRANT "authenticator" TO "postgres" WITH ADMIN TRUE, INHERIT TRUE, SET TRUE;

GRANT "sandbox_exec" TO "postgres" WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;

GRANT "supabase_privileged_role" TO "postgres" WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;

GRANT "anon" TO "authenticator" WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

GRANT "authenticated" TO "authenticator" WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

GRANT "service_role" TO "authenticator" WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "extensions" REVOKE ALL ON FUNCTIONS FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "extensions" GRANT EXECUTE ON FUNCTIONS TO "postgres" WITH GRANT OPTION;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" REVOKE ALL ON FUNCTIONS FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_auth_admin", "dashboard_user", "sandbox_exec", "authenticator", "replay_bootstrap";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT EXECUTE ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT EXECUTE ON FUNCTIONS TO "dashboard_user";

-- Candidate source, current reviewed fingerprint; no application exposure.

-- LOCAL REVIEW ONLY. Exposure is intentionally disabled; see PENDING-ACL.sql.
ALTER TABLE public.cotizaciones ADD COLUMN pricing_solicitud_id uuid
  REFERENCES public.crm_solicitudes_pricing(id);
CREATE INDEX cotizaciones_pricing_solicitud_idx ON public.cotizaciones(pricing_solicitud_id)
  WHERE pricing_solicitud_id IS NOT NULL;
COMMENT ON COLUMN public.cotizaciones.pricing_solicitud_id IS
  'Exact Pricing response origin confirmed by the client-link RPC. NULL means unverified/historical, never inferred from tariff.';
-- Local review candidate. Does not change the existing prospect trigger.
CREATE OR REPLACE FUNCTION public.guard_cotizacion_origen_pricing()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP='UPDATE' AND OLD.pricing_solicitud_id IS NOT NULL AND
    ROW(NEW.pricing_solicitud_id,NEW.oportunidad_id,NEW.cliente_id,NEW.tarifa_id,NEW.organization_id,NEW.es_prospecto,NEW.moneda)
      IS DISTINCT FROM
    ROW(OLD.pricing_solicitud_id,OLD.oportunidad_id,OLD.cliente_id,OLD.tarifa_id,OLD.organization_id,OLD.es_prospecto,OLD.moneda) THEN
    RAISE EXCEPTION 'LC_COT_PRICING_ORIGEN_CONFIRMADO' USING ERRCODE='22023';
  END IF;
  IF NEW.pricing_solicitud_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' OR OLD.pricing_solicitud_id IS NULL THEN
    -- No client-controlled GUC can bypass this guard. The reviewed RPC is owned
    -- by postgres, as other canonical RPCs; application roles cannot set lineage.
    IF current_user <> 'postgres' THEN
      RAISE EXCEPTION 'LC_COT_PRICING_SOLO_RPC' USING ERRCODE='42501';
    END IF;
    IF NEW.es_prospecto IS DISTINCT FROM false OR NEW.cliente_id IS NULL
      OR NEW.oportunidad_id IS NULL OR NEW.tarifa_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.crm_solicitudes_pricing s
        JOIN public.crm_oportunidades o ON o.id=s.oportunidad_id
        JOIN public.clientes c ON c.id=o.cliente_id
        JOIN public.costeo_tarifas t ON t.id=NEW.tarifa_id
        WHERE s.id=NEW.pricing_solicitud_id AND s.oportunidad_id=NEW.oportunidad_id
          AND s.organization_id=NEW.organization_id AND s.deleted_at IS NULL
          AND o.organization_id=NEW.organization_id AND o.deleted_at IS NULL
          AND c.organization_id=NEW.organization_id AND c.deleted_at IS NULL AND c.id=NEW.cliente_id
          AND t.organization_id=NEW.organization_id
          AND (s.tarifa_tarifario_id=t.id OR t.solicitud_pricing_id=s.id)
      ) THEN
      RAISE EXCEPTION 'LC_COT_PRICING_ORIGEN_INVALIDO' USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.guard_cotizacion_origen_pricing() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_cotizacion_origen_pricing() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_guard_cotizacion_origen_pricing ON public.cotizaciones;
CREATE TRIGGER trg_guard_cotizacion_origen_pricing
BEFORE INSERT OR UPDATE OF pricing_solicitud_id,oportunidad_id,cliente_id,tarifa_id,organization_id,es_prospecto,moneda
ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION public.guard_cotizacion_origen_pricing();
-- LOCAL REVIEW CANDIDATE. New RPC has NO application EXECUTE grant.
-- Base 5f8270a629d67d132356d5e00247e629e51de7dc. Do not apply remotely yet.
CREATE OR REPLACE FUNCTION public.crm_vincular_cotizacion_cliente_pricing(
  p_cotizacion_id uuid, p_oportunidad_id uuid, p_solicitud_id uuid, p_tarifa_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_c public.cotizaciones%ROWTYPE;
  v_o public.crm_oportunidades%ROWTYPE;
  v_s public.crm_solicitudes_pricing%ROWTYPE;
  v_t public.costeo_tarifas%ROWTYPE;
  v_e public.crm_etapas_pipeline%ROWTYPE;
  v_catalog jsonb;
  v_updated_at timestamptz;
  v_historical boolean;
  v_today date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_SESION' USING ERRCODE='42501';
  END IF;
  IF p_cotizacion_id IS NULL OR p_oportunidad_id IS NULL OR p_solicitud_id IS NULL OR p_tarifa_id IS NULL THEN
    RAISE EXCEPTION 'LC_PRICING_ORIGEN_INCOMPLETO' USING ERRCODE='22023';
  END IF;

  -- Policies and authorization helper bodies are pinned to reviewed 5f8270a.
  -- Changes fail closed; regenerate/review with RLS equivalence tests before upgrade.
  SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) INTO v_catalog
    FROM pg_catalog.pg_policies p WHERE schemaname='public'
    AND tablename IN ('clientes','costeo_agentes','costeo_tarifas','cotizaciones','crm_etapas_pipeline','crm_oportunidades','crm_solicitudes_pricing','organization_members');
  IF v_catalog IS DISTINCT FROM $policies$[{"cmd":"DELETE","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND es_admin_catalogo(( SELECT auth.uid() AS uid)))","roles":["authenticated"],"tablename":"clientes","permissive":"PERMISSIVE","policyname":"Admin catalog delete clientes","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"(( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (id IN ( SELECT current_user_client_ids() AS current_user_client_ids)))","roles":["authenticated"],"tablename":"clientes","permissive":"PERMISSIVE","policyname":"Cliente read own clientes","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))","roles":["authenticated"],"tablename":"clientes","permissive":"RESTRICTIVE","policyname":"Scope tenant activo super admin","schemaname":"public","with_check":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))"},{"cmd":"SELECT","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role)))","roles":["authenticated"],"tablename":"clientes","permissive":"PERMISSIVE","policyname":"Tenant read clientes","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'contador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))","roles":["authenticated"],"tablename":"clientes","permissive":"PERMISSIVE","policyname":"Tenant update clientes","schemaname":"public","with_check":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'contador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))"},{"cmd":"SELECT","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role))","roles":["authenticated"],"tablename":"clientes","permissive":"PERMISSIVE","policyname":"Tenant viewer clientes","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))","roles":["authenticated"],"tablename":"costeo_agentes","permissive":"RESTRICTIVE","policyname":"Scope tenant activo super admin","schemaname":"public","with_check":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))"},{"cmd":"SELECT","qual":"(EXISTS ( SELECT 1\n   FROM organization_members m\n  WHERE ((m.organization_id = costeo_agentes.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))","roles":["authenticated"],"tablename":"costeo_agentes","permissive":"PERMISSIVE","policyname":"costeo_agentes_select_org","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((EXISTS ( SELECT 1\n   FROM organization_members m\n  WHERE ((m.organization_id = costeo_agentes.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))","roles":["public"],"tablename":"costeo_agentes","permissive":"PERMISSIVE","policyname":"costeo_agentes_write_org","schemaname":"public","with_check":"((EXISTS ( SELECT 1\n   FROM organization_members m\n  WHERE ((m.organization_id = costeo_agentes.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))"},{"cmd":"DELETE","qual":"((NOT has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role)) OR (estado_aprobacion = ANY (ARRAY['borrador'::text, 'rechazada'::text])))","roles":["authenticated"],"tablename":"costeo_tarifas","permissive":"RESTRICTIVE","policyname":"Agente borra solo tarifas no aprobadas","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"(has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AND (agente_id = current_agente_id()) AND (organization_id = current_agente_org()))","roles":["authenticated"],"tablename":"costeo_tarifas","permissive":"PERMISSIVE","policyname":"Agente escribe own tarifas","schemaname":"public","with_check":"(has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AND (agente_id = current_agente_id()) AND (organization_id = current_agente_org()) AND (estado_aprobacion = ANY (ARRAY['borrador'::text, 'rechazada'::text])))"},{"cmd":"ALL","qual":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))","roles":["authenticated"],"tablename":"costeo_tarifas","permissive":"RESTRICTIVE","policyname":"Scope tenant activo super admin","schemaname":"public","with_check":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))"},{"cmd":"SELECT","qual":"(EXISTS ( SELECT 1\n   FROM organization_members m\n  WHERE ((m.organization_id = costeo_tarifas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))","roles":["authenticated"],"tablename":"costeo_tarifas","permissive":"PERMISSIVE","policyname":"costeo_tarifas_select_org","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((EXISTS ( SELECT 1\n   FROM organization_members m\n  WHERE ((m.organization_id = costeo_tarifas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))","roles":["public"],"tablename":"costeo_tarifas","permissive":"PERMISSIVE","policyname":"costeo_tarifas_write_org","schemaname":"public","with_check":"((EXISTS ( SELECT 1\n   FROM organization_members m\n  WHERE ((m.organization_id = costeo_tarifas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))"},{"cmd":"SELECT","qual":"((deleted_at IS NULL) AND has_role(auth.uid(), 'cliente'::app_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids)))","roles":["authenticated"],"tablename":"cotizaciones","permissive":"PERMISSIVE","policyname":"Cliente read own cotizaciones","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))","roles":["authenticated"],"tablename":"cotizaciones","permissive":"RESTRICTIVE","policyname":"Scope tenant activo super admin","schemaname":"public","with_check":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))"},{"cmd":"ALL","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones))","roles":["authenticated"],"tablename":"cotizaciones","permissive":"PERMISSIVE","policyname":"Tenant CRUD cotizaciones","schemaname":"public","with_check":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones))"},{"cmd":"SELECT","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role))","roles":["authenticated"],"tablename":"cotizaciones","permissive":"PERMISSIVE","policyname":"Tenant viewer cotizaciones","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))","roles":["authenticated"],"tablename":"crm_etapas_pipeline","permissive":"RESTRICTIVE","policyname":"Scope tenant activo super admin","schemaname":"public","with_check":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))"},{"cmd":"ALL","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)) AND (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)))","roles":["authenticated"],"tablename":"crm_etapas_pipeline","permissive":"PERMISSIVE","policyname":"Tenant admin crm_etapas_pipeline","schemaname":"public","with_check":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)) AND (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)))"},{"cmd":"SELECT","qual":"((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))","roles":["authenticated"],"tablename":"crm_etapas_pipeline","permissive":"PERMISSIVE","policyname":"Tenant read crm_etapas_pipeline","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))","roles":["authenticated"],"tablename":"crm_oportunidades","permissive":"RESTRICTIVE","policyname":"Scope tenant activo super admin","schemaname":"public","with_check":"((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))"},{"cmd":"ALL","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))","roles":["authenticated"],"tablename":"crm_oportunidades","permissive":"PERMISSIVE","policyname":"Staff CRUD crm_oportunidades","schemaname":"public","with_check":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))"},{"cmd":"SELECT","qual":"(((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role))","roles":["authenticated"],"tablename":"crm_oportunidades","permissive":"PERMISSIVE","policyname":"Tenant viewer crm_oportunidades","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'vendedor'::app_role) AS has_role) AND (vendedor_id = ( SELECT auth.uid() AS uid)))","roles":["authenticated"],"tablename":"crm_oportunidades","permissive":"PERMISSIVE","policyname":"Vendedor own crm_oportunidades","schemaname":"public","with_check":"((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'vendedor'::app_role) AS has_role) AND (vendedor_id = ( SELECT auth.uid() AS uid)))"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"crm_solicitudes_pricing","permissive":"PERMISSIVE","policyname":"crm_sol_pricing_crear","schemaname":"public","with_check":"((organization_id = org_scope()) AND (estado = 'borrador'::text))"},{"cmd":"UPDATE","qual":"((organization_id = org_scope()) AND (((estado = 'borrador'::text) AND (created_by = auth.uid())) OR _crm_es_pricing(organization_id)))","roles":["authenticated"],"tablename":"crm_solicitudes_pricing","permissive":"PERMISSIVE","policyname":"crm_sol_pricing_editar","schemaname":"public","with_check":"(organization_id = org_scope())"},{"cmd":"SELECT","qual":"(organization_id = org_scope())","roles":["authenticated"],"tablename":"crm_solicitudes_pricing","permissive":"PERMISSIVE","policyname":"crm_sol_pricing_leer","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"rls_tenant_scope_ok(organization_id)","roles":["authenticated"],"tablename":"crm_solicitudes_pricing","permissive":"RESTRICTIVE","policyname":"crm_solicitudes_pricing_tenant_restrictive","schemaname":"public","with_check":"rls_tenant_scope_ok(organization_id)"},{"cmd":"ALL","qual":"is_org_admin(( SELECT auth.uid() AS uid), organization_id)","roles":["authenticated"],"tablename":"organization_members","permissive":"PERMISSIVE","policyname":"Org admins manage own org members","schemaname":"public","with_check":"is_org_admin(( SELECT auth.uid() AS uid), organization_id)"},{"cmd":"ALL","qual":"( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)","roles":["authenticated"],"tablename":"organization_members","permissive":"PERMISSIVE","policyname":"Super admins manage members","schemaname":"public","with_check":"( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)"},{"cmd":"SELECT","qual":"((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role))","roles":["authenticated"],"tablename":"organization_members","permissive":"PERMISSIVE","policyname":"Users read own memberships","schemaname":"public","with_check":null}]$policies$::jsonb THEN
    RAISE EXCEPTION 'LC_PRICING_ACL_DRIFT' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'source_md5',md5(p.prosrc),'config',p.proconfig,'security_definer',p.prosecdef,
    'volatility',p.provolatile) ORDER BY p.oid::regprocedure::text) INTO v_catalog
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('_crm_es_pricing','current_agente_id','current_agente_org','current_user_client_ids','current_user_org_id','default_user_org_id','es_admin_catalogo','get_user_org_ids','has_role','is_org_admin','is_org_member','org_scope','puede_escribir_cotizaciones','rls_tenant_scope_ok','roles_jerarquia');
  IF v_catalog IS DISTINCT FROM $helpers$[{"config":["search_path=public"],"signature":"_crm_es_pricing(uuid)","source_md5":"9712ff3986b38c8c69918c3b2bfd3d9e","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"current_agente_id()","source_md5":"e78c421a6384475f8ff90aad18e6a1ec","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"current_agente_org()","source_md5":"e1ae96bc348feaa34313802621c837e1","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"current_user_client_ids()","source_md5":"344c708ed02e90960553abd5219cc9b2","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"current_user_org_id()","source_md5":"8ae92929010ad9d586e7fcc033443c92","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"default_user_org_id()","source_md5":"86ebf4f6d06138fd93c9c201b3fde611","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"es_admin_catalogo(uuid)","source_md5":"3dcbffcd27fdccb6514d56edbb68e62a","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"get_user_org_ids(uuid)","source_md5":"a14933dceef9739a9e351dbdfcf4ea7c","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"has_role(uuid,app_role)","source_md5":"978b46d0f372e2715710482b0e15247c","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"is_org_admin(uuid,uuid)","source_md5":"c4c0810cc8a7060585fc96e20746d3b2","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"is_org_member(uuid)","source_md5":"cb3b222b94be33a45916863643576934","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"org_scope()","source_md5":"7c33bde220e8debd95ca9e3be3e8f30e","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"puede_escribir_cotizaciones(uuid)","source_md5":"1c14f940ee4f07e2710b5ff45b163c2c","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"rls_tenant_scope_ok(uuid)","source_md5":"59dddd53956cd142cb142266bbe6430c","volatility":"s","security_definer":true},{"config":["search_path=public"],"signature":"roles_jerarquia(app_role)","source_md5":"0319faa0f75b5caa86e2eef8f6df157f","volatility":"i","security_definer":false}]$helpers$::jsonb THEN
    RAISE EXCEPTION 'LC_PRICING_ACL_DRIFT' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('clientes','costeo_agentes','costeo_tarifas','cotizaciones','crm_etapas_pipeline','crm_oportunidades','crm_solicitudes_pricing','organization_members')
      AND (NOT c.relrowsecurity OR NOT has_table_privilege('authenticated',c.oid,'SELECT')))
     OR NOT has_table_privilege('authenticated','public.cotizaciones','UPDATE')
     OR NOT has_table_privilege('authenticated','public.crm_oportunidades','UPDATE') THEN
    RAISE EXCEPTION 'LC_PRICING_ACL_DRIFT' USING ERRCODE='42501';
  END IF;

  -- Generated exact SELECT + UPDATE USING + UPDATE WITH CHECK policy predicates.
  SELECT * INTO v_c FROM public.cotizaciones
    WHERE id=p_cotizacion_id AND deleted_at IS NULL
      AND (((((deleted_at IS NULL) AND has_role(auth.uid(), 'cliente'::app_role) AND (cliente_id IN ( SELECT current_user_client_ids() AS current_user_client_ids)))) OR ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones))) OR ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role)))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)))) AND ((((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones)))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))))
      AND ((((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT puede_escribir_cotizaciones(( SELECT auth.uid() AS uid)) AS puede_escribir_cotizaciones)))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))))
    FOR UPDATE;
  IF NOT FOUND OR NOT public.is_org_member(v_c.organization_id)
    OR NOT public.rls_tenant_scope_ok(v_c.organization_id)
    OR v_c.organization_id IS DISTINCT FROM public.org_scope()
    OR NOT public.puede_escribir_cotizaciones() THEN
    RAISE EXCEPTION 'LC_PRICING_ORIGEN_NO_AUTORIZADO' USING ERRCODE='42501';
  END IF;
  IF v_c.cliente_id IS NULL OR v_c.es_prospecto IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'LC_PRICING_REQUIERE_CLIENTE' USING ERRCODE='22023';
  END IF;
  -- Cotización then opportunity follows quote→CRM triggers. Request then tariff
  -- follows crm_aplicar_tarifa_tarifario. Row locks recheck data after waits.
  SELECT * INTO v_o FROM public.crm_oportunidades
    WHERE id=p_oportunidad_id AND organization_id=v_c.organization_id AND deleted_at IS NULL
      AND ((((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) OR ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role))) OR (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'vendedor'::app_role) AS has_role) AND (vendedor_id = ( SELECT auth.uid() AS uid))))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)))) AND ((((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) OR (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'vendedor'::app_role) AS has_role) AND (vendedor_id = ( SELECT auth.uid() AS uid))))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))))
      AND ((((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'operador'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) OR (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'vendedor'::app_role) AS has_role) AND (vendedor_id = ( SELECT auth.uid() AS uid))))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id))))
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PRICING_ORIGEN_NO_AUTORIZADO' USING ERRCODE='42501';
  END IF;
  IF v_o.cliente_id IS DISTINCT FROM v_c.cliente_id THEN
    RAISE EXCEPTION 'LC_PRICING_CLIENTE_INCOMPATIBLE' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.clientes WHERE id=v_c.cliente_id AND organization_id=v_c.organization_id
    AND deleted_at IS NULL AND ((((( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role) AND (id IN ( SELECT current_user_client_ids() AS current_user_client_ids)))) OR ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND (NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AS has_role)))) OR ((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) AND ( SELECT has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role) AS has_role)))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)))) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PRICING_ORIGEN_NO_AUTORIZADO' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_s FROM public.crm_solicitudes_pricing
    WHERE id=p_solicitud_id AND organization_id=v_c.organization_id AND deleted_at IS NULL
      AND ((((organization_id = org_scope()))) AND (rls_tenant_scope_ok(organization_id))) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PRICING_ORIGEN_NO_AUTORIZADO' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_t FROM public.costeo_tarifas
    WHERE id=p_tarifa_id AND organization_id=v_c.organization_id
      AND ((((has_role(( SELECT auth.uid() AS uid), 'agente_carga'::app_role) AND (agente_id = current_agente_id()) AND (organization_id = current_agente_org()))) OR ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_tarifas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) OR (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_tarifas.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)))) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PRICING_ORIGEN_NO_AUTORIZADO' USING ERRCODE='42501';
  END IF;
  IF v_s.oportunidad_id IS DISTINCT FROM v_o.id
    OR (v_s.tarifa_tarifario_id IS DISTINCT FROM v_t.id AND v_t.solicitud_pricing_id IS DISTINCT FROM v_s.id)
    OR v_c.tarifa_id IS DISTINCT FROM v_t.id THEN
    RAISE EXCEPTION 'LC_PRICING_ORIGEN_INCOMPATIBLE' USING ERRCODE='22023';
  END IF;
  v_historical := v_c.pricing_solicitud_id IS NOT NULL;
  IF v_c.oportunidad_id IS NOT NULL OR v_historical THEN
    IF v_c.oportunidad_id IS DISTINCT FROM v_o.id OR v_c.pricing_solicitud_id IS DISTINCT FROM v_s.id THEN
      RAISE EXCEPTION 'LC_COT_VINCULO_CONFIRMADO' USING ERRCODE='22023';
    END IF;
    -- Historical acknowledgement, NOT a fresh offer or eligibility certificate.
    RETURN jsonb_build_object('oportunidad_id',v_o.id,'cliente_id',v_c.cliente_id,
      'solicitud_id',v_s.id,'tarifa_id',v_t.id,'updated_at',v_c.updated_at,'ya_ligada',true);
  END IF;
  IF v_c.estado NOT IN ('Borrador','Solicitada') OR v_c.embarque_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PRICING_COTIZACION_NO_EDITABLE' USING ERRCODE='22023';
  END IF;
  IF v_s.estado IS DISTINCT FROM 'respondida' THEN
    RAISE EXCEPTION 'LC_PRICING_SOLICITUD_NO_RESPONDIDA' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_e FROM public.crm_etapas_pipeline
    WHERE id=v_o.etapa_id AND organization_id=v_c.organization_id AND deleted_at IS NULL
      AND ((((((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)) AND (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin_org'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'gerente_comercial'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role)))) OR (((organization_id = ( SELECT current_user_org_id() AS current_user_org_id)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)))) FOR SHARE;
  IF NOT FOUND OR v_e.activa IS DISTINCT FROM true OR v_e.tipo IS DISTINCT FROM 'abierta'::public.crm_etapa_tipo THEN
    RAISE EXCEPTION 'LC_PRICING_OPORTUNIDAD_NO_ELEGIBLE' USING ERRCODE='22023';
  END IF;
  IF v_o.moneda IS DISTINCT FROM v_c.moneda::text THEN
    RAISE EXCEPTION 'LC_CRM_MONEDA_INCOMPATIBLE' USING ERRCODE='22023';
  END IF;
  -- Match direct tariff view: status, approval, active agent and inclusive end
  -- in Mexico City. No invented start-date, Incoterm or FCL quantity rule.
  IF v_t.estado IS DISTINCT FROM 'vigente' OR v_t.estado_aprobacion IS DISTINCT FROM 'vigente'
    OR (v_t.vigente_hasta IS NOT NULL AND v_t.vigente_hasta < v_today) THEN
    RAISE EXCEPTION 'LC_TARIFA_NO_VIGENTE' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.costeo_agentes WHERE id=v_t.agente_id
    AND organization_id=v_c.organization_id AND activo IS TRUE
    AND ((((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_agentes.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) OR (((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = costeo_agentes.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.role)::text = ANY (ARRAY['admin'::text, 'admin_org'::text, 'gerente_operaciones'::text, 'ejecutivo_pricing'::text, 'operador'::text, 'coordinador_logistico'::text]))))) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)))) AND (((NOT ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)) OR rls_tenant_scope_ok(organization_id)))) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_TARIFA_NO_VIGENTE' USING ERRCODE='22023';
  END IF;
  UPDATE public.cotizaciones SET oportunidad_id=v_o.id, pricing_solicitud_id=v_s.id, updated_at=now()
    WHERE id=v_c.id RETURNING updated_at INTO v_updated_at;
  RETURN jsonb_build_object('oportunidad_id',v_o.id,'cliente_id',v_c.cliente_id,
    'solicitud_id',v_s.id,'tarifa_id',v_t.id,'updated_at',v_updated_at,'ya_ligada',false);
END;
$function$;
ALTER FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;


ALTER FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid) OWNER TO postgres;

ALTER FUNCTION public.guard_cotizacion_origen_pricing() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.guard_cotizacion_origen_pricing() FROM PUBLIC, anon, authenticated, service_role;

SET check_function_bodies = on;

SET search_path TO public, extensions, pg_catalog;
