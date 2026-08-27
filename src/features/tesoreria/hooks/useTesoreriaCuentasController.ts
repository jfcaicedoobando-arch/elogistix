/**
 * Controller para la página `TesoreriaCuentas`: gestiona el formulario de
 * alta y la eliminación con confirmación. Extraído de la página
 * (Auditoría Paso 6: separar lógica de presentación).
 */
import { useState } from "react";
import {
  useCuentasBancarias, useCrearCuenta, useActualizarCuenta, useEliminarCuenta,
  useTieneMovimientosCuenta,
} from "@/features/tesoreria/hooks";
import type { Database } from "@/integrations/supabase/types";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { todayLocalISO } from "@/lib/date/today";
import { validarDatosBancarios } from "@/lib/domain/datosBancarios";

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

export interface CuentaEditable {
  id: string;
  alias: string;
  banco: string;
  moneda: string;
  numero_cuenta: string | null;
  clabe: string | null;
  saldo_inicial: number | string;
  fecha_saldo_inicial: string;
  /** Sello de versión para el bloqueo optimista al guardar (H5). */
  updated_at?: string | null;
}

export function useTesoreriaCuentasController() {
  const { data: cuentas = [], isLoading, isError, refetch } = useCuentasBancarias(false);
  const crear = useCrearCuenta();
  const actualizar = useActualizarCuenta();
  const eliminar = useEliminarCuenta();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editTarget, setEditTarget] = useState<CuentaEditable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; alias: string } | null>(null);
  const { data: tieneMovimientos = false } = useTieneMovimientosCuenta(editTarget?.id ?? null);


  const setField = <K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => setForm(INITIAL_FORM);

  /** Q-15.8: abrir el modal siempre parte de un formulario limpio; antes
   *  conservaba el prellenado (o los datos capturados y cancelados) de la
   *  sesión anterior. Al abrir (`v === true`) se resetea el formulario. */
  const handleOpenChange = (v: boolean) => {
    if (v) reset();
    if (!v) setEditTarget(null);
    setOpen(v);
  };

  /** Abre el modal en modo edición con los datos actuales de la cuenta. */
  const solicitarEditar = (cuenta: CuentaEditable) => {
    setEditTarget(cuenta);
    setForm({
      banco: cuenta.banco,
      alias: cuenta.alias,
      numero: cuenta.numero_cuenta ?? "",
      clabe: cuenta.clabe ?? "",
      moneda: cuenta.moneda as Moneda,
      saldoInicial: Number(cuenta.saldo_inicial) || 0,
      fechaSaldoInicial: cuenta.fecha_saldo_inicial,
    });
    setOpen(true);
  };

  const payloadForm = () => ({
    banco: form.banco,
    alias: form.alias.trim(),
    numero_cuenta: form.numero,
    clabe: form.clabe,
    moneda: form.moneda,
    saldo_inicial: Number(form.saldoInicial) || 0,
    fecha_saldo_inicial: form.fechaSaldoInicial || todayLocalISO(),
  });

  const submit = async () => {
    if (!form.alias.trim()) {
      notifyError(undefined, { title: "Captura un alias", method: "FEATURES_TESORERIA_HOOKS_USETESORERIACUENTASCONTROLLER_1" });
      return;
    }
    // Ola 11 · RFE-07: un corte futuro congela el saldo en saldo_inicial
    // (los movimientos anteriores al corte no afectan el saldo).
    if (form.fechaSaldoInicial > todayLocalISO()) {
      notifyError(undefined, {
        title: "La fecha de corte no puede ser futura",
        description: "El saldo inicial debe corresponder a hoy o a un día anterior.",
        method: "FEATURES_TESORERIA_HOOKS_USETESORERIACUENTASCONTROLLER_3",
      });
      return;
    }
    // Ola 11 · RFE-07: misma validación CLABE que proveedores (18 dígitos +
    // dígito verificador Banxico). CLABE vacía sigue siendo opcional.
    const errorBancario = validarDatosBancarios({ esExtranjero: false, clabe: form.clabe, swiftBic: null });
    if (errorBancario) {
      notifyError(undefined, {
        title: errorBancario.mensaje,
        method: "FEATURES_TESORERIA_HOOKS_USETESORERIACUENTASCONTROLLER_4",
      });
      return;
    }
    if (editTarget && tieneMovimientos && form.moneda !== editTarget.moneda) {
      notifyError(undefined, {
        title: "No se puede cambiar la moneda",
        description: "La cuenta ya tiene movimientos registrados en " + editTarget.moneda + ".",
        method: "FEATURES_TESORERIA_HOOKS_USETESORERIACUENTASCONTROLLER_2",
      });
      return;
    }
    try {
      if (editTarget) {
        await actualizar.mutateAsync({
          id: editTarget.id,
          patch: payloadForm(),
          expectedUpdatedAt: editTarget.updated_at ?? null,
        });
      } else {
        await crear.mutateAsync({ ...payloadForm(), activa: true });
      }
      // Los toasts los emiten los hooks de mutación (evita doble toast).
      reset();
      setEditTarget(null);
      setOpen(false);
    } catch (e) {
      reportCaughtError(e, { feature: "tesoreria", op: editTarget ? "editar_cuenta" : "crear_cuenta" });
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

  /** ¿El cambio afecta saldos y conciliación? (aviso en el modal de edición) */
  const avisoRecalculo = !!editTarget && (
    Number(editTarget.saldo_inicial) !== (Number(form.saldoInicial) || 0) ||
    editTarget.fecha_saldo_inicial !== form.fechaSaldoInicial
  );

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
    submitting: crear.isPending || actualizar.isPending,
    editTarget,
    solicitarEditar,
    monedaBloqueada: !!editTarget && tieneMovimientos,
    avisoRecalculo,
    deleteTarget,
    solicitarEliminar,
    cancelarEliminar,
    confirmarEliminar,
    eliminando: eliminar.isPending,
  };
}
