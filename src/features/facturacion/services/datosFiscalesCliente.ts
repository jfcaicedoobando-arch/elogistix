/**
 * Servicio de datos fiscales del cliente y persistencia de elecciones de
 * timbrado en `facturas`. Aísla la lectura directa de `clientes` y la
 * actualización pre-timbrado del componente `DialogTimbrarFactura`.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import { unwrap, run, unwrapOr } from "@/lib/supabase/response";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";

export interface ClienteFiscalRow {
  rfc: string | null;
  codigo_postal: string | null;
  regimen_fiscal: string | null;
  uso_cfdi_default: string | null;
}

/** Mismo ambiente por organización que resuelve la edge; no lee credenciales. */
export async function fetchAmbienteEmision(organizationId: string): Promise<string | null> {
  const row = await unwrap(
    supabase.from("facturapi_credenciales").select("ambiente")
      .eq("organization_id", organizationId).maybeSingle(),
  );
  return row?.ambiente ?? null;
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

import type { DatosTimbradoPatch } from "../types/datosFiscales";
export type { DatosTimbradoPatch } from "../types/datosFiscales";

export async function actualizarDatosTimbradoFactura(
  facturaId: string,
  patch: DatosTimbradoPatch,
  /** N-06 (QA r2): bloqueo optimista opcional (`updated_at` leído al abrir el diálogo). */
  expectedUpdatedAt?: string | null,
): Promise<void> {
  let query = supabase.from("facturas").update(patch).eq("id", facturaId);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const filas = await unwrapOr(query.select("id"), []);
  if (filas.length === 0 && expectedUpdatedAt) throw conflictoConcurrenciaError();
  await registrarActividad({
    modulo: "facturacion",
    accion: "actualizar_datos_timbrado_factura",
    entidadId: facturaId,
    detalles: { ...patch },

  });
}

/**
 * Realinea la fecha de emisión de un borrador sin timbrar al día indicado; el
 * trigger del DOF recalcula el tipo de cambio de esa fecha.
 */
export async function realinearFechaEmisionBorrador(facturaId: string, fecha: string): Promise<void> {
  const filas = await unwrapOr(
    supabase.from("facturas").update({ fecha_emision: fecha })
      .eq("id", facturaId).is("uuid_fiscal", null).select("id"),
    [],
  );
  if (filas.length === 0) throw new Error("La factura ya no está en borrador; no se cambió la fecha.");
  await registrarActividad({
    modulo: "facturacion",
    accion: "realinear_fecha_emision_borrador",
    entidadId: facturaId,
    detalles: { fecha_emision: fecha },
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
