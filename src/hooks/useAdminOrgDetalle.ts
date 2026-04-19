import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlanes } from "@/hooks/usePlanes";
import { useConfiguracionByOrg } from "@/hooks/useConfiguracionOrg";
import { queryKeys } from "@/lib/queryKeys";
import type { AppRole } from "@/types/types";

export interface MemberRow {
  id: string;
  user_id: string;
  role: AppRole;
  email?: string;
}

export function useAdminOrgDetalle(id: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editRfc, setEditRfc] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const { data: planes = [] } = usePlanes();

  // Org data
  const { data: org } = useQuery({
    queryKey: queryKeys.admin.org(id!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (org) {
      setEditNombre(org.nombre);
      setEditRfc(org.rfc ?? "");
      setEditPlan(org.plan ?? "basic");
    }
  }, [org]);

  // Update org mutation
  const updateOrg = useMutation({
    mutationFn: async (payload: { nombre: string; rfc: string; plan: string }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ nombre: payload.nombre, rfc: payload.rfc, plan: payload.plan })
        .eq("id", id!);
      if (error) throw error;
    },
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
    mutationFn: async (activo: boolean) => {
      const { error } = await supabase
        .from("organizations")
        .update({ activo })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_, activo) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.org(id!) });
      toast({ title: activo ? "Organización activada" : "Organización desactivada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // KPI counts
  const { data: memberCount = 0 } = useQuery({
    queryKey: queryKeys.admin.orgCountMembers(id!),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: embarqueCount = 0 } = useQuery({
    queryKey: queryKeys.admin.orgCountEmbarques(id!),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("embarques")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: clienteCount = 0 } = useQuery({
    queryKey: queryKeys.admin.orgCountClientes(id!),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: cotizacionCount = 0 } = useQuery({
    queryKey: queryKeys.admin.orgCountCotizaciones(id!),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cotizaciones")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  // Members
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: queryKeys.admin.orgMembers(id!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role")
        .eq("organization_id", id!)
        .order("created_at");
      if (error) throw error;

      let emailMap: Record<string, string> = {};
      try {
        const { data: usersData } = await supabase.functions.invoke("list-users");
        if (Array.isArray(usersData)) {
          usersData.forEach((u: { id: string; email: string }) => {
            emailMap[u.id] = u.email;
          });
        }
      } catch { /* */ }

      return (data ?? []).map((m) => ({
        ...m,
        email: emailMap[m.user_id] || m.user_id,
      })) as MemberRow[];
    },
    enabled: !!id,
  });

  // Config
  const { data: configItems = [], isLoading: loadingConfig } = useConfiguracionByOrg(id ?? null);

  const grouped = configItems.reduce<Record<string, typeof configItems>>((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});

  // Mutations
  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("organization_members")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(id!) });
      toast({ title: "Rol actualizado" });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(id!) });
      toast({ title: "Miembro eliminado de la organización" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar miembro", description: error.message, variant: "destructive" });
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

  const saveEditing = () => {
    updateOrg.mutate({ nombre: editNombre.trim(), rfc: editRfc.trim(), plan: editPlan });
  };

  const invalidateMembers = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(id!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(id!) });
  };

  return {
    org,
    planes,
    editing, setEditing,
    editNombre, setEditNombre,
    editRfc, setEditRfc,
    editPlan, setEditPlan,
    addMemberOpen, setAddMemberOpen,
    updateOrg, toggleActivo,
    memberCount, embarqueCount, clienteCount, cotizacionCount,
    members, loadingMembers,
    configItems, loadingConfig, grouped,
    updateRole, removeMember,
    cancelEditing, saveEditing, invalidateMembers,
  };
}
