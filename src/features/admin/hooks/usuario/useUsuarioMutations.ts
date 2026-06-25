import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  createUserViaEdgeFunction,
  type CreateUserParams,
} from "@/features/admin/services/usuario";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateUserParams) => createUserViaEdgeFunction(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      notifySuccess(undefined, { title: "Usuario creado e invitación enviada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear usuario: ${error.message}`, error, method: "CREATE_USER" });
    },
  });
}
