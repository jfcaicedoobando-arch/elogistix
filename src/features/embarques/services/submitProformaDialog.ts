/**
 * Submit del DialogGenerarProforma: construye notas, días de crédito,
 * crea la proforma (RPC) y dispara la generación del PDF.
 * Extraído de `useDialogGenerarProformaController.ts` para mantener el hook
 * controlador bajo el límite Power-of-10 (≤200 líneas).
 */
import type { Tables } from "@/integrations/supabase/types";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import type { FiltroContenedor } from "@/features/embarques/domain/conceptosPorContenedor";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";
import { validarContenedoresFCL } from "@/features/embarques/services/validarContenedoresFCL";
import { ivaDeFila } from "@/features/embarques/domain/ivaConceptoVenta";
import { tratamientoIvaPendiente, MSG_PROFORMA_IVA_PENDIENTE } from "@/lib/financial/etiquetaTratamientoFila";
import { clasificarCoherenciaIva } from "@/lib/financial/coherenciaIva";

/**
 * Error de pre-validación esperada (ej. FCL sin peso/volumen).
 * El controller lo trata como aviso al usuario, NO como bug a reportar en Sentry.
 */
export class ProformaValidationError extends Error {
  readonly isValidation = true as const;
  constructor(message: string) {
    super(message);
    this.name = "ProformaValidationError";
  }
}

type ClienteParaPdf = Pick<
  Tables<"clientes">,
  "nombre" | "rfc" | "direccion" | "ciudad" | "estado" | "cp"
> | null;

type ConceptoVenta = Tables<"conceptos_venta">;
type EmbarqueRow = Tables<"embarques">;
type TotalesProforma = ReturnType<typeof calcularTotalesProforma>;
type CrearProformaArgs = Parameters<
  ReturnType<typeof import("@/features/embarques/hooks/useProformas").useCrearProforma>["mutateAsync"]
>[0];

export interface SubmitProformaParams {
  embarque: EmbarqueRow;
  conceptosSeleccionados: ConceptoVenta[];
  seleccionados: Set<string>;
  notas: string;
  diasCredito: string;
  filtroContenedor: FiltroContenedor;
  contenedores: EmbarqueContenedor[];
  totales: TotalesProforma;
  tasaIva: number;
  crearProformaMutateAsync: (args: CrearProformaArgs) => Promise<Tables<"proformas">>;
  fetchClienteParaPdfCached: (clienteId: string) => Promise<ClienteParaPdf>;
  /** Se ejecuta inmediatamente después del commit, antes de cualquier I/O del PDF. */
  onCreada?: (creada: ProformaCreadaParaPdf) => void;
}

export interface ProformaCreadaParaPdf {
  proforma: Tables<"proformas">;
  embarque: EmbarqueRow;
  conceptos: ConceptoVenta[];
  tasaIva: number;
  totales: TotalesProforma;
  notas: string;
}

/** Reintento post-commit: descarga el mismo documento, nunca vuelve a crearlo. */
export async function descargarProformaCreada(
  creada: ProformaCreadaParaPdf,
  fetchCliente: SubmitProformaParams["fetchClienteParaPdfCached"],
): Promise<void> {
  const cliente = await fetchCliente(creada.embarque.cliente_id);
  const { generarPdfProforma } = await import("@/generators/proformaPdf");
  await generarPdfProforma({ ...creada, cliente });
}

function construirNotasFinales(
  notas: string,
  filtroContenedor: FiltroContenedor,
  contenedores: EmbarqueContenedor[],
): string | null {
  let notasFinal: string | null = notas.trim() || null;
  if (filtroContenedor !== "todos" && filtroContenedor !== "generales") {
    const cont = contenedores.find((c) => c.id === filtroContenedor);
    if (cont) {
      const etiqueta = `Proforma del contenedor ${cont.numero_contenedor || `#${cont.orden}`}`;
      notasFinal = notasFinal ? `${etiqueta}\n${notasFinal}` : etiqueta;
    }
  } else if (filtroContenedor === "generales") {
    const etiqueta = "Proforma de conceptos generales del embarque";
    notasFinal = notasFinal ? `${etiqueta}\n${notasFinal}` : etiqueta;
  }
  return notasFinal;
}

export async function submitProformaDialog(params: SubmitProformaParams): Promise<void> {
  const {
    embarque, conceptosSeleccionados, seleccionados,
    notas, diasCredito, filtroContenedor, contenedores, totales, tasaIva,
    crearProformaMutateAsync, fetchClienteParaPdfCached,
  } = params;

  // Tratamiento de IVA desconocido ≠ no gravado: se exige decisión explícita.
  const pendientes = conceptosSeleccionados.filter(tratamientoIvaPendiente);
  if (pendientes.length > 0) {
    const nombres = pendientes.map((c) => c.descripcion).filter(Boolean).join(", ");
    throw new ProformaValidationError(
      `${MSG_PROFORMA_IVA_PENDIENTE}${nombres ? ` Pendientes: ${nombres}.` : ""}`,
    );
  }
  for (const c of conceptosSeleccionados) {
    const coherencia = clasificarCoherenciaIva(c);
    if (coherencia.estado !== "ok") {
      throw new ProformaValidationError(`${c.descripcion || "Concepto"}: ${coherencia.motivo}. Revisa su tratamiento en Editar embarque → Conceptos de venta.`);
    }
  }

  // Pre-check: contenedores FCL marítimos deben tener peso y volumen capturados.
  const validacion = validarContenedoresFCL(embarque, contenedores);
  if (!validacion.ok) {
    throw new ProformaValidationError(
      validacion.mensaje ?? "Captura peso y volumen de todos los contenedores antes de generar la proforma.",
    );
  }

  // R4-10: la proforma no reclasifica IVA con un booleano. Cualquier cambio
  // fiscal se captura explícitamente en los conceptos de venta del embarque.
  const ivaOverrides = Object.fromEntries(conceptosSeleccionados.map((c) => [c.id, ivaDeFila(c)]));

  const notasFinal = construirNotasFinales(notas, filtroContenedor, contenedores);

  // Días de crédito: input vacío → null → se guarda como 0 (Contado) a nivel DB.
  // Cualquier valor no numérico también degrada a null/Contado en el fallback de abajo.
  const diasCreditoNum = diasCredito.trim() === "" ? null : Number(diasCredito);

  const proforma = await crearProformaMutateAsync({
    embarqueId: embarque.id,
    clienteId: embarque.cliente_id,
    clienteNombre: embarque.cliente_nombre,
    expediente: embarque.expediente ?? "",
    blMaster: embarque.bl_master,
    conceptoIds: Array.from(seleccionados),
    totales,
    notas: notasFinal,
    operador: embarque.operador || null,
    diasCredito: Number.isFinite(diasCreditoNum as number) ? (diasCreditoNum as number) : null,
    tasaIva,
    ivaOverrides,
  });

  const creada: ProformaCreadaParaPdf = {
    proforma, embarque, conceptos: conceptosSeleccionados.map((c) => ({ ...c })),
    tasaIva, totales, notas: notasFinal ?? "",
  };
  params.onCreada?.(creada);
  await descargarProformaCreada(creada, fetchClienteParaPdfCached);
}
