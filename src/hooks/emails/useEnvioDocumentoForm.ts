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
  type ContactoClienteEmail,
} from "@/features/cotizacion/services/envios";
import { queryKeys } from "@/lib/query";
import {
  EMAIL_RE,
  computeInitialPrecarga,
} from "@/hooks/emails/envioDocumentoInit";
import {
  computeDestinatarios,
  computeCcEmails,
} from "@/hooks/emails/envioDocumentoDerivados";
export type Contacto = ContactoClienteEmail;
export { EMAIL_RE } from "@/hooks/emails/envioDocumentoInit";
const EMPTY_CONTACTOS: readonly Contacto[] = Object.freeze([]);

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

  const { data, isLoading: loadingContactos, isSuccess: contactosResueltos } = useQuery({
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

  // RG17 (Ola 3): las refs se sincronizan en efecto, no durante el render.
  useEffect(() => {
    buildAsuntoInicialRef.current = buildAsuntoInicial;
    ccInicialRef.current = ccInicial;
    destInicialRef.current = destinatariosManualesInicial;
  });

  // Ola 9 · B7: la precarga corre UNA vez por apertura. Antes se re-ejecutaba
  // cada vez que la query de contactos refrescaba y borraba lo ya capturado.
  const precargadoRef = useRef(false);
  useEffect(() => {
    if (!open) precargadoRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || precargadoRef.current) return;
    // RG17: se precarga cuando la query YA resolvió, aunque venga vacía (un
    // cliente sin contactos no tiene nada más que esperar). Antes el flag nunca
    // se marcaba con 0 contactos y cualquier refresh pisaba las ediciones.
    if (clienteId && !contactosResueltos) return;
    precargadoRef.current = true;
    setAsunto(buildAsuntoInicialRef.current());
    setMensaje("");
    setEmailManual("");
    const { precargaCc, precargaDest, seleccionadosPre } = computeInitialPrecarga(
      contactos,
      ccInicialRef.current,
      destInicialRef.current,
      userEmail,
    );
    setCcManual(precargaCc.join(", "));
    setEmailsManualesAgregados(precargaDest);
    setSeleccionados(seleccionadosPre);
  }, [open, contactos, contactosResueltos, clienteId, ccInicialKey, destInicialKey, userEmail]);


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

  const destinatarios = useMemo(
    () => computeDestinatarios(contactos, seleccionados, emailsManualesAgregados),
    [contactos, seleccionados, emailsManualesAgregados],
  );

  const ccEmails = useMemo(
    () => computeCcEmails(user?.email, ccManual, destinatarios),
    [user?.email, ccManual, destinatarios],
  );


  return {
    contactos,
    loadingContactos,
    seleccionados,
    setSeleccionados,
    emailManual,
    setEmailManual,
    emailsManualesAgregados,
    agregarManual,
    pushManual,
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
