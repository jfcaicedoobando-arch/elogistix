/**
 * useEnvioDocumentoForm — Estado unificado de envío de documentos por correo.
 *
 * Reutilizado por:
 *   - Cotizaciones (`useEnvioCotizacionForm`)
 *   - Facturas (`useEnviarFacturaEmail`)
 *   - Proformas (pendiente migración)
 *
 * Recibe `clienteId` y una función que construye el asunto inicial. Encapsula:
 *   - Carga de contactos con email.
 *   - Preselección del contacto principal / prioridad cliente.
 *   - Toggles, CC, emails manuales, memoria de sesión (asunto/mensaje).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  fetchContactosClienteConEmail,
  esContactoPrioridadCliente,
  CLIENTE_PRINCIPAL_ID,
  type ContactoClienteEmail,
} from "@/features/cotizacion/services/envios";
import { queryKeys } from "@/lib/query";
export type Contacto = ContactoClienteEmail;
const EMPTY_CONTACTOS: readonly Contacto[] = Object.freeze([]);
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EnvioFormState {
  contactos: Contacto[];
  loadingContactos: boolean;
  seleccionados: Record<string, boolean>;
  setSeleccionados: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  emailManual: string;
  setEmailManual: (v: string) => void;
  emailsManualesAgregados: string[];
  agregarManual: () => void;
  /** Agrega un correo manual sin depender del state `emailManual` (chip input). */
  pushManual: (email: string) => void;
  quitarManual: (e: string) => void;
  ccManual: string;
  setCcManual: (v: string) => void;
  asunto: string;
  setAsunto: (v: string) => void;
  mensaje: string;
  setMensaje: (v: string) => void;
  marcarEnviada: boolean;
  setMarcarEnviada: (v: boolean) => void;
  destinatarios: Array<{ email: string; nombre?: string; contacto_id?: string }>;
  ccEmails: string[];
  userEmail: string | null;
}

export function useEnvioDocumentoForm(
  open: boolean,
  clienteId: string | null,
  buildAsuntoInicial: () => string,
  /**
   * Correos CC a precargar cuando se abre el dialog (además del usuario logueado).
   * Se usa para heredar los CC de la última factura enviada al mismo cliente
   * (o los guardados como preferencia). Editable por el usuario.
   */
  ccInicial?: string[] | null,
  /**
   * Correos manuales (destinatarios que NO vienen de la ficha del cliente) a
   * precargar como badges cuando se abre el dialog. Se usa para heredar la
   * lista del último envío o de la preferencia del cliente. Editable.
   */
  destinatariosManualesInicial?: string[] | null,
): EnvioFormState {
  const { user } = useAuth();

  const { data, isLoading: loadingContactos } = useQuery({
    queryKey: queryKeys.clientes.contactos(clienteId ?? "_none_"),
    enabled: !!clienteId && open,
    queryFn: () => fetchContactosClienteConEmail(clienteId!),
  });
  const contactos = (data ?? EMPTY_CONTACTOS) as Contacto[];

  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({});
  const [emailManual, setEmailManual] = useState("");
  const [emailsManualesAgregados, setEmailsManualesAgregados] = useState<string[]>([]);
  const [ccManual, setCcManual] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [marcarEnviada, setMarcarEnviada] = useState(true);

  // Serializamos `ccInicial` a string estable para no re-disparar el efecto
  // cuando el caller reconstruye el array pero el contenido es idéntico.
  const ccInicialKey = (ccInicial ?? []).join(",");
  const destInicialKey = (destinatariosManualesInicial ?? []).join(",");

  // Refs a callbacks/arrays cuyo contenido se cubre con las keys de arriba.
  const buildAsuntoInicialRef = useRef(buildAsuntoInicial);
  const ccInicialRef = useRef(ccInicial);
  const destInicialRef = useRef(destinatariosManualesInicial);
  const userEmail = user?.email;
  buildAsuntoInicialRef.current = buildAsuntoInicial;
  ccInicialRef.current = ccInicial;
  destInicialRef.current = destinatariosManualesInicial;

  useEffect(() => {
    if (!open) return;
    setAsunto(buildAsuntoInicialRef.current());
    setMensaje("");
    setEmailManual("");
    // Precargamos CC con los correos heredados (última factura / preferencia
    // del cliente), excluyendo al usuario logueado (que ya se agrega solo).
    const userEmailLc = userEmail?.toLowerCase();
    const precargaCc = (ccInicialRef.current ?? [])
      .map((e) => e.trim())
      .filter((e) => EMAIL_RE.test(e) && e.toLowerCase() !== userEmailLc);
    setCcManual(precargaCc.join(", "));
    // Precargamos destinatarios manuales heredados, evitando duplicar los
    // emails que ya vengan de los contactos del cliente.
    const contactoEmails = new Set(contactos.map((c) => c.email.toLowerCase()));
    const precargaDest = (destInicialRef.current ?? [])
      .map((e) => e.trim())
      .filter((e) => EMAIL_RE.test(e) && !contactoEmails.has(e.toLowerCase()));
    // Dedupe manteniendo orden
    const seenDest = new Set<string>();
    setEmailsManualesAgregados(
      precargaDest.filter((e) => {
        const k = e.toLowerCase();
        if (seenDest.has(k)) return false;
        seenDest.add(k);
        return true;
      }),
    );
    const pre: Record<string, boolean> = {};
    const principal = contactos.find((c) => c.id === CLIENTE_PRINCIPAL_ID);
    const prioridad = contactos.find(esContactoPrioridadCliente);
    if (principal) pre[principal.id] = true;
    else if (prioridad) pre[prioridad.id] = true;
    setSeleccionados(pre);
  }, [open, contactos, ccInicialKey, destInicialKey, userEmail]);

  const agregarManual = () => {
    const v = emailManual.trim();
    if (!EMAIL_RE.test(v) || emailsManualesAgregados.includes(v)) {
      setEmailManual("");
      return;
    }
    setEmailsManualesAgregados((arr) => [...arr, v]);
    setEmailManual("");
  };
  const pushManual = (email: string) => {
    const v = email.trim();
    if (!EMAIL_RE.test(v)) return;
    setEmailsManualesAgregados((arr) =>
      arr.some((x) => x.toLowerCase() === v.toLowerCase()) ? arr : [...arr, v],
    );
  };
  const quitarManual = (e: string) =>
    setEmailsManualesAgregados((arr) => arr.filter((x) => x !== e));

  const destinatarios = useMemo(() => {
    const fromContactos = contactos
      .filter((c) => seleccionados[c.id])
      .map((c) => ({ email: c.email, nombre: c.contacto || c.nombre, contacto_id: c.id }));
    const fromManual = emailsManualesAgregados.map((e) => ({ email: e }));
    const seen = new Set<string>();
    return [...fromContactos, ...fromManual].filter((d) => {
      const k = d.email.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [contactos, seleccionados, emailsManualesAgregados]);

  const ccEmails = useMemo(() => {
    const base = user?.email ? [user.email] : [];
    const extra = ccManual.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => EMAIL_RE.test(e));
    const recipientSet = new Set(destinatarios.map((d) => d.email.toLowerCase()));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of [...base, ...extra]) {
      const k = e.toLowerCase();
      if (seen.has(k) || recipientSet.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out;
  }, [user?.email, ccManual, destinatarios]);

  return {
    contactos,
    loadingContactos,
    seleccionados,
    setSeleccionados,
    emailManual,
    setEmailManual,
    emailsManualesAgregados,
    agregarManual,
    quitarManual,
    ccManual,
    setCcManual,
    asunto,
    setAsunto,
    mensaje,
    setMensaje,
    marcarEnviada,
    setMarcarEnviada,
    destinatarios,
    ccEmails,
    userEmail: user?.email ?? null,
  };
}
