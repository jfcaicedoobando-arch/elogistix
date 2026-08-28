/**
 * Estado y validación del diálogo N13 "Registrar devolución" de un anticipo.
 *
 * Extraído de `DevolverAnticipoDialog.tsx` para respetar el límite de 200
 * líneas por archivo (Power of 10): el componente sólo pinta; aquí viven el
 * formulario, las sugerencias automáticas y las validaciones previas a la RPC.
 */
import { useEffect, useMemo, useState } from "react";
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

  const disponible = anticipo?.disponible ?? 0;
  const moneda = anticipo?.moneda ?? "MXN";
  const cuentasDeMoneda = useMemo(
    () => cuentas.filter((c) => c.moneda === moneda),
    [cuentas, moneda],
  );

  // Al abrir se propone devolver todo el saldo con fecha de hoy.
  useEffect(() => {
    if (!open || !anticipo) return;
    setMonto(anticipo.disponible > 0 ? anticipo.disponible : null);
    setFecha(hoyMx());
    setCuentaId("");
    setReferencia("");
    setMotivo("");
  }, [open, anticipo]);

  // La cuenta se sugiere aparte porque el catálogo puede llegar después de
  // abrir el diálogo; sólo se rellena si el usuario aún no eligió una.
  useEffect(() => {
    if (!open) return;
    setCuentaId((actual) => actual || (cuentasDeMoneda[0]?.id ?? ""));
  }, [open, cuentasDeMoneda]);

  const excede = (monto ?? 0) > disponible + 0.01;

  const handleConfirm = async () => {
    if (!anticipo) return;
    if (!monto || monto <= 0 || excede) {
      notifyWarning(undefined, {
        title: "Revisa el monto",
        description: `La devolución debe ser mayor a cero y no puede exceder el saldo disponible (${formatCurrency(disponible, moneda)}).`,
      });
      return;
    }
    if (!fecha) {
      notifyWarning(undefined, { title: "Falta la fecha", description: "Indica cuándo entró el depósito." });
      return;
    }
    if (!cuentaId) {
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
    setCuentaId,
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
