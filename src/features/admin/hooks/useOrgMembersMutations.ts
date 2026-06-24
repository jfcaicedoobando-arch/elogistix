/**
 * Mutaciones para crear miembros nuevos dentro de una organización.
 *
 * Regla de negocio: un usuario sólo puede pertenecer a una organización.
 * Por eso NO exponemos un flujo para "agregar" usuarios existentes —
 * el alta crea un usuario nuevo vía edge function `user-management`
 * (action `create`) y lo inserta como miembro de la org destino.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import type { AppRole } from "@/types/appRole";

export interface CreateOrgMemberInput {
  organizationId: string;
  email: string;
  password: string;
  role: AppRole;
}

async function createOrgMember(input: CreateOrgMemberInput): Promise<void> {
  const { error } = await supabase.functions.invoke("user-management", {
    body: {
      action: "create",
      email: input.email,
      password: input.password,
      role: input.role,
      organization_id: input.organizationId,
    },
  });
  if (error) throw error;
}

export function useCreateOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrgMember,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(variables.organizationId) });
      qc.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(variables.organizationId) });
      notifySuccess(undefined, { title: "Miembro creado en la organización" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear miembro: ${error.message}`, error, method: "CREATE_ORG_MEMBER" });
    },
  });
}
