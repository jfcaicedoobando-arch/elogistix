import { useQuery } from "@tanstack/react-query";
import {
  fetchEmbarquesPendientesAdmin,
  type EmbarquePendienteAdminItem,
  type EmbarquesPendientesAdminData,
} from "@/features/dashboard/services/embarquesPendientesAdmin";

export type { EmbarquePendienteAdminItem, EmbarquesPendientesAdminData };

export function useEmbarquesPendientesAdmin(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "embarques-pendientes-admin"],
    queryFn: fetchEmbarquesPendientesAdmin,
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
