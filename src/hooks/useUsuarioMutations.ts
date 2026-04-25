import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  createUserViaEdgeFunction,
  deleteUserViaEdgeFunctionAuth,
  type CreateUserParams,
} from "@/services/usuarioService";

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateUserParams) => createUserViaEdgeFunction(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUserViaEdgeFunctionAuth(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all });
    },
  });
}
