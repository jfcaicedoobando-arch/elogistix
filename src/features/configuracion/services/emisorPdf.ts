/** Identidad comercial para PDFs internos, separada del emisor fiscal. */
import { supabase } from "@/integrations/supabase/client";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { getAuthSnapshot } from "@/lib/auth/authSnapshot";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { fetchEmisorEmpresa } from "./emisor";

/** Exige la organización persistida en el documento; nunca adopta otro tenant. */
export async function fetchEmisorDocumento(organizationId: string): Promise<EmisorInfo> {
  const scope = captureAuthOperationScope();
  if (!organizationId || organizationId !== scope.organizationId) {
    throw new Error("La organización del documento no coincide con la organización activa.");
  }

  // El loader fiscal comprueba org_scope incluso cuando reutiliza su caché.
  const emisor = await fetchEmisorEmpresa();
  scope.assertCurrent();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, nombre")
    .eq("id", organizationId)
    .maybeSingle();
  scope.assertCurrent();
  if (error) throw error;
  if (!data || data.id !== organizationId) {
    throw new Error("No se pudo identificar la organización del documento.");
  }

  // No se copian nombre/RFC de organizations a los campos fiscales.
  return { ...emisor, organizacionNombre: data.nombre.trim() || undefined };
}

/** Para reportes cuyo snapshot pertenece al ámbito capturado por el exportador. */
export async function fetchEmisorPdf(): Promise<EmisorInfo> {
  const scope = captureAuthOperationScope();
  if (!scope.organizationId) {
    throw new Error("Selecciona una organización antes de generar el PDF.");
  }
  return fetchEmisorDocumento(scope.organizationId);
}

/** A global report keeps neutral identity; only an authenticated platform scope is valid. */
export async function fetchEmisorReporte(organizationId: string | null): Promise<EmisorInfo | undefined> {
  if (organizationId !== null) return fetchEmisorDocumento(organizationId);
  const scope = captureAuthOperationScope();
  const auth = getAuthSnapshot();
  if (scope.organizationId !== null || !auth.userId || auth.effectiveRole !== "super_admin") {
    throw new Error("La organización del reporte no coincide con el ámbito activo.");
  }
  return undefined;
}

/** Resuelve la identidad persistida cuando el DTO del reporte conserva sólo el ID. */
export async function fetchEmisorEntidad(
  tabla: "proveedores" | "cuentas_bancarias" | "proveedor_facturas",
  entidadId: string,
): Promise<EmisorInfo> {
  const scope = captureAuthOperationScope();
  if (!entidadId || !scope.organizationId) {
    throw new Error("No se pudo identificar la organización del documento.");
  }
  const { data, error } = await supabase.from(tabla)
    .select("id, organization_id")
    .eq("id", entidadId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();
  scope.assertCurrent();
  if (error) throw error;
  if (!data || data.id !== entidadId || data.organization_id !== scope.organizationId) {
    throw new Error("La organización del documento no coincide con la organización activa.");
  }
  return fetchEmisorDocumento(data.organization_id);
}
