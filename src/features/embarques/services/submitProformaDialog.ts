/**
 * Submit del DialogGenerarProforma: construye notas, días de crédito,
 * crea la proforma (RPC) y dispara la generación del PDF.
 * Extraído de `useDialogGenerarProformaController.ts` para mantener el hook
 * controlador bajo el límite Power-of-10 (≤200 líneas).
 */
import type { Tables } from "@/integrations/supabase/types";
import type { calcularTotalesProforma } from "@/lib/domain/proforma";
import type { FiltroContenedor } from "@/lib/domain/conceptosPorContenedor";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";
import { validarContenedoresFCL } from "@/features/embarques/services/validarContenedoresFCL";

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
  ivaPorConcepto: Record<string, boolean>;
  notas: string;
  diasCredito: string;
  filtroContenedor: FiltroContenedor;
  contenedores: EmbarqueContenedor[];
  totales: TotalesProforma;
  tasaIva: number;
  crearProformaMutateAsync: (args: CrearProformaArgs) => Promise<Tables<"proformas">>;
  fetchClienteParaPdfCached: (clienteId: string) => Promise<ClienteParaPdf>;
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
    embarque, conceptosSeleccionados, seleccionados, ivaPorConcepto,
    notas, diasCredito, filtroContenedor, contenedores, totales, tasaIva,
    crearProformaMutateAsync, fetchClienteParaPdfCached,
  } = params;

  const ivaOverrides: Record<string, boolean> = {};
  conceptosSeleccionados.forEach((c) => {
    ivaOverrides[c.id] = c.moneda === "MXN" ? true : !!ivaPorConcepto[c.id];
  });

  const notasFinal = construirNotasFinales(notas, filtroContenedor, contenedores);

  // Días de crédito: input vacío → null → se guarda como 0 (Contado) a nivel DB.
  // Cualquier valor no numérico también degrada a null/Contado en el fallback de abajo.
  const diasCreditoNum = diasCredito.trim() === "" ? null : Number(diasCredito);

  const proforma = await crearProformaMutateAsync({
    embarqueId: embarque.id,
    clienteId: embarque.cliente_id,
    clienteNombre: embarque.cliente_nombre,
    expediente: embarque.expediente,
    blMaster: embarque.bl_master,
    conceptoIds: Array.from(seleccionados),
    totales,
    notas: notasFinal,
    operador: embarque.operador || null,
    diasCredito: Number.isFinite(diasCreditoNum as number) ? (diasCreditoNum as number) : null,
    tasaIva,
    ivaOverrides,
  });

  const cliente = await fetchClienteParaPdfCached(embarque.cliente_id);
  const conceptosParaPdf = conceptosSeleccionados.map((c) => ({
    ...c,
    aplica_iva: ivaOverrides[c.id],
  }));
  const { generarPdfProforma } = await import("@/generators/proformaPdf");
  await generarPdfProforma({
    proforma,
    embarque,
    conceptos: conceptosParaPdf,
    cliente,
    tasaIva,
  });
}
