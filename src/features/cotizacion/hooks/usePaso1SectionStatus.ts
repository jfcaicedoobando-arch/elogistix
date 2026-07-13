import { useFormContext, useWatch } from "react-hook-form";
import type { CotizacionFormValues, LclFleteManual } from "@/features/cotizacion/types";
import type { DimensionAerea, DimensionLCL } from "@/features/cotizacion/types/core";
import { esIncotermSinFleteVenta } from "@/features/cotizacion/utils/incotermRules";

export interface Paso1SectionStatus {
  cliente: boolean;
  operacion: boolean;
  ruta: boolean;
  mercancia: boolean;
  /** Solo aplica a marítimo. Para otros modos siempre true (no aplica). */
  tarifa: boolean;
  /** Solo aplica a marítimo (validez + ruta texto). Otros modos: true. */
  condiciones: boolean;
  cierre: boolean;
}

/**
 * Calcula qué secciones del Paso 1 del wizard de cotización ya tienen
 * sus campos requeridos cubiertos. Sirve para mostrar el check verde
 * por sección sin agregar nuevos validadores de Zod.
 */
export function usePaso1SectionStatus(): Paso1SectionStatus {
  const { control } = useFormContext<CotizacionFormValues>();

  const v = useWatch({
    control,
    name: [
      "clienteId", "esProspecto", "prospectoEmpresa",
      "modo", "tipo", "incoterm",
      "origen", "destino",
      "tipoCarga", "pesoKg", "piezas",
      "tipoEmbarque", "tipoContenedor",
      "dimensionesAereas", "dimensionesLCL",
      "tarifaId",
      "rutaTexto", "validezPropuesta",
      "numContenedores",
    ],
  });

  const [
    clienteId, esProspecto, prospectoEmpresa,
    modo, tipo, incoterm,
    origen, destino,
    tipoCarga, pesoKg, piezas,
    tipoEmbarque, tipoContenedor,
    dimensionesAereas, dimensionesLCL,
    tarifaId,
    rutaTexto, validezPropuesta,
    numContenedores,
  ] = v as [
    string, boolean, string,
    string, string, string,
    string, string,
    string, number, number,
    string, string,
    DimensionAerea[] | undefined, DimensionLCL[] | undefined,
    string | null,
    string, Date | undefined,
    number,
  ];

  const modoLower = (modo || "").toLowerCase();
  const esMaritimo = modoLower.startsWith("mar");
  const esAereo = modoLower.startsWith("aér") || modoLower.startsWith("aer");
  // CIF/CFR/CIP/DAP/DDP marítimo: no se vincula tarifa ni hay condiciones
  // comerciales propias (las pone el shipper origen). No bloquear el paso.
  const sinFleteVenta = esIncotermSinFleteVenta(incoterm, modo);

  return {
    cliente: clienteOk(esProspecto, prospectoEmpresa, clienteId),
    operacion: !!modo && !!tipo && !!incoterm,
    ruta: !!origen?.trim() && !!destino?.trim(),
    mercancia: mercanciaOk({
      tipoCarga, pesoKg, piezas,
      esMaritimo, esAereo,
      tipoEmbarque, tipoContenedor, numContenedores,
      dimensionesAereas, dimensionesLCL,
    }),
    tarifa: esMaritimo && !sinFleteVenta ? !!tarifaId : true,
    condiciones: sinFleteVenta ? true : condicionesOk(esMaritimo, rutaTexto, validezPropuesta),
    cierre: (numContenedores ?? 0) >= 1,
  };
}

function clienteOk(esProspecto: boolean, prospectoEmpresa: string, clienteId: string): boolean {
  return esProspecto ? !!prospectoEmpresa?.trim() : !!clienteId;
}

interface MercanciaArgs {
  tipoCarga: string;
  pesoKg: number;
  piezas: number;
  esMaritimo: boolean;
  esAereo: boolean;
  tipoEmbarque: string;
  tipoContenedor: string;
  numContenedores: number;
  dimensionesAereas: DimensionAerea[] | undefined;
  dimensionesLCL: DimensionLCL[] | undefined;
}

function mercanciaOk(a: MercanciaArgs): boolean {
  if (!a.tipoCarga) return false;

  // Marítimo FCL: se define por contenedor(es).
  if (a.esMaritimo && a.tipoEmbarque === "FCL") {
    return !!a.tipoContenedor && (a.numContenedores ?? 0) >= 1;
  }

  // Marítimo LCL: al menos una fila con piezas y dimensiones/volumen válidos.
  if (a.esMaritimo && a.tipoEmbarque === "LCL") {
    return (a.dimensionesLCL ?? []).some(
      (d) => (d.piezas ?? 0) > 0 && ((d.volumen_m3 ?? 0) > 0 || ((d.alto_cm ?? 0) > 0 && (d.largo_cm ?? 0) > 0 && (d.ancho_cm ?? 0) > 0)),
    );
  }

  // Aéreo: al menos una fila con piezas y peso volumétrico/dimensiones válidas.
  if (a.esAereo) {
    return (a.dimensionesAereas ?? []).some(
      (d) => (d.piezas ?? 0) > 0 && ((d.peso_volumetrico_kg ?? 0) > 0 || ((d.alto_cm ?? 0) > 0 && (d.largo_cm ?? 0) > 0 && (d.ancho_cm ?? 0) > 0)),
    );
  }

  // Terrestre / default: campos planos.
  return (a.pesoKg ?? 0) > 0 || (a.piezas ?? 0) > 0;
}

function condicionesOk(esMaritimo: boolean, rutaTexto: string, validezPropuesta: Date | undefined): boolean {
  if (!esMaritimo) return true;
  return !!rutaTexto?.trim() && !!validezPropuesta;
}
