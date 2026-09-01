/**
 * Ola 4 · EC-4 — Reglas de validación del wizard de cotización como schemas zod.
 *
 * Antes cada paso validaba a mano con cadenas de `if` repartidas entre
 * `handlePaso1Crm.ts` y `useCotizacionWizardSteps.ts`. Aquí viven las reglas
 * puras (sin I/O, sin toasts) de cada paso; los handlers sólo consumen el
 * primer mensaje de error y deciden cómo mostrarlo.
 *
 * Los mensajes son idénticos a los previos: la UI y los tests dependen de ellos.
 */
import { z } from "zod";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

// ── Paso 1 · Datos generales obligatorios del borrador ───────────────────────

/**
 * VB-41: estos seis campos son requeridos por el boundary de mutación
 * (`cotizacionDraftInputSchema`). Antes sólo fallaban al guardar, con un toast
 * técnico ("Cotización — Modo: requerido."); ahora se validan antes de tocar
 * la base y se marcan inline en el campo culpable.
 */
export const datosGeneralesSchema = z
  .object({
    modo: z.string().default(""),
    tipo: z.string().default(""),
    incoterm: z.string().default(""),
    descripcionMercancia: z.string().default(""),
    origen: z.string().default(""),
    destino: z.string().default(""),
  })
  .superRefine((v, ctx) => {
    const faltantes: [keyof typeof v, string][] = [
      ["modo", COPY_VALIDACION.modoRequerido],
      ["tipo", COPY_VALIDACION.tipoOperacionRequerido],
      ["incoterm", COPY_VALIDACION.incotermRequerido],
      ["descripcionMercancia", COPY_VALIDACION.descripcionMercanciaRequerida],
      ["origen", COPY_VALIDACION.origenRequerido],
      ["destino", COPY_VALIDACION.destinoRequerido],
    ];
    for (const [campo, message] of faltantes) {
      if (!String(v[campo] ?? "").trim()) {
        ctx.addIssue({ code: "custom", path: [campo], message });
      }
    }
  });

// ── Paso 1 · Destinatario (cliente o prospecto) ──────────────────────────────


export const destinatarioSchema = z
  .object({
    esProspecto: z.boolean(),
    clienteId: z.string().nullable().optional(),
    prospectoModo: z.string().optional(),
    oportunidadId: z.string().nullable().optional(),
    leadId: z.string().nullable().optional(),
    prospectoEmpresa: z.string().default(""),
    prospectoContacto: z.string().default(""),
  })
  .superRefine((v, ctx) => {
    if (!v.esProspecto) {
      if (!v.clienteId) {
        ctx.addIssue({ code: "custom", path: ["clienteId"], message: COPY_VALIDACION.clienteRequerido });
      }
      return;
    }
    if (v.prospectoModo === "vincular" && !v.oportunidadId && !v.leadId) {
      ctx.addIssue({
        code: "custom",
        path: ["oportunidadId"],
        message: COPY_VALIDACION.prospectoOportunidadRequerida,
      });
    }
    if (!v.prospectoEmpresa.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["prospectoEmpresa"],
        message: COPY_VALIDACION.prospectoEmpresaRequerida,
      });
    }
    if (v.prospectoModo === "nuevo" && !v.prospectoContacto.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["prospectoContacto"],
        message: COPY_VALIDACION.prospectoContactoRequerido,
      });
    }
  });

// ── Paso 1 · Ruta terrestre ──────────────────────────────────────────────────

export const rutaTerrestreSchema = z
  .object({
    modo: z.string(),
    modalidadEquipo: z.string().nullable().optional(),
    puntoIntermedio: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modo !== "Terrestre") return;
    if (!v.modalidadEquipo?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["modalidadEquipo"],
        message: COPY_VALIDACION.modalidadEquipoRequerida,
      });
      return;
    }
    if (v.modalidadEquipo === "Porta Contenedor" && !v.puntoIntermedio?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["puntoIntermedio"],
        message: COPY_VALIDACION.puntoIntermedioRequerido,
      });
    }
  });

// ── Paso 1 · Flete LCL manual (cuando no hay tarifa vinculada) ───────────────

export const fleteLclManualSchema = z
  .object({
    tarifaWM: z.coerce.number().default(0),
    consolidadorId: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tarifaWM > 0 && (v.consolidadorId?.trim() ?? "") !== "") return;
    ctx.addIssue({
      code: "custom",
      path: ["tarifaWM"],
      message: COPY_VALIDACION.fleteLclRequerido,
    });
  });

// ── Paso 2 · Costos internos ─────────────────────────────────────────────────

export const costosPaso2Schema = z
  .object({
    totalCostos: z.number(),
    renglonesSinConcepto: z.number(),
  })
  .superRefine((v, ctx) => {
    if (v.totalCostos === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["totalCostos"],
        message: COPY_VALIDACION.costosInternosRequeridos,
      });
      return;
    }
    if (v.renglonesSinConcepto > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["renglonesSinConcepto"],
        message: COPY_VALIDACION.renglonesSinConcepto,
      });
    }
  });

// ── Paso 3 · Conceptos de venta ──────────────────────────────────────────────

export const conceptosPaso3Schema = z
  .object({ conceptosValidos: z.number() })
  .superRefine((v, ctx) => {
    if (v.conceptosValidos === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["conceptosValidos"],
        message: COPY_VALIDACION.conceptosVentaRequeridos,
      });
    }
  });

// ── Helper común ─────────────────────────────────────────────────────────────

/**
 * Corre un schema y devuelve el primer mensaje de error (o `null` si pasa).
 * Los handlers del wizard trabajan con un único mensaje por paso (un solo toast).
 */
export function primerError<S extends z.ZodType>(schema: S, value: z.input<S>): string | null {
  const res = schema.safeParse(value);
  if (res.success) return null;
  return res.error.issues[0]?.message ?? "Datos inválidos";
}
