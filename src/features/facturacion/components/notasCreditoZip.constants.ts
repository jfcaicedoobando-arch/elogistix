import type { EstadoNotaCredito } from "@/features/facturacion/hooks";

/** Sólo las notas que ya pasaron por el SAT tienen PDF/XML. */
export const ESTADOS_NC_CON_CFDI: ReadonlySet<EstadoNotaCredito> = new Set(["Timbrada", "Aplicada", "Cancelada"]);
