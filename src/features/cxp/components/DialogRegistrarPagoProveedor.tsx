/**
 * Registrar pago a proveedor.
 * Migrado a `FormDialogShell` (v13.120.0) — paridad visual con resto de modales CXP.
 * v13.320.48 (B-037): al abrir el diálogo se invalida `queryKeys.cxp.factura(id)`
 * y se re-lee vía `useFacturaProveedor` para evitar mostrar saldo/estado stale
 * cuando el usuario acaba de aprobar/pagar en otra pestaña.
 */
import { useEffect } from "react";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogCancelarBoton } from "@/components/shared/FormDialogCancelarBoton";
import { useFacturaProveedor } from "@/features/cxp/hooks";
import { PagoProveedorResultadoIncierto, type FacturaCxP } from "@/features/cxp/services";
import { PagoFacturaHeaderInfo } from "./PagoProveedorBits";
import { usePagoProveedorForm } from "@/features/cxp/hooks/usePagoProveedorForm";
import { useIntentoPagoProveedor } from "@/features/cxp/hooks/useIntentoPagoProveedor";
import { pagoProveedorCreadoSucio } from "@/features/cxp/hooks/usePagoProveedorForm.editar";

import { PagoProveedorFormBody } from "./PagoProveedorFormBody";
import { traducirErrorPagoProveedor } from "@/features/cxp/services/pagosProveedorErrors";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
}

export function DialogRegistrarPagoProveedor({ open, onOpenChange, factura: facturaInput }: Props) {
  const qc = useQueryClient();
  const facturaId = facturaInput?.id ?? null;

  // B-037: al abrir, forzar re-lectura de la factura para evitar snapshot stale
  // (p.ej. usuario aprobó/pagó en otra ventana y aquí seguía mostrando "por aprobar").
  useEffect(() => {
    if (open && facturaId) {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.factura(facturaId) });
    }
  }, [open, facturaId, qc]);

  const { data: facturaFresca } = useFacturaProveedor(
    open ? facturaId : null,
    facturaInput ?? undefined,
  );
  const factura = facturaFresca ?? facturaInput;

  const { intento, confirmar, disponible, guardando } = useIntentoPagoProveedor(facturaId);
  const f = usePagoProveedorForm(factura, open);
  const noAprobada = !!factura && factura.estado_aprobacion !== "aprobada";

  const submit = async () => {
    if (!factura) return;
    const errorMsg = intento ? null : f.validacion.error;
    if (errorMsg) {
      notifyError(undefined, { title: errorMsg, method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_VALIDAR" });
      return;
    }
    const scope = captureAuthOperationScope();
    try {
      const resultado = await confirmar(intento ? undefined : {
        proveedor_factura_id: factura.id,
        fecha_pago: f.fecha,
        monto: f.montoNum,
        moneda: f.moneda,
        // v13.308.8: si no hay TC válido (ej. pago MXN de factura MXN), enviamos
        // `null` — el CHECK `pagos_proveedor_tc_pos` sólo permite `NULL` o `> 0`.
        tipo_cambio_usd: Number(f.tc) > 0 ? Number(f.tc) : null,
        metodo_pago: f.metodo,
        referencia: f.referencia,
        notas: f.notas,
        // R6-N1: la cuenta permite generar el movimiento bancario vinculado.
        // MNY: en efectivo va `null` para que la base no derive salida de banco.
        cuenta_bancaria_id: f.cuentaBancariaIdEnvio,
        diferencia_cambiaria_mxn: f.diferenciaCambiariaEnvio,
      });
      if (!resultado || !scope.isCurrent()) return;
      if (resultado.estado === "detalle_pendiente") {
        notifyWarning(undefined, { title: "Pago registrado, detalle pendiente" });
      } else {
        notifySuccess(undefined, { title: "Pago registrado" });
      }
      onOpenChange(false);
    } catch (e) {
      if (!scope.isCurrent()) return;
      if (e instanceof PagoProveedorResultadoIncierto) {
        notifyWarning(undefined, { title: e.message });
      } else {
        notifyError(undefined, { title: traducirErrorPagoProveedor(e), error: e, method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_3" });
      }
    }
  };

  const boton = estadoBotonRegistro(f, noAprobada, Boolean(intento), guardando);

  // YG-04 / MNY: hay captura real del usuario que se perdería al cerrar. El
  // monto, el T/C, la diferencia y la cuenta vienen prellenados: sólo cuentan
  // como captura cuando el usuario los tocó (`f.tocados`).
  const isDirty = !intento && pagoProveedorCreadoSucio(
    {
      referencia: f.referencia, notas: f.notas, metodo: f.metodo, moneda: f.moneda,
      monto: f.monto, fecha: f.fecha, tc: f.tc, diffMxn: f.diffMxn, cuentaId: f.cuentaId,
    },
    f.valoresIniciales,
    f.tocados,
  );




  const footer = (
    <>
      {/* v13.821.7 — Cancelar pasa por el cierre guardado del shell: con
          captura en curso pide confirmación en vez de descartar directo. */}
      <FormDialogCancelarBoton onCancelar={() => onOpenChange(false)} disabled={guardando} />
      <Hint label={boton.title}>
        <Button onClick={submit} disabled={boton.disabled || !disponible} loading={guardando}>
          {boton.label}
        </Button>
      </Hint>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ArrowUpFromLine}
      title="Registrar pago a proveedor"
      description={factura ? `Aplica un pago contra el saldo pendiente de la factura seleccionada.` : undefined}
      size="2xl"
      footer={footer}
      isDirty={isDirty}
    >
      {factura && <PagoFacturaHeaderInfo factura={factura} />}

      {noAprobada && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-body-sm text-warning">
          Esta factura no está aprobada. Solicita la aprobación en el detalle de la factura antes de registrar pagos.
        </div>
      )}

      {intento ? (
        <p role="status" className="text-body-sm text-muted-foreground">
          Intento de {intento.input.monto} {intento.input.moneda} del {intento.input.fecha_pago}.
          Puedes confirmar este intento con los mismos datos.
        </p>
      ) : <PagoProveedorFormBody factura={factura} {...f} />}
    </FormDialogShell>
  );
}

function estadoBotonRegistro(
  form: ReturnType<typeof usePagoProveedorForm>,
  noAprobada: boolean,
  reintento: boolean,
  guardando: boolean,
): { label: string; disabled: boolean; title?: string } {
  if (guardando) return { label: "Guardando…", disabled: true };
  if (reintento) return { label: "Confirmar intento anterior", disabled: false };
  const title = noAprobada ? "Requiere aprobación"
    : form.bloqueadoPorTc ? "Captura el TC"
    : form.requiereCuenta && !form.cuentaId ? "Selecciona la cuenta bancaria"
    : undefined;
  return { label: "Registrar pago", disabled: form.validacion.error !== null, title };
}
