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
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors/index";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { Tables } from "@/integrations/supabase/types";
import {
  TASA_IVA,
  sumarMontos,
  subtotalLinea,
  calcularTotalConIVA,
} from "@/lib/financial/financialUtils";
import { logger } from "@/lib/observability/logger";

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
    tasa_iva: TASA_IVA,
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

  // B-007 (v13.320.34): la NC debe reflejar el total con IVA para que iguale
  // el saldo de la factura original. Antes: `Σ cantidad*precio` (sin IVA) — una
  // NC "total" de $1,160 pedía teclear $1,000 y dejaba $160 fantasma en saldo.
  // `tasa_iva` es fracción (0.16 por defecto en makeConcepto).
  const monto = useMemo(
    () =>
      // M3: redondear por línea con el motor canónico antes de sumar; el
      // flotante crudo podía rechazar NCs legítimas por epsilon o dejar
      // centavos fantasma en el saldo (cf. B-007).
      sumarMontos(
        conceptos.map((c) => {
          const base = subtotalLinea(Number(c.cantidad), Number(c.precio_unitario));
          const tasa = Number.isFinite(Number(c.tasa_iva)) ? Number(c.tasa_iva) : 0;
          return calcularTotalConIVA(base, tasa);
        }),
      ),
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

  // YG-06: etiquetas de lo que falta para poder guardar/timbrar la NC.
  const faltantesGuardar = [
    facturaLiquidada && "factura con saldo pendiente",
    !descripcion.trim() && "descripción",
    !conceptosValidos && "conceptos completos (descripción, cantidad y precio)",
    monto <= 0 && "importe mayor a cero",
    excedeSaldo && "monto dentro del saldo de la factura",
  ].filter((x): x is string => !!x);
  const faltantesTimbrar = sinUuid
    ? [...faltantesGuardar, "UUID fiscal de la factura original"]
    : faltantesGuardar;

  // YG-04: hay algo capturado que se perdería si se cierra el modal.
  const isDirty =
    !!descripcion.trim() ||
    conceptos.some((c) => c.descripcion.trim() !== "" || c.cantidad !== 1 || c.precio_unitario !== 0);

  const crearMut = useMutation({
    mutationFn: () => {
      // FIX-11: nunca sustituir TC ausente por 1 en monedas ≠ MXN — provoca cálculos MXN silenciosamente erróneos.
      const tcNormalizado = p.monedaFactura === "MXN" ? 1 : Number(p.tipoCambioFactura);
      if (!Number.isFinite(tcNormalizado) || tcNormalizado <= 0) {
        throw new Error("LC_TC_NO_DISPONIBLE: la factura no tiene tipo de cambio válido; refresca antes de emitir la NC.");
      }
      return crearNotaCredito({
        factura_id: p.facturaId,
        motivo,
        descripcion: descripcion.trim(),
        monto,
        moneda: p.monedaFactura,
        tipo_cambio: tcNormalizado,
        fecha_emision: fecha,
        uso_cfdi: usoCfdi,
        forma_pago: formaPago,
        conceptos,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: facturasKeys.notasCredito(p.facturaId) });
      qc.invalidateQueries({ queryKey: facturasKeys.notasCreditoRecientes() });
    },
    onError: (err) => {
      // `handleSubmit` ya notifica al usuario; el onError sólo satisface la
      // regla de arquitectura y deja huella en consola para diagnóstico.
      logger.warn("useNotaCreditoDraft", "crearNotaCredito failed", getErrorMessage(err));
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
      // YG-05: el usuario nunca ve el código crudo `LC_*` (jerga interna); el
      // catálogo de `getErrorMessage` lo traduce a español. El texto crudo
      // queda sólo en observabilidad para diagnóstico.
      const rawMsg = err instanceof Error ? err.message : String(err ?? "");
      logger.warn("useNotaCreditoDraft", "handleSubmit failed", rawMsg);
      notifyError(undefined, {
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
    faltantesGuardar, faltantesTimbrar, isDirty,
  };
}
