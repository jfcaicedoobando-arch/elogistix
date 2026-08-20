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
        ctx.addIssue({ code: "custom", path: ["clienteId"], message: "Selecciona un cliente" });
      }
      return;
    }
    if (v.prospectoModo === "vincular" && !v.oportunidadId && !v.leadId) {
      ctx.addIssue({
        code: "custom",
        path: ["oportunidadId"],
        message:
          "Selecciona un lead u oportunidad existente, o cambia a 'Crear nuevo prospecto'",
      });
    }
    if (!v.prospectoEmpresa.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["prospectoEmpresa"],
        message: "Ingresa el nombre de la empresa del prospecto",
      });
    }
    if (v.prospectoModo === "nuevo" && !v.prospectoContacto.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["prospectoContacto"],
        message: "Ingresa el nombre del contacto del prospecto",
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
        message: "Selecciona la modalidad de equipo",
      });
      return;
    }
    if (v.modalidadEquipo === "Porta Contenedor" && !v.puntoIntermedio?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["puntoIntermedio"],
        message: "Captura el punto de carga/descarga",
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
      message:
        "Captura el flete LCL (Tarifa W/M y Consolidador) antes de continuar (Paso 1 → Flete LCL).",
    });
  });

// ── Paso 2 · Costos internos ─────────────────────────────────────────────────

export interface Paso2Input {
  totalCostos: number;
  renglonesSinConcepto: number;
}

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
        message: "Agrega al menos un costo interno antes de continuar",
      });
      return;
    }
    if (v.renglonesSinConcepto > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["renglonesSinConcepto"],
        message: "Hay renglones de costo sin concepto",
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
        message: "Agrega al menos un concepto de venta",
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
