import type ts from "typescript";

/** Tablas del esquema `public` con columna `deleted_at`. */
const SOFT_DELETE_TABLES: readonly string[] = [
  "anticipos_aplicaciones",
  "anticipos_proveedor",
  "bbva_movimientos",
  "cliente_documentos",
  "clientes",
  "comisiones_devengadas",
  "comisiones_excepciones",
  "conceptos_costo",
  "conceptos_factura",
  "conceptos_venta",
  "contactos_cliente",
  "cotizacion_costos",
  "cotizacion_plantillas",
  "cotizaciones",
  "crm_actividades",
  "crm_comentarios_oportunidad",
  "crm_etapa_criterios",
  "crm_etapas_pipeline",
  "crm_leads",
  "crm_motivos_perdida",
  "crm_oportunidades",
  "crm_plantillas_mensaje",
  "cuentas_bancarias",
  "documentos_embarque",
  "embarque_contenedores",
  "embarque_facturas_entrantes",
  "embarque_garantias_contenedor",
  "embarques",
  "eventos_embarque",
  "factura_notas_credito",
  "facturas",
  "liquidaciones_comision",
  "notas_embarque",
  "pagos_factura",
  "pagos_factura_lote",
  "pagos_proveedor",
  "pagos_proveedor_lote",
  "proforma_conceptos_consolidados",
  "proformas",
  "proveedor_contactos",
  "proveedor_documentos",
  "proveedor_facturas",
  "proveedor_notas_credito",
  "proveedores",
  "seguros_embarque",
  "traspasos_bancarios",
];

export const TABLE_SET = new Set(SOFT_DELETE_TABLES);
export const DYNAMIC_TABLE = "<tabla dinámica no resuelta>";
export const WRITES = new Set(["insert", "update", "upsert", "delete"]);
export const BUILDER_METHODS = new Set([
  "select", "insert", "update", "upsert", "delete", "is", "eq", "neq", "gt", "gte",
  "lt", "lte", "like", "ilike", "in", "contains", "containedBy", "rangeGt", "rangeGte",
  "rangeLt", "rangeLte", "rangeAdjacent", "overlaps", "textSearch", "match", "not",
  "or", "filter", "order", "limit", "range", "abortSignal", "single", "maybeSingle",
  "csv", "geojson", "explain", "rollback", "returns", "overrideTypes", "throwOnError",
]);

export interface Hallazgo {
  readonly archivo: string;
  readonly tabla: string;
  readonly linea: number;
  readonly tipo: "listado" | "puntual";
}
export interface Origin {
  node: ts.CallExpression;
  tables: string[];
  read: boolean;
  unsafe: boolean;
  single: boolean;
  excepted: boolean;
}
export interface Query {
  origin: Origin;
  protected: boolean;
  mode: "unknown" | "read" | "write";
}
export type Env = Map<string, Query[]>;


export interface Context {
  source: ts.SourceFile;
  origins: Map<ts.CallExpression, Origin>;
  functions: ts.FunctionLikeDeclaration[];
}
export type Evaluate = (node: ts.Expression, env: Env) => Query[];
