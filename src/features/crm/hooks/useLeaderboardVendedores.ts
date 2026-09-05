import { useQuery } from "@tanstack/react-query";
import {
  fetchLeaderboardRaw,
  computeLeaderboard,
  type LeaderboardRow,
} from "@/features/crm/services";
import { queryKeys } from "@/lib/query";
import { ymMx, primerDiaMesMx, mxLocalToUtcIso } from "@/lib/date/mx";

export function useLeaderboardVendedores() {
  return useQuery<LeaderboardRow[]>({
    queryKey: queryKeys.crm.leaderboard,
    queryFn: async () => {
      // FIX-3 (auditoría): mes en curso con calendario LOCAL de México
      // convertido a ISO UTC, y límite superior exclusivo para no colar
      // cierres con fecha futura.
      const [anio, mes] = ymMx().split("-").map(Number);
      const inicioMes = mxLocalToUtcIso(`${primerDiaMesMx(0)}T00:00:00`) ?? primerDiaMesMx(0);
      const finMes = mxLocalToUtcIso(`${primerDiaMesMx(1)}T00:00:00`) ?? primerDiaMesMx(1);
      const raw = await fetchLeaderboardRaw(anio, mes, inicioMes, finMes);
      return computeLeaderboard(raw);
    },
  });
}
