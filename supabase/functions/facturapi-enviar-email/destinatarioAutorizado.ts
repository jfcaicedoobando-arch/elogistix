/**
 * Resolución y autorización del destinatario del CFDI enviado por FacturApi.
 * Vive fuera de `index.ts` para acotar la complejidad del handler y el tamaño
 * del archivo (reglas de lint del proyecto).
 */
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { bloqueoDestinatarioOverride } from "./overrideDestinatario.ts";

type SbClient = ReturnType<typeof createClient>;

const TIPOS_FACTURACION = [
  "facturacion", "facturación", "cobranza", "contabilidad", "pagador",
  "administracion", "administración",
];

interface EmailResolucion {
  email: string | null;
  fuente: "override" | "contacto_facturacion" | "contacto_reciente" | "cliente" | "ninguna";
  emailSugerido: string | null;
}

async function fetchContactosYCliente(supabase: SbClient, clienteId: string) {
  const contactosPromise = supabase
    .from("contactos_cliente")
    .select("email, tipo, created_at")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null)
    .not("email", "is", null)
    .order("created_at", { ascending: false });
  const clientePromise = supabase.from("clientes").select("email").eq("id", clienteId).maybeSingle();

  const [contactosRes, clienteRes] = await Promise.all([contactosPromise, clientePromise]);
  const contactos = ((contactosRes?.data ?? []) as Array<{ email: string | null; tipo: string | null }>)
    .filter((c) => c.email && c.email.includes("@"));
  const facturacion = contactos.find((c) => {
    const t = (c.tipo ?? "").toLowerCase().trim();
    return TIPOS_FACTURACION.some((k) => t.includes(k));
  });
  const emailCliente = (clienteRes?.data?.email as string | null) ?? null;
  return { contactos, facturacion, emailCliente };
}

function elegirEmail(
  facturacion: { email: string | null } | undefined,
  primero: { email: string | null } | undefined,
  emailCliente: string | null,
): { email: string | null; fuente: EmailResolucion["fuente"] } {
  if (facturacion?.email) return { email: facturacion.email, fuente: "contacto_facturacion" };
  if (primero?.email) return { email: primero.email, fuente: "contacto_reciente" };
  if (emailCliente) return { email: emailCliente, fuente: "cliente" };
  return { email: null, fuente: "ninguna" };
}

async function resolveEmail(
  supabase: SbClient,
  clienteId: string,
  override: string | undefined,
): Promise<EmailResolucion> {
  const { contactos, facturacion, emailCliente } = clienteId
    ? await fetchContactosYCliente(supabase, clienteId)
    : { contactos: [], facturacion: undefined, emailCliente: null as string | null };

  const primero = contactos[0];
  const emailSugerido = facturacion?.email ?? primero?.email ?? emailCliente;

  if (override && override.includes("@")) {
    return { email: override.trim(), fuente: "override", emailSugerido };
  }
  const { email, fuente } = elegirEmail(facturacion, primero, emailCliente);
  return { email, fuente, emailSugerido };
}





function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export type DestinatarioOk = { email: string; emailDistintoSugerido: boolean };

/**
 * Resuelve y autoriza el destinatario del correo. Devuelve un `Response` de
 * error o el email final. Extraído del handler para mantener la complejidad
 * ciclomática bajo el límite del lint.
 */
export async function resolverDestinatarioAutorizado(args: {
  supabase: SbClient;
  json: (body: unknown, status?: number) => Response;
  userId: string;
  userEmail: string | undefined;
  organizationId: string;
  clienteId: string | null;
  emailSolicitado?: string;
}): Promise<Response | DestinatarioOk> {
  const { supabase, json, organizationId, clienteId } = args;
  const resolucion = await resolveEmail(supabase, clienteId ?? "", args.emailSolicitado);
  const email = resolucion.email;
  if (!email) return json({ error: "missing_email", message: "El cliente no tiene email registrado." }, 422);
  if (!isValidEmail(email)) return json({ error: "invalid_email", message: "Email inválido." }, 400);

  // B-4: destinatario manual ajeno al cliente exige rol con envío a terceros.
  if (resolucion.fuente === "override") {
    const bloqueo = await bloqueoDestinatarioOverride({
      supabase,
      userId: args.userId,
      userEmail: args.userEmail,
      organizationId,
      clienteId,
      email,
    });
    if (bloqueo) return json({ error: "forbidden_recipient", message: bloqueo }, 403);
  }
  return {
    email,
    emailDistintoSugerido: Boolean(
      resolucion.emailSugerido && email.toLowerCase() !== resolucion.emailSugerido.toLowerCase(),
    ),
  };
}

