/**
 * Controlador de estado del `DialogCrearNotaCredito`: guarda el borrador,
 * expone atajos y compone la política pura (`notaCreditoDraftPolitica`) con el
 * hook de envío (`useNotaCreditoSubmit`). Sin reglas fiscales propias.
 *
 * v13.823.297 — el uso del CFDI queda fijo en G02 (única clave SAT válida en
 * un egreso) y la forma de pago se sugiere según el estado de cobro.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { Tables } from "@/integrations/supabase/types";
import {
  USO_CFDI_NC,
  sugerirFormaPagoNC,
  aplicarPorcentaje,
  conceptosSeleccionados,
} from "@/features/facturacion/utils/notaCreditoSugerencias";
import { conceptosPorSaldoCompleto } from "@/features/facturacion/utils/saldoCompletoNC";
import {
  makeConcepto,
  draftInicialNC,
  derivadosNC,
  construirInputNC,
  type DraftNC,
} from "@/features/facturacion/utils/notaCreditoDraftPolitica";
import { useNotaCreditoSubmit } from "@/features/facturacion/hooks/useNotaCreditoSubmit";

export { makeConcepto };

type Moneda = Tables<"factura_notas_credito">["moneda"];
type Motivo = Tables<"factura_notas_credito">["motivo"];
type DraftConBase = DraftNC & { baseDescuento: ConceptoNotaCredito[] };
function inicialConBase(args: Parameters<typeof draftInicialNC>[0]): DraftConBase {
  const inicial = draftInicialNC(args);
  return { ...inicial, baseDescuento: inicial.conceptos.map((c) => ({ ...c })) };
}

interface Params {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  monedaFactura: Moneda;
  tipoCambioFactura: number;
  saldoFactura: number;
  uuidFacturaOriginal: string | null;
  conceptosSugeridos?: ConceptoNotaCredito[];
  /** Hay al menos un cobro vigente (REP no cancelado) en la factura. */
  facturaCobrada?: boolean;
  /** Forma de pago SAT del cobro vigente más reciente. */
  formaPagoCobro?: string | null;
}

export function useNotaCreditoDraft(p: Params) {
  const sugerenciaPago = useMemo(
    () => sugerirFormaPagoNC({ facturaCobrada: !!p.facturaCobrada, formaPagoCobro: p.formaPagoCobro }),
    [p.facturaCobrada, p.formaPagoCobro],
  );

  // Los últimos sugeridos se leen por referencia: el efecto de apertura NO
  // depende de su identidad, así un refetch con el modal abierto no pisa nada.
  const ultimos = useRef({ conceptos: p.conceptosSugeridos, formaPago: sugerenciaPago.formaPago });
  ultimos.current = { conceptos: p.conceptosSugeridos, formaPago: sugerenciaPago.formaPago };

  const [draft, setDraft] = useState<DraftConBase>(() =>
    inicialConBase({ formaPago: sugerenciaPago.formaPago, conceptosSugeridos: p.conceptosSugeridos }),
  );

  // B-bug: sólo la transición real cerrado→abierto reinicia TODO el borrador.
  // El montaje con `open=true` ya nació inicializado (y StrictMode no lo repite
  // porque el ref arranca reflejando el estado actual de `open`).
  const abiertoPrev = useRef(p.open);
  useEffect(() => {
    if (p.open && !abiertoPrev.current) {
      setDraft(
        inicialConBase({
          formaPago: ultimos.current.formaPago,
          conceptosSugeridos: ultimos.current.conceptos,
        }),
      );
    }
    abiertoPrev.current = p.open;
  }, [p.open]);

  const patch = (cambio: Partial<DraftNC>) => setDraft((prev) => ({ ...prev, ...cambio }));
  const setConceptos = (
    next: ConceptoNotaCredito[] | ((prev: ConceptoNotaCredito[]) => ConceptoNotaCredito[]),
  ) =>
    setDraft((prev) => {
      const conceptos = typeof next === "function" ? next(prev.conceptos) : next;
      const baseDescuento = conceptos.map((c, i) => {
        const anterior = prev.conceptos.indexOf(c);
        const index = anterior >= 0 ? anterior : i;
        const sinCambioPrecio = c.precio_unitario === prev.conceptos[index]?.precio_unitario;
        return { ...c, precio_unitario: sinCambioPrecio
          ? (prev.baseDescuento[index]?.precio_unitario ?? c.precio_unitario) : c.precio_unitario };
      });
      return { ...prev, conceptos, baseDescuento };
    });

  const d = useMemo(
    () =>
      derivadosNC(draft, {
        saldoFactura: p.saldoFactura,
        uuidFacturaOriginal: p.uuidFacturaOriginal,
      }),
    [draft, p.saldoFactura, p.uuidFacturaOriginal],
  );

  // P1-IVA: el saldo completo conserva los tratamientos de la factura (uno por
  // renglón si son mixtos) o se bloquea con el motivo en pantalla.
  const aplicarSaldoCompleto = () => {
    const r = conceptosPorSaldoCompleto(
      p.saldoFactura,
      p.conceptosSugeridos ?? [],
      draft.conceptos[0] ?? makeConcepto(),
    );
    if (!r.ok) {
      notifyError(undefined, {
        title: "No se puede acreditar el saldo completo",
        description: r.motivo,
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    setDraft((prev) => ({ ...prev, conceptos: r.conceptos, baseDescuento: r.conceptos.map((c) => ({ ...c })) }));
  };
  const aplicarDescuento = (porcentaje: number) =>
    setDraft((prev) => ({ ...prev, conceptos: aplicarPorcentaje(prev.baseDescuento, porcentaje) }));
  const aplicarSeleccion = (indices: number[]) => {
    const elegidos = conceptosSeleccionados(p.conceptosSugeridos ?? [], indices);
    const conceptos = elegidos.length ? elegidos : [makeConcepto()];
    setDraft((prev) => ({ ...prev, conceptos, baseDescuento: conceptos.map((c) => ({ ...c })) }));
  };

  const submit = useNotaCreditoSubmit({ facturaId: p.facturaId, onOpenChange: p.onOpenChange });

  const handleSubmit = async (timbrarAhora: boolean) => {
    // C-bug: timbrar exige `puedeTimbrar` (incluye UUID), no sólo `puedeGuardar`:
    // una llamada programática ya no crea el borrador cuando se pidió timbrar.
    if (timbrarAhora ? !d.puedeTimbrar : !d.puedeGuardar) return;
    await submit.enviar(
      () =>
        construirInputNC({
          draft,
          facturaId: p.facturaId,
          monedaFactura: p.monedaFactura,
          tipoCambioFactura: p.tipoCambioFactura,
          monto: d.monto,
        }),
      timbrarAhora,
    );
  };

  return {
    fecha: draft.fecha,
    setFecha: (fecha: string) => patch({ fecha }),
    motivo: draft.motivo,
    setMotivo: (motivo: Motivo) => patch({ motivo }),
    descripcion: draft.descripcion,
    setDescripcion: (descripcion: string) => patch({ descripcion }),
    usoCfdi: USO_CFDI_NC,
    formaPago: draft.formaPago,
    setFormaPago: (formaPago: string) => patch({ formaPago }),
    explicacionFormaPago: sugerenciaPago.explicacion,
    conceptos: draft.conceptos,
    setConceptos,
    monto: d.monto,
    totales: d.totales,
    saldoRestante: d.saldoRestante,
    excedeSaldo: d.excedeSaldo,
    facturaLiquidada: d.facturaLiquidada,
    sinUuid: d.sinUuid,
    aplicarSaldoCompleto,
    aplicarDescuento,
    aplicarSeleccion,
    puedeGuardar: d.puedeGuardar,
    puedeTimbrar: d.puedeTimbrar,
    guardando: submit.guardando,
    handleSubmit,
    faltantesGuardar: d.faltantesGuardar,
    faltantesTimbrar: d.faltantesTimbrar,
    isDirty: d.isDirty,
  };
}
