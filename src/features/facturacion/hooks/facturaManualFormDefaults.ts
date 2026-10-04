/**
 * Defaults y derivados del formulario de factura manual.
 * Extraído de `useFacturaManualForm.ts` (límite Power-of-10 de 200 líneas).
 */
import { useMemo } from "react";
import { todayLocalISO } from "@/lib/date/today";
import type { ClienteFiscalOpt } from "@/features/facturacion/hooks/useClientesFiscalOpts";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import type { DatosFiscalesValue } from "@/features/facturacion/components/FacturaManualDatosFiscales";
import { validarFormaMetodoPago } from "@/lib/financial/formaMetodoPago";

/**
 * Serie oficial por moneda. La numeración fiscal es responsabilidad del sistema
 * — nunca se deja al usuario porque contamina folios (ver v13.301.58).
 */
export function serieForMoneda(m: DatosFiscalesValue["moneda"]): string {
  if (m === "USD") return "SF43718";
  if (m === "EUR") return "SF46410";
  return "A";
}

export const INITIAL_FISCAL: DatosFiscalesValue = {
  serie: serieForMoneda("MXN"), fechaEmision: todayLocalISO(), diasCredito: 0, moneda: "MXN",
  usoCfdi: "G03", formaPago: "99", metodoPago: "PPD", tipoCambio: 1,
};

export const INITIAL_CONCEPTOS: ConceptoManualInput[] = [
  { descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800", tipo_iva: "gravado_16" },
];

/** El renglón inicial vacío no es captura del usuario. */
export function facturaManualIsDirty(
  clienteId: string,
  fiscal: DatosFiscalesValue,
  conceptos: ConceptoManualInput[],
  notas: string,
): boolean {
  return Boolean(clienteId || notas)
    || JSON.stringify(fiscal) !== JSON.stringify(INITIAL_FISCAL)
    || JSON.stringify(conceptos) !== JSON.stringify(INITIAL_CONCEPTOS);
}

export function useFaltantesTimbrar(
  cliente: ClienteFiscalOpt | undefined,
  conceptosValidos: boolean,
  fiscal: DatosFiscalesValue,
): string[] {
  return useMemo(
    () =>
      [
        !cliente && "cliente",
        !conceptosValidos && "conceptos válidos",
        fiscal.tipoCambio <= 0 && "tipo de cambio",
        validarFormaMetodoPago(fiscal.formaPago, fiscal.metodoPago).length > 0 && "forma y método de pago compatibles",
        cliente && (!cliente.rfc || !cliente.codigo_postal || !cliente.regimen_fiscal) &&
          "datos fiscales del cliente (RFC · CP · régimen)",
      ].filter((x): x is string => !!x),
    [cliente, conceptosValidos, fiscal.tipoCambio, fiscal.formaPago, fiscal.metodoPago],
  );
}
