/**
 * Estado y submit del `DialogCrearNotaCredito` — extraído del dialog
 * para respetar Power of 10 (archivos productivos ≤ 200 líneas).
 */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import {
  crearNotaCredito,
  type ConceptoNotaCredito,
} from "@/features/facturacion/services/notasCredito";
import { useTimbrarNotaCredito } from "@/features/facturacion/hooks/useNotaCreditoFacturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors/index";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { Tables } from "@/integrations/supabase/types";

type Moneda = Tables<"factura_notas_credito">["moneda"];
type Motivo = Tables<"factura_notas_credito">["motivo"];

const CLAVE_SAT_DEFAULT = "84111506";
const CLAVE_UNIDAD_DEFAULT = "E48";

export function makeConcepto(): ConceptoNotaCredito {
  return {
    descripcion: "",
    cantidad: 1,
    precio_unitario: 0,
    clave_sat: CLAVE_SAT_DEFAULT,
    clave_unidad: CLAVE_UNIDAD_DEFAULT,
    unidad: "Unidad de servicio",
    tasa_iva: 0.16,
  };
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
}

export function useNotaCreditoDraft(p: Params) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const timbrar = useTimbrarNotaCredito(p.facturaId);

  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [motivo, setMotivo] = useState<Motivo>("Descuento");
  const [descripcion, setDescripcion] = useState("");
  const [usoCfdi, setUsoCfdi] = useState("G02");
  const [formaPago, setFormaPago] = useState("03");
  const [conceptos, setConceptos] = useState<ConceptoNotaCredito[]>(() =>
    p.conceptosSugeridos?.length ? p.conceptosSugeridos.map((c) => ({ ...c })) : [makeConcepto()],
  );
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (p.open) {
      setConceptos(p.conceptosSugeridos?.length ? p.conceptosSugeridos.map((c) => ({ ...c })) : [makeConcepto()]);
    }
  }, [p.open, p.conceptosSugeridos]);

  const monto = useMemo(
    () => conceptos.reduce((acc, c) => acc + Number(c.cantidad) * Number(c.precio_unitario), 0),
    [conceptos],
  );

  const excedeSaldo = monto > p.saldoFactura + 0.01;
  const facturaLiquidada = p.saldoFactura <= 0.01;
  const sinUuid = !p.uuidFacturaOriginal;
  const conceptosValidos =
    conceptos.length > 0 &&
    conceptos.every((c) => c.descripcion.trim() && c.cantidad > 0 && c.precio_unitario >= 0);
  const puedeGuardar =
    !!descripcion.trim() && conceptosValidos && monto > 0 && !excedeSaldo && !facturaLiquidada;
  const puedeTimbrar = puedeGuardar && !sinUuid;

  const crearMut = useMutation({
    mutationFn: () => crearNotaCredito({
      factura_id: p.facturaId,
      motivo,
      descripcion: descripcion.trim(),
      monto,
      moneda: p.monedaFactura,
      tipo_cambio: p.tipoCambioFactura || 1,
      fecha_emision: fecha,
      uso_cfdi: usoCfdi,
      forma_pago: formaPago,
      conceptos,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: facturasKeys.notasCredito(p.facturaId) });
      qc.invalidateQueries({ queryKey: facturasKeys.notasCreditoRecientes() });
    },
    onError: (err) => {
      // `handleSubmit` ya notifica al usuario; el onError sólo satisface la
      // regla de arquitectura y deja huella en consola para diagnóstico.
      console.warn("[useNotaCreditoDraft] crearNotaCredito failed", getErrorMessage(err));
    },
  });

  const handleSubmit = async (timbrarAhora: boolean) => {
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      const nueva = await crearMut.mutateAsync();
      toast({
        title: "Borrador de nota de crédito creado",
        description: timbrarAhora
          ? "Se timbrará ahora y FacturAPI asignará el folio fiscal."
          : "El folio fiscal se asignará al timbrar.",
      });
      if (timbrarAhora && !sinUuid) await timbrar.mutateAsync(nueva.id);
      p.onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo crear la nota de crédito",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    } finally {
      setGuardando(false);
    }
  };

  return {
    fecha, setFecha, motivo, setMotivo, descripcion, setDescripcion,
    usoCfdi, setUsoCfdi, formaPago, setFormaPago,
    conceptos, setConceptos,
    monto, excedeSaldo, facturaLiquidada, sinUuid,
    puedeGuardar, puedeTimbrar, guardando, handleSubmit,
  };
}
