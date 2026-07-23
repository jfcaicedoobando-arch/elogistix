import type { SoftTable } from "@/features/admin/hooks";

export interface TablaMeta {
  value: SoftTable;
  label: string;
  grupo: "Operaciones" | "Comercial" | "Facturación" | "CxP / Tesorería" | "CRM" | "Catálogos";
}

export const TABLAS: TablaMeta[] = [
  // Operaciones
  { value: "embarques", label: "Embarques", grupo: "Operaciones" },
  { value: "embarque_contenedores", label: "Contenedores de embarque", grupo: "Operaciones" },
  { value: "documentos_embarque", label: "Documentos de embarque", grupo: "Operaciones" },
  { value: "eventos_embarque", label: "Eventos de embarque", grupo: "Operaciones" },
  { value: "notas_embarque", label: "Notas de embarque", grupo: "Operaciones" },
  { value: "seguros_embarque", label: "Seguros de embarque", grupo: "Operaciones" },
  { value: "conceptos_costo", label: "Costos directos del embarque", grupo: "Operaciones" },
  { value: "conceptos_venta", label: "Conceptos de venta", grupo: "Operaciones" },
  // Comercial
  { value: "clientes", label: "Clientes", grupo: "Comercial" },
  { value: "contactos_cliente", label: "Contactos de cliente", grupo: "Comercial" },
  { value: "cotizaciones", label: "Cotizaciones", grupo: "Comercial" },
  { value: "cotizacion_costos", label: "Costos de cotización", grupo: "Comercial" },
  // Facturación
  { value: "facturas", label: "Facturas", grupo: "Facturación" },
  { value: "conceptos_factura", label: "Conceptos de factura", grupo: "Facturación" },
  { value: "factura_notas_credito", label: "Notas de crédito (cliente)", grupo: "Facturación" },
  { value: "pagos_factura", label: "Pagos de factura", grupo: "Facturación" },
  { value: "proformas", label: "Proformas", grupo: "Facturación" },
  { value: "proforma_conceptos_consolidados", label: "Conceptos de proforma", grupo: "Facturación" },
  // CxP / Tesorería
  { value: "proveedor_facturas", label: "Facturas de proveedor", grupo: "CxP / Tesorería" },
  { value: "proveedor_notas_credito", label: "Notas de crédito (proveedor)", grupo: "CxP / Tesorería" },
  { value: "pagos_proveedor", label: "Pagos a proveedor", grupo: "CxP / Tesorería" },
  { value: "cuentas_bancarias", label: "Cuentas bancarias", grupo: "CxP / Tesorería" },
  // CRM
  { value: "crm_leads", label: "Leads", grupo: "CRM" },
  { value: "crm_oportunidades", label: "Oportunidades", grupo: "CRM" },
  { value: "crm_actividades", label: "Actividades CRM", grupo: "CRM" },
  { value: "crm_comentarios_oportunidad", label: "Comentarios de oportunidad", grupo: "CRM" },
  { value: "crm_etapas_pipeline", label: "Etapas de pipeline", grupo: "Catálogos" },
  { value: "crm_motivos_perdida", label: "Motivos de pérdida", grupo: "Catálogos" },
  { value: "crm_plantillas_mensaje", label: "Plantillas de mensaje", grupo: "Catálogos" },
];

export const GRUPOS = ["Operaciones", "Comercial", "Facturación", "CxP / Tesorería", "CRM", "Catálogos"] as const;

/**
 * Sprint 4 · Ban Intl.DateTimeFormat fuera de `lib/formatters`: adaptador
 * al helper canónico `formatFechaHora` manteniendo la API previa (`dtf.format(Date)`)
 * para no tocar los consumidores en `columns.tsx`.
 */
import { formatFechaHora } from "@/lib/formatters";

export const dtf = {
  format(d: Date): string {
    return formatFechaHora(d.toISOString(), {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  },
};
