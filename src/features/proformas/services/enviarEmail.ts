/**
 * Envío de proforma por email vía Edge Function `enviar-proforma-email`.
 * Extraído de `EnviarProformaDialog.tsx` (Block 1.6) para respetar la capa
 * componente → service → supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";

export interface EnviarProformaEmailInput {
  proformaId: string;
  destinatarios: { email: string }[];
  cc: string[];
  asunto: string;
  mensaje: string;
}

export interface EnviarProformaEmailResult {
  enlace_portal: string | null;
  estado: "enviado" | "parcial" | "fallido" | "pendiente";
  resultados: ResultadoDestinatario[];
}

interface ResultadoDestinatario {
  email: string;
  tipo: "to" | "cc";
  estado: "enviado" | "suprimido" | "pendiente" | "sin_confirmar";
}

interface EdgeResponse extends Omit<EnviarProformaEmailResult, "resultados"> {
  resultados?: ResultadoDestinatario[];
  error?: string;
}

const intentosEnMemoria = new Map<string, string>();

async function claveIntento(input: EnviarProformaEmailInput, userId: string | null) {
  const bytes = new TextEncoder().encode(JSON.stringify({ input, userId }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "lc:proforma-email:" + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function obtenerIntento(clave: string): string {
  try {
    const guardado = localStorage.getItem(clave);
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(clave, nuevo);
    return nuevo;
  } catch {
    const guardado = intentosEnMemoria.get(clave) ?? crypto.randomUUID();
    intentosEnMemoria.set(clave, guardado);
    return guardado;
  }
}

function confirmarIntento(clave: string, intento: string) {
  intentosEnMemoria.delete(clave);
  try {
    if (localStorage.getItem(clave) === intento) localStorage.removeItem(clave);
  } catch {
    // La confirmación sigue siendo válida si el navegador bloqueó el almacenamiento.
  }
}

export async function enviarProformaPorEmail(
  input: EnviarProformaEmailInput,
): Promise<EnviarProformaEmailResult> {
  const scope = captureAuthDataScope();
  const normalizado = {
    ...input,
    destinatarios: input.destinatarios.map(({ email }) => ({ email: email.trim().toLowerCase() })),
    cc: input.cc.map((email) => email.trim().toLowerCase()),
    asunto: input.asunto.trim(),
  };
  const clave = await claveIntento(normalizado, scope.userId);
  scope.assertCurrent();
  const intento = obtenerIntento(clave);
  const { data, error } = await supabase.functions.invoke<EdgeResponse>(
    "enviar-proforma-email",
    {
      body: {
        proforma_id: input.proformaId,
        intento_id: intento,
        destinatarios: normalizado.destinatarios,
        cc: normalizado.cc,
        asunto: normalizado.asunto,
        mensaje: input.mensaje,
      },
    },
  );
  scope.assertCurrent();
  if (error) throw new Error(error.message);
  if (!data?.estado) throw new Error(data?.error ?? "No se pudo confirmar el envío.");
  if (data.estado !== "pendiente") confirmarIntento(clave, intento);
  return { enlace_portal: data.enlace_portal, estado: data.estado, resultados: data.resultados ?? [] };
}
