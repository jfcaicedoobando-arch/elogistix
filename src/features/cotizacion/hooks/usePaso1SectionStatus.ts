import { useFormContext, useWatch } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
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
    tarifaId,
    rutaTexto, validezPropuesta,
    numContenedores,
  ] = v as [
    string, boolean, string,
    string, string, string,
    string, string,
    string, number, number,
    string | null,
    string, Date | undefined,
    number,
  ];

  const esMaritimo = (modo || "").toLowerCase().startsWith("mar");
  // CIF/CFR/CIP/DAP/DDP marítimo: no se vincula tarifa ni hay condiciones
  // comerciales propias (las pone el shipper origen). No bloquear el paso.
  const sinFleteVenta = esIncotermSinFleteVenta(incoterm, modo);

  return {
    cliente: clienteOk(esProspecto, prospectoEmpresa, clienteId),
    operacion: !!modo && !!tipo && !!incoterm,
    ruta: !!origen?.trim() && !!destino?.trim(),
    mercancia: mercanciaOk(tipoCarga, pesoKg, piezas),
    tarifa: esMaritimo && !sinFleteVenta ? !!tarifaId : true,
    condiciones: sinFleteVenta ? true : condicionesOk(esMaritimo, rutaTexto, validezPropuesta),
    cierre: (numContenedores ?? 0) >= 1,
  };
}

function clienteOk(esProspecto: boolean, prospectoEmpresa: string, clienteId: string): boolean {
  return esProspecto ? !!prospectoEmpresa?.trim() : !!clienteId;
}

function mercanciaOk(tipoCarga: string, pesoKg: number, piezas: number): boolean {
  return !!tipoCarga && ((pesoKg ?? 0) > 0 || (piezas ?? 0) > 0);
}

function condicionesOk(esMaritimo: boolean, rutaTexto: string, validezPropuesta: Date | undefined): boolean {
  if (!esMaritimo) return true;
  return !!rutaTexto?.trim() && !!validezPropuesta;
}
