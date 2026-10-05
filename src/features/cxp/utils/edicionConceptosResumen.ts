import type { CfdiConceptoParsed } from "../services/parseCfdi.types";
import { parseMonto } from "@/lib/format/parseMonto";
import { sumarConceptos } from "./cuadreConceptos";
import { importesConceptosEditados, type ImportesFacturaConceptos } from "./impuestosConceptos";
import type { FacturaParaEdicion } from "../services/proveedorFacturas.update.types";

export function referenciaEdicionConceptos(
  cabecera: FacturaParaEdicion | undefined,
  previo: ImportesFacturaConceptos,
  moneda: string,
) {
  return { monedaMostrada: cabecera?.moneda ?? moneda,
    anterior: cabecera ? { subtotal: cabecera.subtotal, iva: cabecera.iva, ieps: cabecera.ieps,
      retenciones: cabecera.retenciones, total: cabecera.total } : previo };
}

/** Propuesta y validación fiscal del editor; usa la cabecera de la versión revisada. */
export function edicionConceptosResumen(
  conceptos: ReadonlyArray<CfdiConceptoParsed>,
  globales: { iva: string; ieps: string },
  anterior: ImportesFacturaConceptos,
) {
  const lineas = conceptos.map((c, i) => ({
    key: String(i), monto: Number(c.importe) || 0, cantidad: Number(c.cantidad) || 1,
  }));
  const subtotalNuevo = sumarConceptos(lineas);
  const impuestosGlobales = { iva: parseMonto(globales.iva), ieps: parseMonto(globales.ieps) };
  const nuevo = importesConceptosEditados(conceptos.map((c) => ({
    monto: c.importe, cantidad: c.cantidad, iva: c.iva, ieps: c.ieps,
  })), impuestosGlobales, anterior.retenciones);
  const globalInvalido = Object.values(globales).some((v) =>
    !v.trim() || !Number.isFinite(parseMonto(v, NaN)) || parseMonto(v) < 0);
  return {
    subtotalNuevo, impuestosGlobales, nuevo, globalInvalido,
    hayRenglonEnCero: lineas.some((l) => l.monto === 0),
    cambia: Math.abs(subtotalNuevo - anterior.subtotal) > 0.005,
    cambiaImportes: (Object.keys(anterior) as Array<keyof ImportesFacturaConceptos>)
      .some((campo) => Math.abs(anterior[campo] - nuevo[campo]) > 0.005),
  };
}

export function puedeGuardarConceptos(params: {
  cantidad: number; precargado: boolean; isLoading: boolean; isError: boolean; globalInvalido: boolean;
}) {
  return params.cantidad > 0 && params.precargado && !params.isLoading && !params.isError && !params.globalInvalido;
}
