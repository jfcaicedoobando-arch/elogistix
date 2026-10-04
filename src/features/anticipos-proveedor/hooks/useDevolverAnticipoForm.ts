/**
 * Estado y validación del diálogo N13 "Registrar devolución" de un anticipo.
 *
 * Extraído de `DevolverAnticipoDialog.tsx` para respetar el límite de 200
 * líneas por archivo (Power of 10): el componente sólo pinta; aquí viven el
 * formulario, las sugerencias automáticas y las validaciones previas a la RPC.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useDevolverAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { formatCurrency } from "@/lib/formatters";
import { hoyMx } from "@/lib/date/mx";
import { notifyWarning } from "@/lib/ui/appFeedback";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

interface Args {
  open: boolean;
  anticipo: AnticipoProveedorRow | null;
  onOpenChange: (o: boolean) => void;
}

export function useDevolverAnticipoForm({ open, anticipo, onOpenChange }: Args) {
  const devolver = useDevolverAnticipo();
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const [monto, setMonto] = useState<number | null>(null);
  const [fecha, setFecha] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const sesionRef = useRef<string | null>(null);
  const cuentaElegidaRef = useRef(false);

  const disponible = anticipo?.disponible ?? 0;
  const moneda = anticipo?.moneda ?? "MXN";
  const cuentasDeMoneda = useMemo(
    () => cuentas.filter((c) => c.moneda === moneda && c.activa && !c.deleted_at),
    [cuentas, moneda],
  );

  // Al abrir se propone devolver todo el saldo con fecha de hoy.
  useEffect(() => {
    if (!open) { sesionRef.current = null; return; }
    if (!anticipo || sesionRef.current === anticipo.id) return;
    sesionRef.current = anticipo.id;
    cuentaElegidaRef.current = false;
    setMonto(anticipo.disponible > 0 ? anticipo.disponible : null);
    setFecha(hoyMx());
    setCuentaId("");
    setReferencia("");
    setMotivo("");
  }, [open, anticipo]);

  const cuentaOriginal = cuentasDeMoneda.find((c) => c.id === anticipo?.cuenta_bancaria_id);
  // El catálogo puede llegar después. Sólo se propone la cuenta de salida
  // original, nunca la primera del catálogo ni otra tras una elección manual.
  useEffect(() => {
    if (!open || cuentaElegidaRef.current || !cuentaOriginal) return;
    setCuentaId((actual) => actual || cuentaOriginal.id);
  }, [open, cuentaOriginal, anticipo?.id]);

  const elegirCuenta = (id: string) => { cuentaElegidaRef.current = true; setCuentaId(id); };
  const cuentaValida = cuentasDeMoneda.some((c) => c.id === cuentaId);

  // F2 (decisión 2026-08-29): sólo devolución TOTAL. El monto queda fijo al
  // saldo disponible; una parcial haría desaparecer el remanente sin asiento.
  const excede = (monto ?? 0) > disponible + 0.01;
  const esParcial = (monto ?? 0) < disponible - 0.01;

  const handleConfirm = async () => {
    if (!anticipo || devolver.isPending) return;
    if (!monto || monto <= 0 || excede || esParcial) {
      notifyWarning(undefined, {
        title: "Revisa el monto",
        description: `La devolución debe ser por el saldo completo (${formatCurrency(disponible, moneda)}); no se permiten devoluciones parciales.`,
      });
      return;
    }
    if (!fecha) {
      notifyWarning(undefined, { title: "Falta la fecha", description: "Indica cuándo entró el depósito." });
      return;
    }
    if (!cuentaValida) {
      notifyWarning(undefined, {
        title: "Falta la cuenta",
        description: "Selecciona la cuenta bancaria donde entró el dinero.",
      });
      return;
    }
    if (motivo.trim().length < 3) {
      notifyWarning(undefined, {
        title: "Indica un motivo",
        description: "Escribe el motivo de la devolución (al menos 3 caracteres).",
      });
      return;
    }
    await devolver.mutateAsync({
      id: anticipo.id,
      monto,
      fecha,
      cuentaBancariaId: cuentaId,
      referencia: referencia.trim() || null,
      motivo: motivo.trim(),
    });
    onOpenChange(false);
  };

  return {
    monto,
    setMonto,
    fecha,
    setFecha,
    cuentaId,
    setCuentaId: elegirCuenta,
    cuentaOriginal,
    cuentaValida,
    otraCuenta: cuentaValida && cuentaId !== anticipo?.cuenta_bancaria_id,
    referencia,
    setReferencia,
    motivo,
    setMotivo,
    cuentasDeMoneda,
    disponible,
    moneda,
    excede,
    isPending: devolver.isPending,
    handleConfirm,
  };
}
