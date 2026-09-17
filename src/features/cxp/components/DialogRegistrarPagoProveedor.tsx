/**
 * Registrar pago a proveedor.
 * Migrado a `FormDialogShell` (v13.120.0) — paridad visual con resto de modales CXP.
 * v13.320.48 (B-037): al abrir el diálogo se invalida `queryKeys.cxp.factura(id)`
 * y se re-lee vía `useFacturaProveedor` para evitar mostrar saldo/estado stale
 * cuando el usuario acaba de aprobar/pagar en otra pestaña.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogCancelarBoton } from "@/components/shared/FormDialogCancelarBoton";
import { useRegistrarPagoProveedor, useFacturaProveedor } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import { PagoFacturaHeaderInfo } from "./PagoProveedorBits";
import { usePagoProveedorForm } from "@/features/cxp/hooks/usePagoProveedorForm";
import { pagoProveedorCreadoSucio } from "@/features/cxp/hooks/usePagoProveedorForm.editar";

import { PagoProveedorFormBody } from "./PagoProveedorFormBody";
import { notifyError } from "@/lib/ui/appFeedback";
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

  // BL-14: UUID por apertura del dialog; los reintentos del MISMO submit
  // comparten el id y el UNIQUE parcial de `pagos_proveedor` absorbe el
  // duplicado (retry de red / doble submit tras timeout).
  const clientRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (open && facturaId && !clientRequestIdRef.current) {
      clientRequestIdRef.current = crypto.randomUUID();
    }
    if (!open) clientRequestIdRef.current = null;
  }, [open, facturaId]);

  const registrar = useRegistrarPagoProveedor();
  const f = usePagoProveedorForm(factura, open);
  const noAprobada = !!factura && factura.estado_aprobacion !== "aprobada";

  const faltaCuenta = f.requiereCuenta && !f.cuentaId;

  // R6-N2: la validación de montos/IVA/totales vive en el hook (módulo puro).
  const validarPago = () => f.validacion.error;


  const submit = async () => {
    if (!factura) return;
    const errorMsg = validarPago();
    if (errorMsg) {
      notifyError(undefined, { title: errorMsg, method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_VALIDAR" });
      return;
    }
    try {
      await registrar.mutateAsync({
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

        client_request_id: clientRequestIdRef.current,
      });
      notifySuccess(undefined, { title: "Pago registrado" });
      onOpenChange(false);
    } catch (e) {
      notifyError(undefined, { title: traducirErrorPagoProveedor(e), error: e, method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_3" });
    }
  };

  const submitDisabled = registrar.isPending || validarPago() !== null;
  const submitTitle = computeSubmitTitle(noAprobada, f.bloqueadoPorTc, faltaCuenta);

  // YG-04 / MNY: hay captura real del usuario que se perdería al cerrar. El
  // monto, el T/C, la diferencia y la cuenta vienen prellenados: sólo cuentan
  // como captura cuando el usuario los tocó (`f.tocados`).
  const isDirty = pagoProveedorCreadoSucio(
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
      <FormDialogCancelarBoton onCancelar={() => onOpenChange(false)} disabled={registrar.isPending} />
      <Hint label={submitTitle}>
        <Button onClick={submit} disabled={submitDisabled} loading={registrar.isPending}>
          {registrar.isPending ? "Guardando…" : "Registrar pago"}
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

      <PagoProveedorFormBody factura={factura} {...f} />
    </FormDialogShell>
  );
}

function computeSubmitTitle(
  noAprobada: boolean,
  bloqueadoPorTc: boolean,
  faltaCuenta: boolean,
): string | undefined {
  if (noAprobada) return "Requiere aprobación";
  if (bloqueadoPorTc) return "Captura el TC";
  if (faltaCuenta) return "Selecciona la cuenta bancaria";
  return undefined;
}
