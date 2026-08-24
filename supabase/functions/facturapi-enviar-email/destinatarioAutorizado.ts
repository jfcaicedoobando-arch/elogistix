/**
 * Resolución y autorización del destinatario del CFDI enviado por FacturApi.
 * Vive fuera de `index.ts` para acotar la complejidad del handler y el tamaño
 * del archivo (reglas de lint del proyecto).
 */
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveEmail } from "./destinatarioCliente.ts";
import { bloqueoDestinatarioOverride } from "./overrideDestinatario.ts";

type SbClient = ReturnType<typeof createClient>;

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export type DestinatarioOk = { email: string; emailDistintoSugerido: boolean };

/**
 * Resuelve y autoriza el destinatario del correo. Devuelve un `Response` de
 * error o el email final. Extraído del handler para mantener la complejidad
 * ciclomática bajo el límite del lint.
 */
async function resolverDestinatarioAutorizado(args: {
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

