import { useQuery } from "@tanstack/react-query";
import {
  fetchLeaderboardRaw,
  computeLeaderboard,
  type LeaderboardRow,
} from "@/services/crm";
import { queryKeys } from "@/lib/query";

export function useLeaderboardVendedores() {
  return useQuery<LeaderboardRow[]>({
    queryKey: queryKeys.crm.leaderboard,
    queryFn: async () => {
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const raw = await fetchLeaderboardRaw(
        ahora.getFullYear(),
        ahora.getMonth() + 1,
        inicioMes,
      );
      return computeLeaderboard(raw);
    },
  });
}
