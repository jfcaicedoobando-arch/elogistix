import { useRef, useState } from "react";
import { useCrearFacturaManual } from "./useCrearFacturaManual";
import { useValidarLimiteCredito, registrarExcesoCredito, type ValidarLimiteResultado } from "@/features/cliente/hooks/useValidarLimiteCredito";
import { calcularTotalMxn } from "../utils/calcularTotalMxn";
import type { CrearFacturaManualInput } from "../services/facturaManual";
import { notifyError } from "@/lib/ui/appFeedback";

type Alerta = (ValidarLimiteResultado & { timbrar: boolean }) | null;
type Captura = { input: CrearFacturaManualInput; timbrarAlGuardar: boolean };

/** Una captura conserva su identidad y bloquea desde ANTES de validar crédito. */
export function useFacturaManualSubmit(p: {
  buildInput: () => { input: CrearFacturaManualInput } | null;
  puedeGuardar: boolean;
  puedeTimbrar: boolean;
  onSuccess: () => void;
}) {
  const crear = useCrearFacturaManual();
  const validarLimite = useValidarLimiteCredito();
  const fase = useRef<"idle" | "validando" | "confirmacion" | "guardando">("idle");
  const captura = useRef<Captura | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false);
  const [creditoAlerta, setAlerta] = useState<Alerta>(null);
  const liberar = () => { fase.current = "idle"; setOcupado(false); };
  const resetCaptura = () => {
    setRequestId(crypto.randomUUID()); captura.current = null; setAlerta(null); liberar();
  };
  const setCreditoAlerta = (alerta: Alerta) => {
    setAlerta(alerta);
    if (!alerta && fase.current === "confirmacion") liberar();
  };
  const ejecutar = () => {
    if (!captura.current) { liberar(); return; }
    fase.current = "guardando"; setOcupado(true);
    crear.mutate(captura.current, {
      onSuccess: () => { resetCaptura(); p.onSuccess(); },
      onSettled: liberar,
    });
  };
  const handleSubmit = async (timbrarAlGuardar: boolean) => {
    if (fase.current !== "idle" || !p.puedeGuardar || (timbrarAlGuardar && !p.puedeTimbrar)) return;
    const payload = p.buildInput();
    if (!payload) return;
    fase.current = "validando"; setOcupado(true);
    const input = { ...payload.input, requestId };
    captura.current = { input, timbrarAlGuardar };
    const total = calcularTotalMxn(input.conceptos, input.moneda, input.tipoCambio, input.tasaIva);
    if (total.tcFaltante) {
      notifyError(undefined, { title: "Captura un tipo de cambio válido", method: "FACTURA_MANUAL_TC" });
      liberar(); return;
    }
    try {
      const resultado = await validarLimite({ clienteId: input.clienteId,
        clienteNombre: input.clienteNombre, montoAdicionalMxn: total.mxn });
      if (resultado?.rebasa) {
        fase.current = "confirmacion"; setOcupado(false);
        setAlerta({ ...resultado, timbrar: timbrarAlGuardar });
        return;
      }
    } catch { /* La validación informativa conserva su política fail-open. */ }
    ejecutar();
  };
  const onConfirmarExceso = async () => {
    if (fase.current !== "confirmacion" || !creditoAlerta || !captura.current) return;
    fase.current = "guardando"; setOcupado(true);
    const { input } = captura.current;
    try {
      await registrarExcesoCredito({ clienteId: input.clienteId, clienteNombre: input.clienteNombre,
        totalProyectadoMxn: creditoAlerta.totalProyectadoMxn,
        limiteMxn: creditoAlerta.exposicion.limiteMxn ?? 0,
        excedenteMxn: creditoAlerta.excedentePotencialMxn, origen: "factura_manual" });
      setAlerta(null); ejecutar();
    } catch (error) {
      fase.current = "confirmacion"; setOcupado(false);
      notifyError(undefined, { title: "No se pudo confirmar el exceso de crédito", error, method: "FACTURA_MANUAL_CREDITO" });
    }
  };
  return { handleSubmit, onConfirmarExceso, creditoAlerta, setCreditoAlerta, resetCaptura,
    isPending: ocupado || crear.isPending };
}
