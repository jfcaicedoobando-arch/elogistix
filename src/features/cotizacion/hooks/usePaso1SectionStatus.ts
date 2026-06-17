import { useFormContext, useWatch } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

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

  const cliente = esProspecto
    ? !!prospectoEmpresa?.trim()
    : !!clienteId;

  const operacion = !!modo && !!tipo && !!incoterm;
  const ruta = !!origen?.trim() && !!destino?.trim();
  const mercancia = !!tipoCarga && ((pesoKg ?? 0) > 0 || (piezas ?? 0) > 0);

  const esMaritimo = (modo || "").toLowerCase().startsWith("mar");
  const tarifa = esMaritimo ? !!tarifaId : true;
  const condiciones = esMaritimo
    ? !!rutaTexto?.trim() && !!validezPropuesta
    : true;

  const cierre = (numContenedores ?? 0) >= 1;

  return { cliente, operacion, ruta, mercancia, tarifa, condiciones, cierre };
}
