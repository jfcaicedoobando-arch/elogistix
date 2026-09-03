/**
 * Estado y lógica de alta express de oportunidad.
 * Extraído de `QuickCreateOportunidadDialog.tsx` (Power of 10 — límite de
 * líneas por archivo).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCrearOportunidad, useEtapasPipeline } from "@/features/crm/hooks";
import { useClientesForSelect } from "@/features/cliente/hooks";
import {
  primeraEtapaAbierta,
  MSG_SIN_ETAPA_ABIERTA,
  type OrigenInicial,
} from "@/features/crm/domain/oportunidadFormHelpers";

/**
 * Borrador mínimo que viaja del alta express al formulario completo cuando el
 * usuario pulsa "Más campos →": sólo nombre y origen/ownership ya elegidos.
 */
export interface OportunidadQuickDraft {
  nombre: string;
  origen: OrigenInicial | null;
}

export type OrigenTipo = "prospecto" | "cliente";

interface Params {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function useQuickCreateOportunidad({ open, onOpenChange, onCreated }: Params) {
  const { user } = useAuth();
  const crear = useCrearOportunidad();
  const enviandoRef = useRef(false);
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };
  const [nombre, setNombre] = useState("");
  const [origenTipo, setOrigenTipo] = useState<OrigenTipo>("cliente");
  const [clienteId, setClienteId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [leadNombre, setLeadNombre] = useState("");
  // v13.823.51 — el dueño canónico del prospecto (igual que el formulario
  // completo): antes el quick create reasignaba la oportunidad a quien la
  // capturaba, robándole el prospecto a su vendedor.
  const [leadVendedorId, setLeadVendedorId] = useState<string | null>(null);
  const [leadVendedorEmail, setLeadVendedorEmail] = useState("");

  // Reset sólo en la transición real abierto -> cerrado (la confirmación de
  // descarte del shell mantiene `open` en true, así que no borra nada).
  const abiertoAntes = useRef(open);
  useEffect(() => {
    if (abiertoAntes.current && !open) {
      setNombre("");
      setOrigenTipo("cliente");
      setClienteId(""); setLeadId(""); setLeadNombre("");
      setLeadVendedorId(null); setLeadVendedorEmail("");
    }
    abiertoAntes.current = open;
  }, [open]);

  const limpiarOrigen = () => {
    setClienteId(""); setLeadId(""); setLeadNombre("");
    setLeadVendedorId(null); setLeadVendedorEmail("");
  };

  // v13.823.53 — sólo la primera etapa ABIERTA: antes se usaba `orden === 1`
  // (o `etapas[0]`) sin mirar el tipo, así que un pipeline con una etapa
  // terminal en la primera posición creaba oportunidades ganadas/perdidas.
  const etapaInicial = useMemo(() => primeraEtapaAbierta(etapas), [etapas]);
  const origenListo = origenTipo === "cliente" ? !!clienteId : !!leadId;

  /** Devuelve el mensaje de validación, o null si el formulario es válido. */
  const validar = (): string | null => {
    if (!nombre.trim()) return "Nombre requerido";
    if (!etapaInicial) return MSG_SIN_ETAPA_ABIERTA;
    if (!origenListo) return "Elige un prospecto o un cliente";
    return null;
  };

  /** Dueño de la oportunidad: el vendedor del prospecto, o el usuario actual. */
  const resolverVendedor = () => {
    if (origenTipo === "prospecto") {
      return {
        vendedor_id: leadVendedorId ?? user?.id ?? null,
        vendedor_email: leadVendedorEmail || user?.email || "",
      };
    }
    return { vendedor_id: user?.id ?? null, vendedor_email: user?.email ?? "" };
  };

  /** Lo capturado hasta ahora, para no perderlo al pasar al formulario completo. */
  const construirBorrador = (): OportunidadQuickDraft => {
    const nombreLimpio = nombre.trim();
    const cliente = clientes.find((c) => c.id === clienteId);
    if (origenTipo === "cliente" && cliente) {
      return { nombre: nombreLimpio, origen: { tipo: "cliente", id: cliente.id, nombre: cliente.nombre } };
    }
    if (origenTipo === "prospecto" && leadId) {
      return {
        nombre: nombreLimpio,
        origen: {
          tipo: "prospecto",
          id: leadId,
          nombre: leadNombre,
          vendedorId: leadVendedorId,
          vendedorEmail: leadVendedorEmail,
        },
      };
    }
    return { nombre: nombreLimpio, origen: null };
  };

  const submit = async () => {
    if (crear.isPending || enviandoRef.current) return;
    const invalido = validar();
    if (invalido) {
      notifyError(undefined, { title: invalido, method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADDIALOG_1" });
      return;
    }
    const n = nombre.trim();
    const cliente = clientes.find((c) => c.id === clienteId);
    enviandoRef.current = true;
    try {
      const r = await crear.mutateAsync({
        nombre: n,
        cliente_id: origenTipo === "cliente" ? (cliente?.id ?? null) : null,
        cliente_nombre: origenTipo === "cliente" ? (cliente?.nombre ?? "") : leadNombre,
        lead_id: origenTipo === "prospecto" ? leadId : null,
        etapa_id: etapaInicial!.id,
        moneda: "MXN",
        probabilidad: etapaInicial!.probabilidad_default ?? 10,
        ...resolverVendedor(),
      });
      notifySuccess(undefined, { title: "Oportunidad creada", duration: 2000 });
      // El cierre limpia el estado (efecto de transición): sin reset duplicado.
      onOpenChange(false);
      onCreated(r.id);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo crear la oportunidad", description: getErrorMessage(e),
        error: e,
        method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADDIALOG_3",
      });
    } finally {
      enviandoRef.current = false;
    }
  };

  return {
    nombre, setNombre,
    origenTipo, setOrigenTipo,
    clienteId, setClienteId,
    leadId, setLeadId, setLeadNombre,
    setLeadVendedorId, setLeadVendedorEmail,
    limpiarOrigen,
    etapaInicial, origenListo,
    clientes,
    crear,
    submit,
    construirBorrador,
  };
}
