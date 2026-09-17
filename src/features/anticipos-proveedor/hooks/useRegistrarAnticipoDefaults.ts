/**
 * Sugerencias automáticas del formulario "Registrar anticipo".
 *
 * Concentra los efectos de sincronización que antes vivían en el diálogo
 * (proveedor fijo, T/C sugerido y cuenta bancaria por moneda). Las reglas de
 * negocio son funciones puras en `domain/registrarAnticipoPolicy`.
 */
import { useEffect, useMemo, useRef } from "react";
import type { UseFormSetValue } from "react-hook-form";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useTcDofPorFecha } from "@/features/catalogos/hooks";
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
  /** Fecha del anticipo: define QUÉ DOF se sugiere (MNY P2.7). */
  fechaAnticipo: string | undefined;
  cuentaBancariaId: string | undefined;
  /** false cuando el método es Efectivo: no debe haber cuenta ni cargo bancario. */
  requiereCuenta: boolean;
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
  fechaAnticipo,
  cuentaBancariaId,
  requiereCuenta,
  tipoCambioUsd,
  proveedorIdInicial,
  setValue,
  onProveedorFijo,
}: Params): Resultado {
  const { data: cuentas = [] } = useCuentasBancarias(true);
  // MNY P2.7: para un anticipo retroactivo se sugiere el DOF de ESA fecha, no
  // el más reciente (antes se persistía un T/C de otro día).
  const pedirTc = open && moneda !== "MXN" && Boolean(fechaAnticipo);
  const { data: tcDof } = useTcDofPorFecha(pedirTc ? fechaAnticipo ?? null : null, pedirTc);
  const tc = useMemo(
    () =>
      tcDof
        ? {
            usdMxn: tcDof.usdMxn,
            eurMxn: tcDof.eurMxn,
            esFallback: false,
            eurEsFallback: tcDof.eurMxn == null,
          }
        : null,
    [tcDof],
  );

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
  // MNY P2.7: al cambiar la fecha se re-sugiere sólo si el valor actual venía de
  // una sugerencia previa; un T/C escrito a mano se conserva.
  const ultimoSugeridoRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open) {
      ultimoSugeridoRef.current = null;
      return;
    }
    const sugerido = tcSugeridoParaMoneda(moneda, tc);
    if (sugerido === null) return;
    const eraAutomatico = Number(tipoCambioUsd) === ultimoSugeridoRef.current;
    if (debeSugerirTc(tipoCambioUsd, sugerido) || eraAutomatico) {
      ultimoSugeridoRef.current = sugerido;
      if (Number(tipoCambioUsd) !== sugerido) setValue("tipoCambioUsd", sugerido, SET_OPTS);
    }
  }, [open, moneda, tc, tipoCambioUsd, setValue]);

  // Preselecciona/limpia la cuenta bancaria según la moneda del anticipo.
  useEffect(() => {
    if (!open) return;
    const siguiente = resolverCuentaBancaria(cuentaBancariaId, cuentasCompatibles, requiereCuenta);
    if (siguiente !== null) setValue("cuentaBancariaId", siguiente, SET_OPTS);
  }, [open, cuentaBancariaId, cuentasCompatibles, requiereCuenta, setValue]);

  const tcManual =
    Number(tipoCambioUsd) > 0 && Number(tipoCambioUsd) !== ultimoSugeridoRef.current;
  const tcHint = !tcDof
    ? moneda !== "MXN" && fechaAnticipo
      ? `Sin tipo de cambio DOF publicado para el ${fechaAnticipo}: captúralo a mano.`
      : undefined
    : tcManual
      ? `Tipo de cambio capturado por ti. El DOF del ${tcDof.fecha} es ${tcDof.usdMxn}.`
      : `Sugerido por el DOF del ${tcDof.fecha}${tcDof.exacto ? "" : " (última publicación antes de la fecha del anticipo)"}. Puedes editarlo.`;

  return { cuentasDeMoneda: cuentasCompatibles, tcHint };
}
