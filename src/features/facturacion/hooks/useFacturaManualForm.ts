/**
 * useFacturaManualForm — encapsula el estado + derivados + lógica de submit
 * de `DialogNuevaFacturaManual`. Reduce la complejidad ciclomática del componente
 * (Power of 10 #4) y permite testear los cálculos sin montar el UI.
 *
 * v13.313.0
 */
import { useMemo, useState } from "react";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { useFacturaManualSubmit } from "./useFacturaManualSubmit";
import { useClientesFiscalOpts } from "@/features/facturacion/hooks/useClientesFiscalOpts";
import {
  INITIAL_CONCEPTOS, INITIAL_FISCAL, facturaManualIsDirty, serieForMoneda, useFaltantesTimbrar, validarUsoClienteManual,
} from "@/features/facturacion/hooks/facturaManualFormDefaults";

export { serieForMoneda };
import { sumarSubtotales } from "@/lib/financial/financialUtils";
import { validarTcMxn } from "@/lib/financial/tcBanda";
import { formaPagoParaMetodo, validarFormaMetodoPago } from "@/lib/financial/formaMetodoPago";

import { todayLocalISO } from "@/lib/date/today";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import type { DatosFiscalesValue } from "@/features/facturacion/components/FacturaManualDatosFiscales";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

export function useFacturaManualForm(open: boolean, onClose?: () => void) {
  const { organizationId } = useOrgActiva();
  const tasaIva = useTasaIVA();
  const { data: clientes = [] } = useClientesFiscalOpts(organizationId, open);

  const [clienteId, setClienteId] = useState<string>("");
  const [fiscal, setFiscal] = useState<DatosFiscalesValue>(INITIAL_FISCAL);
  const [conceptos, setConceptos] = useState<ConceptoManualInput[]>(INITIAL_CONCEPTOS);
  const [notas, setNotas] = useState<string>("");

  const cliente = useMemo(() => clientes.find((c) => c.id === clienteId), [clientes, clienteId]);

  const onClienteChange = (id: string) => {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    setFiscal((prev) => ({
      ...prev,
      usoCfdi: c?.uso_cfdi_default ?? prev.usoCfdi,
      diasCredito: c?.dias_credito ?? 0,
    }));
  };

  const updateFiscal = (patch: Partial<DatosFiscalesValue>) =>
    setFiscal((prev) => {
      const next = { ...prev, ...patch };
      // Serie es derivada de la moneda: si cambió moneda, recalculamos serie.
      if (patch.moneda && patch.moneda !== prev.moneda) {
        next.serie = serieForMoneda(patch.moneda);
      }
      if (patch.metodoPago && patch.metodoPago !== prev.metodoPago) {
        next.formaPago = formaPagoParaMetodo(patch.metodoPago, next.formaPago);
      }
      return next;
    });

  const clienteIncompleto = !!cliente && (!cliente.rfc || !cliente.codigo_postal || !cliente.regimen_fiscal);
  const conceptosValidos = conceptos.every(
    (c) => c.descripcion.trim().length > 0 && Number(c.cantidad) > 0 && Number(c.precio_unitario) >= 0,
  );
  // B-11: una factura con total 0 (todos los conceptos a $0) no es facturable.
  const totalEstimado = sumarSubtotales(conceptos, (c) => ({
    cantidad: Number(c.cantidad), precioUnitario: Number(c.precio_unitario),
  }));
  // M-14: banda de plausibilidad del T/C (sólo cuando la factura no es en MXN).
  const tcFueraDeBanda = fiscal.moneda === "MXN" ? null : validarTcMxn(fiscal.tipoCambio);
  const puedeGuardar =
    !!cliente && conceptosValidos && fiscal.tipoCambio > 0 && totalEstimado > 0 && !tcFueraDeBanda;
  const errorFormaMetodo = validarFormaMetodoPago(fiscal.formaPago, fiscal.metodoPago)[0]?.message;
  const issuesUso = validarUsoClienteManual(cliente, fiscal.usoCfdi);
  const puedeTimbrar = puedeGuardar && !clienteIncompleto && !errorFormaMetodo && issuesUso.length === 0;
  const faltantesTimbrar = useFaltantesTimbrar(cliente, conceptosValidos, fiscal);


  const reset = () => {
    setClienteId("");
    setFiscal(INITIAL_FISCAL);
    setConceptos(INITIAL_CONCEPTOS);
    setNotas("");
  };

  const buildInput = () => {
    if (!cliente || !organizationId) return null;
    // Serie y fecha de emisión se resuelven aquí (nunca los edita el usuario):
    // — serie deriva de la moneda para no contaminar folios fiscales.
    // — fecha = hoy local MX en el momento del submit (SAT: timbrar dentro de 72 h).
    const serie = serieForMoneda(fiscal.moneda);
    const fechaEmision = todayLocalISO();
    return {
      input: {
        organizationId, clienteId: cliente.id, clienteNombre: cliente.nombre,
        rfcCliente: cliente.rfc ?? "",
        serie, usoCfdi: fiscal.usoCfdi,
        formaPago: fiscal.formaPago, metodoPago: fiscal.metodoPago,
        diasCredito: fiscal.diasCredito, fechaEmision,
        moneda: fiscal.moneda, tipoCambio: fiscal.tipoCambio,
        notas, conceptos, tasaIva,
      },
    };
  };

  const submit = useFacturaManualSubmit({ buildInput, puedeGuardar, puedeTimbrar,
    onSuccess: () => { reset(); onClose?.(); } });

  return {
    clienteId,
    clientes,
    cliente,
    onClienteChange,
    fiscal,
    updateFiscal,
    tasaIva,
    conceptos,
    setConceptos,
    notas,
    setNotas,
    isDirty: facturaManualIsDirty(clienteId, fiscal, conceptos, notas),
    reset: () => { reset(); submit.resetCaptura(); },
    clienteIncompleto,
    puedeGuardar,
    puedeTimbrar,
    faltantesTimbrar: [...faltantesTimbrar, ...issuesUso.map((i) => i.message), ...(tcFueraDeBanda ? ["tipo de cambio plausible"] : [])],
    tcFueraDeBanda,

    ...submit,
  };
}
