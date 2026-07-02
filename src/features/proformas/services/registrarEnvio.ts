/**
 * Servicio: registrar envío de proforma por email.
 *
 * Fase 1 (MVP): esta versión NO despacha el correo desde el servidor. Registra
 * el envío en `proforma_envios`, actualiza `proformas.enviada_at`/`enviada_por`
 * y devuelve un enlace `mailto:` con asunto y cuerpo prellenados que el usuario
 * abre en su cliente de correo.
 *
 * Fase 2 (pendiente): edge function `enviar-proforma-email` con Resend + PDF
 * adjunto + plantilla, análoga a `enviar-cotizacion-email` (ver CHANGELOG).
 */
import { supabase } from "@/integrations/supabase/client";

export interface EnvioProformaInput {
  proformaId: string;
  organizationId: string;
  destinatarios: string[];
  cc: string[];
  asunto: string;
  mensaje: string;
  snapshotTotales?: Record<string, unknown>;
}

export interface EnvioProformaResult {
  envioId: string | null;
  mailtoUrl: string;
}

function normalizarLista(xs: string[]): string[] {
  return xs.map((e) => e.trim()).filter((e) => e.length > 0);
}

function buildMailto(to: string[], cc: string[], asunto: string, mensaje: string): string {
  const params = new URLSearchParams();
  if (cc.length) params.set("cc", cc.join(","));
  if (asunto) params.set("subject", asunto);
  if (mensaje) params.set("body", mensaje);
  const qs = params.toString();
  return `mailto:${to.join(",")}${qs ? `?${qs}` : ""}`;
}

export async function registrarEnvioProforma(
  input: EnvioProformaInput,
): Promise<EnvioProformaResult> {
  const destinatarios = normalizarLista(input.destinatarios);
  const cc = normalizarLista(input.cc);
  if (destinatarios.length === 0) {
    throw new Error("Al menos un destinatario es requerido");
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;
  const userEmail = userData?.user?.email ?? null;

  const { data: envio, error: envioErr } = await supabase
    .from("proforma_envios")
    .insert({
      proforma_id: input.proformaId,
      organization_id: input.organizationId,
      enviado_por: userId,
      destinatarios: destinatarios.map((email) => ({ email })),
      cc,
      asunto: input.asunto,
      mensaje: input.mensaje,
      estado: "registrado",
      snapshot_totales: input.snapshotTotales ?? null,
    })
    .select("id")
    .single();

  if (envioErr) throw new Error(`No se pudo registrar el envío: ${envioErr.message}`);

  // SAFE-CAST: columnas nuevas de esta migración; el tipo generado aún no las conoce.
  const patch: Record<string, unknown> = {
    enviada_at: new Date().toISOString(),
    enviada_por: userId,
    ultimo_envio_email: destinatarios[0] ?? userEmail,
  };
  const { error: updErr } = await supabase
    .from("proformas")
    .update(patch as never)
    .eq("id", input.proformaId);
  if (updErr) {
    // No re-lanzamos: el envío ya quedó registrado. Log en consola solo dev.
    console.warn("[registrarEnvioProforma] update proformas falló:", updErr.message);
  }

  return {
    envioId: envio?.id ?? null,
    mailtoUrl: buildMailto(destinatarios, cc, input.asunto, input.mensaje),
  };
}
