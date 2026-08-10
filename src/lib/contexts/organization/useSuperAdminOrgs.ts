/**
 * RG7/RG9/RG19/RG21 (Ola 3) — lógica de tenant activo del super admin.
 * Extraída de `OrganizationContext.tsx` para respetar el límite de 200 líneas.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getSuperAdminOrg,
  listActiveOrganizations,
  setSuperAdminOrg,
} from "@/features/admin/services/organization";
import { safeLocalStorage, STORAGE_KEYS } from "@/lib/browserStorage";
import { logger } from "@/lib/observability/logger";
import type { Organization } from "./types";

export interface SuperAdminOrgState {
  organizations: Organization[];
  activeId: string | null;
  loading: boolean;
  errorOrganizaciones: boolean;
  reintentarCargaOrganizaciones: () => void;
  cambiarTenant: (id: string | null) => void;
}

export function useSuperAdminOrgs(enabled: boolean): SuperAdminOrgState {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorOrganizaciones, setError] = useState(false);
  const queryClient = useQueryClient();
  // RG19: token monotónico para que sólo el cambio de tenant MÁS RECIENTE haga
  // la limpieza final de caché (evita la carrera del doble clear).
  const tenantSeq = useRef(0);

  // RG7: try/catch/finally; antes un fallo dejaba `loading` en true para siempre
  // y el super admin quedaba atrapado sin lista ni forma de reintentar.
  const cargarOrganizaciones = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(false);
    try {
      const orgList = await listActiveOrganizations<Organization>();
      setOrganizations(orgList);
      const stored = safeLocalStorage.getItem(STORAGE_KEYS.superAdminActiveOrg);
      // El super admin administra la plataforma, NO es miembro de un tenant:
      // sólo se restaura la preferencia que él eligió explícitamente.
      let siguiente = stored && orgList.some((o) => o.id === stored) ? stored : null;
      // RG9: sin preferencia local, LEER la del servidor antes de tocar nada;
      // el arranque anterior la machacaba enviando `null`.
      if (!siguiente) {
        const serverId = await getSuperAdminOrg().catch((err: unknown) => {
          logger.warn("organization", "No se pudo leer el tenant activo del servidor", err);
          return null;
        });
        if (serverId && orgList.some((o) => o.id === serverId)) {
          siguiente = serverId;
          safeLocalStorage.setItem(STORAGE_KEYS.superAdminActiveOrg, serverId);
        }
      }
      setActiveId(siguiente);
      // Sólo se re-sincroniza el servidor cuando había preferencia local que
      // restaurar; sin ella NO se envía nada (RG9).
      if (stored) {
        await setSuperAdminOrg(siguiente).catch((err: unknown) =>
          logger.warn("organization", "No se pudo re-sincronizar el tenant activo", err),
        );
      }
    } catch (err) {
      logger.warn("organization", "Falló la carga de organizaciones del super admin", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void cargarOrganizaciones();
  }, [cargarOrganizaciones]);

  const cambiarTenant = useCallback(
    (id: string | null) => {
      setActiveId(id);
      if (id) safeLocalStorage.setItem(STORAGE_KEYS.superAdminActiveOrg, id);
      else safeLocalStorage.removeItem(STORAGE_KEYS.superAdminActiveOrg);
      // El tenant activo se persiste en el servidor: las RPC de agregación lo
      // resuelven con `org_scope()`. Se limpia la caché antes del round-trip y,
      // si sigue siendo el cambio más reciente, también después.
      const seq = ++tenantSeq.current;
      queryClient.clear();
      void setSuperAdminOrg(id)
        // RG21: antes el catch era silencioso y el tenant quedaba distinto
        // entre pestañas sin dejar rastro.
        .catch((err: unknown) =>
          logger.warn("organization", "No se pudo persistir el tenant activo en el servidor", err),
        )
        .finally(() => {
          if (seq === tenantSeq.current) queryClient.clear();
        });
    },
    [queryClient],
  );

  const reintentarCargaOrganizaciones = useCallback(() => {
    void cargarOrganizaciones();
  }, [cargarOrganizaciones]);

  return {
    organizations,
    activeId,
    loading,
    errorOrganizaciones,
    reintentarCargaOrganizaciones,
    cambiarTenant,
  };
}
