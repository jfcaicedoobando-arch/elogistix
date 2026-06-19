/**
 * Controller para la página `TesoreriaCuentas`: gestiona el formulario de
 * alta y la eliminación con confirmación. Extraído de la página
 * (Auditoría Paso 6: separar lógica de presentación).
 */
import { useState } from "react";
import { toast } from "sonner";
import { useCuentasBancarias, useCrearCuenta, useEliminarCuenta } from "@/features/tesoreria/hooks";
import type { Database } from "@/integrations/supabase/types";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

import { notifyError } from "@/components/shared/utils/appFeedback";
export type Moneda = Database["public"]["Enums"]["moneda"];

const INITIAL_FORM = {
  banco: "BBVA",
  alias: "",
  numero: "",
  clabe: "",
  moneda: "MXN" as Moneda,
  saldoInicial: 0,
};

export function useTesoreriaCuentasController() {
  const { data: cuentas = [], isLoading } = useCuentasBancarias(false);
  const crear = useCrearCuenta();
  const eliminar = useEliminarCuenta();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const setField = <K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => setForm(INITIAL_FORM);

  const submit = async () => {
    if (!form.alias.trim()) {
      notifyError(toast, { title: "Captura un alias", method: "FEATURES_TESORERIA_HOOKS_USETESORERIACUENTASCONTROLLER_1" });
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
      toast.success("Cuenta creada");
      reset();
      setOpen(false);
    } catch (e) {
      notifyError(toast, { title: (e as Error).message, error: e, method: "FEATURES_TESORERIA_HOOKS_USETESORERIACUENTASCONTROLLER_2" });
      reportCaughtError(e, { feature: "tesoreria", op: "crear_cuenta" });
    }
  };

  const confirmarEliminar = (id: string, alias: string) => {
    if (window.confirm(`¿Eliminar cuenta "${alias}"?`)) eliminar.mutate(id);
  };

  return {
    cuentas,
    isLoading,
    open,
    setOpen,
    form,
    setField,
    submit,
    submitting: crear.isPending,
    confirmarEliminar,
  };
}
