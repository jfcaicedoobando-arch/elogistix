/**
 * Lectura y edición de la organización a nivel super admin.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import {
  fetchAdminOrganization,
  setOrganizationActivo,
  updateAdminOrganization,
} from "@/services/admin";

export function useAdminOrgInfo(id: string | undefined) {
  const { toast } = useToast();
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
      toast({ title: "Organización actualizada" });
      setEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: (activo: boolean) => setOrganizationActivo(id!, activo),
    onSuccess: (_, activo) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.org(id!) });
      toast({ title: activo ? "Organización activada" : "Organización desactivada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
