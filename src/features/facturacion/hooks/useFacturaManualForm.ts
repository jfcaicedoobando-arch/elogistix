/**
 * useFacturaManualForm — encapsula el estado + derivados + lógica de submit
 * de `DialogNuevaFacturaManual`. Reduce la complejidad ciclomática del componente
 * (Power of 10 #4) y permite testear los cálculos sin montar el UI.
 *
 * v13.313.0
 */
import { useMemo, useState } from "react";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { useCrearFacturaManual } from "@/features/facturacion/hooks/useCrearFacturaManual";
import { useClientesFiscalOpts, type ClienteFiscalOpt } from "@/features/facturacion/hooks/useClientesFiscalOpts";
import { calcularTotalMxn } from "@/features/facturacion/utils/calcularTotalMxn";
import { sumarSubtotales } from "@/lib/financial/financialUtils";
import { validarTcMxn } from "@/lib/financial/tcBanda";

import { useValidarLimiteCredito, registrarExcesoCredito, type ValidarLimiteResultado } from "@/features/cliente/hooks/useValidarLimiteCredito";
import { todayLocalISO } from "@/lib/date/today";
import { notifyError } from "@/lib/ui/appFeedback";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import type { DatosFiscalesValue } from "@/features/facturacion/components/FacturaManualDatosFiscales";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

/**
 * Serie oficial por moneda. La numeración fiscal es responsabilidad del sistema
 * — nunca se deja al usuario porque contamina folios (ver v13.301.58).
 */
export function serieForMoneda(m: DatosFiscalesValue["moneda"]): string {
  if (m === "USD") return "SF43718";
  if (m === "EUR") return "SF46410";
  return "A";
}

const INITIAL_FISCAL: DatosFiscalesValue = {
  serie: serieForMoneda("MXN"), fechaEmision: todayLocalISO(), diasCredito: 0, moneda: "MXN",
  usoCfdi: "G03", formaPago: "99", metodoPago: "PPD", tipoCambio: 1,
};

const INITIAL_CONCEPTOS: ConceptoManualInput[] = [
  { descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800", tipo_iva: "gravado_16" },
];

function useFaltantesTimbrar(
  cliente: ClienteFiscalOpt | undefined,
  conceptosValidos: boolean,
  fiscal: DatosFiscalesValue,
): string[] {
  return useMemo(
    () =>
      [
        !cliente && "cliente",
        !conceptosValidos && "conceptos válidos",
        
        fiscal.tipoCambio <= 0 && "tipo de cambio",
        cliente && (!cliente.rfc || !cliente.codigo_postal || !cliente.regimen_fiscal) &&
          "datos fiscales del cliente (RFC · CP · régimen)",
      ].filter((x): x is string => !!x),
    [cliente, conceptosValidos, fiscal.tipoCambio],
  );
}

export function useFacturaManualForm(open: boolean, onClose?: () => void) {
  const { organizationId } = useOrgActiva();
  const tasaIva = useTasaIVA();
  const crear = useCrearFacturaManual();
  const validarLimite = useValidarLimiteCredito();
  const { data: clientes = [] } = useClientesFiscalOpts(organizationId, open);

  const [clienteId, setClienteId] = useState<string>("");
  const [fiscal, setFiscal] = useState<DatosFiscalesValue>(INITIAL_FISCAL);
  const [conceptos, setConceptos] = useState<ConceptoManualInput[]>(INITIAL_CONCEPTOS);
  const [notas, setNotas] = useState<string>("");
  const [creditoAlerta, setCreditoAlerta] = useState<
    (ValidarLimiteResultado & { timbrar: boolean }) | null
  >(null);

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
  const puedeTimbrar = puedeGuardar && !clienteIncompleto;
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

  const ejecutarSubmit = (timbrarAlGuardar: boolean) => {
    const payload = buildInput();
    if (!payload) return;
    crear.mutate({ input: payload.input, timbrarAlGuardar }, { onSuccess: () => { reset(); onClose?.(); } });
  };

  const handleSubmit = async (timbrarAlGuardar: boolean) => {
    if (!cliente || !organizationId) return;
    const totalMxn = calcularTotalMxn(conceptos, fiscal.moneda, fiscal.tipoCambio, tasaIva);
    if (totalMxn.tcFaltante) {
      // FIX C6: sin TC confiable no se puede validar el crédito en MXN.
      notifyError(undefined, {
        title: "Captura un tipo de cambio válido",
        description: `La factura está en ${fiscal.moneda} y el tipo de cambio no es utilizable.`,
        method: "FACTURA_MANUAL_TC",
      });
      return;
    }
    try {
      const resultado = await validarLimite({
        clienteId: cliente.id, clienteNombre: cliente.nombre, montoAdicionalMxn: totalMxn.mxn,
      });
      if (resultado?.rebasa) {
        setCreditoAlerta({ ...resultado, timbrar: timbrarAlGuardar });
        return;
      }
    } catch { /* fail-open */ }
    ejecutarSubmit(timbrarAlGuardar);
  };

  const onConfirmarExceso = async () => {
    if (!creditoAlerta || !cliente) return;
    await registrarExcesoCredito({
      clienteId: cliente.id, clienteNombre: cliente.nombre,
      totalProyectadoMxn: creditoAlerta.totalProyectadoMxn,
      limiteMxn: creditoAlerta.exposicion.limiteMxn ?? 0,
      excedenteMxn: creditoAlerta.excedentePotencialMxn,
      origen: "factura_manual",
    });
    const timbrar = creditoAlerta.timbrar;
    setCreditoAlerta(null);
    ejecutarSubmit(timbrar);
  };

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
    creditoAlerta,
    setCreditoAlerta,
    clienteIncompleto,
    puedeGuardar,
    puedeTimbrar,
    faltantesTimbrar: tcFueraDeBanda ? [...faltantesTimbrar, "tipo de cambio plausible"] : faltantesTimbrar,
    tcFueraDeBanda,

    handleSubmit,
    onConfirmarExceso,
    isPending: crear.isPending,
  };
}
