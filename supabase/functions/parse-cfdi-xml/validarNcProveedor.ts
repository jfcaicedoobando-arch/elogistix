import type { AuthContext } from "../_shared/auth.ts";
import type { CfdiParsed } from "../_shared/cfdiParser.ts";
import { esUuid } from "../_shared/uuid.ts";

const normalizar = (valor: string | null | undefined) => (valor ?? "").trim().toUpperCase();

/** Prevalidación de identidad, no certificación del estado fiscal ante SAT. */
export function errorIdentidadNc(
  cfdi: CfdiParsed,
  destino: { rfcProveedor: string | null; rfcOrganizacion: string | null; uuidFactura: string | null },
): string | null {
  if (cfdi.tipo_comprobante !== "E") return "El XML debe ser un CFDI de egreso (nota de crédito).";
  if (!esUuid(cfdi.uuid)) return "La nota de crédito no contiene un UUID fiscal válido.";
  if (!normalizar(destino.rfcProveedor) || !normalizar(destino.rfcOrganizacion)) {
    return "Falta el RFC del proveedor o de la organización para verificar esta nota de crédito.";
  }
  if (normalizar(cfdi.emisor.rfc) !== normalizar(destino.rfcProveedor)) {
    return "El RFC emisor del XML no corresponde al proveedor de la factura seleccionada.";
  }
  if (normalizar(cfdi.receptor.rfc) !== normalizar(destino.rfcOrganizacion)) {
    return "El RFC receptor del XML no corresponde a la organización de la factura.";
  }
  const uuidFactura = normalizar(destino.uuidFactura);
  if (!esUuid(uuidFactura)) return "La factura seleccionada no tiene un UUID fiscal verificable para vincular este XML.";
  if (normalizar(cfdi.uuid) === uuidFactura) return "El UUID de la nota de crédito no puede ser el de la factura.";
  if (!(cfdi.relacionados ?? []).some((uuid) => normalizar(uuid) === uuidFactura)) {
    return "El XML no relaciona el UUID de la factura seleccionada.";
  }
  if (!Number.isFinite(cfdi.total) || cfdi.total <= 0) return "El importe de la nota de crédito debe ser positivo.";
  if (!["MXN", "USD", "EUR"].includes(cfdi.moneda)) return "La moneda del XML no está soportada.";
  return null;
}

/** Sólo lecturas, siempre después de autenticar y autorizar la organización. */
export async function validarNcProveedor(
  admin: AuthContext["adminClient"], orgId: string, facturaId: string, cfdi: CfdiParsed,
): Promise<string | null> {
  const factura = await admin.from("proveedor_facturas")
    .select("rfc_proveedor, uuid_fiscal, proveedor_id")
    .eq("id", facturaId).eq("organization_id", orgId).is("deleted_at", null).maybeSingle();
  if (factura.error) throw new Error("503:No se pudo verificar la factura de la nota de crédito.");
  if (!factura.data) return "La factura seleccionada no está disponible en esta organización.";
  const org = await admin.from("organizations").select("rfc").eq("id", orgId).maybeSingle();
  if (org.error) throw new Error("503:No se pudo verificar el RFC de la organización.");
  let rfcProveedor = factura.data.rfc_proveedor;
  if (!rfcProveedor) {
    const proveedor = await admin.from("proveedores").select("rfc")
      .eq("id", factura.data.proveedor_id).eq("organization_id", orgId).is("deleted_at", null).maybeSingle();
    if (proveedor.error) throw new Error("503:No se pudo verificar el RFC del proveedor.");
    rfcProveedor = proveedor.data?.rfc;
  }
  const error = errorIdentidadNc(cfdi, {
    rfcProveedor, rfcOrganizacion: org.data?.rfc, uuidFactura: factura.data.uuid_fiscal,
  });
  if (error) return error;
  const duplicada = await admin.from("proveedor_notas_credito").select("id")
    .eq("organization_id", orgId).ilike("uuid_fiscal", cfdi.uuid).is("deleted_at", null).limit(1);
  if (duplicada.error) throw new Error("503:No se pudo verificar si la nota de crédito ya está registrada.");
  return duplicada.data?.length ? "Ya existe una nota de crédito con este UUID en la organización." : null;
}
