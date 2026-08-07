/**
 * Controller para la página `TesoreriaCuentas`: gestiona el formulario de
 * alta y la eliminación con confirmación. Extraído de la página
 * (Auditoría Paso 6: separar lógica de presentación).
 */
import { useState } from "react";
import { useCuentasBancarias, useCrearCuenta, useEliminarCuenta } from "@/features/tesoreria/hooks";
import type { Database } from "@/integrations/supabase/types";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { todayLocalISO } from "@/lib/date/today";

import { notifyError } from "@/lib/ui/appFeedback";
export type Moneda = Database["public"]["Enums"]["moneda"];

const INITIAL_FORM = {
  banco: "BBVA",
  alias: "",
  numero: "",
  clabe: "",
  moneda: "MXN" as Moneda,
  saldoInicial: 0,
  /** Fecha a la que corresponde el saldo inicial (corte de arranque). */
  fechaSaldoInicial: todayLocalISO(),
};

export function useTesoreriaCuentasController() {
  const { data: cuentas = [], isLoading, isError, refetch } = useCuentasBancarias(false);
  const crear = useCrearCuenta();
  const eliminar = useEliminarCuenta();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; alias: string } | null>(null);

  const setField = <K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => setForm(INITIAL_FORM);

  /** Q-15.8: abrir el modal siempre parte de un formulario limpio; antes
   *  conservaba el prellenado (o los datos capturados y cancelados) de la
   *  sesión anterior. Al abrir (`v === true`) se resetea el formulario. */
  const handleOpenChange = (v: boolean) => {
    if (v) reset();
    setOpen(v);
  };

  const submit = async () => {
    if (!form.alias.trim()) {
      notifyError(undefined, { title: "Captura un alias", method: "FEATURES_TESORERIA_HOOKS_USETESORERIACUENTASCONTROLLER_1" });
      return;
    }
    try {
      await crear.mutateAsync({
        banco: form.banco,
        alias: form.alias.trim(),
        numero_cuenta: form.numero,
        clabe: form.clabe,
        moneda: form.moneda,
        saldo_inicial: Number(form.saldoInicial) || 0,
        activa: true,
      });
      // El toast de éxito lo emite `useCrearCuenta` (evita doble toast).
      reset();
      setOpen(false);
    } catch (e) {
      // El toast de error lo emite `useCrearCuenta`; aquí sólo reportamos.
      reportCaughtError(e, { feature: "tesoreria", op: "crear_cuenta" });
    }
  };

  const solicitarEliminar = (id: string, alias: string) => setDeleteTarget({ id, alias });
  const cancelarEliminar = () => setDeleteTarget(null);
  const confirmarEliminar = () => {
    if (deleteTarget) {
      eliminar.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return {
    // P1-1: error + retry en lugar de esqueleto perpetuo.
    isError,
    refetch: () => void refetch(),
    cuentas,
    isLoading,
    open,
    setOpen: handleOpenChange,
    form,
    setField,
    submit,
    submitting: crear.isPending,
    deleteTarget,
    solicitarEliminar,
    cancelarEliminar,
    confirmarEliminar,
    eliminando: eliminar.isPending,
  };
}
