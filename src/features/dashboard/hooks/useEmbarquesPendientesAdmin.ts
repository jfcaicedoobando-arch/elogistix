import { useQuery } from "@tanstack/react-query";
import {
  fetchEmbarquesPendientesAdmin,
  type EmbarquePendienteAdminItem,
  type EmbarquesPendientesAdminData,
} from "@/features/dashboard/services/embarquesPendientesAdmin";
import { queryKeys } from "@/lib/query";

;

export function useEmbarquesPendientesAdmin(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.embarquesPendientesAdmin.all,
    queryFn: fetchEmbarquesPendientesAdmin,
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
