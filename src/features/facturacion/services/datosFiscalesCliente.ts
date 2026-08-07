/**
 * Servicio de datos fiscales del cliente y persistencia de elecciones de
 * timbrado en `facturas`. Aísla la lectura directa de `clientes` y la
 * actualización pre-timbrado del componente `DialogTimbrarFactura`.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import { unwrap, run } from "@/lib/supabase/response";

export interface ClienteFiscalRow {
  rfc: string | null;
  codigo_postal: string | null;
  regimen_fiscal: string | null;
  uso_cfdi_default: string | null;
}

export async function fetchClienteFiscal(clienteId: string): Promise<ClienteFiscalRow | null> {
  return unwrap(
    supabase
      .from("clientes")
      .select("rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
      .eq("id", clienteId)
      .maybeSingle(),
  ) as Promise<ClienteFiscalRow | null>;
}

export interface DatosTimbradoPatch {
  serie?: string;
  uso_cfdi: string;
  forma_pago: string;
  metodo_pago: string;
  dias_credito?: number;
  notas?: string | null;
  tipo_cambio?: number | null;
  fecha_emision?: string;
}

export async function actualizarDatosTimbradoFactura(
  facturaId: string,
  patch: DatosTimbradoPatch,
): Promise<void> {
  await run(supabase.from("facturas").update(patch).eq("id", facturaId));
  await registrarActividad({
    modulo: "facturacion",
    accion: "actualizar_datos_timbrado_factura",
    entidadId: facturaId,
    detalles: { ...patch },

  });
}

/**
 * Defaults de facturación por cliente (uso CFDI, forma/método de pago, CC de correo).
 *
 * Origen: preferencia guardada en `clientes.*_default`; si no existe, se usa
 * el valor de la última factura timbrada / último envío del mismo cliente.
 * La resolución vive en el RPC `obtener_defaults_facturacion_cliente`.
 */
export interface DefaultsFacturacionCliente {
  uso_cfdi: string | null;
  forma_pago: string | null;
  metodo_pago: string | null;
  cc_emails: string[] | null;
  destinatarios_emails: string[] | null;
}

export async function fetchDefaultsFacturacionCliente(
  clienteId: string,
): Promise<DefaultsFacturacionCliente | null> {
  const data = await unwrap(
    supabase.rpc("obtener_defaults_facturacion_cliente", { p_cliente_id: clienteId }),
  );
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as DefaultsFacturacionCliente | null;
}

/**
 * Persiste como preferencia del cliente los últimos valores usados al timbrar.
 * Best-effort: los errores se propagan al caller para logueo, pero no deben
 * romper el flujo de timbrado (el caller usa try/catch silencioso).
 */
export async function guardarDefaultsTimbradoCliente(
  clienteId: string,
  patch: { uso_cfdi_default?: string; forma_pago_default?: string; metodo_pago_default?: string },
): Promise<void> {
  await run(supabase.from("clientes").update(patch).eq("id", clienteId));
  await registrarActividad({
    modulo: "facturacion",
    accion: "guardar_defaults_timbrado_cliente",
    entidadId: clienteId,
    detalles: patch as Record<string, unknown>,
  });
}

export async function guardarDefaultsCcCliente(
  clienteId: string,
  ccEmails: string[],
): Promise<void> {
  await run(
    supabase.from("clientes").update({ email_cc_default: ccEmails }).eq("id", clienteId),
  );
  await registrarActividad({
    modulo: "facturacion",
    accion: "guardar_defaults_cc_cliente",
    entidadId: clienteId,
    detalles: { ccEmails },
  });
}

/**
 * Persiste los destinatarios manuales usados en el último envío (correos que
 * NO vienen de la ficha de contactos del cliente). Best-effort.
 */
export async function guardarDefaultsDestinatariosCliente(
  clienteId: string,
  emails: string[],
): Promise<void> {
  await run(
    supabase
      .from("clientes")
      .update({ email_destinatarios_default: emails })
      .eq("id", clienteId),
  );
  await registrarActividad({
    modulo: "facturacion",
    accion: "guardar_defaults_destinatarios_cliente",
    entidadId: clienteId,
    detalles: { emails },
  });
}
