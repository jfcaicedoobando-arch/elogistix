/**
 * Lectura y edición de la organización a nivel super admin.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchAdminOrganization,
  establecerOrganizacionActiva,
  updateAdminOrganization,
} from "@/features/admin/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
export function useAdminOrgInfo(id: string | undefined) {
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editRfc, setEditRfc] = useState("");
  const [editPlan, setEditPlan] = useState("");

  const { data: org } = useQuery({
    queryKey: queryKeys.admin.org(id!),
    queryFn: () => fetchAdminOrganization(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (org) {
      setEditNombre(org.nombre);
      setEditRfc(org.rfc ?? "");
      setEditPlan(org.plan ?? "basic");
    }
  }, [org]);

  const updateOrg = useMutation({
    mutationFn: (payload: { nombre: string; rfc: string; plan: string }) =>
      updateAdminOrganization(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.org(id!) });
      notifySuccess(undefined, { title: "Organización actualizada" });
      setEditing(false);
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "Error al actualizar", description: error.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: (activo: boolean) => establecerOrganizacionActiva(id!, activo),
    onSuccess: (_, activo) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.org(id!) });
      notifySuccess(undefined, { title: activo ? "Organización activada" : "Organización desactivada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "Error", description: error.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });

  const cancelEditing = () => {
    setEditing(false);
    if (org) {
      setEditNombre(org.nombre);
      setEditRfc(org.rfc ?? "");
      setEditPlan(org.plan ?? "basic");
    }
  };

  const saveEditing = () =>
    updateOrg.mutate({ nombre: editNombre.trim(), rfc: editRfc.trim(), plan: editPlan });

  return {
    org,
    editing, setEditing,
    editNombre, setEditNombre,
    editRfc, setEditRfc,
    editPlan, setEditPlan,
    updateOrg, toggleActivo,
    cancelEditing, saveEditing,
  };
}
