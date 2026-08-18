/**
 * Sugerencias automáticas del formulario "Registrar anticipo".
 *
 * Concentra los efectos de sincronización que antes vivían en el diálogo
 * (proveedor fijo, T/C sugerido y cuenta bancaria por moneda). Las reglas de
 * negocio son funciones puras en `domain/registrarAnticipoPolicy`.
 */
import { useEffect, useMemo } from "react";
import type { UseFormSetValue } from "react-hook-form";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useTcInicial } from "@/features/catalogos/hooks";
import {
  cuentasDeMoneda as filtrarCuentasDeMoneda,
  debeSugerirTc,
  resolverCuentaBancaria,
  tcSugeridoParaMoneda,
  type MonedaAnticipo,
} from "@/features/anticipos-proveedor/domain/registrarAnticipoPolicy";
import type { RegistrarAnticipoFormValues } from "@/features/anticipos-proveedor/components/registrarAnticipo.schema";

const SET_OPTS = { shouldValidate: true, shouldDirty: true } as const;

interface Params {
  open: boolean;
  moneda: MonedaAnticipo;
  cuentaBancariaId: string | undefined;
  tipoCambioUsd: number | undefined;
  proveedorIdInicial?: string;
  setValue: UseFormSetValue<RegistrarAnticipoFormValues>;
  /** Se invoca al abrir con proveedor fijo, para reflejar el nombre en la UI. */
  onProveedorFijo: () => void;
}

interface Resultado {
  /** Cuentas bancarias compatibles con la moneda del anticipo. */
  cuentasDeMoneda: ReturnType<typeof useCuentasBancarias>["data"];
  /** Texto de ayuda sobre el origen del T/C sugerido. */
  tcHint: string | undefined;
}

export function useRegistrarAnticipoDefaults({
  open,
  moneda,
  cuentaBancariaId,
  tipoCambioUsd,
  proveedorIdInicial,
  setValue,
  onProveedorFijo,
}: Params): Resultado {
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const { data: tc } = useTcInicial();

  const cuentasCompatibles = useMemo(
    () => filtrarCuentasDeMoneda(cuentas, moneda),
    [cuentas, moneda],
  );

  // Al abrir con proveedor fijo, sincroniza el valor del formulario.
  useEffect(() => {
    if (!open || !proveedorIdInicial) return;
    setValue("proveedorId", proveedorIdInicial, SET_OPTS);
    onProveedorFijo();
  }, [open, proveedorIdInicial, setValue, onProveedorFijo]);

  // Precarga el T/C sugerido (nunca un fallback estimado, ver EF-04).
  useEffect(() => {
    if (!open) return;
    const sugerido = tcSugeridoParaMoneda(moneda, tc);
    if (debeSugerirTc(tipoCambioUsd, sugerido)) {
      setValue("tipoCambioUsd", sugerido, SET_OPTS);
    }
  }, [open, moneda, tc, tipoCambioUsd, setValue]);

  // Preselecciona/limpia la cuenta bancaria según la moneda del anticipo.
  useEffect(() => {
    if (!open) return;
    const siguiente = resolverCuentaBancaria(cuentaBancariaId, cuentasCompatibles);
    if (siguiente !== null) setValue("cuentaBancariaId", siguiente, SET_OPTS);
  }, [open, cuentaBancariaId, cuentasCompatibles, setValue]);

  const tcHint = tc
    ? tc.fuente === "DOF"
      ? `Sugerido por el DOF${tc.fecha ? ` del ${tc.fecha}` : ""}. Puedes editarlo.`
      : "Sugerido por el servicio de tipos de cambio. Puedes editarlo."
    : undefined;

  return { cuentasDeMoneda: cuentasCompatibles, tcHint };
}
