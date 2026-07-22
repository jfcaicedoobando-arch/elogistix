/**
 * Estilos ad-hoc para dominios/estados que no están en `ESTADO_CONFIG`.
 * Extraído de `statusRegistry.ts` para mantenerlo bajo 200 líneas.
 *
 * v13.307.17 — Homologación semántica del módulo Compras. Se aplican 4 roles:
 *   • Neutral (muted) → sin acción / terminal frío (Pagada, Borrador, Cancelada)
 *   • Info (azul)     → en curso / seguimiento (Vigente, Parcial, Emitida)
 *   • Atención (ámbar)→ requiere acción del usuario (Por aprobar, Por vencer, Pendiente)
 *   • Alerta (rojo)   → bloqueante / SLA roto (Vencida, Rechazada, Sustituida)
 *   • Éxito (verde)   → cerrado bien — únicamente terminales (Aprobada, Validado, Completo)
 * El verde deja de utilizarse para "en curso" para eliminar la repetición
 * cromática que hacía indistinguibles filas de CxP.
 */
import type { EstadoVisual } from "@/lib/ui/estadoConfig";

export const EXTRA_STATUS_BADGES: Record<string, EstadoVisual["badge"]> = {
  // Lead
  Nuevo: "bg-info/15 text-info border border-info/30",
  Contactado: "bg-warning/15 text-warning border border-warning/30",
  Calificado: "bg-success/15 text-success border border-success/30",
  Descalificado: "bg-destructive/15 text-destructive border border-destructive/30",
  Convertido: "bg-primary/15 text-primary border border-primary/30",
  Descartado: "bg-muted text-muted-foreground border border-border",
  // CxP — chip primario derivado. Vigente pasa a info (aún tiene saldo).
  Vigente: "bg-info/15 text-info border border-info/30",
  "Por vencer": "bg-warning/15 text-warning border border-warning/30",
  Parcial: "bg-info/15 text-info border border-info/30",
  "Por aprobar": "bg-warning/15 text-warning border border-warning/30",
  Rechazada: "bg-destructive/15 text-destructive border border-destructive/30",
  // Pagada: estado terminal — muted en todos los dominios.
  Pagada: "bg-muted text-muted-foreground border border-border",
  // Comisión
  Devengada: "bg-warning/15 text-warning border border-warning/30",
  Liquidada: "bg-success/15 text-success border border-success/30",
  // Organización
  Activa: "bg-success/15 text-success border border-success/30",
  Inactiva: "bg-muted text-muted-foreground border border-border",
  // Aprobación CxP — Aprobada es el único verde del flujo.
  Aprobada: "bg-success/15 text-success border border-success/30",
  // Captura CxP — "Parcial" reusa la clase info definida arriba.
  "Sin captura": "bg-muted text-muted-foreground border border-border",
  Completo: "bg-success/15 text-success border border-success/30",
  // Actividad CRM
  Pendiente: "bg-warning/15 text-warning border border-warning/30",
  Completada: "bg-success/15 text-success border border-success/30",
  // Tarifa marítima
  Borrador: "bg-muted text-muted-foreground border border-border",
  // Agente
  Activo: "bg-success/15 text-success border border-success/30",
  Inactivo: "bg-muted text-muted-foreground border border-border",
  // Garantía naviera
  Depositado: "bg-info/15 text-info border border-info/30",
  Liberado: "bg-success/15 text-success border border-success/30",
  Retenido: "bg-destructive/15 text-destructive border border-destructive/30",
  // Ruta marítima
  "Sin tarifa": "bg-destructive/15 text-destructive border border-destructive/30",
  // Liquidación
  Pagado: "bg-success/15 text-success border border-success/30",
  // Factura — estados derivados del ciclo SAT
  "En cancelación": "bg-warning/15 text-warning border border-warning/30",
  Sustituida: "bg-destructive/10 text-destructive border border-destructive/30",
};
