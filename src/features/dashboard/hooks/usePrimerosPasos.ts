import { useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { seleccionarPrimerosPasos } from "@/features/dashboard/domain/primerosPasos";
import { resolverRutasVisiblesPrimerosPasos } from "./primerosPasosMenu";

/** Sólo lee el contexto existente; la guía no carga ni modifica datos de negocio. */
export function usePrimerosPasos() {
  const auth = useAuth();
  const org = useOrganization();
  const permisos = usePermissions();
  const rutasVisibles = resolverRutasVisiblesPrimerosPasos(auth.role, auth.effectiveRole);
  const identidad = JSON.stringify([
    auth.user?.id ?? null, org.organizationId, auth.role, auth.effectiveRole,
  ]);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const resultado = seleccionarPrimerosPasos({
    userId: auth.user?.id ?? null,
    role: auth.role,
    effectiveRole: auth.effectiveRole,
    organizationId: org.organizationId,
    loading: auth.loading || org.loading || actualizando === identidad,
    profileError: auth.profileError,
    errorOrganizaciones: org.errorOrganizaciones,
    permisos,
    esRutaVisible: (pathname) => rutasVisibles.has(pathname),
  });

  const reintentar = async () => {
    setActualizando(identidad);
    try {
      if (resultado.estado === "error-organizaciones") org.reintentarCargaOrganizaciones();
      else if (resultado.estado === "error-perfil") await auth.refreshProfile();
    } catch {
      // El contexto conserva su estado de error; no sustituirlo por tareas previas.
    } finally {
      setActualizando((anterior) => anterior === identidad ? null : anterior);
    }
  };

  return {
    resultado,
    // Una identidad distinta no hereda la apertura ni la tarea expandida.
    claveContexto: identidad,
    reintentar,
  };
}
